# Game Dev Hub

Orchestrator skill for browser game development — routes to specialized sub-skills for idle/incremental games, text-based MMOs, tactical RPGs, AI asset generation, and music generation.

## What It Covers

- Recommended stack (TypeScript, React/Next.js, Tailwind, Drizzle, Elysia)
- Project scaffolding (Turborepo monorepo)
- Skill routing to specialized sub-skills
- Player psychology and retention design
- Cross-skill workflow examples

## Companion Skills

| Skill | Focus |
|-------|-------|
| idle-game-design | Prestige, scaling, big numbers, offline progress |
| rpg-systems | Stats, combat, items, progression, economy |
| browser-mmo-design | Multiplayer, factions, PvP, energy/timers |
| game-architecture | Game loops, state, ECS, save/load, performance |
| game-asset-gen | AI art generation with Gemini |
| game-music-gen | AI music generation with Vertex AI Lyria |

## File Structure

```
game-dev-hub/
├── SKILL.md                          # Main skill — orchestrator + routing
├── README.md                         # This file
└── references/
    ├── project-scaffold.md           # Full monorepo scaffold, schemas, Docker
    └── player-psychology.md          # Bartle types, retention, monetization, flow
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill game-dev-hub
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill game-dev-hub -g
```

### Manual

Copy the `game-dev-hub/` folder to your agent's skills directory:

```bash
# OpenClaw (workspace skills, highest precedence)
cp -r game-dev-hub/ ~/.openclaw/workspace/skills/game-dev-hub/

# Claude Code
cp -r game-dev-hub/ .claude/skills/game-dev-hub/
```

## Usage

Once installed, the skill triggers on browser game development topics. It routes to companion skills for specialized areas like idle game design, RPG systems, multiplayer architecture, AI asset generation, and music generation.

Use `/game-dev-hub` as a slash command, or let the agent invoke it automatically based on context.
