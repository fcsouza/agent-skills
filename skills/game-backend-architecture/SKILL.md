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
3. A room owns its state, its action queue, its player set and its `GameLoop`. Rooms share nothing, and one room runs on one server instance.
4. REST for durable, request-response work (create a room, read a profile, buy an item). WebSocket for the match: actions in, state deltas out.
5. Authenticate once, on the WebSocket upgrade, from the Better Auth session. The player id comes from that session for the life of the socket, never from a message.
6. Default to 20 ticks per second. One tick then has a 50 ms budget for every room on the instance. Pick another rate per room when the genre needs it.

## Files

- `boilerplate/server.ts`: copy when wiring the server. It mounts the Better Auth handler, checks `Origin` and the session in `.derive()` on the upgrade, and routes WebSocket messages to the room manager.
- `boilerplate/room-manager.ts`: copy when adding rooms. Read when plugging in game logic: `tickRoom` and `processAction` are the hooks.
- `boilerplate/game-loop.ts`: copy when a room needs its tick loop; it needs no changes.
- `boilerplate/fan-out.ts`: copy when you run more than one server instance.
- `templates/message-types.ts`: copy when defining the client-server protocol; extend the unions with your game's messages.
- `references/architecture.md`: read when you need the connection flow or room lifecycle as a diagram.
- `references/sources.md`: read when you need the page behind a rule here.

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

## Related skills

- `game-state-sync` for the client side: prediction, reconciliation, interpolation
- `bullmq-game-queues` for heavy or must-not-lose work off the tick loop
- `postgres-game-schema` for player profiles, inventory and match history
- `matchmaking-system` for filling rooms
