# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Plugins

Plugins are complete workflow bundles — skills + agents + hooks working together as an integrated system. Install a plugin to get the full experience.

| Plugin | Description | Platform |
|--------|-------------|----------|
| [game-dev](plugins/game-dev/) | **26 skills, 7 commands, 3 agents, 5 hooks** — complete game development workflow with engineering, design, narrative, and infrastructure | Game Dev |

## Available Skills

Skills are individual, cherry-pickable modules. Install only what you need.

### Core

| Skill | Description | Platform |
|-------|-------------|----------|
| [claude-agent-sdk](skills/claude-agent-sdk/) | Build production AI agents with the Claude Agent SDK — query(), hooks, subagents, custom tools, MCP servers, sessions, permissions, hosting | Claude Code / API |
| [foundry-vtt-module-dev](skills/foundry-vtt-module-dev/) | Build, extend, and maintain Foundry VTT v13 modules — TypeDataModel, ApplicationV2, ActorSheetV2, hooks, sockets, dice, canvas/PIXI, ActiveEffects, migrations, boilerplate files | [Foundry VTT](https://foundryvtt.com) |
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |
| [react-animations](skills/react-animations/) | React animation patterns and utilities | React |

### Game Dev — Design

| Skill | Description |
|-------|-------------|
| [game-design-fundamentals](skills/game-design-fundamentals/) | Core loops, MDA framework, progression curves |
| [game-economy-design](skills/game-economy-design/) | Virtual economies, currencies, loot tables |
| [level-design](skills/level-design/) | Levels, environments, difficulty curves |
| [procedural-gen](skills/procedural-gen/) | Dungeon gen, noise terrain, wave function collapse |
| [quest-mission-design](skills/quest-mission-design/) | Quests, objectives, quest trees |
| [skill-progression-trees](skills/skill-progression-trees/) | Skill trees, talent trees, unlock graphs |
| [ui-ux-game](skills/ui-ux-game/) | HUD, menus, onboarding, accessibility |

### Game Dev — Engineering

| Skill | Description |
|-------|-------------|
| [betterauth-integration](skills/betterauth-integration/) | Auth, OAuth, JWT, RBAC |
| [bullmq-game-queues](skills/bullmq-game-queues/) | Job queues, async events, scheduled tasks |
| [elevenlabs-sound-music](skills/elevenlabs-sound-music/) | SFX generation, adaptive music, voice acting |
| [game-backend-architecture](skills/game-backend-architecture/) | Game servers, WebSocket, rooms, tick loops |
| [game-state-sync](skills/game-state-sync/) | Client-server sync, rollback netcode, delta compression |
| [gameplay-analytics](skills/gameplay-analytics/) | Retention analytics, funnels, D1/D7/D30 |
| [matchmaking-system](skills/matchmaking-system/) | Matchmaking, lobbies, ELO, skill-based queues |
| [postgres-game-schema](skills/postgres-game-schema/) | Game DB schemas, Drizzle ORM, inventory |
| [redis-game-patterns](skills/redis-game-patterns/) | Caching, leaderboards, pub/sub, rate limiting |
| [stripe-game-payments](skills/stripe-game-payments/) | In-app purchases, subscriptions, webhooks |

### Game Dev — Infrastructure

| Skill | Description |
|-------|-------------|
| [ci-cd-game](skills/ci-cd-game/) | CI/CD pipelines, GitHub Actions, deployment |
| [claude-code-game-workflow](skills/claude-code-game-workflow/) | Entry point for AI agents on game projects |
| [cursor-codex-integration](skills/cursor-codex-integration/) | Cursor IDE, .cursorrules, Codex setup |
| [monitoring-game-ops](skills/monitoring-game-ops/) | Monitoring, logging, telemetry, alerts |

### Game Dev — Narrative

| Skill | Description |
|-------|-------------|
| [character-design-narrative](skills/character-design-narrative/) | Characters, NPCs, dialogue, archetypes |
| [quest-narrative-coherence](skills/quest-narrative-coherence/) | Narrative coherence check, lore validation |
| [story-structure-game](skills/story-structure-game/) | Branching narratives, player agency, story arcs |
| [worldbuilding](skills/worldbuilding/) | Lore, factions, geography, world bibles |

## Structure

All skills follow a flat layout:

```
skills/<skill-name>/
├── README.md           # Overview and installation instructions
├── SKILL.md            # Main skill file (YAML frontmatter + body)
├── boilerplate/        # Starter code to copy and customize (optional)
├── templates/          # Document and config templates (optional)
├── references/         # Deep-dive reference files (optional)
└── ARCHITECTURE.md     # System design decisions (optional)
```

- `SKILL.md` is always the entry point — read this first
- `boilerplate/` files are starter code, copy and customize
- `templates/` are document/config templates to fill in
- `ARCHITECTURE.md` explains system design decisions

## Installation

### game-dev plugin (Claude Code)

```bash
/plugin marketplace add fcsouza/agent-skills
/plugin install game-dev@fcsouza-agent-skills
```

See [plugins/game-dev/README.md](plugins/game-dev/README.md) for the full skill index, commands, and agents.

### Individual skills (cherry-pick)

```bash
# Install a specific skill
npx skills add fcsouza/agent-skills --skill game-design-fundamentals

# Install all game-dev engineering skills at once
npx skills add fcsouza/agent-skills --skill betterauth-integration --skill postgres-game-schema --skill game-backend-architecture

# List all available skills
npx skills add fcsouza/agent-skills --list
```

### Manual

```bash
# Plugin (full bundle)
cp -r plugins/game-dev/ .claude/plugins/game-dev/

# Individual skill
cp -r skills/<skill-name>/ .claude/skills/<skill-name>/

# For OpenClaw
cp -r skills/<skill-name>/ ~/.openclaw/workspace/skills/<skill-name>/
```

## License

GPL-3.0
