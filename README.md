# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Plugins

A plugin bundles skills you install in one step.

| Plugin | Description | Platform |
|--------|-------------|----------|
| [game-dev](skills/game-dev/) | Game development skills for design, engineering, narrative and infrastructure, seven workflow commands, and an index skill that routes a task to the right one | Game Dev |

## Claude Code Mods

Mods are plugins built on function hooks: they run inside Claude Code, guard tool calls and draw above the prompt. See [mods/](mods/) for install steps.

| Mod | Description |
|-----|-------------|
| [commit-guard](mods/commit-guard/) | Blocks commits with machine paths or `.env` files, `git add -A`, and pushes to `main` |
| [prod-guard](mods/prod-guard/) | Holds Dokploy MCP writes until you press Proceed |
| [bun-only](mods/bun-only/) | Rewrites npm, npx, yarn and pnpm to bun |
| [done-gate](mods/done-gate/) | Shows edited files and the checks still owed |
| [worktrees](mods/worktrees/) | Shows git worktrees, their changes, and the count |
| [usage-rings](mods/usage-rings/) | Context and plan usage, coloured by level |
| [pr-status](mods/pr-status/) | The current branch's PR: CI checks and review |
| [sql-guard](mods/sql-guard/) | Holds writes to non-local databases until you press Proceed |
| [pino-guard](mods/pino-guard/) | Blocks pino transports that break bundled logging |

## Available Skills

Skills are individual, cherry-pickable modules. Install only what you need.

### Core

