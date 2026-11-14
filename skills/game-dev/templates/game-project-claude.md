# [Game Name] — Claude Code Project Configuration

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Bun |
| Backend | Elysia |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Cache | Redis |
| Job Queue | BullMQ |
| Auth | BetterAuth |
| Payments | Stripe |
| Deployment | Fly.io |

## Package Manager

Always use `bun`. Never npm, npx, or yarn.
- Install: `bun add <pkg>`
- Run: `bun run <script>`
- Execute: `bunx <tool>`

## Mandatory Rules

1. **Server-authoritative** — all game logic runs on the server. Client is display only.
2. **Narrative coherence** — any quest, character, or story content requires the `quest-narrative-coherence` skill first, so new content does not contradict existing lore.
3. **Schema first** — use the `postgres-game-schema` skill before writing any database code.
4. **Genre-agnostic shared code** — never hardcode game-specific mechanics in shared libraries.
5. **Format before done** — `bun run format` after any TypeScript changes, then `bun run lint:biome`.

## When Compacting

Preserve in the compact summary:
- Current game system being built (e.g., "implementing quest system — schema done, API in progress")
- Schema decisions made this session (table names, JSONB fields chosen, indexes added)
- Narrative decisions (new factions introduced, quest rewards set, NPC alignments)
- Active feature branch name and what's been merged vs pending
- Any architectural pivots (e.g., "switched from polling to WebSocket for presence tracking")

## Skills

Start from the `game-dev` skill. It routes each task to the right game-dev skill. If a skill is missing, install it with `bunx skills add fcsouza/agent-skills --skill <name>`.

## Project Files

- `docs/mvp-first-draft.md` — the MVP plan
- `docs/build-registry.md` — components built so far
- `docs/quest-registry.md` — all active and completed quests (update after every narrative session)
- `docs/world-lore.md` — canonical world state: factions, geography, relationships

## Game-Specific Context

<!-- Fill in after applying the game-design-fundamentals skill -->

**Core Loop**: [describe the player's core action loop]
**Genre**: [puzzle / RPG / idle / platformer / strategy / etc.]
**Target Platforms**: [web / mobile / desktop]
**Multiplayer**: [none / co-op / PvP / MMO]

## Common Commands

```bash
# Development
bun run dev           # start Elysia dev server

# Database
bunx drizzle-kit generate   # generate migration
bunx drizzle-kit migrate    # apply migrations

# Code quality
bun run format              # format
bun run lint:biome          # lint
bun run typecheck           # TypeScript check

# Tests
bun test                    # run all tests
```
