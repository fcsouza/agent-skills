---
name: skill-progression-trees
description: >-
  Use when designing or implementing skill trees, talent trees, ability progression systems, or unlock graphs. Triggers: skill tree, talent tree, ability tree, progression system, unlock, prestige, node, skill points.
---

# Skill & Progression Trees

## Purpose

DAG-based progression systems for any game genre — skill trees, talent trees, ability unlocks, passive stat graphs, and prestige layers. Covers data modeling, server-authoritative validation, cost scaling, and respec mechanics.

## When to Use

Trigger: skill tree, talent tree, ability tree, progression system, unlock system, prestige, node graph, skill points, ability unlock, passive tree, talent build, respec, skill reset

## Prerequisites

- `game-design-fundamentals` — core loop and reward system knowledge
- `postgres-game-schema` — player and currency data models
- `game-economy-design` — cost balancing and currency integration

## Core Principles

> Chris Taylor (Supreme Commander): "A good tech tree gives the player the illusion of infinite choice while keeping every path viable."
> Will Wright (The Sims, Spore): "Emergent systems arise when simple rules interact — skill trees should compose, not prescribe."
> Jonathan Blow (Braid, The Witness): "Every unlock should feel like a genuine insight, not a checkbox."

1. **DAG not tree** — prerequisites form a directed acyclic graph; cycles break validation, break rollback, break everything. Enforce acyclicity at admin write time.
2. **Server-authoritative unlock validation** — never trust client unlock requests. Validate prerequisites, currency, and cooldowns server-side before writing.
3. **Prerequisite snapshot for rollback** — store the full prerequisite state at unlock time. If a respec or patch changes the graph, you can audit what was valid when the player unlocked it.
4. **Cost scaling follows exponential curve** — flat costs make endgame nodes trivially cheap relative to player income. Use `cost = baseCost * tier^exponent` (typically exponent 1.5-2.0).
5. **Respec is player-friendly** — always provide a reset mechanism. Free with cooldown, or paid with soft currency. Never lock players into permanent bad choices.
6. **Effects are data, not code** — store effects as JSONB (`{ "stat": "attack", "modifier": "+10%" }`). Apply server-side. Enables hot reload, A/B testing, and balance patches without deploys.
7. **Progressive reveal** — don't show all nodes at once. Reveal nodes as prerequisites are met. Reduces overwhelm and creates discovery moments (Jonathan Blow).

## Step-by-Step Instructions

### 1. Define Node Categories
Classify every node: active skills (abilities the player triggers), passive stats (always-on bonuses), unlocks (gates to content or mechanics), prestige (post-endgame reset bonuses).

### 2. Model the DAG
Use an adjacency list stored in JSONB. Each node has a `prerequisites` array of node IDs. Validate acyclicity on every admin write.

### 3. Write Drizzle Schema
Create `skill_nodes` (tree definition) and `player_skills` (player state) tables. See boilerplate for full implementation.

### 4. Implement Unlock API
Endpoint: `POST /skills/unlock/:nodeId`. Flow: check prerequisites met, check currency available, atomic transaction (deduct currency + insert player_skills + snapshot).

### 5. Cache Unlocked Nodes
Store unlocked node IDs in Redis per player session. Invalidate on unlock or respec. Tree lookups are frequent — database per-request is too slow.

### 6. Add Respec Endpoint
Endpoint: `POST /skills/respec`. Flow: deduct respec fee (or check cooldown), delete all player_skills rows, refund skill points to player wallet, invalidate Redis cache.

### 7. Add Tree Health Checks
Admin-only utilities: cycle detection (DFS on prerequisite graph), orphaned node detection (nodes with prerequisites referencing deleted nodes), unreachable node detection.

## Drizzle Schema

```typescript
// skill_nodes — defines the tree structure (admin-managed)
export const skillNodes = pgTable("skill_nodes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'active' | 'passive' | 'unlock' | 'prestige'
  tier: integer("tier").notNull().default(1),
  prerequisites: jsonb("prerequisites").$type<string[]>().default([]),
  cost: integer("cost").notNull().default(1),
  effects: jsonb("effects").$type<Record<string, unknown>[]>().default([]),
  isVisible: boolean("is_visible").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// player_skills — tracks which nodes each player has unlocked
export const playerSkills = pgTable("player_skills", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull().references(() => skillNodes.id),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default({}),
});
```

## API Patterns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/skills/tree` | GET | Full tree with player unlock status per node |
| `/skills/unlock/:nodeId` | POST | Unlock node — validates prerequisites, deducts cost, atomic write |
| `/skills/respec` | POST | Full reset — deducts fee, deletes player_skills, refunds points |

## Cross-References

- `game-economy-design` — cost balancing, currency sinks for skill points
- `postgres-game-schema` — player and currency table schemas
- `redis-game-patterns` — caching unlocked node sets per session
- `game-design-fundamentals` — core loop integration and progression pacing

## Pitfalls & Anti-Patterns

- **"Client-side tree state"** — storing unlock state in the client; trivially hackable, desync guaranteed
- **"No respec mechanic"** — players who make bad choices quit; always provide a reset path
- **"Flat cost curves"** — every node costs the same; endgame nodes become trivially cheap as income scales
- **"Missing cycle detection"** — one circular prerequisite creates infinite loops in validation; enforce DAG at write time
- **"Hardcoded effects"** — effects baked into code instead of JSONB data; every balance change requires a deploy
- **"All nodes visible"** — showing the entire tree upfront overwhelms new players and spoils discovery

## Designer Philosophy

**Chris Taylor** (Supreme Commander, Total Annihilation): Tech trees should give players the feeling of building toward something powerful. Every branch should feel like it opens new strategic possibilities. If a player looks at two branches and one is obviously better, the tree has failed.

**Will Wright** (The Sims, SimCity, Spore): The best progression systems are ones where simple rules interact to create emergent builds. Don't design 50 unique abilities — design 10 composable ones that combine in 50 ways.

**Jonathan Blow** (Braid, The Witness): Unlocking a skill should feel like understanding something new, not like filling a progress bar. If the player doesn't feel smarter or more capable after an unlock, the node is wasted.

## Sources

- "Designing Tech Trees and Progression Systems" — GDC 2016, Chris Taylor
- "The Art of Game Design" — Jesse Schell, Chapters on Skill and Chance
- "Balancing Ability Systems in Multiplayer Games" — GDC 2019
- "Emergent Gameplay from Simple Systems" — Will Wright, GDC Classic
- "Player Agency in Progression Design" — GDC 2020
