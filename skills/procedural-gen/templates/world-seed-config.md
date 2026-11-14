# World seed configuration

Fill this in before you write generator code. Copy it into the game's design notes.

## Seed format

- Player-facing seed: a string such as `ocean-crystal-4519`.
- Internal sub-seeds: 32-bit numbers produced by a hash of the string.
- A 32-bit space reaches a 50% chance of some collision after about 77,000 seeds (the square root of 2 x 2^32 x ln 2). If one world issues more seeds than that, use longer seeds.

## Per-system seed derivation

Derive each sub-seed from the world seed, the system name and the ids that locate the content. Changing one generator then leaves the others alone.

```
dungeonSeed = hash(worldSeed + ":dungeon:" + levelId)
terrainSeed = hash(worldSeed + ":terrain:" + chunkX + ":" + chunkY)
npcSeed     = hash(worldSeed + ":npc:" + npcId)
weatherSeed = hash(worldSeed + ":weather:" + dayNumber)
```

- Put the system name in every derivation string.
- Use one hash function everywhere (FNV-1a, djb2 or MurmurHash3).
- Loot seeds follow the same pattern. The loot rules themselves live in `game-economy-design`.

## Budget (fill in per generator)

| Constraint | Min | Max |
|---|---|---|
| Rooms | | |
| Room size | | |
| Enemies per room | | |
| Items per room | | |
| Path length | | |
| Retry attempts | 1 | |

Playtest and tune these. They are the design, not a default.

## Generation order

Generate in dependency order. Each layer constrains the next. Cut the layers your game does not have.

1. World topology
2. Biomes
3. Regions
4. Settlements
5. Roads
6. Dungeon entrances
7. Dungeon layouts
8. Entity placement
9. Loot assignment

## Store or regenerate

Rule: if the player can change it, store it. If the player only observes it, regenerate it from the seed.

Store (see `postgres-game-schema`):

- World topology generated once per world
- Dungeons a player partly explored and changed
- Loot already rolled and given out
- Settlements with player-built structures

Regenerate:

- Terrain heights from noise
- Weather from the day number
- Unexplored dungeon rooms
- Ambient detail

Keep session-scoped results (active dungeon state, nearby chunks) in a cache with a time to live (see `redis-game-patterns`).

Use two kinds of row. Never put the seed and the data in the same row.

Regenerated content: a seed and the generator version that reads it, no data. A generator change breaks old seeds, so the version says which generator to run.

```
regenerated_content { id, seed, generator_version, content_type, created_at }
```

Stored content: the data only, for content the player changed. It needs no seed and no generator.

```
stored_content { id, content_type, data, created_at }
```
