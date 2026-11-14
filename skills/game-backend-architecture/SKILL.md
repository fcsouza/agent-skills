---
name: game-backend-architecture
description: >-
  Covers the server side of a real-time game on Bun and Elysia: server-authoritative rooms, a fixed-timestep tick loop with a spiral-of-death cap, delta broadcasts over WebSocket, a session check on the WebSocket upgrade, and Redis fan-out between server instances. Use when a multiplayer or real-time game needs a game server, match rooms, a server tick loop, state pushed from server to clients, or more than one server instance.
---

# Game backend architecture

The boilerplate targets `elysia` 1.4.32. Use the `elysiajs` skill if it is installed, otherwise https://elysiajs.com, and check which Elysia major the project runs: the Elysia 2 beta rewrites the WebSocket API, so the `.ws()` code here does not carry over unchanged.

## Requires

- `betterauth-integration` for the Better Auth instance, roles and trusted origins
- `redis-game-patterns` for presence keys and per-action rate limits

## Decisions

1. The server is the authority. A client sends what it wants to do (`move north`), never the result (`I am at 100, 200`). The server validates the action against its own state, applies it, and tells clients what happened.
2. Game logic runs on a fixed timestep, separate from network I/O. Every tick sees the same `dt`, so the same inputs give the same result.
3. A room owns its state, its action queue, its player set and its `GameLoop`. Rooms share nothing, and one room runs on one server instance. This holds for session games, where a match has a fixed, small player count. It stops holding when one space must carry more players or entities than one process can tick in its budget; see "When one space outgrows a process".
4. REST for durable, request-response work (create a room, read a profile, buy an item). WebSocket for the match: actions in, state deltas out.
5. Authenticate once, on the WebSocket upgrade, from the Better Auth session. The player id comes from that session for the life of the socket, never from a message.
6. Default to 20 ticks per second. One tick then has a 50 ms budget for every room on the instance. Pick another rate per room when the genre needs it.

## Wiring the server

1. Define the protocol first in `templates/message-types.ts`. Every message is a member of a discriminated union on `type`. Client messages are one TypeBox schema, `clientMessage`; `ClientMessage` is derived from it with `Static`, and `server.ts` validates with it, so malformed messages are rejected before your code sees them and the type cannot drift from the check.
2. Create the server with `createGameServer(auth, trustedOrigins)`, passing the Better Auth instance and the game client origins. Put the same origins in Better Auth's `trustedOrigins` option.
3. The upgrade check lives in `.derive()` on its own Elysia instance, so it does not run on the mounted auth routes. It returns 403 for an untrusted `Origin` and 401 without a session, and the route never upgrades. A direct `auth.api` call skips Better Auth's own origin checks, which is why the server checks `Origin` itself.
4. Put per-request values (the player id) in `.derive()`, not in `store`. `store` is one object shared by every request.
5. Write game logic in `RoomManager.tickRoom` and `processAction`. The pattern for one action:

```typescript
const result = validateAction(room.gameState, queued.playerId, queued.action);
if (!result.valid) {
  this.sendToPlayer(room.id, queued.playerId, {
    type: 'action_result',
    action: queued.action.type,
    success: false,
    data: { reason: result.reason },
  });
  return;
}
applyAction(room.gameState, queued.playerId, queued.action);
```

Send the reason with a rejection; the client needs it to show the player why.

## The tick loop

`GameLoop` adds real elapsed time to an accumulator and runs as many fixed `dt` steps as fit. The leftover stays for the next pass.

- The elapsed time fed into one pass is capped at 250 ms. Without a cap, a slow tick makes the next pass run more steps, which makes it slower still: the spiral of death. With the cap, a long stall slows the game down instead of freezing it.
- `setSpeed()` scales elapsed time, for fast-forward or slow motion. `dt` stays fixed.
- After each tick the room diffs its state against the previous tick and broadcasts only the changed top-level keys as `state_update`. Removed keys arrive as `null`. Diffing against the previous tick is safe because WebSocket runs on TCP and delivers every message in order; over an unreliable transport, encode against the client's acknowledged snapshot instead (`game-state-sync`, step 3). Send the full state again when a client reconnects (`room_joined` carries it).
- A throw in a room's tick or in `processAction` stops that room's loop, is logged, and closes that room. Other rooms keep running.

## More than one instance

A room lives in one instance's memory. Route every player of a room to the instance that holds it: return that instance's address when the room is created, or route on the room id at the load balancer.

Create one ioredis client when the server starts (`new Redis(redisUrl)`, with a `redis://` URL) and pass it to `createFanOut` and to the `redis-game-patterns` helpers. Use `boilerplate/fan-out.ts` only for messages that cross instances: a direct message to a player connected elsewhere, a server-wide announcement, or closing a banned player's sockets on every instance (a ban revokes sessions, but an open socket stays open until the server closes it). Implement `LocalDelivery` with a map from player id to socket that `open` fills and `close` clears.

Redis Pub/Sub delivers at most once. A message published while an instance is down or reconnecting is lost. Send match results, rewards and purchases through a queue (`bullmq-game-queues`), not through fan-out.

## When one space outgrows a process

One room on one instance fits matches. A persistent world with crowds needs more.

