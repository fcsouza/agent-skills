---
name: procedural-gen
description: Covers seeded procedural generation of dungeons, maps, terrain and world content - seeds and RNG, algorithm choice, budgets, validation and caching. Use when a game needs generated levels or worlds that stay reproducible from a seed, or when generated content repeats, comes out unplayable or loops forever. Loot and drop tables belong to `game-economy-design`.
---

# Procedural generation

## Decide before you build

State these for each generator. They set where validation effort goes.

- Online (at runtime) or offline (at build time). Runtime generators must run in milliseconds.
- Necessary or optional content. A level with no reachable exit is a bug. A misplaced decoration is not. Validate necessary content fully and optional content lightly.
- Deterministic or stochastic. Deterministic means the same seed and parameters give the same content, which lets you reproduce bugs, share seeds and regenerate instead of store.
- Constructive (one pass) or generate-and-test (loop until a test passes). Both are normal. Generate-and-test needs a retry cap.

## Rules

1. **Seed everything.** Use a seeded PRNG such as mulberry32 (in `boilerplate/dungeon-generator.ts`). `Math.random()` cannot be seeded or reset by the caller.
2. **Derive one seed per system** from the world seed (`<worldSeed>:<system>:<id>`), so changing one generator does not shift the output of the others. Read `templates/world-seed-config.md` when you design the derivation and the generation order.
3. **Set the budget first.** Min and max for rooms, enemies, items and path length come before any generation code. The budget is the design.
4. **Generate in layers.** Macro structure first (world, regions, areas), then detail (rooms, props, items). Each layer constrains the next.
5. **Prefer playability by construction.** Cap gap widths at the jump range and connect rooms along the tree. Check afterwards only what construction cannot promise.
6. **Emit a witness.** Generate a solution path with the level and test it. A level with a valid path is solvable. Reachability found by a later search is a bug found late.
7. **Cap every retry loop.** Fail with a clear error and loosen the budget. Never `while (true)`.
8. **Do not simulate more detail than the player sees.** Extra layers cost time and make causes hard to trace.
9. **Cache or regenerate, never both.** Store what the player can change or what is slow to build. Regenerate what the player only observes.
10. **Version the generator.** Any algorithm change makes old seeds produce different content. Store the generator version beside the seed.

## Choose the algorithm

| Content | Algorithm | Notes |
|---|---|---|
| Rooms and corridors | BSP tree | Split recursively, one room per leaf, connect rooms along the tree. Rooms never overlap. Tree nodes can group rooms into themed wings. |
| Caves | Cellular automata | Fill at random, then repeat a neighbour rule. Parameters interact, so you cannot ask for "N rooms". |
| Terrain heights | Gradient noise summed over octaves | One noise scale gives uniform undulation. Add octaves at half amplitude per doubled frequency. Never fill a heightmap with independent random values. |
| Plants and other self-similar shapes | L-systems | Rewrite all symbols in parallel, then draw the string. |
| Tile worlds from an example | Wave Function Collapse | Output only contains patterns found in the input. Propagation can remove every option for a cell (a contradiction), so allow a restart. |
| Mission order (keys, locks) | Graph grammar, then layout | Generate the mission graph and the space as two steps. |
| Hand-made rooms assembled at random | Template chunks | Use when authored quality matters more than novelty. Spelunky works this way. |

Read `references/algorithms.md` when you need the parameters, steps and failure modes for BSP, cellular automata, noise octaves or the witness-path check.

For a full runtime pipeline (voxel generation, polygonization, texturing, population, simulation), watch the GDC 2017 talk "Continuous World Generation in 'No Man's Sky'" by Innes McKendrick. The link is in `references/sources.md`.

## Procedure

1. Pick the seed format and PRNG. Use string seeds for player-facing seeds. A 32-bit seed space reaches a 50% chance of some collision after about 77,000 seeds.
2. Write the budget as a typed object, including `maxRetries`.
3. Generate with a PRNG derived from the seed and the attempt number.
4. Validate. Return `null` after `maxRetries` and let the caller loosen the budget.
5. Measure the generator (see below) before you ship it.

```typescript
const generateWithValidation = <T>(
  generator: (rng: () => number) => T,
  validator: (result: T) => boolean,
  makeRng: (attempt: number) => () => number,
  maxRetries: number,
): T | null => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = generator(makeRng(attempt));
    if (validator(result)) return result;
  }
  return null;
};
```

## Measure the generator

Pick two or three metrics that do not simply echo your input parameters (for example, linearity or density, not "difficulty" if difficulty is an input). Generate a large sample, plot a 2D histogram of the metrics and read the hot spots. Compare the plots across parameter settings to see how much control the parameters give. This finds bias. It does not prove quality.

## Usage

```typescript
import { DungeonGenerator } from './dungeon-generator';

const dungeon = new DungeonGenerator().generate('my-seed-123', {
  width: 80,
  height: 60,
  minRooms: 5,
  maxRooms: 12,
  minRoomSize: 4,
  maxRoomSize: 10,
  corridorWidth: 1,
});
// dungeon.rooms, dungeon.corridors, dungeon.entrance, dungeon.exits, dungeon.grid
```

## Pitfalls

- Over-constrained budgets make generate-and-test loop until the cap. Log the failure rate per attempt.
- Wave Function Collapse runs into contradictions when the input is tight. Cap the restarts like any other retry.
- Storing the content and the seed both. The two drift apart when the generator changes.
- Generating and discarding in a hot loop. Batch the attempts and cap them.
- Seeds shared as 32-bit numbers collide at scale. Use longer or string seeds.

## Files

- `boilerplate/dungeon-generator.ts`: copy when you need a seeded BSP dungeon generator with rooms, corridors, entrance, exits and a cell grid. It retries up to 20 times and throws when the budget is too tight.
- `templates/world-seed-config.md`: read when you design seed derivation, generation order and the store-or-regenerate split.
- `references/algorithms.md`: read when you implement BSP, cellular automata, noise octaves or the witness-path check.
- `references/sources.md`: read when you need the source behind a claim.

## Related skills

- `game-economy-design` (loot tables, drop rates)
- `postgres-game-schema` (stored generated content)
- `redis-game-patterns` (session caches)
- `game-backend-architecture` (server-side generation)
