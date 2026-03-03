# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Plugins

Plugins are complete workflow bundles — skills + agents + hooks working together as an integrated system. Install a plugin to get the full experience.

| Plugin | Description | Platform |
|--------|-------------|----------|
| [game-dev](plugins/game-dev/) | **25 skills, 3 agents, 4 hooks** — complete game development workflow with engineering, design, narrative, and infrastructure | Game Dev |

## Available Skills

Skills are individual, cherry-pickable modules. Install only what you need.

| Skill | Description | Platform |
|-------|-------------|----------|
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |
| [game-dev](skills/game-dev/) | **25 individual game development skills** — cherry-pick engineering, design, narrative, and infrastructure skills | Game Dev |

## Structure

Simple skills follow a flat layout:

```
skills/<skill-name>/
├── README.md           # Overview and installation instructions
├── SKILL.md            # Main skill file (YAML frontmatter + body)
└── references/         # Deep-dive reference files (optional)
    └── topic-a.md
```

Larger skill ecosystems (like `game-dev`) use a nested layout with domain sub-skills:

```
skills/<skill-name>/
├── README.md           # Ecosystem overview and skill index
├── AGENTS.md           # How AI agents should navigate the ecosystem
├── <domain>/
│   └── <sub-skill>/
│       ├── SKILL.md        # Skill knowledge and principles
│       ├── ARCHITECTURE.md # System diagrams (optional)
│       ├── boilerplate/    # Starter code to copy and customize
│       └── templates/      # Document and config templates
```

- `SKILL.md` is always the entry point — read this first
- `boilerplate/` files are starter code, copy and customize
- `templates/` are document/config templates to fill in
- `ARCHITECTURE.md` explains system design decisions

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more.

```bash
# Install a plugin (full workflow: skills + agents + hooks)
npx skills add fcsouza/agent-skills --skill game-dev

# Install a specific skill
npx skills add fcsouza/agent-skills --skill openclaw-genie

# Install globally (available across projects)
npx skills add fcsouza/agent-skills --skill openclaw-genie -g

# Target a specific agent
npx skills add fcsouza/agent-skills --skill openclaw-genie -a claude-code

# List all available skills
npx skills add fcsouza/agent-skills --list
```

### Manual

```bash
# For Claude Code — plugin (full bundle)
cp -r plugins/game-dev/ .claude/plugins/game-dev/

# For Claude Code — individual skill
cp -r skills/game-dev/<category>/<skill-name>/ .claude/skills/<skill-name>/

# For OpenClaw
cp -r skills/<skill-name>/ ~/.openclaw/workspace/skills/<skill-name>/
```

## License

MIT
