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
2. **Narrative coherence** — any quest, character, or story content requires reading `quest-narrative-coherence/SKILL.md` first. No exceptions.
3. **Schema first** — read `postgres-game-schema/SKILL.md` before writing any database code.
4. **Genre-agnostic shared code** — never hardcode game-specific mechanics in shared libraries.
5. **Run Biome before done** — `bunx biome check --write .` after any TypeScript changes.

## When Compacting

Preserve in the compact summary:
- Current game system being built (e.g., "implementing quest system — schema done, API in progress")
- Schema decisions made this session (table names, JSONB fields chosen, indexes added)
- Narrative decisions (new factions introduced, quest rewards set, NPC alignments)
- Active feature branch name and what's been merged vs pending
- Any architectural pivots (e.g., "switched from polling to WebSocket for presence tracking")

## Skill References

When working on a task, read the relevant skill before implementing:

| Task | Skill to Read |
|------|--------------|
| Database schema / migrations | `@skills/game-dev/engineering/postgres-game-schema/SKILL.md` |
| Game server / WebSocket | `@skills/game-dev/engineering/game-backend-architecture/SKILL.md` |
| State sync / netcode | `@skills/game-dev/engineering/game-state-sync/SKILL.md` |
| Matchmaking | `@skills/game-dev/engineering/matchmaking-system/SKILL.md` |
| Analytics / retention | `@skills/game-dev/engineering/gameplay-analytics/SKILL.md` |
| Redis patterns | `@skills/game-dev/engineering/redis-game-patterns/SKILL.md` |
| Background jobs | `@skills/game-dev/engineering/bullmq-game-queues/SKILL.md` |
| Authentication | `@skills/game-dev/engineering/betterauth-integration/SKILL.md` |
| Payments / IAP | `@skills/game-dev/engineering/stripe-game-payments/SKILL.md` |
| Core game design | `@skills/game-dev/design/game-design-fundamentals/SKILL.md` |
| Skill / talent trees | `@skills/game-dev/design/skill-progression-trees/SKILL.md` |
| Economy / currency | `@skills/game-dev/design/game-economy-design/SKILL.md` |
| Procedural content | `@skills/game-dev/design/procedural-gen/SKILL.md` |
| UI / HUD | `@skills/game-dev/design/ui-ux-game/SKILL.md` |
| Quests / missions | `@skills/game-dev/design/quest-mission-design/SKILL.md` |
| Narrative (ALWAYS FIRST) | `@skills/game-dev/narrative/quest-narrative-coherence/SKILL.md` |
| World lore | `@skills/game-dev/narrative/worldbuilding/SKILL.md` |
| Characters / NPCs | `@skills/game-dev/narrative/character-design-narrative/SKILL.md` |
| CI/CD | `@skills/game-dev/infrastructure/ci-cd-game/SKILL.md` |
| AI IDE setup | `@skills/game-dev/infrastructure/cursor-codex-integration/SKILL.md` |
| Before designing a new feature | `@skills/superpowers/brainstorming/SKILL.md` |
| Before implementing any game system | `@skills/superpowers/writing-plans/SKILL.md` |
| Debugging a production issue | `@skills/superpowers/systematic-debugging/SKILL.md` |
| Before implementing with tests | `@skills/superpowers/test-driven-development/SKILL.md` |

## Memory Files

- `quest-registry.md` — all active and completed quests (update after every narrative session)
- `world-lore.md` — canonical world state: factions, geography, relationships
- `~/.claude/projects/<this-project>/memory/MEMORY.md` — architectural decisions

## Custom Agents

This project uses Claude Code custom agents in `.claude/agents/`:

- `game-engineer.md` — server-side implementation (schema, API, WebSocket, queues). Has Bash access.
- `narrative-writer.md` — all narrative content (quests, characters, lore). No Bash access.
- `game-designer.md` — design documents, balance, economy. No Bash access.

Source templates: `@skills/game-dev/infrastructure/claude-code-game-workflow/templates/game-agents/`

To invoke explicitly: `"Using the game-engineer agent: implement [feature]"`

## Game-Specific Context

<!-- Fill in after reading game-design-fundamentals/SKILL.md -->

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
bunx biome check --write .  # format + lint
bun run typecheck           # TypeScript check

# Tests
bun test                    # run all tests
```
