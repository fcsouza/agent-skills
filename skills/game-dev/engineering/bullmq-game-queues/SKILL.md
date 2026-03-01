# BullMQ Game Queues

## Purpose

Job queue patterns for games using BullMQ + Redis — matchmaking, async events, delayed jobs, scheduled tasks.

## When to Use

Trigger: job queue, matchmaking, async events, delayed jobs, scheduled tasks, BullMQ, background processing, game events, retry strategy, dead letter queue

## Prerequisites

- `redis-game-patterns` (Redis connection)

## Core Principles

> Will Wright: "Simulation systems benefit from decoupled event processing."
> Sid Meier: "Queue priorities ensure the most interesting events happen first."

1. **Every game action that can be deferred SHOULD be deferred to a queue** — keep the game loop responsive
2. **Idempotent job processors** — same job can run twice safely without side effects
3. **Use named queues per domain** (matchmaking, events, rewards, notifications)
4. **Exponential backoff for retries, dead letter for permanent failures**
5. **Priority queues for time-sensitive operations** (matchmaking > analytics)
6. **Delayed jobs for scheduled game events** (daily rewards, season changes)
7. **Rate limiting per player to prevent abuse**

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add bullmq ioredis
```

### 2. Configure Redis Connection

Use the connection from `redis-game-patterns`, or create a dedicated one for queues. See `templates/queue-config.ts` for the full configuration pattern.

### 3. Define Job Types

Start with the type definitions in `templates/job-types.ts`. These cover matchmaking, game events, rewards, notifications, and analytics job payloads.

### 4. Create Queues

Use `boilerplate/queues.ts` to define typed queues per domain. Each queue has its own retry strategy, concurrency, and priority settings.

### 5. Implement Workers

See `boilerplate/workers.ts` for worker implementations. Each worker processes jobs from a specific queue with proper error handling, logging, and result tracking.

### 6. Schedule Recurring Jobs

Use `boilerplate/scheduler.ts` to set up cron-based repeatable jobs (daily rewards, leaderboard snapshots, session cleanup) and delayed one-off jobs (season events, timed rewards).

### 7. Monitor & Observe

Add queue event listeners for completed, failed, and stalled jobs. Integrate with your monitoring stack via `monitoring-game-ops`.

## Code Examples

### Adding a matchmaking job

```typescript
import { matchmakingQueue } from './queues';

await matchmakingQueue.add('find-match', {
  playerId: 'player_123',
  skillRating: 1500,
  region: 'us-east',
  preferences: { mode: 'ranked', teamSize: 2 },
}, { priority: 1 });
```

### Scheduling a delayed reward

```typescript
import { rewardQueue } from './queues';

await rewardQueue.add('distribute-reward', {
  playerId: 'player_123',
  rewardType: 'daily-login',
  payload: { currency: 100, items: ['item_rare_box'] },
}, { delay: 60_000 }); // 1 minute delay
```

### Processing game events

```typescript
import { gameEventQueue } from './queues';

await gameEventQueue.add('process-event', {
  eventType: 'match-completed',
  sessionId: 'session_456',
  participants: ['player_123', 'player_456'],
  outcome: { winnerId: 'player_123', duration: 300 },
});
```

See `boilerplate/queues.ts` for full queue definitions, `boilerplate/workers.ts` for worker implementations, and `boilerplate/scheduler.ts` for scheduled jobs.

## Cross-References

- `redis-game-patterns` for Redis connection and caching
- `postgres-game-schema` for persisting job results to the database
- `game-backend-architecture` for integrating queues with the game server
- `monitoring-game-ops` for queue monitoring and alerting

## Pitfalls & Anti-Patterns

- **Don't process game-critical logic synchronously when it can be queued** — matchmaking, reward distribution, and analytics should never block the game loop
- **Don't forget to handle job failures** — always set maxRetries + dead letter queue configuration
- **Don't use a single monolithic queue for everything** — separate queues per domain allow independent scaling and priority tuning
- **Don't store large payloads in jobs** — store IDs and fetch from the database in the worker; job data should be small and serializable
- **Don't skip idempotency** — network failures and retries mean jobs can run more than once; always check before mutating state
- **Don't ignore stalled jobs** — configure stall detection and alerts to catch stuck workers early

## Designer Philosophy

**Will Wright:** Simulation systems benefit from decoupled event processing. Queues let game systems communicate asynchronously, the same way SimCity processes zoning, traffic, and utilities independently. Each queue is a subsystem that can evolve without affecting others.

**Sid Meier:** Queue priorities ensure the most "interesting" events happen first. A player waiting for a match should never be blocked by analytics processing. Priority levels map directly to player-perceived responsiveness.

## Sources

- [BullMQ Official Documentation](https://docs.bullmq.io)
- [Redis Best Practices for Queues](https://redis.io/docs/data-types/streams-tutorial/)
- [BullMQ Patterns & Best Practices](https://docs.bullmq.io/patterns/idempotent-jobs)
- Game Server Architecture Patterns (GDC talks on scalable game backends)
