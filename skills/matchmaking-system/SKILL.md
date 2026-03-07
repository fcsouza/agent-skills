---
name: engineering-matchmaking-system
description: >-
  Use when implementing player matchmaking, skill-based match selection, lobby systems, queue management, or rank-based grouping. Triggers: matchmaking, lobby, queue, ELO, skill-based, rank, match players, pairing, bracket.
---

# Matchmaking System

## Purpose

Rank-based and skill-based player matching, lobby lifecycle management, and queue orchestration for multiplayer games.

## When to Use

Trigger: matchmaking, lobby, queue, ELO, Glicko, skill-based matchmaking, rank, match players, pairing, bracket, queue management, wait time, search radius, lobby state

## Prerequisites

- `bullmq-game-queues` — priority queues, delayed jobs, worker patterns
- `redis-game-patterns` — Redis connection, pub/sub for lobby events
- `postgres-game-schema` — persisting match history, player ratings

## Core Principles

> Raph Koster: "Matchmaking is the invisible hand that shapes every player's experience. Get it wrong, and no amount of great game design can save you."
> Will Wright: "The best systems match complexity to the player — beginners face beginners, experts face experts, and everyone stays in flow."

1. **ELO/Glicko-2 for skill estimation** — track rating AND deviation. A player with 1500 rating and low deviation is well-calibrated; 1500 with high deviation means uncertain. Factor in performance metrics (damage dealt, objectives captured), not just win/loss.
2. **Match quality score = sum(skill_delta^2 x weight) — minimize skill gap** — a match is only as good as its closest pairing. Compute quality across all player pairs, not just averages. Weight recent performance higher than lifetime rating.
3. **Expand search radius over time** — start tight (+-50 rating) and widen every 10s. After 30s, widen aggressively. Players prefer a slightly uneven match over waiting 3 minutes. Use BullMQ delayed jobs to trigger radius expansion.
4. **Separate queues by game mode, region, and optional parameters** — 1v1 ranked, 2v2 casual, battle royale, and co-op each have different matching criteria. Never cross-pollinate queues unless the player opts in.
5. **Lobby state machine: WAITING -> ALL_READY -> COUNTDOWN -> IN_PROGRESS -> COMPLETE** — every lobby transition is explicit, logged, and reversible (until IN_PROGRESS). If a player disconnects during COUNTDOWN, revert to WAITING.
6. **BullMQ priority queue for matchmaking** — players waiting > 30s get priority 1 (highest). This prevents starvation where popular skill brackets drain the queue while edge cases wait forever.
7. **Never match new players against experienced players** — players with < 10 games are in a protected pool. Players with > 100 games are in the general pool. The 10-100 range transitions gradually. This prevents new player churn from stomps.
8. **Pre-match validation: all players still connected before starting** — after a match is found, verify every player is still online via WebSocket heartbeat. If anyone dropped, return remaining players to the front of the queue (not the back).
9. **Anti-abuse: leave penalties and queue cooldowns** — track abandonment rate. Players who leave > 20% of matches in the last 20 games get increasing queue delays (30s, 2m, 10m). Cooldown decays over time with completed matches.

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add bullmq ioredis
bun add -d @types/node
```

### 2. Set Up Matchmaking Queues

Create dedicated BullMQ queues for matchmaking. Use the patterns from `bullmq-game-queues`.

```typescript
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

const matchmakingQueue = new Queue('matchmaking', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

// Separate queue for search radius expansion
const radiusExpansionQueue = new Queue('matchmaking:radius-expand', {
  connection: redis,
});
```

### 3. Configure Rating System

Choose ELO for simplicity or Glicko-2 for accuracy. Glicko-2 tracks rating deviation (confidence) and volatility.

```typescript
interface PlayerRating {
  rating: number;      // ELO/Glicko-2 rating (default: 1500)
  deviation: number;   // Glicko-2 RD (default: 350, lower = more confident)
  volatility: number;  // Glicko-2 sigma (default: 0.06)
  gamesPlayed: number;
}

// K-factor decreases as confidence increases
function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40;  // New players: high adjustment
  if (gamesPlayed < 30) return 24;  // Learning players
  return 16;                         // Established players
}
```

### 4. Implement Queue Entry

See `boilerplate/matchmaker.ts` for the full `MatchmakingEngine` class. Players enter the queue with their rating, region, and game mode.

```typescript
import { MatchmakingEngine } from './matchmaker';

const engine = new MatchmakingEngine(redis);

