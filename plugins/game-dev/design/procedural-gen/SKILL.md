---
name: design-procedural-gen
description: >-
  Use when implementing procedural content generation, dungeon or map generation, procedural loot tables, world seeds, noise-based terrain, NPC behavior variation, or wave function collapse. Triggers: procedural, dungeon gen, map gen, loot table, world seed, noise, BSP, wave function collapse, randomization.
---

# Procedural Content Generation

## Purpose

Procedural content generation for replayability — maps, dungeons, loot, terrain, NPC behavior variation, and world construction. Genre-agnostic — applies to roguelikes, survival games, idle games, open-world titles, or any game that benefits from generated content.

## When to Use

Trigger: procedural generation, dungeon gen, map gen, loot table, world seed, noise terrain, BSP, wave function collapse, randomization, seeded random, perlin noise, simplex noise, generated content, roguelike, replayability

## Prerequisites

- `game-economy-design` — loot balance and reward curves
- `postgres-game-schema` — caching generated content, seed storage

## Core Principles

> Will Wright: "I'm not interested in creating a game that does things for the player. I want to create a simulation that responds to the player." — Emergence from simple rules is the heart of procedural generation.

> Derek Yu (Spelunky): "The magic of procedural generation isn't randomness — it's constrained randomness. The constraints are the design."

> Tarn Adams (Dwarf Fortress): "Simulate the world first, then let the stories emerge."

> The original Rogue developers (Michael Toy, Glenn Wichman): "Every run should feel different, but every run should feel fair."

1. **Seed everything** — same seed = same result; enables debugging, sharing, bug reproduction, and deterministic replays
2. **Separate generation from validation** — generate freely, then validate constraints; never generate-and-check in a tight loop that risks infinite loops
3. **BSP (Binary Space Partitioning) for dungeon rooms** — balanced, controllable density; recursively split space into leaf nodes, place rooms in leaves
4. **Perlin/Simplex noise for continuous variation** — terrain, weather, ambient variation, resource density; always coherent and smooth
5. **Weighted random tables for loot** — never pure random; control variance with weights, pity systems, and guaranteed drops (cross-ref `game-economy-design`)
6. **Wave Function Collapse for tile-based worlds** — define adjacency rules between tiles, collapse cells from lowest entropy; produces coherent, rule-respecting layouts
7. **Budget constraints before generation** — set min/max values for room count, enemy density, item count, path length BEFORE generating; the budget is the design
8. **Layered generation** — generate macro structure first (world → regions → areas), then micro detail (rooms → furniture → items); each layer constrains the next
9. **Cache or regenerate, never both** — decide per content type: store in DB (expensive to generate, rarely changes) or regenerate on demand (cheap, seed-deterministic)
10. **Determinism across environments** — use a known PRNG algorithm (mulberry32, xoshiro128), never `Math.random()`; JS engine differences in `Math.random()` break cross-platform seeds

## Step-by-Step Instructions

### 1. Define Seed and RNG Strategy

Choose a seeded PRNG. Never use `Math.random()` — it is not seedable and varies across engines.

```typescript
// mulberry32 — fast, deterministic, 32-bit state
const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
```

Derive per-system seeds from a world seed:

```typescript
const deriveSubSeed = (worldSeed: string, system: string, id: string): number => {
  const str = `${worldSeed}:${system}:${id}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
};
```

### 2. Choose Generation Algorithm

| Content Type | Algorithm | When to Use |
|---|---|---|
| Dungeon rooms/corridors | BSP tree | Grid-based levels with rooms and hallways |
| Open terrain, height maps | Perlin/Simplex noise | Continuous, smooth landscapes |
| Tile-based worlds | Wave Function Collapse | Tile sets with adjacency rules |
| Loot, drops, rewards | Weighted random tables | Any item distribution system |
| Cave systems | Cellular automata | Organic, cave-like shapes |
| City layouts, road networks | L-systems / Voronoi | Structured but organic layouts |

### 3. Define Budget Constraints

Before any generation runs, define hard limits:

```typescript
interface GenerationBudget {
  minRooms: number;
  maxRooms: number;
  minEnemies: number;
  maxEnemies: number;
  minItems: number;
  maxItems: number;
  maxRetries: number; // CRITICAL: prevent infinite loops
}
```

### 4. Generate, Validate, Retry

```typescript
const generateWithValidation = <T>(
  generator: (rng: () => number) => T,
  validator: (result: T) => boolean,
  seed: number,
  maxRetries: number,
): T | null => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rng = mulberry32(seed + attempt);
    const result = generator(rng);
    if (validator(result)) return result;
  }
  return null; // Budget exhausted — loosen constraints or fix generator
};
```

### 5. Cache Generated Content

For expensive generation (full dungeon layouts, world maps), cache keyed by seed:

```typescript
// Store in DB via postgres-game-schema
const cacheKey = `${generatorVersion}:${seed}`;
// Regenerate on demand for cheap content (loot rolls, NPC names)
```

Cross-reference `redis-game-patterns` for ephemeral seed caches during active sessions.

## Code Examples

### BSP Dungeon Generation

See `boilerplate/dungeon-generator.ts` for a complete BSP-based dungeon generator. Usage:

```typescript
import { DungeonGenerator } from './dungeon-generator';

