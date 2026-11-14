# Retention Dashboard Queries

SQL for the tables in `boilerplate/analytics-schema.ts`. Each block was run on PostgreSQL 16.

Conventions every query relies on:

- Timestamps are `timestamp` without time zone and hold UTC. Drizzle writes a JS `Date` as UTC.
- "Today" is `(now() AT TIME ZONE 'UTC')::date`, never `CURRENT_DATE`. `CURRENT_DATE` follows the session `TimeZone` setting, so it shifts the day boundary per connection.
- `x::date` on a `timestamp` column ignores the session time zone, so cohort and return days are UTC days.
- Pass numbers as bound parameters (`${dayOffset}::int` in a Drizzle `sql` template), not with `sql.raw`.
- `db.execute()` returns a different shape per driver: postgres-js returns the rows as an array; node-postgres and neon-http return an object with `rows`. Read the result accordingly, or keep the work in SQL as the cohort job below does.

---

## D1 / D7 / D30 retention by cohort

A player's cohort is the UTC day of their first session. D<N> retention is the share of a cohort with at least one session on exactly cohort day + N.

```sql
-- $1 = N (1, 7, 30)
WITH cohorts AS (
  SELECT user_id, MIN(started_at)::date AS cohort_date
  FROM analytics_sessions
  GROUP BY user_id
),
returned AS (
  SELECT DISTINCT c.user_id
  FROM cohorts c
  JOIN analytics_sessions s
    ON s.user_id = c.user_id AND s.started_at::date = c.cohort_date + $1::int
)
SELECT c.cohort_date,
       COUNT(*)          AS total_users,
       COUNT(r.user_id)  AS retained_users,
       ROUND(100.0 * COUNT(r.user_id) / NULLIF(COUNT(*), 0), 2) AS retention_pct
FROM cohorts c
LEFT JOIN returned r ON r.user_id = c.user_id
WHERE c.cohort_date + $1::int < (now() AT TIME ZONE 'UTC')::date
GROUP BY c.cohort_date
ORDER BY c.cohort_date DESC
LIMIT 30;
```

Why each part is there:

- `date + integer` returns a `date`. `date + interval` returns a `timestamp`, which compares but reads as a different type.
- The `WHERE` drops cohorts whose day N has not finished. Without it, the newest cohorts report 0% and drag the average down.
- `DISTINCT` counts a player with several sessions on day N once.
- First-seen comes from `analytics_sessions`. If you archive old session rows, the archived players get a new, later cohort. Archive `analytics_events`, keep `analytics_sessions`, or take the cohort day from your players table's creation date.

## Store cohorts nightly

One statement computes and upserts, so it does not depend on the driver's result shape. Run it once per N from a scheduled job (see the `bullmq-game-queues` skill).

```typescript
import { sql } from 'drizzle-orm';
import type { AnalyticsDb } from './analytics-client';

export const storeRetentionCohorts = (db: AnalyticsDb, dayOffset: number) =>
  db.execute(sql`
    WITH cohorts AS (
      SELECT user_id, MIN(started_at)::date AS cohort_date
      FROM analytics_sessions GROUP BY user_id
    ),
    returned AS (
      SELECT DISTINCT c.user_id
      FROM cohorts c
      JOIN analytics_sessions s
        ON s.user_id = c.user_id AND s.started_at::date = c.cohort_date + ${dayOffset}::int
    )
    INSERT INTO analytics_retention_cohorts (cohort_date, day, total_users, retained_users)
    SELECT c.cohort_date, ${dayOffset}::int, COUNT(*), COUNT(r.user_id)
    FROM cohorts c LEFT JOIN returned r ON r.user_id = c.user_id
    WHERE c.cohort_date + ${dayOffset}::int < (now() AT TIME ZONE 'UTC')::date
    GROUP BY c.cohort_date
    ON CONFLICT (cohort_date, day) DO UPDATE
    SET total_users = EXCLUDED.total_users, retained_users = EXCLUDED.retained_users
  `);

// Nightly: for (const n of [1, 7, 30]) await storeRetentionCohorts(db, n);
```

The dashboard then reads the small table:

```sql
SELECT cohort_date, day, total_users, retained_users,
       ROUND(100.0 * retained_users / NULLIF(total_users, 0), 2) AS retention_pct
FROM analytics_retention_cohorts
ORDER BY cohort_date DESC, day;
```

---

## Funnel drop-off, ordered

