# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Skills

| Skill | Description | Platform |
|-------|-------------|----------|
| [openclaw-genie](skills/openclaw-genie/) | Comprehensive OpenClaw gateway skill — installation, configuration, 38+ channels, memory, tools, hooks, deployment, multi-agent | [OpenClaw](https://openclaw.ai) |

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
