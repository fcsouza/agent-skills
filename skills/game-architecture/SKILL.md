---
name: game-architecture
version: 1.0.0
description: >-
  Use when implementing browser game engine patterns — game loops, tick systems,
  state management, entity-component-system (ECS), save/load serialization,
  offline progress calculation, React rendering optimization, performance
  tuning, or modular game system architecture with TypeScript.
---

# Game Architecture

Patterns and implementations for browser-based games using TypeScript, React,
and Zustand. Covers game loops, state management, ECS, save/load, offline
progress, and performance optimization.

---

## Game Loop Patterns

Two independent loops: **simulation** (fixed timestep) and **rendering** (rAF).

- **Simulation loop**: Fixed tick rate (10/sec for idle, 60/sec for action). Uses delta-time accumulator to ensure deterministic updates regardless of frame rate.
- **Render loop**: `requestAnimationFrame` for smooth visuals. Interpolates between simulation states.
- **React integration**: Game loop runs OUTSIDE React. Systems update Zustand stores, React re-renders via selectors.

```typescript
import { useGameStore } from './stores/gameStore';

const TICK_RATE = 10;
const TICK_DURATION = 1000 / TICK_RATE;

let lastTime = 0;
let accumulator = 0;

const gameLoop = (currentTime: number) => {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Cap delta to prevent spiral of death
  accumulator += Math.min(deltaTime, 1000);

  while (accumulator >= TICK_DURATION) {
    const dt = TICK_DURATION / 1000;
    // Tick all game systems
    resourceSystem.tick(dt);
    upgradeSystem.tick(dt);
    combatSystem.tick(dt);
    accumulator -= TICK_DURATION;
  }

  requestAnimationFrame(gameLoop);
};

requestAnimationFrame((time) => {
  lastTime = time;
  gameLoop(time);
});
```

For full `GameLoop` class, hooks, speed control, and pause/resume, read `references/game-loop.md`.

---

## State Management

Zustand is the best fit for game state — minimal boilerplate, selector-based re-rendering, works outside React.

**Why NOT Redux**: Redux dispatch overhead per tick is too high. Zustand `setState` is a direct merge — no action creators, no reducers, no middleware chain per update.

**Architecture**: One store per game system. Cross-system reads use selectors.

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ResourceState {
  gold: number;
  gems: number;
  goldPerSecond: number;
  addGold: (amount: number) => void;
  tick: (dt: number) => void;
}

const useResourceStore = create<ResourceState>()(
  immer((set) => ({
    gold: 0,
    gems: 0,
    goldPerSecond: 1,
    addGold: (amount) =>
      set((state) => {
        state.gold += amount;
      }),
    tick: (dt) =>
      set((state) => {
        state.gold += state.goldPerSecond * dt;
      }),
  })),
);

// Fine-grained selector — only re-renders when gold changes
const gold = useResourceStore((s) => s.gold);
```

**Middleware stack**: `persist` (localStorage save), `devtools` (debug), `immer` (nested mutations).

For store architecture, slicing, serialization, and migrations, read `references/state-patterns.md`.

---

## Entity-Component-System

Lightweight ECS for browser games with many similar entities (enemies, projectiles, particles).

- **Entity**: Number ID (auto-incrementing counter).
- **Component**: Typed data object attached to an entity (`Position`, `Velocity`, `Health`).
- **System**: Function that queries entities by component set and operates on them each tick.

```typescript
// Define components
interface Position { x: number; y: number; }
interface Velocity { dx: number; dy: number; }
interface Health { current: number; max: number; }

// Create world and entities
const world = new World();
const enemy = world.createEntity();
world.addComponent(enemy, 'Position', { x: 100, y: 200 });
world.addComponent(enemy, 'Velocity', { dx: -1, dy: 0 });
world.addComponent(enemy, 'Health', { current: 50, max: 50 });

