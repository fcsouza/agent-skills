---
name: game-state-sync
description: >-
  Use when implementing client-server state synchronization, delta compression, optimistic updates, rollback netcode, or real-time game state reconciliation. Triggers: state sync, netcode, delta, rollback, interpolation, prediction.
---

# Game State Sync

## Purpose

Client-server state reconciliation, delta compression, optimistic updates, and rollback for multiplayer games.

## When to Use

Trigger: state sync, client-server, delta compression, optimistic updates, rollback, netcode, lag compensation, snapshot, interpolation, reconciliation

## Prerequisites

- `game-backend-architecture` — server loop, tick system, authority model
- `redis-game-patterns` — pub/sub for cross-server state distribution

## Core Principles

1. **Server is authoritative** — client predicts, server confirms or corrects. Never trust the client.
2. **Delta compression** — send only what changed, not full state. Reduces bandwidth by 80-95% in typical games.
3. **Optimistic updates** — apply input locally for instant feedback, revert if server disagrees.
4. **Snapshot + interpolation** — render smoothly between discrete server updates by interpolating between two known states.
5. **Rollback** — maintain a history buffer to rewind and replay when the server corrects a misprediction.
6. **Tick-aligned** — all state changes happen at discrete tick boundaries. No floating-point time drift.
7. **Bandwidth budget** — target < 10KB/s per player for typical games. Monitor and alert on spikes.

## Step-by-Step

### 1. Define Your State Shape

Use a generic type parameter so the sync engine works with any game state. Keep state flat where possible — deep nesting increases delta computation cost.

```typescript
// Your game defines the shape, the engine stays generic
interface MyGameState {
  players: Record<string, PlayerState>;
  projectiles: Record<string, ProjectileState>;
  world: WorldState;
}
```

### 2. Set Up the Sync Engine

```typescript
import { StateSyncEngine } from './state-sync';

const engine = new StateSyncEngine<MyGameState>({
  tickRate: 20,           // 20 ticks/second = 50ms per tick
  snapshotInterval: 3,    // snapshot every 3 ticks
  historyLength: 64,      // keep 64 ticks of history (~3.2s at 20Hz)
  interpolationDelay: 2,  // render 2 ticks behind for smooth interpolation
});
```

### 3. Client Prediction Loop

On the client, apply inputs immediately without waiting for server confirmation.

```typescript
// Client sends input + applies locally
const input: PlayerInput = { tick: currentTick, actions: getLocalInputs() };
engine.applyLocalInput(input);
sendToServer(input);

// When server state arrives, reconcile
onServerState((serverState, serverTick) => {
  engine.reconcile(serverState, serverTick);
});
```

### 4. Server Authority Loop

Server processes all inputs, advances the simulation, and broadcasts deltas.

```typescript
// Server tick
const previousState = engine.snapshot();
processAllInputs(pendingInputs);
advanceSimulation(tickDelta);
const currentState = engine.snapshot();

// Generate and broadcast delta
const delta = engine.generateDelta(previousState, currentState);
if (delta) {
  broadcastToClients(delta, currentTick);
}
```

### 5. Delta Compression

Use the delta encoder for bandwidth-efficient state transfer.

```typescript
import { encodeDelta, decodeDelta } from './delta-encoder';

// Server: compute minimal diff
const delta = encodeDelta(previousState, currentState);

// Client: reconstruct from base + delta
const reconstructed = decodeDelta(lastKnownState, delta);
```

### 6. Rollback on Misprediction

When server state diverges from client prediction, roll back and replay.

```typescript
import { RollbackBuffer } from './rollback-buffer';

const buffer = new RollbackBuffer<MyGameState>(64);

// Store every tick
buffer.push(currentTick, currentState);

// On server correction at tick N
const correctedState = buffer.rollbackTo(serverTick);
// Replay all inputs from serverTick to currentTick
replayInputs(correctedState, serverTick, currentTick);
```

### 7. Snapshot Interpolation (Visual Smoothing)

Render between two known server states for smooth visuals even at low tick rates.

```typescript
// Keep two recent server snapshots
const renderTick = currentTick - interpolationDelay;
const prev = buffer.getAt(Math.floor(renderTick));
const next = buffer.getAt(Math.ceil(renderTick));
const alpha = renderTick % 1;

// Interpolate positions, rotations, etc.
const renderState = interpolate(prev, next, alpha);
```

