---
name: engineering-postgres-game-schema
description: >-
  Use when designing game database schemas, player data models, inventory systems, or working with Drizzle ORM and PostgreSQL for games. Triggers: database, schema, Drizzle, players, inventory, leaderboards, game data.
---

# PostgreSQL Game Schema

## Purpose

Genre-agnostic database schema design for games using Drizzle ORM + PostgreSQL.

## When to Use

Trigger: database schema, game database, Drizzle schema, players table, inventory, leaderboards, sessions, events, entity system, game data model

## Prerequisites

None — this is a foundational skill.

## Core Principles

> Sid Meier: "A game is a series of interesting decisions."
> Richard Garfield: "The best game systems are elegant rule systems — minimal components that compose into complex behaviors."

1. **Schema must be game-type agnostic** — never assume RPG, MMO, or idle
2. **Use JSONB for extensible data** (stats, properties, metadata)
3. **Timestamps everywhere** (createdAt, updatedAt) for audit trails
4. **Soft deletes over hard deletes** for game data
5. **Enum types for fixed categories** (rarity, status, role)
6. **Composite indexes** for common query patterns
7. **Foreign keys with cascading deletes** where appropriate
8. **Versioned schema migrations** with drizzle-kit

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit
```

### 2. Configure Drizzle

Create `drizzle.config.ts` at the project root. See `boilerplate/migrations.ts` for the full config pattern.

### 3. Define Schemas

Start with the core tables in `boilerplate/schema.ts`. These cover players, sessions, inventory, items, events, leaderboards, achievements, currencies, social relations, guilds, and guild members.

Extend with custom entities using `templates/entity-template.ts`.

### 4. Generate Migrations

```bash
bunx drizzle-kit generate
```

### 5. Run Migrations

```bash
bunx drizzle-kit migrate
```

### 6. Query Data

See `templates/query-patterns.ts` for common query patterns including inventory lookups, leaderboard queries, event aggregation, and JSONB filtering.

## Code Examples

### Player with JSONB stats

```typescript
import { players } from './schema';

await db.insert(players).values({
  username: 'player1',
  email: 'player1@example.com',
  displayName: 'Player One',
  stats: { health: 100, speed: 10 },
  metadata: { tutorial_completed: true },
});
```

### Flexible item definitions

```typescript
await db.insert(itemDefinitions).values({
  name: 'Rare Artifact',
  type: 'equipment',
  rarity: 'rare',
  baseStats: { power: 25, durability: 100 },
  metadata: { description: 'A mysterious artifact', tradeable: true },
  stackable: false,
});
```

See `boilerplate/schema.ts` for full table definitions and `templates/query-patterns.ts` for advanced queries.

## Cross-References

- `bullmq-game-queues` for async event processing
- `redis-game-patterns` for cached queries
- `betterauth-integration` for auth tables
- `game-economy-design` for economy schemas

## Pitfalls & Anti-Patterns

- **Don't store game state as a single JSON blob** — use normalized tables with JSONB for extensible fields only
- **Don't use auto-increment IDs for player-facing identifiers** — use UUIDs or nanoid to prevent enumeration
- **Don't skip indexes on frequently queried columns** — especially playerId, category, type, and createdAt
- **Don't hardcode genre-specific columns in core tables** — use JSONB metadata instead of adding `swordDamage` or `spellPower` columns
- **Don't use hard deletes** — always soft delete with `deletedAt` timestamps so game history is preserved
- **Don't forget composite indexes** — queries like "player's inventory filtered by type" need `(playerId, type)` indexes

## Designer Philosophy

**Sid Meier:** Schema should enable "interesting decisions" — flexible enough that any game mechanic can be modeled without schema changes. A well-designed JSONB column lets designers iterate on game mechanics without migrations.

**Richard Garfield:** Elegant schemas have minimal tables that compose into complex behaviors. Eleven core tables can model inventory, progression, social, economy, and analytics for any genre.

## Sources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PostgreSQL JSONB Best Practices](https://www.postgresql.org/docs/current/datatype-json.html)
- Game Database Design Patterns (GDC talks on scalable game backends)
- [Neon Serverless PostgreSQL](https://neon.tech/docs)
