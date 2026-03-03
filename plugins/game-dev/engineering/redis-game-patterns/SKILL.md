---
name: redis-game-patterns
description: >-
  Use when implementing Redis patterns for games — caching, leaderboards, pub/sub messaging, session storage, rate limiting, or ephemeral game state. Triggers: Redis, cache, leaderboard, pub/sub, rate limit, session.
---

# Redis Game Patterns

## Purpose

Redis usage patterns for games — leaderboards, session caching, pub/sub messaging, rate limiting, ephemeral state, and sorted sets for real-time game data.

## When to Use

Trigger: Redis, pub/sub, leaderboard, session cache, rate limiting, sorted sets, game cache, ephemeral state, TTL, player presence, cross-server messaging

## Prerequisites

None — this is a foundational infrastructure skill.

## Core Principles

> Will Wright: "Simulation state must be fast, ephemeral, and disposable — persistence is for outcomes, not for process."

1. **Redis is for hot data, PostgreSQL is for cold data** — cache what's accessed frequently, persist what matters long-term
2. **Every cached value needs a TTL** — stale data is worse than no data; always set expiration
3. **Use the right data structure** — sorted sets for leaderboards, hashes for sessions, pub/sub for events, strings for simple counters
4. **Cache-aside pattern by default** — check cache, miss, load from DB, populate cache; never assume cache is populated
5. **Atomic operations prevent race conditions** — use pipelines and Lua scripts for multi-step operations, never read-then-write
6. **Separate Redis connections for pub/sub** — subscriber connections are blocked; use dedicated connections for subscriptions
7. **Namespace all keys** — prefix keys by domain (`lb:`, `session:`, `rl:`, `presence:`) to avoid collisions and enable selective flushing

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add ioredis
```

### 2. Configure Redis Connection

Use `boilerplate/redis-client.ts` for the base connection with reconnection logic and error handling. All other modules import from this file.

### 3. Set Up Leaderboards

Use `boilerplate/leaderboard.ts` for sorted-set-based leaderboards. Supports adding scores, fetching top N, getting player rank, and fetching nearby ranks. Includes periodic snapshot to PostgreSQL for historical data.

### 4. Implement Session Caching

Use `boilerplate/session-cache.ts` for player session caching with TTL. Follows cache-aside pattern: check cache → miss → load from DB → populate cache.

### 5. Configure Pub/Sub

Use `boilerplate/pub-sub.ts` for cross-server messaging. Requires separate Redis connections for publishing and subscribing. Typed event handlers ensure type safety.

### 6. Add Rate Limiting

Use `templates/rate-limiter.ts` for per-player per-action sliding window rate limiting using sorted sets. Configurable window size and max requests.

### 7. Manage Ephemeral State

Use `templates/ephemeral-state.ts` for short-lived game state: match state with TTL, player presence via heartbeat, and temporary buffs/effects.

## Code Examples

### Adding a player score to a leaderboard

```typescript
import { leaderboard } from './leaderboard';

await leaderboard.addScore('weekly', 'player_123', 4500);
const top10 = await leaderboard.getTopN('weekly', 10);
const rank = await leaderboard.getPlayerRank('weekly', 'player_123');
```

### Caching a player session

```typescript
import { sessionCache } from './session-cache';

const session = await sessionCache.get('player_123');
if (!session) {
  const fromDb = await db.query.players.findFirst({ where: eq(players.id, 'player_123') });
  await sessionCache.set('player_123', fromDb, 3600);
}
```

### Publishing a game event across servers

```typescript
import { publisher, subscriber } from './pub-sub';

await publisher.publish('match-events', {
  type: 'match-started',
  matchId: 'match_456',
  players: ['player_123', 'player_789'],
});

subscriber.on('match-events', (event) => {
  console.log('Match event:', event.type);
});
```

### Rate limiting a player action

```typescript
import { checkRateLimit } from './rate-limiter';

const result = await checkRateLimit('player_123', 'attack', {
  maxRequests: 1,
  windowSeconds: 5,
});

if (!result.allowed) {
  throw new Error(`Rate limited. Retry after ${result.retryAfter}s`);
}
```

See `boilerplate/` for full implementations and `templates/` for rate limiting and ephemeral state patterns.

## Cross-References

- `game-backend-architecture` for integrating Redis into the game server
- `bullmq-game-queues` for job queues built on Redis
- `postgres-game-schema` for persisting leaderboard snapshots and session fallback data

## Pitfalls & Anti-Patterns

- **Don't use Redis as a primary database** — Redis is a cache and message broker; always have a persistence layer backing it
- **Don't forget TTLs** — keys without expiration accumulate forever and eventually exhaust memory
- **Don't use `KEYS *` in production** — it blocks Redis; use `SCAN` for key enumeration
- **Don't share a single connection for pub/sub and commands** — subscriber connections are blocked and cannot execute other commands
- **Don't store large objects in Redis** — keep values small (< 1MB); store IDs and fetch details from the database
- **Don't assume cache is populated** — always implement cache-aside; never trust that a key exists

## Designer Philosophy

**Will Wright** (SimCity, The Sims): Simulation state management is about speed and disposability. In SimCity, the game constantly recalculates traffic, power, and zoning — none of that intermediate state needs to survive a restart. Redis serves this exact role in multiplayer games: it holds the hot, fast-changing state that drives the simulation, while the database records outcomes that matter. The moment you treat cache as truth, you've confused process with product.

## Sources

- [Redis Official Documentation](https://redis.io/docs/)
- [Redis Data Types and Abstractions](https://redis.io/docs/data-types/)
- [ioredis GitHub Repository](https://github.com/redis/ioredis)
- [Redis Sorted Sets for Leaderboards](https://redis.io/docs/data-types/sorted-sets/)
- [Redis Pub/Sub Documentation](https://redis.io/docs/interact/pubsub/)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