## Code Examples

See boilerplate files:

- `boilerplate/state-sync.ts` — Core `StateSyncEngine` class with prediction, reconciliation, and snapshot management
- `boilerplate/delta-encoder.ts` — Deep object diff with `encodeDelta` / `decodeDelta` and binary encoding option
- `boilerplate/rollback-buffer.ts` — Ring buffer with `push`, `getAt`, `rollbackTo` for memory-efficient history

## Client Architecture

The sections above cover the server-authoritative sync model. This section covers the client-side architecture that complements it: input handling, prediction, dead reckoning, and visual smoothing.

### Input Handling

Collect raw inputs (keyboard, mouse, gamepad) at display frame rate, then sample them at the simulation tick rate. Use a ring buffer to queue inputs for sending to the server.

```typescript
// Collect at display FPS, sample at tick rate
const rawInputs: RawInput[] = [];

// In your render loop (60+ FPS)
function onFrame() {
  rawInputs.push(captureCurrentInput());
}

// In your tick loop (e.g., 20 Hz)
function onTick(tickId: number) {
  const sampled = sampleInputs(rawInputs, tickId);
  rawInputs.length = 0; // Clear after sampling
  inputBuffer.push({ tickId, input: sampled });
  sendToServer({ tickId, input: sampled });
}
```

Key rules:
- Never drop inputs. If the tick rate is lower than the frame rate, merge intermediate inputs (e.g., combine multiple mouse deltas).
- Tag every input with its tick ID so the server can process inputs in tick order.
- Keep the ring buffer sized to at least `RTT / tickDuration * 2` entries for replay during rollback.

### Client-Side Prediction Loop

Apply inputs locally before waiting for server confirmation. This gives the player instant feedback while the server validates.

```typescript
// Apply locally, then send to server
const input = captureTickInput(currentTick);

// Predict: apply to local state immediately
localState = applyInput(localState, input);
inputBuffer.push({ tick: currentTick, input, predictedState: localState });

// Send to server for authoritative processing
sendToServer(input);
```

The prediction is "optimistic" — it assumes the server will agree. When the server sends its authoritative state, the client reconciles by replaying unacknowledged inputs on top of the server state (see Rollback section above).

### Input Buffer

Store the last N inputs with their tick ID for replay during server reconciliation. The buffer must be large enough to cover the round-trip time to the server.

```typescript
interface BufferedInput<TInput> {
  tick: number;
  input: TInput;
  predictedState: GameState;
}

class InputRingBuffer<TInput> {
  private buffer: (BufferedInput<TInput> | null)[];
  private head = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  push(entry: BufferedInput<TInput>): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
  }

  getInputsSince(tick: number): BufferedInput<TInput>[] {
    const results: BufferedInput<TInput>[] = [];
    for (let i = 0; i < this.capacity; i++) {
      const entry = this.buffer[i];
      if (entry && entry.tick >= tick) results.push(entry);
    }
    return results.sort((a, b) => a.tick - b.tick);
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
  }
}
```

### Dead Reckoning

When no server update has arrived for an entity, extrapolate its position based on the last known velocity and acceleration. This prevents entities from "freezing" during packet loss.

```typescript
interface EntitySnapshot {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  lastUpdateTick: number;
}

function deadReckon(
  entity: EntitySnapshot,
  currentTick: number,
  tickDuration: number,
): { x: number; y: number } {
  const elapsed = (currentTick - entity.lastUpdateTick) * tickDuration;
  return {
    x: entity.position.x + entity.velocity.x * elapsed,
    y: entity.position.y + entity.velocity.y * elapsed,
  };
}
```

Key rules:
- Cap extrapolation time (e.g., max 500ms). Beyond that, the entity is stale — show a visual indicator.
- When the server update finally arrives, blend from the dead-reckoned position to the corrected position over 2-3 frames to avoid snapping.
- For non-linear motion (e.g., turning vehicles), include angular velocity in the snapshot.

### Visual Smoothing

Separate the render loop from the game logic loop. The game logic runs at a fixed tick rate, while rendering runs at the display refresh rate and interpolates between the previous and current game states.

