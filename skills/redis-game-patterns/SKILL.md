---
name: redis-game-patterns
description: >-
  Four Redis patterns for game servers: sorted-set leaderboards, heartbeat
  presence with short-lived match state and timed buffs, a per-player
  per-action sliding-window rate limit, and cache-aside for player data. Use
  when a game needs ranked scores, an online/offline indicator, action
  cooldowns or anti-spam limits, or a fast read path in front of the player
  database, on Redis through ioredis.
---

# Redis Game Patterns

Redis holds hot, disposable game state. The database holds outcomes. If Redis
restarts empty, players should lose nothing that matters: match results,
rewards and currency are written to the database first.

## Client choice

The code here uses `ioredis` 6, because BullMQ 6 creates its Redis connections
with ioredis by default and most game servers in this bundle already run
BullMQ (`bullmq-game-queues`). The ioredis README says that for new projects
node-redis is the recommended client; if the project has no BullMQ and no
ioredis yet, consider node-redis and port the commands. BullMQ 6 marks ioredis
as an optional peer, so install it explicitly: `bun add ioredis`.

Every file takes the client as a parameter typed `Redis` from `ioredis`.
Create the client once in the server and pass it in. Keep the default
`replyMapping: "legacy"`: the parsers expect `WITHSCORES` replies as flat
`[member, score, ...]` string arrays. The code needs Redis 6.2 or newer
(`ZRANGE ... REV`).

## Pattern 1: leaderboard

Copy `boilerplate/leaderboard.ts` when the game ranks players by score.

- One sorted set per board and period: `lb:weekly:2026-W46`, `lb:season:3`.
  A new period is a new key; snapshot the old one, then delete it.
- `ZADD` overwrites the score. For "best score counts", decide on purpose:
  `ZADD ... GT` keeps the higher value; `ZINCRBY` adds points.
- Ties: equal scores sort by member ID bytes (reverse order under `REV`), not
  by who reached the score first. If first-to-score must win, encode the tie
  break into the score, and keep the whole score inside the exact integer
  range of a double (2^53).
- Rank from `ZREVRANK` is zero-based; the boilerplate returns rank 1 for the
  top player.
- At season end, call `snapshot()` with a function that writes the rows to
  Postgres (`postgres-game-schema`), then reset the board.

## Pattern 2: presence and ephemeral state

Copy `templates/ephemeral-state.ts` when the game shows who is online, keeps
live match state outside the database, or applies timed buffs.

- Presence: the client heartbeats every few seconds; the server writes
  `presence:<playerId>` with `EX`. A missing key means offline, so a crashed
  client goes offline without cleanup code. Set the TTL to a few heartbeat
  intervals so one lost packet does not flash the player offline.
- Match state: one JSON key per match with a TTL longer than the longest
  match. `update()` reads the JSON, applies your pure function and writes
  the result with a compare-and-set Lua script: the write lands only if the
  key still holds what was read, else it reads again and retries. Calls for
  one match from the same process run one after another, so they never race
  each other; the script catches races with other servers. Do not use
  `WATCH`/`MULTI` here: concurrent updates on one shared client interleave
  their `WATCH` and `EXEC` and lose writes.
- Timed buffs: one key per effect with `EX`, plus a per-player sorted set
  scored by expiry time to list them. Expiry needs no sweeper job.
- `SET` clears an existing TTL unless you pass `EX` again. Every write in the
  template passes it.

## Pattern 3: per-action rate limit

Copy `templates/rate-limiter.ts` when an action needs a cooldown or spam cap:
attacks, chat, trades, crafting.

- Key per player and action: `rl:<action>:<playerId>`. Limits differ per
  action, so one global limit per player is the wrong shape.
- Sliding window on a sorted set: each attempt is a member scored by its
  timestamp. The template runs remove-old, add, count and expire in one
  `MULTI`, so two concurrent attempts cannot both pass.
- A denied attempt is removed again. Otherwise a player who spams the button
  stays locked out past the window.
- Check the limit on the server for every action message, including actions
  that arrive over WebSocket (`game-backend-architecture`).

## Pattern 4: cache-aside for player data

No file; the code is short enough to write in place.

1. Read `player:<id>` from Redis. On a hit, parse and return it.
2. On a miss, load from the database, write it with `SET key value EX ttl`,
   and return it. A missing row stays uncached unless you cache a "not found"
   marker with a short TTL.
3. On every database write to that player, delete the cache key after the
   write commits. Do not update the cache in place from game logic.
4. If the cached JSON fails to parse, delete the key and fall through to the
   database.

Cache only what the game reads often and can tolerate seeing a few seconds
late (profile, loadout, cosmetics). Wallet balances and inventory counts are
read from the database inside the transaction that changes them.

## Pitfalls

- Treating Redis as the record of truth for match results, rewards or
  currency. Write those to the database; Redis may lose them.
- Read-then-write on shared keys from more than one server. Use `MULTI`,
  `WATCH` or a single command; a plain pipeline does not stop another client's
  command running between yours.
- Using Pub/Sub for events a server must not miss. Redis Pub/Sub delivers at
  most once: a server that is down or disconnected loses the message. Send
  match results and purchases through a queue (`bullmq-game-queues`).
- Subscribing on the shared command connection. Under RESP2 a subscribed
  connection accepts only subscribe-family commands, and the ioredis README
  says to create a separate connection for subscribing. Give subscribers their
  own client (`redis.duplicate()`).
- Prefix Pub/Sub channels with the environment (`prod:match-events`). Pub/Sub
  ignores database numbers, so staging and production on one Redis hear each
  other.

## Files

- `boilerplate/leaderboard.ts`: copy when building a ranked board; read when
  checking how ranks and snapshots are computed.
- `templates/rate-limiter.ts`: copy when adding per-action limits.
- `templates/ephemeral-state.ts`: copy when adding presence, live match state
  or timed buffs.
- `references/sources.md`: read when you need the Redis or ioredis page behind
  a rule above.

## Related skills

- `bullmq-game-queues`: durable jobs and events on the same Redis.
- `matchmaking-system`: queue and lobby state on Redis.
- `gameplay-analytics`: event buffering on Redis.
- `postgres-game-schema`: where leaderboard snapshots and player data live.
- `game-backend-architecture`: where the client is created and passed in.