const generator = new DungeonGenerator();
const dungeon = generator.generate('my-seed-123', {
  width: 80,
  height: 60,
  minRooms: 5,
  maxRooms: 12,
  minRoomSize: 4,
  maxRoomSize: 10,
  corridorWidth: 1,
});

// dungeon.rooms — array of placed rooms
// dungeon.corridors — connections between rooms
// dungeon.entrance — starting point
// dungeon.exits — exit points
// dungeon.grid — 2D cell array for rendering
```

### Weighted Loot Tables

See `boilerplate/loot-table.ts` for a weighted loot table using Vose's alias method. Usage:

```typescript
import { LootTable } from './loot-table';

const table = new LootTable<string>()
  .add('Common Sword', 60)
  .add('Rare Shield', 25)
  .add('Epic Staff', 10)
  .add('Legendary Crown', 4)
  .add('Mythic Amulet', 1)
  .withGuaranteed('Health Potion');

const drops = table.roll(3, seededRng); // 3 weighted rolls + guaranteed item
```

## Cross-References

- `game-economy-design` — loot balance, reward curves, drop rate tuning
- `postgres-game-schema` — caching generated content in DB, seed storage
- `redis-game-patterns` — ephemeral seed cache, session-scoped generated content
- `game-backend-architecture` — server-side generation, authoritative dungeon state

## Pitfalls & Anti-Patterns

- **Infinite retry loops** — overly constrained budgets cause generate-validate to loop forever; always cap retries with `maxRetries` and fail gracefully
- **Seed collisions at scale** — 32-bit seeds have ~4B values; at 10K daily seeds, birthday paradox hits around 65K seeds; use 64-bit or string seeds for large-scale games
- **Non-determinism across JS engines** — `Math.random()` implementations differ between V8, SpiderMonkey, and JavaScriptCore; always use an explicit PRNG
- **Generating in a tight loop** — generating and immediately discarding in a while(true) burns CPU; batch attempts, cap retries, and log failure rates
- **Storing generated content AND the seed** — pick one; storing both wastes space and creates sync bugs when the generator version changes
- **Over-constraining WFC** — too many adjacency rules make collapse impossible; start with loose rules and tighten incrementally
- **Forgetting generator versioning** — if you change the algorithm, old seeds produce different results; version your generators and store the version alongside the seed

## Designer Philosophy

**Will Wright** (SimCity, Spore): The best procedural systems are emergent — simple rules interacting to produce complex, unpredictable results. Your generator should surprise you. If you can predict every output, the system isn't complex enough. If every output is chaos, the constraints aren't tight enough.

**Derek Yu** (Spelunky): Procedural generation is not a substitute for design. Every generated room, every placed enemy, every dropped item should feel intentional. The generator is a tool that executes your design intent at scale — it needs clear rules, tight constraints, and careful tuning.

**Tarn Adams** (Dwarf Fortress): Simulate deeply. The richest procedural content comes from layered simulation — history generates factions, factions generate conflicts, conflicts generate quests. Each layer feeds the next.

## Sources

- "Procedural Content Generation in Games" — Noor Shaker, Julian Togelius, Mark J. Nelson
- "Spelunky" — Derek Yu (Boss Fight Books)
- "The Art of Game Design" — Jesse Schell, Chapter on Randomness
- "Wave Function Collapse" — Maxim Gumin (original algorithm)
- GDC Talks: "Building Worlds with Noise" (2018), "Procedural Generation in No Man's Sky" (2017)