| Skill | Description | Platform |
|-------|-------------|----------|
| [claude-agent-sdk](skills/claude-agent-sdk/) | Build production AI agents with the Claude Agent SDK — query(), hooks, subagents, custom tools, MCP servers, sessions, permissions, hosting | Claude Code / API |
| [database-performance-tuning](skills/database-performance-tuning/) | Diagnose and fix slow databases like a DBA — pg_stat_statements, EXPLAIN plans, index design, query rewrites, vacuum and bloat, safe online rollout. Ships a read-only diagnostic script | PostgreSQL / MySQL |
| [foundry-vtt-module-dev](skills/foundry-vtt-module-dev/) | Build, extend, and maintain Foundry VTT v14 modules — TypeDataModel, ApplicationV2 (detached windows), ActorSheetV2, hooks, sockets, dice, canvas/PIXI, Scene Levels, Regions as templates, ActiveEffects V2, v13→v14 migration, boilerplate files | [Foundry VTT](https://foundryvtt.com) |
| [foundry-vtt-system-dev](skills/foundry-vtt-system-dev/) | Build Foundry VTT v14 game systems — system.json documentTypes, Actor/Item TypeDataModel, dice mechanics, combat/initiative, ActiveEffect V2 subtypes, data migration, character sheets, status effects, macros, enrichers | [Foundry VTT](https://foundryvtt.com) |
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |
| [nuvemshop-sdk](skills/nuvemshop-sdk/) | Prepare, audit, implement, homologate, and publish Nuvemshop/Tiendanube apps — OAuth, API, NubeSDK, Nexo, Nimbus, webhooks, and App Store approval | [Nuvemshop](https://dev.nuvemshop.com.br/docs/getting-started) |
| [react-animations](skills/react-animations/) | React animation patterns and utilities | React |

### Game Dev

Start with `game-dev`. It routes a game task to the right skill below and states the project conventions.

| Skill | Description |
|-------|-------------|
| [game-dev](skills/game-dev/) | Entry point: routes a game task to the right skill and states the project conventions |

#### Design

| Skill | Description |
|-------|-------------|
| [game-design-fundamentals](skills/game-design-fundamentals/) | Core loops, MDA framework, progression curves |
| [game-economy-design](skills/game-economy-design/) | Virtual economies, currencies, loot tables |
| [level-design](skills/level-design/) | Levels, environments, difficulty curves |
| [procedural-gen](skills/procedural-gen/) | Dungeon gen, noise terrain, wave function collapse |
| [quest-mission-design](skills/quest-mission-design/) | Quests, objectives, quest trees |
| [ui-ux-game](skills/ui-ux-game/) | HUD, menus, onboarding, accessibility |

#### Engineering

| Skill | Description |
|-------|-------------|
| [betterauth-integration](skills/betterauth-integration/) | Player login, staff roles, session checks on WebSocket |
| [bullmq-game-queues](skills/bullmq-game-queues/) | Job queues, async events, scheduled tasks |
| [elevenlabs-sound-music](skills/elevenlabs-sound-music/) | SFX generation, adaptive music, voice acting |
| [game-backend-architecture](skills/game-backend-architecture/) | Game servers, WebSocket, rooms, tick loops |
| [game-state-sync](skills/game-state-sync/) | Client-server sync: prediction, reconciliation, interpolation, delta compression |
| [gameplay-analytics](skills/gameplay-analytics/) | Retention analytics, funnels, D1/D7/D30 |
| [matchmaking-system](skills/matchmaking-system/) | Matchmaking, lobbies, rating systems, skill-based queues |
| [postgres-game-schema](skills/postgres-game-schema/) | Game DB schemas, Drizzle ORM, inventory |
| [redis-game-patterns](skills/redis-game-patterns/) | Leaderboards, presence, rate limits, cache-aside |
| [skill-progression-trees](skills/skill-progression-trees/) | Skill trees, talent trees, unlock graphs |
| [stripe-game-payments](skills/stripe-game-payments/) | In-app purchases, subscriptions, webhooks |

#### Infrastructure

| Skill | Description |
|-------|-------------|
| [ci-cd-game](skills/ci-cd-game/) | CI/CD pipelines, GitHub Actions, deployment |
| [monitoring-game-ops](skills/monitoring-game-ops/) | Logging, alerts, server health |

#### Narrative

| Skill | Description |
|-------|-------------|
| [character-design-narrative](skills/character-design-narrative/) | Characters, NPCs, dialogue, archetypes |
| [quest-narrative-coherence](skills/quest-narrative-coherence/) | Narrative coherence check, lore validation |
| [story-structure-game](skills/story-structure-game/) | Branching narratives, player agency, story arcs |
| [worldbuilding](skills/worldbuilding/) | Lore, factions, geography, world bibles |

#### Workflows

Each workflow is a skill. In Claude Code you can also run it as a slash command. Installed as the Claude Code plugin, the commands are `/game-dev:<name>`, for example `/game-dev:game-build`.

| Command | Description |
|---------|-------------|
| [game-architect](skills/game-dev-commands/game-architect/) | Interview you, then write an MVP plan with starter project files |
| [game-build](skills/game-dev-commands/game-build/) | Build one component from the MVP plan, with tests and mocks |
| [game-expand](skills/game-dev-commands/game-expand/) | Add a feature to an existing MVP plan |
| [game-balance](skills/game-dev-commands/game-balance/) | Check economy, difficulty, progression and rewards for imbalances |
| [game-review](skills/game-dev-commands/game-review/) | Audit game code for server authority, auth, payments and scope drift |
| [game-lore](skills/game-dev-commands/game-lore/) | Add or update one lore entry and keep it consistent |
| [game-quest](skills/game-dev-commands/game-quest/) | Design one quest from objective tree to registry entry |

## Structure

All skills follow a flat layout:

```
skills/<skill-name>/
├── SKILL.md            # Main skill file (YAML frontmatter + body)
├── references/         # Deep-dive reference files (optional)
├── templates/          # Document and config templates (optional)
├── boilerplate/        # Starter code to copy and customize (optional)
└── ARCHITECTURE.md     # System design decisions (optional)
```

The seven workflow commands sit under `skills/game-dev-commands/<name>/`.

- `SKILL.md` is always the entry point — read this first
- `references/` holds deep-dive files that `SKILL.md` links to
- `templates/` are document/config templates to fill in
- `boilerplate/` files are starter code, copy and customize
- `ARCHITECTURE.md` explains system design decisions

## Installation

### game-dev plugin (Claude Code)

```bash
/plugin marketplace add fcsouza/agent-skills
/plugin install game-dev@fcsouza-agent-skills
```

### Individual skills (cherry-pick)

```bash
# Install a specific skill
npx skills add fcsouza/agent-skills --skill game-design-fundamentals

# Install the index skill and a few topic skills
npx skills add fcsouza/agent-skills --skill game-dev --skill betterauth-integration --skill postgres-game-schema

# List all available skills
npx skills add fcsouza/agent-skills --list
```

### Manual

```bash
# Individual skill
cp -r skills/<skill-name>/ .claude/skills/<skill-name>/

# For OpenClaw
cp -r skills/<skill-name>/ ~/.openclaw/workspace/skills/<skill-name>/
```

## Upgrading from 1.x

Version 2.0.0 changes names and removes parts of the plugin.

- Skill names no longer carry a category prefix. `design-level-design` is now `level-design`. The prefixes `design-`, `engineering-`, `narrative-` and `infrastructure-` are gone.
- Two skills were removed: `claude-code-game-workflow` and `cursor-codex-integration`.
- The five plugin entries `game-dev-design`, `game-dev-engineering`, `game-dev-narrative`, `game-dev-infrastructure` and `game-dev-commands` are now one entry, `game-dev`.
- The hooks, agents and MCP config that shipped with the plugin are gone.

To upgrade, remove the old prefixed skills, then install again. Use `-g` for skills installed in your home directory, and leave it off for the current project.

```bash
npx skills remove -g -y \
  design-game-design-fundamentals design-game-economy-design design-level-design \
  design-procedural-gen design-quest-mission-design design-skill-progression-trees \
  design-ui-ux-game \
  engineering-betterauth-integration engineering-bullmq-game-queues \
  engineering-elevenlabs-sound-music engineering-game-backend-architecture \
  engineering-game-state-sync engineering-gameplay-analytics \
  engineering-matchmaking-system engineering-postgres-game-schema \
  engineering-redis-game-patterns engineering-stripe-game-payments \
  infrastructure-ci-cd-game infrastructure-claude-code-game-workflow \
  infrastructure-cursor-codex-integration infrastructure-monitoring-game-ops \
  narrative-character-design-narrative narrative-quest-narrative-coherence \
  narrative-story-structure-game narrative-worldbuilding
```

Run the same command without `-g` in each project that has them. The command skips names that are not installed. If you use the Claude Code plugin, run `/plugin marketplace update fcsouza-agent-skills` and then `/plugin install game-dev@fcsouza-agent-skills`. Otherwise install the skills you want with `npx skills add`, as shown above.

The marketplace maps the five old entry names to `game-dev`, so Claude Code should move an enabled old entry to `game-dev`. If `claude plugin list` still shows an old entry, uninstall it in your shell:

```bash
claude plugin uninstall game-dev-design@fcsouza-agent-skills
claude plugin uninstall game-dev-engineering@fcsouza-agent-skills
claude plugin uninstall game-dev-narrative@fcsouza-agent-skills
claude plugin uninstall game-dev-infrastructure@fcsouza-agent-skills
claude plugin uninstall game-dev-commands@fcsouza-agent-skills
```

These act on user scope. Add `--scope project` or `--scope local` for an entry installed there.

## License

MIT
