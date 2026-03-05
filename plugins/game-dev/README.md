# Game Development Plugin

Genre-agnostic game development plugin — 26 skills, 3 agents, 4 hooks. Works for RPGs, MMOs, idle games, puzzlers, platformers, strategy, card games, shooters, and any other genre.

> For individual skills without agents/hooks, see [skills/game-dev](../../skills/game-dev/).

## Quick Start

> AI agents: read `AGENTS.md` first — it maps every task to the right skill.

1. `/game-dev:game-architect` — start a new game project (interactive MVP planner)
2. `/game-dev:design-game-design-fundamentals` — define your core loop
3. `/game-dev:engineering-postgres-game-schema` — set up your database
4. `/game-dev:engineering-game-backend-architecture` — set up your server
5. Pick domain skills as needed

## Installation

### Via marketplace

```bash
# Add the marketplace
/plugin marketplace add fcsouza/agent-skills

# Install the plugin
/plugin install game-dev@fcsouza-agent-skills
```

### For local development

```bash
claude --plugin-dir ./plugins/game-dev
```

## Plugin Components

### Command

| Command | Invocation | Description |
|---------|-----------|-------------|
| game-architect | `/game-dev:game-architect` | MVP interviewer — interviews you, researches your genre, produces an actionable first draft plan |

### Agents (3)

Appear in the `/agents` interface. Claude invokes them automatically based on task context.

| Agent | Description |
|-------|-------------|
| `game-dev:game-engineer` | Backend implementation (schemas, APIs, WebSocket, queues) |
| `game-dev:game-designer` | Design documents (core loops, economy, levels, UX) |
| `game-dev:narrative-writer` | Narrative content (quests, characters, lore) with coherence enforcement |

### Hooks (4)

| Event | Description |
|-------|-------------|
| `UserPromptSubmit` | Detects keywords and suggests relevant skills |
| `PreToolUse` (Write/Edit) | Reminds to complete narrative coherence check on story files |
| `PreToolUse` (Bash) | Flags destructive DB commands (DROP, TRUNCATE, DELETE) |
| `PostToolUse` (Write/Edit) | Auto-formats TypeScript with Biome |
| `Stop` | Reminds to update quest-registry.md and world-lore.md |

## Skill Index

All skills are invokable via `/game-dev:<category>-<skill-name>`. Claude also auto-invokes them based on context. Type `/engineering`, `/design`, `/narrative`, or `/infrastructure` to filter by category.

### Engineering (10 skills)

| Skill | Trigger Keywords | Description |
|-------|-----------------|-------------|
| [postgres-game-schema](engineering/postgres-game-schema/) | database, schema, Drizzle, players, inventory | Genre-agnostic PostgreSQL schemas with Drizzle ORM |
| [bullmq-game-queues](engineering/bullmq-game-queues/) | queue, matchmaking, async events, jobs | BullMQ job queues for game events and scheduling |
| [game-backend-architecture](engineering/game-backend-architecture/) | game server, WebSocket, rooms, tick loop | Elysia server with WebSocket, rooms, and game loops |
| [redis-game-patterns](engineering/redis-game-patterns/) | Redis, cache, leaderboard, pub/sub, rate limit | Redis patterns for real-time games |
| [betterauth-integration](engineering/betterauth-integration/) | auth, login, OAuth, JWT, roles | BetterAuth with RBAC for game players |
| [stripe-game-payments](engineering/stripe-game-payments/) | payments, IAP, subscription, Stripe | Stripe integration for game monetization |
| [elevenlabs-sound-music](engineering/elevenlabs-sound-music/) | audio, music, SFX, voice, ElevenLabs, Lyria | AI audio generation (ElevenLabs + Lyria) |
| [game-state-sync](engineering/game-state-sync/) | state sync, netcode, delta, rollback, client prediction | Client-server state reconciliation + client game loop |
| [gameplay-analytics](engineering/gameplay-analytics/) | analytics, telemetry, retention, D1 D7 D30, events, funnel | Player event tracking and retention metrics |
| [matchmaking-system](engineering/matchmaking-system/) | matchmaking, lobby, ELO, queue, rank, skill-based | Skill-based matchmaking and lobby lifecycle |

### Design (7 skills)

| Skill | Trigger Keywords | Description |
|-------|-----------------|-------------|
| [game-design-fundamentals](design/game-design-fundamentals/) | core loop, MDA, player motivation, flow | Core game design theory and frameworks |
| [level-design](design/level-design/) | level, pacing, difficulty curve, encounter | Environment layout and difficulty design |
| [quest-mission-design](design/quest-mission-design/) | quest, mission, objectives, quest tree | Quest types, objective trees, and rewards |
| [game-economy-design](design/game-economy-design/) | economy, currency, sinks, loot, inflation | Virtual economies and monetization balance |
| [ui-ux-game](design/ui-ux-game/) | HUD, menu, onboarding, accessibility | Game interface patterns and feedback |
| [procedural-gen](design/procedural-gen/) | procedural, dungeon gen, loot table, world seed, BSP, noise | Procedural content generation for replayability |
| [skill-progression-trees](design/skill-progression-trees/) | skill tree, talent tree, progression, unlock, prestige | Skill trees, talent systems, and progression graphs |

### Narrative (4 skills)

| Skill | Trigger Keywords | Description |
|-------|-----------------|-------------|
| [worldbuilding](narrative/worldbuilding/) | lore, factions, geography, world bible | World creation and consistency |
| [story-structure-game](narrative/story-structure-game/) | branching narrative, player agency, story arc | Interactive narrative frameworks |
| [character-design-narrative](narrative/character-design-narrative/) | character, NPC, dialogue, archetype | Character creation and dialogue systems |
| [quest-narrative-coherence](narrative/quest-narrative-coherence/) | coherence check, lore validation, quest registry | **MANDATORY** narrative consistency enforcement |

### Infrastructure (4 skills)

| Skill | Trigger Keywords | Description |
|-------|-----------------|-------------|
| [claude-code-game-workflow](infrastructure/claude-code-game-workflow/) | workflow, which skill, how to start | Ecosystem navigation guide |
| [cursor-codex-integration](infrastructure/cursor-codex-integration/) | cursor, .cursorrules, codex | IDE configuration for AI coding |
| [ci-cd-game](infrastructure/ci-cd-game/) | CI/CD, GitHub Actions, deployment | Build and deployment pipelines |
| [monitoring-game-ops](infrastructure/monitoring-game-ops/) | monitoring, logging, telemetry, alerts | Observability and player analytics |

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Bun |
| Backend | Elysia |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Cache / Realtime | Redis |
| Job Queue | BullMQ |
| Auth | BetterAuth |
| Payments | Stripe |
| Image Gen | Gemini (Nano Banano) |
| Audio/Music | ElevenLabs + Vertex AI Lyria |

## Narrative Coherence Rule

> Every quest, mission, or story beat **MUST** pass the 5-step coherence check in `quest-narrative-coherence` before creation. No exceptions.
