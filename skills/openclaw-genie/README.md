# OpenClaw Genie

A comprehensive agent skill for [OpenClaw](https://openclaw.ai) — the self-hosted AI agent gateway that connects LLM agents to 38+ messaging platforms.

## What It Covers

- Installation and quick start
- Full `openclaw.json` configuration reference
- Channel setup (Discord, Telegram, WhatsApp, Slack, Signal, iMessage, and more)
- Memory system (vector search, hybrid BM25+vector, QMD, local embeddings)
- Tools (exec, browser, skills, hooks, messaging, sub-agents)
- Deployment (Docker, Fly.io, Railway, Render, sandboxing, security)
- Multi-agent architecture (routing, broadcast, workspaces, session isolation)

## File Structure

```
openclaw-genie/
├── SKILL.md                          # Main skill (247 lines)
└── references/
    ├── configuration.md              # openclaw.json, model providers, auth, OAuth
    ├── channels.md                   # Per-channel setup, access control, streaming
    ├── memory.md                     # Vector search, QMD, hybrid, embeddings
    ├── tools.md                      # Exec, browser, skills system, hooks, sub-agents
    ├── deployment.md                 # Docker, cloud platforms, sandboxing, security
    └── multi-agent.md                # Bindings, broadcast, workspaces, sessions
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill openclaw-genie
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill openclaw-genie -g
```

### Via ClawHub (OpenClaw only)

```bash
clawhub install openclaw-genie
```

### Manual

Copy the `openclaw-genie/` folder to your agent's skills directory:

```bash
# OpenClaw (workspace skills, highest precedence)
cp -r openclaw-genie/ ~/.openclaw/workspace/skills/openclaw-genie/

# Claude Code
cp -r openclaw-genie/ .claude/skills/openclaw-genie/
```

## Usage

Once installed, the skill is automatically available. It triggers when you ask about any OpenClaw topic — installation, configuration, channels, memory, tools, hooks, deployment, or multi-agent setup.

Use `/openclaw-genie` as a slash command, or let the agent invoke it automatically based on context.

## Sources

- [OpenClaw Docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw) (229k stars, MIT license)
- [ClawHub Registry](https://clawhub.com)
