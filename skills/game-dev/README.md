# Game Development Skill Ecosystem

Genre-agnostic game development skills — 25 skills across engineering, design, narrative, and infrastructure. Works for RPGs, MMOs, idle games, puzzlers, platformers, strategy, card games, shooters, and any other genre.

## Quick Start

> AI agents: read `AGENTS.md` first — it maps every task to the right skill.

1. Read `infrastructure/claude-code-game-workflow/SKILL.md` — understand the ecosystem
2. Read `design/game-design-fundamentals/SKILL.md` — define your core loop
3. Read `engineering/postgres-game-schema/SKILL.md` — set up your database
4. Read `engineering/game-backend-architecture/SKILL.md` — set up your server
5. Pick domain skills as needed

## Skill Index

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

### Design (6 skills)

| Skill | Trigger Keywords | Description |
|-------|-----------------|-------------|
| [game-design-fundamentals](design/game-design-fundamentals/) | core loop, MDA, player motivation, flow | Core game design theory and frameworks |
| [level-design](design/level-design/) | level, pacing, difficulty curve, encounter | Environment layout and difficulty design |
| [quest-mission-design](design/quest-mission-design/) | quest, mission, objectives, quest tree | Quest types, objective trees, and rewards |
| [game-economy-design](design/game-economy-design/) | economy, currency, sinks, loot, inflation | Virtual economies and monetization balance |
| [ui-ux-game](design/ui-ux-game/) | HUD, menu, onboarding, accessibility | Game interface patterns and feedback |
| [procedural-gen](design/procedural-gen/) | procedural, dungeon gen, loot table, world seed, BSP, noise | Procedural content generation for replayability |

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
