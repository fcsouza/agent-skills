---
name: game-state-sync
description: >-
  Keeps a multiplayer game's world consistent between an authoritative server and its clients: choosing a sync strategy (dumb client, lockstep, snapshot interpolation, client prediction with server reconciliation, lag compensation), plus TypeScript boilerplate for delta encoding, a rollback history buffer and a fixed-timestep client loop. Use when a multiplayer game feels laggy on input, shows remote players stuttering or teleporting, drifts out of sync between clients, or sends too much state per tick.
---

# Game State Sync

The server owns the game state. Clients send inputs, never results. Every technique below hides latency on top of that rule; none of them replaces it.

Prerequisites: a server tick loop and authority model (`game-backend-architecture`). For fanning deltas out across several server processes, see the fan-out section of `game-backend-architecture`.

## Pick a sync strategy

Decide this first. Most games combine rows: prediction for the local player, interpolation for everyone else, lag compensation for hits.

| Game situation | Strategy | Cost and limits | Boilerplate |
|---|---|---|---|
| Turn-based or slow (strategy, cards, board games) | Dumb client: send input, wait for the server's new state, render it | Input lag equals round-trip time. Fine when turns are slow | Not needed; skip prediction |
| Your own avatar in a real-time game | Client prediction plus server reconciliation: apply input locally, tag it with a sequence number, replay unacknowledged inputs on each server state | Mispredictions cause corrections; smooth small ones, snap large ones | `StateSyncEngine.reconcile`, `ClientGameLoop.handleServerUpdate` |
| Other players whose speed and direction change instantly (shooters) | Entity interpolation: render them in the past, between two received snapshots | They appear about one interpolation period behind. Source defaults to 100 ms (`cl_interp 0.1`) | `RollbackBuffer.getBracket` over received snapshots |
| Entities with predictable motion (vehicles, ships) | Dead reckoning: extrapolate from last speed and heading, correct on the next update | Wrong when motion changes. Cap how long you extrapolate | Pattern only, see `references/client-architecture.md` |
| Hit detection against entities shown in the past | Lag compensation: the server rewinds the world to the shooter's view time and tests the hit there | A target can be hit just after reaching cover | Not implemented; use `RollbackBuffer` for the history |
| 2-4 players, simulation you can make deterministic | Deterministic lockstep: send inputs only | Bandwidth independent of object count. Everyone waits for the slowest player's input; float differences break it | Not implemented |
| Physics-heavy co-op with no competitive stakes | Distributed authority with state synchronization: each player owns the objects it touches | Less secure; only for non-competitive play | Not implemented |

The preset values in `templates/sync-strategies.ts` (tick rates, byte budgets, buffer sizes) are starting points to measure against, not benchmarks.

## Procedure

### 1. Define the state shape

Keep entities in `Record<id, entity>`, not arrays. An insert into an array shifts every later index and the whole tail diffs as changed.

```typescript
interface MyGameState extends Record<string, unknown> {
  tick: number;
  players: Record<string, { x: number; y: number; vx: number; vy: number }>;
}
```

### 2. Run the authoritative server loop

```typescript
import { StateSyncEngine, type PlayerInput } from './state-sync';

const engine = new StateSyncEngine<MyGameState>(initialState, {
  tickRate: 20,
  snapshotInterval: 1,
  historyLength: 64,
  interpolationDelay: 2,
});

// Each server tick. With snapshotInterval: 1, tick() already stores this
// tick in the history; snapshot() replaces that entry (the buffer keeps one
// entry per tick) and returns { tick, state, timestamp } to send.
engine.tick((state, tick) => simulate(applyInputs(state, pendingInputs), tick));
const snap = engine.snapshot();
```

Send each client the new state as a delta (step 3), with the sequence number of the last input processed for that client.

### 3. Encode deltas against what the client has acknowledged

Over an unreliable transport such as UDP, encode each client's delta against the last snapshot that client acknowledged, not against the previous tick. A client that lost the previous packet cannot apply a delta built on it. Keep a per-client acknowledged tick and a history of sent snapshots (`RollbackBuffer`). Send a full snapshot on join and after sustained packet loss.

Over WebSocket, deltas against the previous tick are safe: WebSocket runs on TCP, which delivers every message in order, so the client always holds the previous state. This is what `game-backend-architecture` does. Resend a full snapshot when a client reconnects.

```typescript
import { encodeDelta, decodeDelta } from './delta-encoder';

const delta = encodeDelta(ackedBaseline, currentState); // server, per client
const next = decodeDelta(ackedBaseline, delta);          // client, same baseline
```

`toBinaryDelta` only frames the JSON delta in a byte buffer. It does not compress. Quantize floats yourself if bandwidth matters.

### 4. Predict and reconcile on the client

`clientTick` is your own counter, advanced once per fixed step (step 7). `applyLocalInput` does not advance the engine's tick.

```typescript
let sequence = 0;
const input: PlayerInput = { tick: clientTick, playerId, actions, sequence: ++sequence };
engine.applyLocalInput(input, applyInput); // predict now
send(input);

// On each authoritative state from the server
const result = engine.reconcile(serverState, serverTick, lastProcessedSequence, applyInput);
if (result.corrected) startCorrectionSmoothing();
```

`reconcile` discards inputs up to `lastProcessedSequence` and replays the rest on top of the server state. Keep irreversible outcomes (death, item pickup) until the server confirms them.

### 5. Interpolate everyone else

Store the snapshots you receive, keyed by server tick, and render remote entities a fixed delay behind the newest one. Make the delay span at least two snapshot intervals, so one lost snapshot still leaves two to interpolate between. A longer delay survives more consecutive losses at the cost of latency.

