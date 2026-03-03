---
name: gameplay-analytics
description: >-
  Use when tracking player events, implementing retention analytics, building engagement funnels, measuring D1/D7/D30 retention, or setting up gameplay telemetry. Triggers: analytics, telemetry, events, retention, D1 D7 D30, funnel, engagement, session tracking, player behavior.
---

# Gameplay Analytics

## Purpose

Genre-agnostic gameplay analytics for tracking player events, measuring retention (D1/D7/D30), building engagement funnels, session analysis, and A/B testing hooks. Uses Drizzle ORM + PostgreSQL for storage and Redis for high-throughput event buffering.

## When to Use

Trigger: analytics, telemetry, player events, retention, D1/D7/D30, funnel analysis, engagement metrics, session tracking, player behavior, DAU, MAU, cohort analysis, A/B testing, event tracking

## Prerequisites

- `postgres-game-schema` for base database schema and Drizzle configuration
- `redis-game-patterns` for Redis connection and buffering infrastructure

## Core Principles

> Will Wright: "I'm a big believer in metrics. You can have the best intuition in the world, but if you're not measuring what players actually do, you're designing blind."
> Raph Koster: "The game is not what the designer thinks it is. The game is what the player does."
> Amy Jo Kim: "Retention is not a metric to optimize. It's a signal that players are finding sustained meaning in your system."

1. **Use `noun_verb` naming for all events** — `level_completed`, `item_purchased`, `match_ended`. Consistent naming makes querying, filtering, and building dashboards trivial. Never use camelCase or free-form strings.

2. **Every event carries required context** — `userId`, `sessionId`, `timestamp`, `version`, `platform`. Without these five fields, an event is unanalyzable. Enforce this at the client level, not as a DB constraint, so malformed events are logged rather than dropped.

3. **Buffer events in Redis before writing to PostgreSQL** — game clients produce high-frequency events; writing each one directly to the database creates unsustainable write pressure. LPUSH events to a Redis list, then drain the buffer in batches via a worker. See `boilerplate/analytics-client.ts`.

4. **Track sessions explicitly: start, heartbeat, end** — don't infer sessions from event gaps. Send a `session_started` event on connect, `session_heartbeat` every 30-60 seconds, and `session_ended` on disconnect. Use a server-side idle timeout (5 minutes) to close orphaned sessions.

5. **Compute retention as cohort analysis, not rolling windows** — D1/D7/D30 retention groups players by their registration date (cohort) and measures what fraction returned on day 1, 7, and 30. Rolling "how many players were active yesterday" is DAU, not retention. See `templates/retention-dashboard.md`.

6. **Define funnels as ordered step sequences with drop-off per step** — a funnel is a list of event names in order. For each step, count how many users from the previous step completed this step. Report both absolute counts and percentage drop-off. Never hard-code funnels; make them configurable.

7. **Never block gameplay for analytics** — `track()` must be fire-and-forget. If Redis is down, log to a local buffer or drop the event. Never await a database write in the game loop. Analytics is observability, not game logic.

8. **Separate analytics tables from gameplay tables** — analytics data is append-only, high-volume, and queried differently. Keep `analytics_events`, `analytics_sessions`, and `analytics_retention_cohorts` in their own schema namespace. Don't pollute gameplay tables with telemetry columns.

9. **Plan for event volume from day one** — a game with 10K DAU generating 50 events/session produces 500K events/day. Add `createdAt` partitioning for time-range queries, archive events older than 90 days, and use materialized views or pre-aggregated tables for dashboards.

10. **A/B test by tagging events, not by forking code paths** — add an `experimentId` and `variant` to event properties. Query analytics by grouping on variant. This keeps game code clean and lets you analyze experiments retroactively from the event stream.

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add drizzle-orm @neondatabase/serverless ioredis
bun add -d drizzle-kit
```

### 2. Set Up the Analytics Schema

Copy `boilerplate/analytics-schema.ts` into your project's schema directory. This provides three tables:

- `analyticsEvents` — append-only event log with JSONB properties
- `analyticsSessions` — session lifecycle tracking with heartbeat
- `analyticsRetentionCohorts` — pre-computed cohort retention data

Generate and run migrations:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

### 3. Initialize the Analytics Client

Copy `boilerplate/analytics-client.ts` and configure it with your Redis and Drizzle instances:

```typescript
import { AnalyticsClient } from './analytics-client';
import { redis } from './redis-client';
import { db } from './db';

const analytics = new AnalyticsClient({ redis, db });
```

### 4. Instrument Events in Game Code

```typescript
// Fire-and-forget — never await in game loop
analytics.track('level_completed', {
  levelId: 'level_12',
  score: 4500,
  timeSeconds: 127,
  deaths: 3,
});

analytics.track('item_purchased', {
  itemId: 'sword_rare_01',
  currency: 'gold',
  amount: 500,
});
```

### 5. Track Sessions

```typescript
// On player connect
analytics.trackSession('start');

// Every 30-60 seconds while connected
analytics.trackSession('heartbeat');