1. Partition by a unit of load: a zone, a shard or an instance. A zone is a region of one world, owned by one process. A shard or instance is an isolated copy of the same space, and players in different copies never meet. Keep a static map from unit to process that you can re-cut. CCP rebalanced EVE after a player-count rise by splitting which systems share a node, several times.
2. Know the floor. The unit of load cannot split below one hot area. In EVE, a node is one process on one CPU core, and CCP states that a single solar system that exceeds the capacity of its core can no longer be balanced further. More processes do not help a room that is too busy by itself. The options are smaller zones by design, a population cap, copies of the space, or the overload policy below.
3. Move non-spatial services off the simulation processes: chat, market, mail, and account or character data. The simulation process keeps only the tick. Call the others over HTTP or a queue (`bullmq-game-queues`), never from inside a tick. CCP reports that after it moved some services to separate character nodes, up to 80% of the calls that had gone to the busiest system node went elsewhere. That figure is EVE's, not a target.
4. Set an overload policy before launch. One option is time dilation: scale the game clock down so the work queue shrinks, then raise it back toward normal in small steps as load eases. `GameLoop.setSpeed()` does this: fewer fixed steps run per second, and `dt` stays fixed. Every time-based rule (cooldowns, regeneration, movement) must then read game time, not wall-clock time. Decide which timers must stay on real time. CCP exempts reinforcement timers from dilation, because players could otherwise move when they expire. The other option is to shed load: refuse joins to the busy zone, send low-priority updates less often (`game-state-sync`, step 8). CCP's pages do not say whether EVE dilates per node or for the whole cluster, so decide the scope for your game.

## What lives where

- Redis holds transient state: presence, rate-limit counters, room-to-instance routing, caches (`redis-game-patterns`). Redis persistence can lose data on a crash: an RDB snapshot setup can lose the latest minutes, and the AOF default (fsync every second) can lose about one second. Redis's own advice is RDB plus AOF for safety comparable to PostgreSQL. Treat anything you cannot afford to lose as not Redis-only.
- Postgres holds ledgers, balances, inventory and trades (`postgres-game-schema`, which has the tables and the guarded-spend query).
- A two-player trade is one Postgres transaction. First lock the two `players` rows with `SELECT ... FOR UPDATE`, ordered by id. Locking the player rows covers rows the trade inserts, such as merged stacks, which an inventory lock cannot. Then change inventory and currencies. Two opposite trades then take their locks in the same order and cannot wait on each other. If Postgres still aborts the transaction with SQLSTATE `40P01` (`deadlock_detected`), retry the whole transaction a small, bounded number of times. The Postgres docs give the two rules (acquire locks in a consistent order; retry transactions that abort for a deadlock). Applying them to a trade through the `players` rows is this skill's rule. It holds only if every other path that writes either player's inventory or currencies takes the same `players` locks first, in id order. A single guarded statement on one row, such as `spendCurrency`, is the one exception.
- Ledger and trade writes commit at once, unlike room-state writes. Write room state to Postgres on room close, on a timer, or from a queue, never awaited inside a tick.

## Heartbeat and presence

The client sends `ping`; the server answers `pong` with its time. On each ping, refresh the player's presence key with a TTL of a few heartbeat intervals (`redis-game-patterns`, presence pattern). A missing key means offline, so a crashed client needs no cleanup message. When the socket closes, `close` removes the player from every room that socket is in. After a reconnect the new socket replaces the old one in the room, so the old socket's late `close` leaves the player in place (the room compares socket ids).

## Pitfalls

- Trusting the client's state. Move, damage, inventory and score changes are computed on the server.
- Variable `dt` in game formulas. Game logic must see the fixed step, not wall-clock time.
- One global game state instead of rooms.
- Awaiting a database write inside a tick. Persist on room close or every N ticks, outside the tick callback.
- Broadcasting full state every tick. Send deltas; filter by what each player can see when the state is large.
- No cap on elapsed time per pass (spiral of death).
- Game systems that import WebSocket types and send messages. Systems change state and emit events; the room turns them into messages.
- Destroying a room the moment it empties. Go through `closing`: stop the loop, persist, notify, then delete.
- Reading the player id from a client message, or reading the session per message instead of once per upgrade.
- Forgetting that the session check runs once. Ban and logout do not close sockets that are already open; use the `kick` fan-out message.

## Files

- `boilerplate/server.ts`: copy when wiring the server. It mounts the Better Auth handler, checks `Origin` and the session in `.derive()` on the upgrade, and routes WebSocket messages to the room manager.
- `boilerplate/room-manager.ts`: copy when adding rooms. Read when plugging in game logic: `tickRoom` and `processAction` are the hooks.
- `boilerplate/game-loop.ts`: copy when a room needs its tick loop; it needs no changes.
- `boilerplate/fan-out.ts`: copy when you run more than one server instance.
- `templates/message-types.ts`: copy when defining the client-server protocol; extend the unions with your game's messages.
- `references/architecture.md`: read when you need the connection flow or room lifecycle as a diagram.
- `references/sources.md`: read when you need the page behind a rule here.

## Related skills

- `game-state-sync` for the client side: prediction, reconciliation, interpolation
- `bullmq-game-queues` for heavy or must-not-lose work off the tick loop
- `postgres-game-schema` for player profiles, inventory and match history
- `matchmaking-system` for filling rooms
