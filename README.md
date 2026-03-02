# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Skills

| Skill | Description | Platform |
|-------|-------------|----------|
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |
| [game-dev](skills/game-dev/) | **21-skill game development ecosystem** — genre-agnostic engineering, design, narrative, and infrastructure skills with TypeScript boilerplate | Game Dev |

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