A player counts at step K only if they did step K after step K-1. Counting each event on its own overstates later steps: players who skipped the tutorial still show up at "tutorial completed".

Key the funnel by `session_id` for flows that must finish in one sitting (tutorial, first match). Key it by `user_id` for flows that span sessions (install to first purchase). The same events give different numbers: a player who starts the tutorial, quits, and finishes it the next day completes the `user_id` funnel and drops out of the `session_id` funnel.

```typescript
import { type SQL, sql } from 'drizzle-orm';

type FunnelKey = 'user_id' | 'session_id';

export const funnelQuery = (steps: string[], key: FunnelKey, since: Date): SQL => {
  if (steps.length < 2) throw new Error('A funnel needs at least 2 steps');
  const k = sql.identifier(key);
  const step = (i: number) => sql.identifier(`step_${i}`);
  const ctes = steps.map((eventName, i) =>
    i === 0
      ? sql`${step(i)} AS (
          SELECT ${k} AS k, MIN(created_at) AS t
          FROM analytics_events
          WHERE event_name = ${eventName} AND created_at >= ${since.toISOString()}::timestamp
          GROUP BY ${k})`
      : sql`${step(i)} AS (
          SELECT e.${k} AS k, MIN(e.created_at) AS t
          FROM analytics_events e
          JOIN ${step(i - 1)} p ON e.${k} = p.k AND e.created_at > p.t
          WHERE e.event_name = ${eventName}
          GROUP BY e.${k})`,
  );
  const counts = steps.map(
    (_, i) => sql`(SELECT COUNT(*) FROM ${step(i)})::int AS ${step(i)}`,
  );
  return sql`WITH ${sql.join(ctes, sql`, `)} SELECT ${sql.join(counts, sql`, `)}`;
};

// One row: { step_0, step_1, ... }. Drop-off at K = step_(K-1) - step_K.
// const result = await db.execute(
//   funnelQuery(['tutorial_started', 'tutorial_completed', 'level_started'], 'session_id', since),
// );
```

Taking the earliest match of each step after the previous one finds every player who did the steps in order. Store funnel step lists as configuration, not code, so designers can change them without a deploy.

---

## Session duration distribution

Run `closeIdleSessions()` from `boilerplate/analytics-client.ts` first, or crashed sessions never get an `ended_at` and drop out.

```sql
SELECT
  CASE
    WHEN d < 60   THEN '< 1 min'
    WHEN d < 300  THEN '1-5 min'
    WHEN d < 900  THEN '5-15 min'
    WHEN d < 1800 THEN '15-30 min'
    WHEN d < 3600 THEN '30-60 min'
    ELSE '60+ min'
  END AS duration_bucket,
  COUNT(*) AS session_count,
  ROUND(AVG(d)::numeric, 1) AS avg_seconds
FROM (
  SELECT EXTRACT(EPOCH FROM (ended_at - started_at)) AS d
  FROM analytics_sessions
  WHERE ended_at IS NOT NULL
) s
GROUP BY duration_bucket
ORDER BY MIN(d);
```

## Top events, last 7 days

Use it to check new instrumentation: an event missing from this list never fired.

```sql
SELECT event_name, COUNT(*) AS event_count, COUNT(DISTINCT user_id) AS unique_users
FROM analytics_events
WHERE created_at >= (now() AT TIME ZONE 'UTC') - interval '7 days'
GROUP BY event_name
ORDER BY event_count DESC
LIMIT 20;
```

## DAU, MAU and DAU/MAU

```sql
-- DAU per UTC day, last 30 days
SELECT started_at::date AS day, COUNT(DISTINCT user_id) AS dau
FROM analytics_sessions
WHERE started_at >= (now() AT TIME ZONE 'UTC') - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- Average DAU over the window divided by MAU over the same window
WITH daily AS (
  SELECT started_at::date AS day, COUNT(DISTINCT user_id) AS dau
  FROM analytics_sessions
  WHERE started_at >= (now() AT TIME ZONE 'UTC') - interval '30 days'
  GROUP BY day
),
monthly AS (
  SELECT COUNT(DISTINCT user_id) AS mau
  FROM analytics_sessions
  WHERE started_at >= (now() AT TIME ZONE 'UTC') - interval '30 days'
)
SELECT ROUND(100.0 * AVG(daily.dau) / NULLIF((SELECT mau FROM monthly), 0), 2) AS dau_mau_pct
FROM daily;
```

DAU counts who played on a day. It is not retention: it mixes new and returning players.