// On player disconnect
analytics.trackSession('end');
```

### 6. Set Up the Buffer Worker

The analytics client pushes events to a Redis list. Set up a worker (via `bullmq-game-queues` or a simple interval) to drain the buffer:

```typescript
// Run on a worker process, not the game server
setInterval(async () => {
  await analytics.flush();
}, 5000);
```

### 7. Run Retention Queries

See `templates/retention-dashboard.md` for pre-built Drizzle ORM queries for D1/D7/D30 retention, DAU/MAU, session duration distribution, top events, and funnel analysis.

### 8. Build Your Event Catalog

Use `templates/event-catalog.md` as a starting point to document all events in your game. Share this with your entire team so designers, producers, and engineers agree on event names and properties.

## Code Examples

### Tracking with A/B test variant

```typescript
analytics.track('tutorial_step_completed', {
  step: 3,
  experimentId: 'onboarding_v2',
  variant: 'shortened',
});
```

### Querying events by player

```typescript
import { eq, and, gte } from 'drizzle-orm';
import { analyticsEvents } from './analytics-schema';

const recentEvents = await db
  .select()
  .from(analyticsEvents)
  .where(
    and(
      eq(analyticsEvents.userId, 'player_123'),
      gte(analyticsEvents.createdAt, new Date(Date.now() - 86400000)),
    ),
  )
  .orderBy(analyticsEvents.createdAt);
```

### Batch insert from Redis buffer

```typescript
import { analyticsEvents } from './analytics-schema';

const batch = await redis.lrange('analytics:events', 0, 499);
if (batch.length > 0) {
  const rows = batch.map((raw) => JSON.parse(raw));
  await db.insert(analyticsEvents).values(rows);
  await redis.ltrim('analytics:events', batch.length, -1);
}
```

See `boilerplate/analytics-client.ts` for the full implementation and `boilerplate/analytics-schema.ts` for table definitions.

## Cross-References

- `postgres-game-schema` for base database schema, Drizzle config, and players table
- `redis-game-patterns` for Redis connection, buffering, and pub/sub infrastructure
- `bullmq-game-queues` for reliable async event processing and scheduled retention computation

## Pitfalls & Anti-Patterns

- **Event explosion** — don't track every mouse move or frame tick. Define a finite event catalog (see `templates/event-catalog.md`) and stick to it. If you need high-frequency data (e.g., position tracking), sample at fixed intervals and batch.
- **PII in events** — never put emails, IP addresses, or real names in event properties. Use opaque player IDs. If you need demographics, store them in a separate PII-protected table and join at query time.
- **Missing session boundaries** — if you only track `session_started` but forget `session_ended` (common when players crash or lose connection), your session duration data is garbage. Always implement a server-side idle timeout that closes sessions after 5 minutes of no heartbeat.
- **Confusing retention with DAU** — "50% of our players came back yesterday" is not D1 retention. D1 retention is "of the cohort that registered on day X, what percentage played on day X+1." These are fundamentally different metrics. Use cohort analysis.
- **No sampling strategy** — at scale (100K+ DAU), storing every event is expensive. Implement sampling: track 100% of monetization events, 100% of session events, and sample gameplay events at 10-25% with a `sampled: true` flag.
- **Writing analytics synchronously in the game loop** — if your `track()` call awaits a database write, a DB hiccup causes frame drops or timeout errors in-game. Always buffer through Redis and flush asynchronously.
- **Hardcoding funnel steps** — funnels change as your game evolves. Store funnel definitions as configuration (JSON or DB), not as code. Let product managers update funnels without code deploys.

## Designer Philosophy

**Will Wright** (SimCity, The Sims): Analytics is the feedback loop that closes the gap between what you designed and what players experience. In The Sims, player behavior data revealed that people spent far more time decorating houses than managing relationships — a complete surprise that reshaped expansion pack priorities. Without telemetry, that insight would have taken years of guessing.

**Raph Koster** (Ultima Online, Star Wars Galaxies): In Ultima Online, emergent player behavior — like the entire ecosystem collapse from player-killed animals — was only understood in retrospect because we lacked event-level tracking. Modern games have no excuse. Every meaningful player action should produce a queryable event, because the most important design discoveries come from patterns you weren't looking for.

**Amy Jo Kim** (Community Design): Engagement is not about maximizing time-in-game. Healthy retention curves show players finding a sustainable rhythm. If your D1 is 40% but D30 is 2%, you have an onboarding cliff, not a content problem. Analytics should surface where meaning breaks down, not just where players leave.

## Sources

- [Mixpanel Engineering Blog — Event Tracking Best Practices](https://mixpanel.com/blog/)
- [Amplitude Engineering — Behavioral Analytics at Scale](https://amplitude.com/blog/engineering)
- [GDC Vault — Player Metrics in Game Development](https://gdcvault.com)
- [Delta DNA — Game Analytics Patterns](https://deltadna.com)
- [GameAnalytics Documentation](https://docs.gameanalytics.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Redis LPUSH/LRANGE for Buffering](https://redis.io/commands/lpush/)
