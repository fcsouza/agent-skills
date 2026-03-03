---
name: game-backend-architecture
description: >-
  Use when building game servers, WebSocket connections, room management, game tick loops, or server-authoritative architecture with Elysia. Triggers: game server, WebSocket, rooms, tick loop, server architecture, multiplayer backend.
---

# Game Backend Architecture

## Purpose

WebSocket + REST patterns, room/session management, game tick loops, genre-agnostic server design using Elysia + Bun. Covers server-authoritative architecture, fixed-timestep simulation, room lifecycle, typed message protocols, and horizontal scaling via Redis pub/sub.

## When to Use

Trigger: game server, backend architecture, WebSocket, room management, game loop, tick system, server-authoritative, real-time, Elysia game server, multiplayer backend, session management, game tick, fixed timestep server

## Prerequisites

- `postgres-game-schema` — database layer for persistent game state
- `redis-game-patterns` — caching, pub/sub, presence, and ephemeral state

## Core Principles

> "I'm not interested in creating a game that does things for the player. I want to create a simulation that responds to the player." — Will Wright

> "A game is a series of interesting decisions." — Sid Meier

The server is a simulation system that responds to player intentions and produces meaningful state changes. Every design decision should preserve determinism, enforce authority, and keep the door open for any genre.

1. **Server-authoritative**: the client sends intentions (actions), the server validates and executes. Never trust the client.
2. **Separate simulation loop from I/O**: the game tick runs on a fixed timestep independent of network or render cycles.
3. **Fixed timestep for deterministic game logic**: same inputs at the same tick always produce the same output, enabling replays, rollback, and offline catchup.
4. **Room-based architecture for multiplayer isolation**: each room encapsulates its own state, tick loop, and player set. Rooms are the unit of scaling.
5. **Stateless REST for CRUD, WebSocket for real-time state**: use REST for durable operations (create account, save inventory, fetch leaderboard) and WebSocket for ephemeral, high-frequency updates (game state, actions, presence).
6. **Event-driven**: game actions produce events, systems consume them. Decouple producers from consumers for testability and extensibility.
7. **Horizontal scaling via Redis pub/sub**: multiple Elysia instances share state through Redis. Any instance can handle any player; cross-server communication uses pub/sub channels.

## Step-by-Step Instructions

### 1. Define the Message Protocol

Start with `templates/message-types.ts`. Define discriminated unions for every client-to-server and server-to-client message. This is the contract between frontend and backend — get it right first.

```typescript
import type { ClientMessage, ServerMessage } from './templates/message-types';
```

### 2. Set Up the Elysia Server

Use `boilerplate/server.ts` as the entry point. It wires together:
- REST routes for CRUD operations (players, sessions, inventory)
- A WebSocket endpoint with JWT authentication
- Message routing to the room manager

```bash
bun run boilerplate/server.ts
```

### 3. Implement Room Management

Use `boilerplate/room-manager.ts`. The room manager handles:
- Creating and destroying rooms
- Joining and leaving players
- Broadcasting messages to room members
- Room lifecycle transitions (created -> active -> closing -> closed)

Each room owns its game state and tick loop instance.

### 4. Configure the Game Loop

Use `boilerplate/game-loop.ts`. The `GameLoop` class provides:
- Fixed-timestep accumulator pattern
- Configurable tick rate (default 20 TPS for most genres)
- Speed multiplier for fast-forward or slow-motion
- Delta time overflow protection (caps accumulated time to prevent spiral of death)

Attach one `GameLoop` per room. The tick callback receives `dt` in seconds and updates room state.

### 5. Wire Room State to WebSocket Broadcasts

After each tick, diff the room state and broadcast deltas to all room members:

```typescript
room.gameLoop.onTick = (dt) => {
  room.state = updateGameState(room.state, dt);
  const delta = computeDelta(room.previousState, room.state);
  if (delta) {
    room.broadcast({ type: 'state_update', roomId: room.id, state: delta, tick: room.tick });
  }
  room.previousState = structuredClone(room.state);
  room.tick++;
};
```

### 6. Add Redis Pub/Sub for Scaling

When running multiple Elysia instances behind a load balancer:

```typescript
import { Redis } from 'ioredis';

const pub = new Redis(process.env.REDIS_URL!);
const sub = new Redis(process.env.REDIS_URL!);

sub.subscribe('game:broadcast', 'game:direct');
sub.on('message', (channel, message) => {
  const parsed = JSON.parse(message);
  if (channel === 'game:broadcast') {
    server.publish(parsed.channel, parsed.data);
  }
  if (channel === 'game:direct') {
    const ws = connections.get(parsed.userId);
    if (ws) ws.send(parsed.data);
  }
});
```

### 7. Implement Presence and Heartbeat

- Client sends `ping` every 30 seconds
- Server responds with `pong` + server timestamp
- If no ping within 90 seconds, mark player offline and clean up room membership
- Store presence in Redis with TTL for automatic expiry

## Code Examples

### Fixed-Timestep Server Loop

```typescript
const TICK_RATE = 20;
const TICK_DURATION_MS = 1000 / TICK_RATE;

const loop = new GameLoop(TICK_RATE, (dt) => {
  for (const room of roomManager.getActiveRooms()) {
    room.update(dt);
    room.broadcastState();
  }
});

loop.start();
```

### Server-Authoritative Action Processing