```typescript
import { RollbackBuffer } from './rollback-buffer';

const received = new RollbackBuffer<MyGameState>(32);
received.push(serverTick, serverState); // on each server snapshot

// Each render frame. estimatedServerTick is fractional, from your clock sync.
const renderTick = estimatedServerTick - delayTicks;
const { before, after } = received.getBracket(renderTick);
if (before && after) {
  const alpha = (renderTick - before.tick) / (after.tick - before.tick);
  render(lerpEntities(before.state, after.state, alpha));
}
```

Do not use `engine.getInterpolationStates` for this on the client: it reads the engine's own history, which holds the local player's predicted states.

When both ends are missing for longer than your extrapolation cap, freeze the entity and mark it stale. Source extrapolates for at most 0.25 s of packet loss (`cl_extrapolate_amount`).

### 6. Correct mispredictions

Snap the simulation state to the server's. Smooth only the rendered position: reduce small errors gradually and correct large ones fast, since a slow correction of a large jump disorients players.

### 7. Separate simulation from rendering on the client

Run the simulation at a fixed tick with an accumulator; render at display rate and interpolate with the leftover fraction. `boilerplate/game-loop-client.ts` does this. With a rendering engine that runs its own frame loop (Phaser, PixiJS, three.js), never call `start()`: call `step(now)` from the engine's per-frame callback and draw from `getRenderState()`, so one loop drives both. `game-client` covers the per-engine wiring. The full client walkthrough (input sampling, prediction, dead reckoning, the loop) is in `references/client-architecture.md`.

### 8. Send each client only what it can see

In a world with many entities, broadcasting every change to every client does not scale. Filter per client, then fit what remains into a byte budget.

Area of interest, first step: a uniform grid.
- Set the cell size to the radius of interest. A client receives entities in its own cell and the eight around it, so a lookup costs the same wherever the client stands.
- Store entities by cell. When one moves across a cell edge, take it out of the old cell and add it to the new one. Do nothing when it stays inside.
- A cell block is a rough fit for a circular radius, so some entities you send are out of range. Smaller cells filter more but cost more CPU, and the gain can be small. Measure before shrinking them.
- Build each client's delta (step 3) over its visible set only. An entity that enters the set goes out in full; one that leaves goes out as a removal.

Byte budget, second step: a priority accumulator, for when the visible set still does not fit.
- Give each entity a priority. Each tick, add it to that entity's accumulator for this client, sort by accumulator, and add entities to the packet until the byte budget is full.
- Reset the accumulator of every entity that fit. Leave the others as they are, so a skipped entity ranks higher next tick and never starves.
- Give the client's own avatar a priority high enough to be in every packet.
- Start from `bandwidth` in `templates/sync-strategies.ts`, then measure.

## Pitfalls

### Desync

- Floating-point results differ across compilers, operating systems and instruction sets. Lockstep needs fixed-point math or a deterministic physics engine. Server-authoritative sync tolerates the drift because the server's state wins.
- A delta that names a key the client lacks means the client missed its baseline. Request a full snapshot.
- Delta paths join keys with `.`, so a state key that contains a dot (`"x.y"`) decodes as a nested `x.y` path and the old key stays. Keep dots out of state keys.
- `StateSyncEngine` stores state with `structuredClone`. Keep state to plain data: no class instances, functions or DOM nodes.
- Treat every delta from the network as hostile, even from your own server. `delta-encoder.ts` refuses any path or key named `__proto__`, `constructor` or `prototype` and throws instead of applying the delta; keep that check if you change the path format.

### Bandwidth

- Compare by reference before deep-diffing. If `prev.players === current.players`, skip the subtree.
- Send each client only the entities it can see, and fill the packet by priority when it is full (step 8).

### Interpolation jitter

- If snapshots arrive late, the buffer runs dry and entities freeze or extrapolate. Lengthen the delay if this happens often.
- Remote players render in the past, so without lag compensation shooters must lead their targets.

## Files

- `boilerplate/state-sync.ts`: copy when you need the server or client engine. `StateSyncEngine` with tick, snapshot, delta, local prediction, reconciliation, rollback-and-replay, and interpolation over its own history.
- `boilerplate/delta-encoder.ts`: copy when you send state diffs. `encodeDelta`, `decodeDelta`, `toBinaryDelta`, `fromBinaryDelta`, `deltaByteSize`, `deepEqual`.
- `boilerplate/rollback-buffer.ts`: copy when you need tick-indexed history for rollback, acknowledged baselines or lag compensation. Ring buffer with `push`, `getAt`, `rollbackTo`, `getBracket`, `getRange`.
- `boilerplate/game-loop-client.ts`: copy when you build the browser client. `ClientGameLoop` with a fixed timestep, input ring buffer, prediction and `handleServerUpdate` reconciliation. It reports staleness (`isExtrapolating`) but does no dead reckoning itself. Runs its own `requestAnimationFrame` loop (`start()`) or is stepped from an engine's frame callback (`step()`, `getRenderState()`, `resetClock()`).
- `templates/sync-strategies.ts`: copy when you configure interpolation, prediction, rollback and bandwidth settings. Has action, turn-based and MMO presets. The presets do not configure area of interest; step 8 does.
- `references/client-architecture.md`: read when you build the client side: input sampling, the prediction loop, dead reckoning and fixed-timestep rendering, with a sequence diagram.
- `references/sources.md`: read when you need the talks and articles behind these rules.

## Related skills

- `game-backend-architecture`: the authoritative server loop and rooms these clients sync with.
- `game-client`: the browser client that renders this state and feeds it input, on plain Canvas/WebGL, Phaser, PixiJS or Three.js.