// System: move all entities with Position + Velocity
const movementSystem = (world: World, dt: number) => {
  for (const [entity, pos, vel] of world.query('Position', 'Velocity')) {
    pos.x += vel.dx * dt * 60;
    pos.y += vel.dy * dt * 60;
  }
};
```

**When to use ECS**: 100+ entities with shared behavior, dynamic composition needed.
**When NOT to use**: Simple idle games with fixed systems, fewer than 20 entities — plain objects are simpler.

For full `World` class implementation and performance notes, read `references/ecs.md`.

---

## Modular Game Systems

Each game system implements a standard interface for lifecycle, serialization, and tick updates.

```typescript
interface GameSystem<T = unknown> {
  id: string;
  init(): void;
  tick(dt: number): void;
  serialize(): T;
  deserialize(data: T): void;
}
```

**Common systems**: `ResourceSystem`, `UpgradeSystem`, `CombatSystem`, `InventorySystem`, `QuestSystem`, `AchievementSystem`, `PrestigeSystem`.

**Plugin architecture**: Systems register with a `GameEngine` that calls `init()` on start, `tick(dt)` each frame, and `save()`/`load()` for persistence. The engine iterates its system map in registration order.

---

## Save/Load System

JSON serialization to localStorage with versioned format and migration support.

```typescript
interface SaveFile {
  saveVersion: number;
  timestamp: number;
  playtime: number;
  systems: Record<string, unknown>;
}
```

- **Versioned format**: `saveVersion` field increments on schema changes. Migration functions run sequentially (`v1→v2→v3`) on load.
- **Auto-save**: 30-second interval via `setInterval`.
- **Export/import**: Base64-encoded JSON (`btoa`/`atob`) for save sharing.
- **Server sync**: POST save to API on interval, or on tab close via `navigator.sendBeacon`.

For full migration system and persistence patterns, read `references/state-patterns.md`.

---

## Offline Progress

Calculate what happened while the player was away.

| Strategy | Speed | Accuracy | Best For |
|----------|-------|----------|----------|
| Fast-forward ticks | Slow | Exact | Complex event-driven systems |
| Analytical formula | Instant | Approximate | Simple resource generation |
| Hybrid | Fast | Good | Most games |

```typescript
const calculateOfflineProgress = (
  lastTimestamp: number,
  engine: GameEngine,
) => {
  const now = Date.now();
  const elapsedSeconds = (now - lastTimestamp) / 1000;

  // Cap offline time (anti-exploit)
  const cappedTime = Math.min(elapsedSeconds, 24 * 60 * 60); // 24h max

  // Strategy 1: Fast-forward (cap iterations)
  const TICK_RATE = 10;
  const maxTicks = Math.min(cappedTime * TICK_RATE, 1000);
  const tickDt = cappedTime / maxTicks;

  for (let i = 0; i < maxTicks; i++) {
    engine.tick(tickDt);
  }

  // Strategy 2: Analytical (for simple resources)
  // gold += goldPerSecond * cappedTime;

  // Strategy 3: Hybrid — analytical for resources, ticks for events
};
```

**Anti-exploit**: Cap offline duration, validate calculations server-side, apply diminishing returns after threshold.

---

## Performance Quick Reference

| Technique | When to Use |
|-----------|-------------|
| `React.memo` | Components re-rendering without prop changes |
| Zustand selectors | Prevent re-renders from unrelated state changes |
| `useShallow` | Select arrays/objects from store |
| Canvas rendering | Sprites, animations, particle effects |
| Web Workers | Offline progress, pathfinding, heavy math |
| `@tanstack/virtual` | Inventories with 100+ items, chat logs |
| Dynamic `import()` | Game areas loaded on demand |
| `requestAnimationFrame` | Visual updates only, not simulation |
| Object pooling | Frequent entity creation/destruction |

For detailed optimization patterns, read `references/performance.md`.

---

## Cross-References

| Topic | Skill |
|-------|-------|
| Idle/incremental game mechanics | `idle-game-design` |
| RPG combat, stats, loot systems | `rpg-systems` |
| Browser MMO multiplayer sync | `browser-mmo-design` |
