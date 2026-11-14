---
name: postgres-game-schema
description: >-
  Genre-agnostic PostgreSQL schema and table conventions for games, written with Drizzle ORM: players, sessions, items, inventory, events, leaderboards, achievements, currencies, social relations and guilds. Use when a game needs a database table, a player data model, inventory or currency storage, a leaderboard table, or any database code that must follow the project's schema conventions.
---

# PostgreSQL Game Schema

The schema is the value of this skill. Install, driver setup, config and migrations come from the vendor: use the `neon-drizzle` skill if it is installed, otherwise https://orm.drizzle.team/docs/get-started.

Target the stable Drizzle line, `drizzle-orm` 0.45.x. The Drizzle docs install lines use `drizzle-orm@rc` and `drizzle-kit@rc`; pin the 0.45 versions instead (see "Drizzle 1.0" below).

## Files

- `boilerplate/schema.ts`: copy when starting a game database. Twelve tables (players, sessions, item definitions, inventory, events, leaderboards, achievements, currencies, social relations, guilds, guild members, processed events) and their enums.
- `templates/entity-template.ts`: copy when adding a new game entity. Three patterns: an entity a player owns, a definition catalog with player instances, and an enum-driven timed entity.
- `templates/query-patterns.ts`: read when writing queries against the schema: inventory join, leaderboard top N, event aggregation, JSONB filters, atomic currency credit, guarded spend, best-score upsert. Each function takes the database as its first argument (`GameDb`, any Drizzle Postgres database), so it works with whichever driver the project uses.

## Conventions

Every table and query in a game project follows these. Other skills (`stripe-game-payments`, `gameplay-analytics`, `game-economy-design`) build on them.

- **Naming.** Tables are plural snake_case (`item_definitions`). Columns are snake_case in SQL and camelCase in TypeScript: `playerId: text("player_id")`. Indexes are named `<table>_<columns>_idx`.
- **IDs.** `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`. Player-facing identifiers are never auto-increment integers; sequential ids let anyone enumerate players and items.
- **Timestamps.** `timestamp(...).notNull().defaultNow()`. Entity and catalog tables (`players`, `item_definitions`, `guilds`) carry `createdAt` and `updatedAt`; append-only and state rows carry the time that matters (`events.createdAt`, `sessions.startedAt`, `guild_members.joinedAt`). Give a new mutable table both columns. Set `updatedAt` in every update; a column default fills it only on insert.
- **Soft delete.** `players` has `deletedAt: timestamp("deleted_at")`; a deleted player keeps their rows for history. Every read that returns players, including joins, filters `isNull(players.deletedAt)`. Add `deletedAt` to a new entity when its history matters (`templates/entity-template.ts` pattern 1).
- **JSONB.** Typed columns for anything you filter, sort, join or sum. `jsonb(...).$type<...>().default({})` for per-genre extras: `stats`, `baseStats`, `properties`, `metadata`. Never add genre columns (`swordDamage`) to core tables. Use `jsonb`, not `json`: PostgreSQL stores `jsonb` decomposed, processes it faster and can index it.
- **Enums.** `pgEnum` for fixed sets that code switches on (rarity, guild role, leaderboard period). Plain `text` for open sets designers extend (event type, currency type).
- **Foreign keys.** `onDelete: "cascade"` from player-owned rows to `players`. Analytics rows (`events`) use `onDelete: "set null"` so history survives. Catalog references (`itemDefinitionId`) have no cascade.
- **Indexes.** Index the owner key (`playerId`) of every player-owned table. Add a composite index for each common filter, leading with the owner: `events (playerId, type)`, `leaderboards (category, period, score)`. Put a unique index on every natural key an upsert targets (`currencies (playerId, currencyType)`): PostgreSQL infers the `ON CONFLICT` target from a unique index.
- **Money and currency.** Integer amounts, never read-modify-write. Credit with the atomic `amount = amount + n` upsert (`addCurrency` in `templates/query-patterns.ts`). Debit with `spendCurrency`: one `UPDATE ... WHERE amount >= cost`, and it reports failure when no row was updated, so two parallel spends cannot overdraw. The `currencies` table also has `CHECK (amount >= 0)`, so a debit that bypasses the guard fails instead of going negative.
- **Idempotency.** `processed_events` holds one row per external event or job already applied (a Stripe event id, a reward job key), with `id` as the primary key, a `kind` and `created_at`. Insert it in the same transaction as the change it guards; a primary-key conflict means the change already happened. `stripe-game-payments` and `bullmq-game-queues` use this table.

## Procedure

1. Copy `boilerplate/schema.ts` into the project's schema module. Delete tables the game does not need.
2. Add game entities from `templates/entity-template.ts`, following the conventions above.
3. Generate and apply migrations with drizzle-kit as the Drizzle docs describe. Change the schema file first, then generate; never hand-write migration SQL.
4. Write queries in the style of `templates/query-patterns.ts`, with the database passed in.

## Drizzle 1.0

Drizzle 1.0 is a release candidate (npm `rc` tag), not the `latest` tag. If a project moves to it, these parts change (https://orm.drizzle.team/docs/v0-v1-changes):
- `relations()` is replaced by `defineRelations()`, passed to the client as `drizzle({ client, relations })`. The relational query API v1 (`db.query` with a `schema` option) is removed.
- `drizzle({ casing })` moves to a table-level API (`snakeCase.table(...)`).
- Migration folders drop `journal.json`; running `drizzle-kit up` upgrades the migration table.
- `drizzle-orm/pg-core` exports `PgAsyncDatabase` and no `PgDatabase`, so the `GameDb` type in `templates/query-patterns.ts` must be redone.

## Pitfalls

- **One JSON blob for all game state.** Normalize into tables; keep JSONB for the extensible fields only.
- **Missing composite index.** "A player's events of type X" needs `events (playerId, type)`, not two single-column indexes. Add the composite index with the query that needs it.
- **Filtering on a JSONB key in a hot path.** A GIN index on a `jsonb` column serves containment (`properties @> '{"key": "value"}'`), not `properties ->> 'key' = ...`. For a hot filter, query with `@>` against a GIN index, add an expression index on that key, or promote the key to a typed column.
- **Forgetting soft-deleted players.** Leaderboard and guild queries join `players`; filter `isNull(players.deletedAt)` there too, as `templates/query-patterns.ts` does.
- **Running migrations from two git worktrees at once.** Worktrees share one Neon database, so concurrent migrations conflict. Only one worktree runs migrations at a time. Use separate Neon branches for experimental schema work.

## Related skills

- `redis-game-patterns` for cached leaderboards and presence.
- `bullmq-game-queues` for async event processing.
- `betterauth-integration` for auth tables.
- `database-performance-tuning` for slow queries.

Verified citations are in `references/sources.md`; read it when checking where a claim comes from.
