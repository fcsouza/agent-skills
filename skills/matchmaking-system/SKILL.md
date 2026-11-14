---
name: matchmaking-system
description: >-
  Covers skill-based matchmaking for multiplayer games: picking a rating system
  (Elo, Glicko-2 or TrueSkill), skill brackets that widen with wait time,
  claiming a matched pair from the queue without double-booking a player, and
  the lobby lifecycle from ready-up to match end. Use when players need to be
  paired or grouped by skill, a queue matches the same player twice or leaves
  players waiting too long, new players keep losing to veterans, or a lobby
  breaks when someone leaves during the countdown. Redis and BullMQ are the
  reference implementation.
---

# Matchmaking System

Pairs players by skill from a Redis sorted set, widens the skill bracket as they wait, claims each pair atomically, and runs the lobby until the match ends.

Related skills: `bullmq-game-queues` (queue and worker setup), `redis-game-patterns` (Redis client, presence), `postgres-game-schema` (rating and match history), `game-state-sync` (takes over once the match starts).

## Choose the rating system

| System | Pick it when | What it tracks |
|---|---|---|
| Elo | Matches are plentiful and you can keep matchmaking tight | One number. Menke: needs more matches to converge than Glicko or TrueSkill. |
| Glicko-2 | Players compete alone and you want an uncertainty that grows while a player is away (RD rises in a rating period with no games) | Rating, rating deviation (RD), volatility; a draw scores 0.5. Menke, on Glicko: converges faster than Elo, not naturally adapted to teams. |
| TrueSkill | Team modes, more than two teams, or draws | Mean mu and uncertainty sigma per player; team skill is the sum of its players. Menke: designed for teams and draws, converges in the fewest matches of the three. |

Starting values with a source:

- Glicko-2: unrated players start at rating 1500, RD 350, volatility 0.06. Set the system constant tau between 0.3 and 1.2 and test which predicts best. Rating periods work best with 10-15 games per player.
- TrueSkill: new players start at mu 25, sigma 8.333. Rank on the conservative estimate mu - 3 sigma, not on mu.
- A Glicko-2 player's strength sits in rating plus or minus 2 RD with 95% confidence.

No Elo K-factor is given here because no source was checked. Pick one and tune it against your own win-prediction data.

Persist ratings in Postgres after each match (`postgres-game-schema`) and cache them in Redis for the queue.

## Procedure

1. Split pools by game mode and region. One sorted set per pool, score = rating. A player only searches their own pool unless they opt in to cross-region.
2. Enqueue: write the sorted-set member and a hash with rating, deviation, games played and `queuedAt`, with a TTL so a crashed client does not stay queued forever.
3. Add one BullMQ search job per player. The job calls `findMatch`; if nothing fits, it adds a delayed copy of itself, so the search runs again with a wider bracket.
4. Bracket width comes from wait time: `initial + floor(wait / interval) * step`, capped at a maximum. Derive it from `queuedAt` on every search; do not store it, so it cannot go stale and needs no separate "widen" job.
5. A pair fits when the rating gap is inside the wider of the two players' brackets, so the player who waited longer decides.
6. Claim the pair in one Lua script: if both members are still in the sorted set, remove both and delete both hashes; otherwise remove nothing and try the next candidate. See "Atomic dequeue" below.
7. Create the lobby. Players ready up; the last ready-up moves the lobby to COUNTDOWN.
8. When the countdown ends, check every player's presence (WebSocket heartbeat). If all are there, the lobby goes IN_PROGRESS. If anyone dropped, remove them, return the lobby to WAITING and requeue the others with their original `queuedAt` so their bracket stays wide.
9. On match end, mark the lobby COMPLETE, update ratings, and let the lobby expire after the results screen.

Copy when building the queue: `boilerplate/matchmaker.ts` (`MatchmakingEngine`, `startMatchmaking`). It takes the ioredis client as a parameter.
Copy when building the lobby: `boilerplate/lobby-manager.ts` (`LobbyManager`). It takes the same client.