```typescript
// Fixed timestep game loop with interpolated rendering
let previous = performance.now();
let accumulator = 0;
const tickDuration = 1000 / TICK_RATE; // e.g., 50ms for 20Hz

let prevState = initialState;
let currState = initialState;

function loop(timestamp: number) {
  const dt = timestamp - previous;
  previous = timestamp;
  accumulator += dt;

  // Fixed timestep: advance simulation in discrete steps
  while (accumulator >= tickDuration) {
    prevState = currState;
    currState = simulateTick(currState);
    accumulator -= tickDuration;
  }

  // Render: interpolate between prev and current state
  const alpha = accumulator / tickDuration;
  render(interpolate(prevState, currState, alpha));

  requestAnimationFrame(loop);
}
```

This separation ensures:
- Game logic is deterministic and tick-aligned (no frame rate dependency)
- Rendering is smooth at any refresh rate (60Hz, 120Hz, 144Hz)
- Visual positions are always between two valid game states — no overshoot artifacts

### Client Game Loop

See `boilerplate/game-loop-client.ts` for a full TypeScript implementation of the client game loop that combines all the above concepts: fixed timestep, input sampling, client-side prediction, server reconciliation, and `requestAnimationFrame`-based rendering.

```typescript
import { ClientGameLoop } from './game-loop-client';

const gameLoop = new ClientGameLoop({
  tickRate: 20,
  inputBufferSize: 128,
  interpolationDelay: 2,
  maxExtrapolationMs: 500,
});

gameLoop.onTick = (state, tick) => {
  // Your game simulation step
  return applyPhysics(applyInputs(state, getLocalInput()));
};

gameLoop.onRender = (state, alpha) => {
  // Your rendering code
  renderer.draw(state, alpha);
};

gameLoop.onServerUpdate = (serverState, serverTick) => {
  // Automatic reconciliation + input replay
};

gameLoop.start();
```

## Cross-References

- **game-backend-architecture** — Server tick loop, authority model, input processing pipeline. The sync engine sits on top of the game loop.
- **redis-game-patterns** — Redis pub/sub for distributing state deltas across multiple server instances. Use sorted sets for leaderboard state that doesn't need tick-aligned sync.

## Pitfalls

### Desync Bugs
- **Floating-point determinism** — Different platforms compute slightly different float results. Use fixed-point arithmetic for physics or quantize values before comparison.
- **Input ordering** — Process inputs in tick order, not arrival order. Late inputs get applied to the correct historical tick via rollback.
- **Missing state** — If delta references a state key the client doesn't have, the client must request a full sync. Track state versions to detect gaps.

### Bandwidth Explosion
- **Array diffs are expensive** — Prefer `Record<id, entity>` over arrays. Array index shifts cause the entire array to diff as changed.
- **Unchanged nested objects** — Use reference equality checks before deep-diffing. If `prev.players === current.players`, skip the diff entirely.
- **High-frequency state** — Position updates at 60Hz for 100 players = ~600 updates/tick. Batch and compress. Use spatial partitioning to only send nearby entities.

### Interpolation Jitter
- **Clock drift** — Sync client clock to server via periodic time samples. Use a rolling average, not a single RTT measurement.
- **Buffer underrun** — If server packets arrive late, interpolation has no target state. Buffer at least 2 ticks ahead. Increase buffer on packet loss detection.
- **Teleporting entities** — If delta between snapshots is too large (entity moved > threshold), snap instead of interpolate to avoid visual artifacts.

## Designer Philosophy

> "A simulation that maintains consistency enables emergent gameplay — players can reason about the world because the world behaves predictably."
> — Will Wright

State sync exists to maintain the illusion that all players share the same consistent simulation. The closer your sync gets to true consistency, the more emergent and surprising gameplay becomes, because players can trust the world's rules.

## Sources

- **GDC Talks**: "Overwatch Gameplay Architecture and Netcode" (Tim Ford, GDC 2017), "Rocket League Physics and Networking" (Jared Cone, GDC 2018)
- **Valve Source Engine**: [Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking) — authoritative server, client prediction, entity interpolation, lag compensation
- **Glenn Fiedler**: [Networked Physics](https://gafferongames.com/post/networked_physics_in_virtual_reality/), [State Synchronization](https://gafferongames.com/post/state_synchronization/), [Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/)
- **Gabriel Gambetta**: [Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html) — client prediction, server reconciliation, entity interpolation series
