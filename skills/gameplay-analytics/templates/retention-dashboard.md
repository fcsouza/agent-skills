# Retention Dashboard Queries

Pre-built Drizzle ORM queries for common analytics dashboards. Each query includes the raw SQL equivalent for reference and can be adapted to your reporting needs.

## Setup

```typescript
import { db } from './db';
import { sql, eq, gte, lte, and, desc, count, countDistinct } from 'drizzle-orm';
import {
  analyticsEvents,
  analyticsSessions,
  analyticsRetentionCohorts,
} from './analytics-schema';
```

---

## D1 / D7 / D30 Retention by Cohort

Cohort-based retention: for each registration date, what percentage of users returned on day 1, 7, and 30.

This query assumes you have a `players` table with `createdAt` as the registration date. It computes retention by joining first-seen dates against subsequent session dates.

```typescript
const retentionByDay = async (dayOffset: number) => {
  const result = await db.execute(sql`
    WITH cohorts AS (
      SELECT
        user_id,
        DATE(MIN(started_at)) AS cohort_date
      FROM analytics_sessions
      GROUP BY user_id
    ),
    returning_users AS (
      SELECT DISTINCT
        c.cohort_date,
        s.user_id
      FROM cohorts c
      INNER JOIN analytics_sessions s ON s.user_id = c.user_id
        AND DATE(s.started_at) = c.cohort_date + INTERVAL '${sql.raw(String(dayOffset))} days'
    )
    SELECT
      c.cohort_date,
      COUNT(DISTINCT c.user_id) AS total_users,
      COUNT(DISTINCT r.user_id) AS retained_users,
      ROUND(
        COUNT(DISTINCT r.user_id)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0) * 100,
        2
      ) AS retention_pct
    FROM cohorts c
    LEFT JOIN returning_users r ON r.cohort_date = c.cohort_date
    GROUP BY c.cohort_date
    ORDER BY c.cohort_date DESC
    LIMIT 30
  `);

  return result;
};

// Usage
const d1 = await retentionByDay(1);
const d7 = await retentionByDay(7);
const d30 = await retentionByDay(30);
```

### Saving Pre-computed Cohorts

Run this on a scheduled job (daily) to populate the `analyticsRetentionCohorts` table for fast dashboard reads:

```typescript
import { analyticsRetentionCohorts } from './analytics-schema';

const computeAndStoreCohort = async (dayOffset: number) => {
  const rows = await retentionByDay(dayOffset);

  for (const row of rows) {
    await db
      .insert(analyticsRetentionCohorts)
      .values({
        cohortDate: row.cohort_date,
        day: dayOffset,
        totalUsers: Number(row.total_users),
        retainedUsers: Number(row.retained_users),
      })
      .onConflictDoUpdate({
        target: [analyticsRetentionCohorts.cohortDate, analyticsRetentionCohorts.day],
        set: {
          totalUsers: Number(row.total_users),
          retainedUsers: Number(row.retained_users),
        },
      });
  }
};

// Run daily via cron or BullMQ scheduled job
await computeAndStoreCohort(1);
await computeAndStoreCohort(7);
await computeAndStoreCohort(30);
```

---

## Session Duration Distribution

Understand how long players stay per session. Returns bucketed session durations.

```typescript
const sessionDurationDistribution = async () => {
  const result = await db.execute(sql`
    SELECT
      CASE
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 60 THEN '< 1 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 300 THEN '1-5 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 900 THEN '5-15 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 1800 THEN '15-30 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 3600 THEN '30-60 min'
        ELSE '60+ min'
      END AS duration_bucket,
      COUNT(*) AS session_count,
      ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))::numeric, 1) AS avg_seconds
    FROM analytics_sessions
    WHERE ended_at IS NOT NULL
    GROUP BY duration_bucket
    ORDER BY MIN(EXTRACT(EPOCH FROM (ended_at - started_at)))
  `);

  return result;
};
```

---

## Top Events by Frequency