```typescript
import { Redis } from 'ioredis';
import { MatchmakingEngine, startMatchmaking } from './matchmaker';
import { LobbyManager } from './lobby-manager';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
// Request path: default retries, so a Redis outage fails the request fast.
const redis = new Redis(url);
// Worker connection: BullMQ requires maxRetriesPerRequest: null here.
const workerRedis = new Redis(url, { maxRetriesPerRequest: null });
const engine = new MatchmakingEngine(redis);
const lobbies = new LobbyManager(redis);
const { queue } = startMatchmaking(workerRedis, engine, async (match) => {
  await lobbies.createLobby(match);
});

await engine.enqueue({
  playerId: 'player_123',
  rating: 1500,
  deviation: 350,
  gamesPlayed: 0,
  gameMode: 'ranked-1v1',
  region: 'eu-west',
  queuedAt: Date.now(),
});
await queue.add(
  'search',
  { gameMode: 'ranked-1v1', region: 'eu-west', playerId: 'player_123' },
  { removeOnComplete: true },
);
```

## Atomic dequeue

Reading candidates and then removing them in separate calls lets two workers pick the same opponent, and both matches go ahead. A MULTI/EXEC of two ZREMs does not fix this: if one member is already gone, the other is still removed, and Redis transactions have no rollback.

The boilerplate's claim script checks both members with ZSCORE, then ZREMs both and DELs both hashes, all inside one script. Redis runs a script atomically, so a second worker sees the pair gone and moves to its next candidate. Pass every key the script touches as a key argument. Every matchmaking key shares the `{mm}` hash tag because the scripts touch a pool and the global per-player markers together; on Redis Cluster that puts all matchmaking state in one slot.

## Lobby state machine

WAITING -> COUNTDOWN -> IN_PROGRESS -> COMPLETE. A leave or a failed presence check sends COUNTDOWN back to WAITING and clears every ready flag. A leave after IN_PROGRESS is an abandon, not a lobby change.

Every transition reads the lobby JSON, applies a change and writes it back with a compare-and-set script. Without that, two players readying up at once overwrite each other and the lobby never leaves WAITING.

Give IN_PROGRESS a TTL longer than your longest match, or the lobby expires mid-game.

## New players and parties

Check both in your own match data before you change anything: compare predicted and actual win rate by games played, and by party size.

- New players: in Menke's data they won 44% of their first game against a 49% prediction, catching up by about the ninth game. Matching them lower without changing their rating gives their opponents the wrong rating update; starting everyone lower drifts the whole population down. His fix was a model that learns the starting rating and the per-mode catch-up speed together with skill (TrueSkill Through Time).
- Parties: in his example a party of four won 58% against a 53% prediction. An offset kept outside the rating model causes the same drift; his fix learns a skill offset per party size inside the model.
- The boilerplate's guard keeps players under `newPlayerGames` away from players over `veteranGames`. It is a stopgap with tunable thresholds, not a measured fix.

## Pitfalls

- Matching on average team rating alone: [1000, 2000] and [1500, 1500] have the same average. With TrueSkill, compare team sums and look at the spread inside each team.
- Resetting a requeued player's wait: keep the original `queuedAt` so the bracket stays wide.
- One global queue: separate by mode and region.
- Long waits: the queue entry's hash expires after `entryTtlSeconds` and the player drops out silently. Refresh it from the client heartbeat or raise the TTL.
- Losing a claimed pair: once the claim script runs, both players are out of the queue. `startMatchmaking` handles an `onMatch` failure by calling `engine.requeue` (one script, original rating and `queuedAt`), restarting both searches and rethrowing. Do the same if you call `findMatch` yourself.
- One player in two pools: a per-mode key lets the same player queue in two modes or regions and get matched twice. The boilerplate keeps a global "queued in" marker, written by the enqueue script, cleared by the claim and cancel scripts, and refuses an enqueue into a second pool.
- Untrusted key parts: game mode and region become part of Redis keys; the boilerplate rejects anything but letters, digits, `_` and `-`.
- Leave calls from non-members or stale clients: refuse a leave from a player not in the lobby, and delete the player-to-lobby mapping only if it still names this lobby (compare-and-delete script).
- Starting on a stale presence check: the lobby can change while presence is checked. Start only if the countdown, its end time and the player set are the ones that were checked; otherwise `startMatch` throws `LobbyChangedError` and you call it again when the new countdown ends.
- Skipping the presence check before IN_PROGRESS: a player who dropped during the countdown starts a match one short.
- Priorities in BullMQ: jobs with no priority run before every prioritized job. If you boost long waiters with `priority`, give every search job a priority.
- Tuning by opinion: test what your players care about most (latency, skill, streaks or wait time) with match data before you change the weights.
- Client choice: the boilerplate uses ioredis because the other skills do. Its README says it is in maintenance and recommends node-redis for new projects; the claim logic ports as is.

Read when citing a number or claim from this skill: `references/sources.md`.
