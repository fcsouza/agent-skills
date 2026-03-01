# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Skills

| Skill | Description | Platform |
|-------|-------------|----------|
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |
| [game-dev-hub](skills/game-dev-hub/) | Browser game development orchestrator — routes to specialized sub-skills, project scaffolding, player psychology, recommended stack | Game Dev |
| [idle-game-design](skills/idle-game-design/) | Idle/incremental game mechanics — prestige systems, exponential scaling, big numbers, offline progress, upgrade trees, automation | Game Dev |
| [rpg-systems](skills/rpg-systems/) | RPG mechanics — stats, combat formulas, damage calculations, skill trees, equipment, loot tables, XP curves, economy design | Game Dev |
| [browser-mmo-design](skills/browser-mmo-design/) | Multiplayer browser game systems — factions, PvP, energy/timers, leaderboards, chat, WebSocket sync, anti-cheat | Game Dev |
| [game-architecture](skills/game-architecture/) | Browser game engine patterns — game loops, state management, ECS, save/load, offline progress, React performance | Game Dev |
| [game-asset-gen](skills/game-asset-gen/) | AI art generation with Gemini (Nano Banano) — sprites, pixel art, icons, backgrounds, tilesets, UI elements, prompt engineering | Game Dev |
| [game-music-gen](skills/game-music-gen/) | AI music generation with Vertex AI Lyria — background music, battle themes, ambient soundscapes, audio pipeline | Game Dev |

## Structure

Each skill follows the same convention:

```
skills/<skill-name>/
├── README.md           # Overview and installation instructions
├── SKILL.md            # Main skill file (YAML frontmatter + body)
└── references/         # Deep-dive reference files (optional)
    ├── topic-a.md
    └── topic-b.md
```

- `SKILL.md` provides the overview and links to reference files
- Reference files keep the main skill concise while offering depth on demand
- Progressive disclosure: metadata → body → references

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Install any skill from this repo to 37+ supported agents (Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more):

```bash
# Install a specific skill
npx skills add fcsouza/agent-skills --skill openclaw-genie

# Install globally (available across projects)
npx skills add fcsouza/agent-skills --skill openclaw-genie -g

# Target a specific agent
npx skills add fcsouza/agent-skills --skill openclaw-genie -a claude-code

# List all available skills from this repo
npx skills add fcsouza/agent-skills --list
```

### Via ClawHub (OpenClaw only)

```bash
clawhub install <skill-name>
```

### Manual

```bash
# For OpenClaw
cp -r skills/<skill-name>/ ~/.openclaw/workspace/skills/<skill-name>/

# For Claude Code
cp -r skills/<skill-name>/ .claude/skills/<skill-name>/
```

## License

MIT
