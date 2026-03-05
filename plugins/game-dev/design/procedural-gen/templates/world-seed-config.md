# World Seed Configuration Template

## Seed Format

**Recommended format:** alphanumeric string, 8-32 characters.

```
worldSeed = "ocean-crystal-4519"
```

**Collision probability analysis:**

| Seed Space | Daily Seeds | Time to 50% Collision |
|---|---|---|
| 32-bit integer (4.3B) | 1,000 | ~7 years |
| 32-bit integer (4.3B) | 10,000 | ~9 months |
| String (a-z0-9, 8 chars) | 10,000 | ~1.1M years |
| String (a-z0-9, 16 chars) | 100,000 | heat death of universe |

**Recommendation:** use string seeds for player-facing seeds, numeric for internal sub-seeds.

## Per-System Seed Derivation

Derive sub-seeds from the world seed to isolate systems. Changing one system's generator does not affect others.

```
dungeonSeed  = hash(worldSeed + ":dungeon:" + levelId)
lootSeed     = hash(worldSeed + ":loot:" + levelId + ":" + roomId)
terrainSeed  = hash(worldSeed + ":terrain:" + chunkX + ":" + chunkY)
npcSeed      = hash(worldSeed + ":npc:" + npcId)
weatherSeed  = hash(worldSeed + ":weather:" + dayNumber)
```

**Rules:**
- Always include the system name in the derivation string
- Include contextual IDs (level, chunk, NPC) for location-specific content
- Use a consistent hash function (FNV-1a, djb2, or MurmurHash3)

## Budget Constraints by Content Type

Adjust per genre. These are starting points — playtest and tune.

### Dungeon / Level Generation

| Constraint | Roguelike | Action | Puzzle | Survival |
|---|---|---|---|---|
| Min rooms | 5 | 3 | 4 | 2 |
| Max rooms | 15 | 8 | 10 | 6 |
| Min room size | 4x4 | 6x6 | 3x3 | 8x8 |
| Max room size | 12x12 | 20x20 | 8x8 | 30x30 |
| Enemy density (per room) | 2-5 | 3-8 | 0-1 | 1-3 |
| Item density (per room) | 0-2 | 1-3 | 0-1 | 1-4 |
| Max retry attempts | 20 | 10 | 30 | 10 |

### Loot / Drop Tables

| Constraint | Roguelike | RPG | Idle | Survival |
|---|---|---|---|---|
| Common drop rate | 60% | 50% | 70% | 55% |
| Uncommon drop rate | 25% | 30% | 20% | 30% |
| Rare drop rate | 10% | 15% | 8% | 12% |
| Epic drop rate | 4% | 4% | 1.5% | 2.5% |
| Legendary drop rate | 1% | 1% | 0.5% | 0.5% |
| Pity counter (guaranteed rare) | 20 rolls | 15 rolls | 50 rolls | 25 rolls |

### Terrain / World Generation

| Constraint | Open World | Island | Underground | Space |
|---|---|---|---|---|
| Noise octaves | 4-6 | 3-5 | 2-4 | 5-8 |
| Noise frequency | 0.005-0.02 | 0.01-0.05 | 0.02-0.1 | 0.001-0.01 |
| Biome count | 5-12 | 3-6 | 2-4 | 4-8 |
| Water coverage | 30-40% | 50-70% | 0-5% | N/A |
| Resource node density | 1-3 per chunk | 1-2 per chunk | 2-5 per chunk | 0-2 per chunk |

## Generation Priority Order

Generate in dependency order — each layer constrains the next.

```
1. World topology     (continents, oceans, major terrain)
2. Biome assignment   (climate zones, resource distribution)
3. Region boundaries  (political, geographical)
4. Settlement placement (cities, towns, camps)
5. Road/path networks (connecting settlements)
6. Dungeon entrances  (placed within regions)
7. Dungeon layouts    (rooms, corridors per entrance)
8. Entity placement   (NPCs, enemies, items per room/area)
9. Loot assignment    (drops per entity, chests per room)
```

Each step uses the world seed + step-specific derivation to remain deterministic.

## Caching Strategy

### Store in Database (via `postgres-game-schema`)

Use for content that is expensive to generate or has been modified by players.

- World topology and biome maps (generated once per world)
- Dungeon layouts that players have partially explored
- Loot that has been rolled and distributed to players
- NPC state that has been modified by player interaction
- Settlement data with player-built structures

**Schema pattern:**
```
generated_content {
  id, seed, generator_version, content_type, data (JSONB),
  created_at, expires_at
}
```

### Regenerate on Demand

Use for content that is cheap to generate and has not been player-modified.

- Terrain height values (fast noise lookup)
- Weather patterns (derived from day number)
- NPC idle dialogue (seeded from NPC ID)
- Ambient details (decorations, particle effects)
- Unexplored dungeon rooms (regenerate from seed when entered)

**Rule of thumb:** if the player can change it, store it. If the player only observes it, regenerate it.

### Redis Cache (via `redis-game-patterns`)

Use for session-scoped generated content that needs fast access.

- Active dungeon state during exploration
- Current loot table rolls awaiting player pickup
- In-progress generation results (avoid regenerating mid-session)
- Chunk data for nearby terrain the player might traverse

**TTL:** match session duration or set to 1 hour with refresh on access.