await engine.enqueue({
  playerId: 'player_123',
  rating: 1500,
  deviation: 100,
  gameMode: 'ranked-1v1',
  region: 'us-east',
  queuedAt: Date.now(),
  searchRadius: 50,
});
```

### 5. Implement Match Finding

The engine scores potential matches and picks the best one. Quality score considers rating difference, deviation overlap, wait time, and region latency.

```typescript
// Inside BullMQ worker
const worker = new Worker('matchmaking', async (job) => {
  const player = job.data as PlayerQueueEntry;
  const match = await engine.findMatch(player);

  if (match) {
    await lobbyManager.createLobby(match);
  } else {
    // Schedule radius expansion after 10s
    await radiusExpansionQueue.add('expand', {
      playerId: player.playerId,
    }, { delay: 10_000 });
  }
}, { connection: redis, concurrency: 10 });
```

### 6. Implement Lobby Lifecycle

See `boilerplate/lobby-manager.ts` for the full `LobbyManager` class. Lobbies use Redis for state storage and pub/sub for real-time events.

```typescript
import { LobbyManager } from './lobby-manager';

const lobbyManager = new LobbyManager(redis);

// Match found -> create lobby
const lobby = await lobbyManager.createLobby(match);

// Players ready up
await lobbyManager.readyUp(lobby.lobbyId, 'player_123');

// All ready -> countdown starts automatically
// Countdown complete -> IN_PROGRESS
// Game ends -> COMPLETE
```

### 7. Handle Edge Cases

```typescript
// Player disconnects during countdown
await lobbyManager.leaveLobby(lobbyId, disconnectedPlayerId);
// Remaining players return to queue front with priority boost

// Player cancels queue
await engine.dequeue('player_123');

// Search radius expansion (called by delayed job)
engine.widenSearchRadius('player_123');
```

## Code Examples

See boilerplate files:

- `boilerplate/matchmaker.ts` — Core `MatchmakingEngine` class with enqueue, dequeue, match finding, and quality scoring
- `boilerplate/lobby-manager.ts` — `LobbyManager` class with state machine, Redis storage, and pub/sub events
- `templates/matchmaking-config.md` — Configuration template for queue settings, rating parameters, and anti-abuse rules

## Cross-References

- **bullmq-game-queues** — Queue creation, worker patterns, retry strategies, delayed jobs. Matchmaking queues build directly on these patterns.
- **redis-game-patterns** — Redis connection, pub/sub for lobby events, sorted sets for leaderboards. Lobby state is stored in Redis hashes with TTL.
- **postgres-game-schema** — Match history, player rating persistence, abandonment tracking. Ratings are cached in Redis but persisted to PostgreSQL after each match.
- **game-state-sync** — Once a match starts, state sync takes over. The lobby hands off to the game server with the match configuration.

## Pitfalls & Anti-Patterns

- **Don't match purely on average team rating** — a team of [1000, 2000] vs [1500, 1500] has the same average but terrible match quality. Minimize variance within AND between teams.
- **Don't reset search radius on re-queue** — if a player was returned to queue after a failed lobby, preserve their accumulated wait time and expanded radius.
- **Don't use a single global queue** — separate by game mode and region. A global queue means a 1v1 player in Asia competes for worker time with a 4v4 player in Europe.
- **Don't ignore ELO inflation** — over time, ratings drift upward as new players inject points. Implement seasonal resets or rating decay for inactive players.
- **Don't skip pre-match validation** — the #1 source of "ghost matches" is starting a game with a player who disconnected 2 seconds before launch. Always verify presence.
- **Don't match solo players against premade teams at the same rating** — premade teams have coordination advantage worth ~100-200 rating points. Apply a handicap or separate the queues.
- **Don't ignore region latency** — a "perfect" skill match across continents produces a terrible gameplay experience. Prioritize region over rating within reasonable bounds.

## Designer Philosophy

**Raph Koster:** Matchmaking defines the difficulty curve more than any level designer ever could. A good matchmaker keeps players in Csikszentmihalyi's "flow channel" — challenged enough to be engaged, but never so outmatched that they feel helpless. The system is invisible when it works, infuriating when it doesn't.

**Will Wright:** The matchmaker is a simulation of social dynamics. It must model not just skill but confidence, frustration tolerance, and play patterns. A player on a losing streak needs an easier match, even if their rating says otherwise. Systems that serve the math instead of the human always fail.

## Sources

- [Microsoft TrueSkill Research](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/) — Bayesian skill estimation with uncertainty tracking
- [Glicko-2 Rating System](http://www.glicko.net/glicko/glicko2.pdf) — Mark Glickman's rating system with deviation and volatility
- [BullMQ Documentation](https://docs.bullmq.io) — Priority queues, delayed jobs, rate limiting
- **GDC Talks**: "Ranked Matchmaking in Overwatch" (Scott Mercer, GDC 2017), "The Science Behind Matchmaking" (Josh Menke, GDC 2018)
- [Riot Games Engineering: Matchmaking](https://technology.riotgames.com/) — Queue architecture and wait time optimization
