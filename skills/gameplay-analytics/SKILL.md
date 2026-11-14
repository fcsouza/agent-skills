---
name: gameplay-analytics
description: >-
  Covers player event tracking, session tracking, cohort retention (D1, D7, D30), ordered funnels and retention targets for a game backend on PostgreSQL with a Redis buffer. Use when instrumenting what players do in a game, measuring whether players come back, finding where new players drop out of the tutorial or first match, or setting retention targets.
---

# Gameplay Analytics

Events go from the game server into a Redis list, a single worker drains the list into PostgreSQL in batches, and retention and funnels run as SQL over the stored tables.

## Rules

1. **Name events `noun_verb`, snake_case, past tense for finished actions**: `level_completed`, `item_purchased`, `match_ended`. Keep a finite catalog in `templates/event-catalog.md`; an event not in the catalog does not ship.
2. **Every event carries `userId`, `sessionId`, `createdAt`, `version`, `platform`.** The client fills them. It drops events tracked before a session starts instead of filing them under a fake session id.
3. **Never block gameplay on analytics.** `track()` returns at once and never throws. A Redis outage loses events, not frames.
4. **Buffer in Redis, insert in batches.** `track()` does LPUSH. One worker per Redis key runs `flush()`, which reads the oldest batch from the list tail, inserts it, then trims it. The insert skips ids that already exist, so a crash between insert and trim replays safely. Two flushers on one key insert the same batch twice and trim twice, losing events.
5. **Track sessions explicitly: start, heartbeat, end.** Do not infer sessions from gaps between events. Players crash and lose network without sending `end`, so run `closeIdleSessions(db, idleMs)` on a schedule with `idleMs` set to a few heartbeat intervals.
6. **Retention is cohort-based.** A cohort is the UTC day of a player's first session. D<N> is the share of a cohort with a session on exactly cohort day + N. Report a cohort only after its day N has ended. "Players active yesterday" is DAU, not retention.
7. **Funnels are ordered.** A player counts at step K only after doing step K-1. Choose the key on purpose: `session_id` for flows that must finish in one sitting (tutorial, first match), `user_id` for flows across sessions (install to first purchase). The query is in `templates/retention-dashboard.md`.
8. **Store UTC, compute days in UTC.** Use `(now() AT TIME ZONE 'UTC')::date` for today. `CURRENT_DATE` follows the connection's time zone.
9. **Keep analytics tables apart from gameplay tables.** They are append-only, large and read by different queries.
10. **Tag experiments on the event, do not fork code paths for analytics.** Put `experimentId` and `variant` in `properties` and group by them in SQL.

## Setup

1. Install the packages (versions this skill was checked against: `drizzle-orm` 0.45.4, `ioredis` 6.0.0). Install your Postgres driver as `postgres-game-schema` describes.

   ```bash
   bun add drizzle-orm ioredis
   bun add -d drizzle-kit
   ```

2. Copy `boilerplate/analytics-schema.ts` into your schema directory, then generate and run the migration with `bunx drizzle-kit generate` and `bunx drizzle-kit migrate`.

3. Create one client per connected player. The caller owns both connections:

   ```typescript
   import { AnalyticsClient, type AnalyticsDb } from './analytics-client';
   import type Redis from 'ioredis';

   export const analyticsFor = (redis: Redis, db: AnalyticsDb, player: { id: string; platform: string }) =>
     new AnalyticsClient({ redis, db, userId: player.id, platform: player.platform, version: process.env.GAME_VERSION ?? 'dev' });
   ```

4. Instrument the game server. Do not await these calls:

   ```typescript
   analytics.trackSession('start');                    // on connect
   analytics.track('level_completed', { levelId: 'level_12', score: 4500, deaths: 3 });
   analytics.track('tutorial_step_completed', { step: 3, experimentId: 'onboarding_v2', variant: 'shortened' });
   analytics.trackSession('heartbeat');                // on a fixed interval while connected
   analytics.trackSession('end');                      // on disconnect
   ```

5. In one worker process, on a schedule: call `flush()` on one `AnalyticsClient` built for that worker (`await workerClient.flush()`; it drains until the list is empty and skips, with a log line, any buffered row that is not a valid event) and `await closeIdleSessions(db, idleMs)`. Nightly, store cohorts with `storeRetentionCohorts(db, n)` for n in 1, 7, 30, from `templates/retention-dashboard.md`.

## Retention targets

This skill gives no D1, D7 or D30 target numbers. A benchmark only compares if its source states the same definition of "day N" as rule 6, the same platform and the same genre. Set targets from your own baseline:

1. Ship with the cohort job running. Wait until at least four weekly sets of cohorts have matured past day 30.
2. For each of D1, D7 and D30, take the median `retention_pct` across those mature cohorts from `analytics_retention_cohorts`. That is the baseline.
3. Split the baseline by `platform` and by acquisition source before comparing; a new channel changes the mix, not the game.
4. Set a target as a change over the baseline that one release is meant to cause, and judge it only on cohorts that started after the release.
5. Alert when a mature cohort falls well below the baseline, not when a young cohort looks low.

## Pitfalls

- **Event explosion.** Do not track per-frame or per-input data. If you need positions, sample on a fixed interval and send them in one event.
- **PII in properties.** No emails, IPs or real names. Use the opaque player id; keep demographics in a separate protected table.
- **Sampling events, then counting players.** Dropping a share of events and scaling counts up breaks distinct-player counts and funnels. If volume forces sampling, sample whole players (hash the player id) and record the rate. Never sample session or purchase events.
- **Archiving the wrong table.** Retention reads first-seen from `analytics_sessions`. Archive old `analytics_events` rows, keep sessions, or every archived player re-enters as a new cohort.
- **Hard-coded funnels.** Keep step lists in configuration so designers change them without a deploy.
- **Independent step counts.** Counting each funnel event on its own counts players who skipped earlier steps. Use the ordered query.

## Files

- `boilerplate/analytics-schema.ts`: copy when adding the three analytics tables (events, sessions, stored retention cohorts) to a Drizzle schema.
- `boilerplate/analytics-client.ts`: copy when wiring `track()`, session tracking, the buffer flush and the idle-session closer. It takes the Drizzle database and the ioredis client as parameters, so it works with any Drizzle Postgres driver.
- `templates/retention-dashboard.md`: read when writing retention, funnel, session-length or DAU/MAU queries. Every query in it was run on PostgreSQL 16.
- `templates/event-catalog.md`: copy when starting the list of events the team agrees to track.
- `references/sources.md`: read when you need the doc pages behind the Redis and PostgreSQL behaviour this skill relies on.

## Related skills

- `postgres-game-schema` (base schema, players table, Drizzle setup)
- `redis-game-patterns` (Redis connection)
- `bullmq-game-queues` (scheduled flush and nightly cohort jobs)