Most common events over a given time window. Useful for verifying instrumentation and spotting anomalies.

```typescript
const topEvents = async (days = 7, limit = 20) => {
  const since = new Date(Date.now() - days * 86400000);

  const result = await db
    .select({
      eventName: analyticsEvents.eventName,
      eventCount: count(),
      uniqueUsers: countDistinct(analyticsEvents.userId),
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.eventName)
    .orderBy(desc(count()))
    .limit(limit);

  return result;
};
```

---

## Daily Active Users (DAU) / Monthly Active Users (MAU)

```typescript
const dauMau = async (days = 30) => {
  const result = await db.execute(sql`
    SELECT
      DATE(started_at) AS day,
      COUNT(DISTINCT user_id) AS dau
    FROM analytics_sessions
    WHERE started_at >= NOW() - INTERVAL '${sql.raw(String(days))} days'
    GROUP BY DATE(started_at)
    ORDER BY day DESC
  `);

  return result;
};

const mau = async () => {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id) AS mau
    FROM analytics_sessions
    WHERE started_at >= NOW() - INTERVAL '30 days'
  `);

  return result;
};

// DAU/MAU ratio (stickiness)
const stickiness = async () => {
  const result = await db.execute(sql`
    WITH daily AS (
      SELECT
        DATE(started_at) AS day,
        COUNT(DISTINCT user_id) AS dau
      FROM analytics_sessions
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(started_at)
    ),
    monthly AS (
      SELECT COUNT(DISTINCT user_id) AS mau
      FROM analytics_sessions
      WHERE started_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      ROUND(AVG(daily.dau)::numeric / NULLIF((SELECT mau FROM monthly), 0) * 100, 2) AS stickiness_pct
    FROM daily
  `);

  return result;
};
```

---

## Funnel Drop-off Analysis

Configurable funnel: pass an ordered array of event names and get drop-off per step.

```typescript
const funnelAnalysis = async (
  steps: string[],
  days = 30,
) => {
  if (steps.length < 2) throw new Error('Funnel needs at least 2 steps');

  const since = new Date(Date.now() - days * 86400000);

  // Get unique users who completed each step
  const stepCounts: { step: string; users: number; dropOff: number; dropOffPct: number }[] = [];

  let previousUsers = 0;

  for (let i = 0; i < steps.length; i++) {
    const result = await db
      .select({
        uniqueUsers: countDistinct(analyticsEvents.userId),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventName, steps[i]),
          gte(analyticsEvents.createdAt, since),
        ),
      );

    const users = Number(result[0]?.uniqueUsers ?? 0);
    const dropOff = i === 0 ? 0 : previousUsers - users;
    const dropOffPct = i === 0 ? 0 : previousUsers > 0
      ? Math.round((dropOff / previousUsers) * 10000) / 100
      : 100;

    stepCounts.push({
      step: steps[i],
      users,
      dropOff,
      dropOffPct,
    });

    previousUsers = users;
  }

  return stepCounts;
};

// Usage: onboarding funnel
const onboardingFunnel = await funnelAnalysis([
  'session_started',
  'tutorial_step_completed',
  'level_started',
  'level_completed',
  'item_purchased',
]);

// Usage: match engagement funnel
const matchFunnel = await funnelAnalysis([
  'match_started',
  'match_ended',
  'match_started', // started a second match (re-engagement)
]);
```

---

## Notes

- **Performance**: For large event tables (millions of rows), add `createdAt` range partitioning and create materialized views for dashboards that run on a schedule.
- **Pre-aggregation**: Run the retention cohort computation and DAU/MAU as scheduled jobs (daily via BullMQ), then query the pre-computed `analyticsRetentionCohorts` table for instant dashboard loads.
- **Time zones**: All timestamps should be stored in UTC. Convert to the user's timezone only at the presentation layer.
- **Sampling**: If event volume is extreme, add a `WHERE properties->>'sampled' = 'true'` filter and scale counts by the inverse sampling rate.