```typescript
const processAction = (
  room: Room,
  playerId: string,
  action: { type: string; payload: Record<string, unknown> },
): ActionResult => {
  // 1. Validate: is this action legal in current state?
  const validation = validateAction(room.state, playerId, action);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // 2. Execute: apply to authoritative state
  const events = applyAction(room.state, playerId, action);

  // 3. Broadcast: notify all room members of resulting events
  for (const event of events) {
    room.broadcast({
      type: 'game_event',
      event: event.type,
      data: event.data,
      tick: room.tick,
    });
  }

  return { success: true, events };
};
```

### Room-Scoped State Update

```typescript
const updateRoomState = (room: Room, dt: number) => {
  // Run all registered systems in order
  for (const system of room.systems) {
    system.update(room.state, dt);
  }

  // Process queued player actions
  while (room.actionQueue.length > 0) {
    const { playerId, action } = room.actionQueue.shift()!;
    processAction(room, playerId, action);
  }

  room.tick++;
};
```

### WebSocket Message Routing

```typescript
const handleMessage = (ws: GameWebSocket, data: ClientMessage) => {
  const { playerId } = ws.data;

  switch (data.type) {
    case 'join_room':
      roomManager.joinRoom(data.roomId, playerId, ws);
      break;
    case 'leave_room':
      roomManager.leaveRoom(data.roomId, playerId);
      break;
    case 'action':
      roomManager.queueAction(data.roomId, playerId, data.action);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
      break;
  }
};
```

### Delta State Synchronization

```typescript
const computeDelta = (
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> | null => {
  const delta: Record<string, unknown> = {};
  let hasChanges = false;

  for (const key of Object.keys(current)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      delta[key] = current[key];
      hasChanges = true;
    }
  }

  return hasChanges ? delta : null;
};
```

## Cross-References

- **`redis-game-patterns`** — presence storage, pub/sub for cross-server communication, room state caching, rate limiting
- **`bullmq-game-queues`** — offload heavy computations (matchmaking, leaderboard recalc, scheduled events) to background workers
- **`game-state-sync`** — client-side state reconciliation, interpolation, optimistic updates, rollback
- **`postgres-game-schema`** — persistent storage for player profiles, inventory, match history, room configurations

## Pitfalls & Anti-Patterns

### 1. Client-Authoritative State
**Wrong**: client sends "my position is (100, 200)" and server trusts it.
**Right**: client sends "move north" intention, server validates movement speed, collision, and updates position.

### 2. Variable Timestep for Game Logic
**Wrong**: using wall-clock delta time directly in game formulas.
**Right**: fixed-timestep accumulator — game logic always sees the same `dt`, regardless of how fast the server runs.

### 3. Global State Instead of Room Isolation
**Wrong**: single shared game state object for all players.
**Right**: each room owns its state, tick loop, and player set. Rooms are independent simulation contexts.

### 4. Synchronous Database Writes in the Tick Loop
**Wrong**: `await db.update(players).set(...)` inside the tick callback.
**Right**: batch state changes and persist asynchronously outside the tick loop (e.g., every N ticks or on room close).

### 5. Broadcasting Full State Every Tick
**Wrong**: sending the entire game state to every player on every tick.
**Right**: compute deltas and only send what changed. Use interest management to filter updates per player.

### 6. No Overflow Protection
**Wrong**: accumulator grows unbounded when server lags, causing hundreds of catch-up ticks.
**Right**: cap accumulated time (e.g., 1 second max) to prevent spiral of death.

### 7. Tight Coupling Between Message Types and Game Logic
**Wrong**: game systems import WebSocket types and send messages directly.
**Right**: game systems produce events, a separate broadcast layer translates events to WebSocket messages.

### 8. No Graceful Room Shutdown
**Wrong**: rooms disappear instantly when the last player leaves, losing unsaved state.
**Right**: transition through closing state — persist state, notify players, clean up resources, then destroy.

## Designer Philosophy

**Will Wright's Simulation Thinking**: the server is not a script executor — it is a simulation. Players interact with systems that have emergent behavior. The server defines rules and constraints; the interesting outcomes arise from player interactions within those rules. Design your tick loop as a simulation step, not a sequence of hardcoded events.

**Sid Meier's Interesting Decisions**: every message from the client represents a decision. The server's job is to make that decision meaningful by enforcing constraints (can you afford this action?), producing consequences (what happens as a result?), and communicating outcomes (what changed?). If an action has no validation and no consequence, it is not an interesting decision — remove it or make it matter.

**Practical Implications**:
- Validation is gameplay. Rejection messages should explain *why* an action failed, giving players information for their next decision.
- Events are the language of consequence. When an action produces events that other systems consume, you get emergent complexity without writing combinatorial logic.
- The tick loop is your simulation clock. Everything that "happens" in the game happens during a tick. Between ticks, the game world is frozen and consistent.

## Sources

- Glenn Fiedler, "Fix Your Timestep!" — https://gafferongames.com/post/fix_your_timestep/
- Gabriel Gambetta, "Fast-Paced Multiplayer" — https://www.gabrielgambetta.com/client-server-game-architecture.html
- Elysia documentation — https://elysiajs.com/
- Redis pub/sub documentation — https://redis.io/docs/manual/pubsub/
- Will Wright, GDC talks on simulation design
- Sid Meier, GDC 2012, "Interesting Decisions"
