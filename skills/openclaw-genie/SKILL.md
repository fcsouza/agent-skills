---
name: openclaw-genie
description: >-
  Use when the user asks about OpenClaw — installation, configuration, agents,
  channels, memory, tools, hooks, skills, deployment, Docker, multi-agent,
  OAuth, gateway, CLI, browser, exec, sandboxing, sessions, cron, webhooks,
  heartbeat, sub-agents, or messaging platform integration.
---

# OpenClaw Genie

OpenClaw is a self-hosted personal AI agent gateway (MIT license, ~229k GitHub
stars). It connects LLM agents to 38+ messaging platforms (WhatsApp, Telegram,
Discord, Slack, Signal, iMessage, MS Teams, Matrix, and more) through a single
Gateway process. All data stays local.

---

## Quick Start

```bash
# One-liner install (macOS/Linux, requires Node 22+)
curl -fsSL https://openclaw.ai/install.sh | bash

# Or via npm
npm install -g openclaw@latest

# Interactive setup — gateway, workspace, channels, skills
openclaw onboard --install-daemon

# Verify
openclaw status
openclaw gateway status
```

Web Control UI: `http://127.0.0.1:18789/`

---

## Core Architecture

```
Channels (WhatsApp, Discord, Telegram, Slack, Signal, …)
        ↓
    Gateway  ← WebSocket control plane (port 18789), single source of truth
        ↓
    Agents   ← isolated workspaces, sessions, memory, tools
        ↓
    Tools    ← exec, browser, skills, hooks, messaging, sub-agents
```

- **Gateway**: Multiplexed port (WebSocket + HTTP + Control UI). Hot-reloads config.
- **Agents**: Fully isolated — own workspace, session store, memory, auth profiles, sandbox.
- **Channels**: 38+ adapters run simultaneously. Deterministic routing: replies return to origin.
- **Sessions**: Key format `agent:<agentId>:<channel>:<scope>:<chatId>`. DM scopes: `main`, `per-peer`, `per-channel-peer`, `per-account-channel-peer`.

---

## Agent Configuration

Workspace files in `~/.openclaw/workspace/` (default agent) or `~/.openclaw/workspace-<agentId>/`:

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent personality and system prompt |
| `IDENTITY.md` | Name, emoji, avatar |
| `USER.md` | User profile information |
| `MEMORY.md` | Curated long-term memory |
| `memory/YYYY-MM-DD.md` | Daily append-only session logs |
| `TOOLS.md` | Tool usage guidance |
| `BOOTSTRAP.md` | One-time init tasks (deleted after first run) |
| `HEARTBEAT.md` | Periodic check-in instructions |

Bootstrap injection: IDENTITY → SOUL → USER → MEMORY → daily log → skills → session.
Limits: 20,000 chars/file, 150,000 chars total (configurable).

Multi-agent config uses `agents.list[]` and `bindings[]` in openclaw.json (see `references/multi-agent.md`).

---

## Configuration — openclaw.json

Location: `~/.openclaw/openclaw.json` (JSON5 — comments and trailing commas OK).

```jsonc
{
  "models": {           // primary, fallbacks, aliases, image model
    "primary": "anthropic/claude-sonnet-4-5",
    "fallbacks": ["openai/gpt-4o"]
  },
  "channels": { },      // discord, telegram, whatsapp, slack, signal, …
  "agents": { },        // list, defaults, bindings, broadcast, subagents
  "tools": { },         // profiles, allow/deny, loop detection, exec config
  "skills": { },        // entries, load dirs, install manager
  "browser": { },       // profiles, SSRF policy, executable path
  "sandbox": { },       // mode (off/non-main/all), scope, Docker hardening
  "gateway": { },       // port, auth, discovery, binding
  "automation": { },    // cron, webhooks, heartbeat
  "hooks": { },         // internal hooks config
  "session": { },       // dmScope, resets, sendPolicy, maintenance
  "auth": { }           // OAuth profiles, key rotation, order
}
```

- **Env vars**: `~/.openclaw/.env`, `${VAR}` substitution in config strings.
- **`$include`**: Nested file inclusion (up to 10 levels).
- **Hot reload**: `hybrid` mode (default) — safe changes hot-apply, critical ones auto-restart. Debounce 300ms.
- **Strict validation**: Unknown keys prevent Gateway startup.

For full reference, read `references/configuration.md`.

---

## Channels Quick Reference

| Channel | Setup | Notes |
|---------|-------|-------|
| Discord | `openclaw channels add discord` | Bot API + Gateway; servers, DMs, threads, slash commands, voice |
| Telegram | `openclaw channels add telegram` | grammY; groups, forums, inline buttons, webhook mode |
| WhatsApp | `openclaw channels add whatsapp` | Baileys; QR pairing, media, polls |
| Slack | `openclaw channels add slack` | Bolt SDK; socket or HTTP mode, native streaming |
| Signal | `openclaw channels add signal` | signal-cli; privacy-focused, auto-daemon |
| iMessage | `openclaw channels add bluebubbles` | BlueBubbles; reactions, edits, groups |
| Google Chat | `openclaw channels add googlechat` | HTTP webhook app |
| IRC | `openclaw channels add irc` | NickServ, channels + DMs |
| MS Teams | `openclaw plugins install @openclaw/msteams` | Adaptive Cards, polls |
| Matrix | `openclaw plugins install @openclaw/matrix` | E2EE, threads, rooms |

**Access control**: DM policy (`pairing`/`allowlist`/`open`/`disabled`), group policy, mention gating. Multi-account per channel supported.

For per-channel details, read `references/channels.md`.

---

## Memory System

- **Daily logs**: `memory/YYYY-MM-DD.md` — today + yesterday loaded at session start
- **Long-term**: `MEMORY.md` — curated facts, decisions, preferences (private sessions only)
- **Tools**: `memory_search` (vector recall, ~400-token chunks) and `memory_get` (file reads)
- **Hybrid search**: BM25 (exact tokens) + vector (semantic) with configurable weights
- **Post-processing**: MMR deduplication (lambda 0.7) + temporal decay (30-day half-life)
- **Providers**: auto-selects local → OpenAI → Gemini → Voyage → Mistral
- **QMD backend**: Optional local-first sidecar (BM25 + vectors + reranking)
- **Auto flush**: Silent agentic turn before context compaction preserves important memories

For full memory config, read `references/memory.md`.

---

## Tools Overview

| Tool | Purpose |
|------|---------|
| `exec` | Shell commands (sandbox/gateway/node hosts) |
| `process` | Background process management |
| `browser` | Chromium automation (navigate, click, type, screenshot) |
| `web_search` | Brave Search API queries |
| `web_fetch` | URL → markdown extraction |
| `memory_search` | Semantic vector search over memory |
| `memory_get` | Direct memory file reads |
| `message` | Cross-channel messaging (send, react, thread, pin, poll) |
| `sessions_spawn` | Sub-agent runs (one-shot or persistent, up to depth 5) |
| `canvas` | Node Canvas UI (HTML display on connected devices) |

**Access control**: Profiles (`minimal`, `coding`, `messaging`, `full`), allow/deny lists, tool groups (`group:fs`, `group:runtime`, `group:web`, `group:ui`, `group:automation`).

For full tools, skills, and hooks reference, read `references/tools.md`.

---

## Hooks & Automation

**Hooks** — event-driven TypeScript handlers in `<workspace>/hooks/`:

| Event | Trigger |
|-------|---------|
| `command:new/reset/stop` | Session lifecycle |
| `agent:bootstrap` | Pre-injection (can mutate bootstrap files) |
| `gateway:startup` | After channels load |
| `message:received/sent` | Message lifecycle |
| `tool_result_persist` | Synchronous tool result transform |

**Automation** — built into Gateway:
- **Cron**: Scheduled jobs (cron expressions, intervals, one-shot). Isolated or main-session.
- **Webhooks**: `/hooks/wake` (system events), `/hooks/agent` (isolated turns), custom mapped endpoints.
- **Heartbeat**: Periodic check-ins (default 30min), batches multiple checks per turn.

---

## Deployment Options

```bash
# Local service (default)
openclaw gateway install && openclaw gateway start

# One-liner Docker
./docker-setup.sh

# Manual Docker
docker build -t openclaw:local -f Dockerfile .
docker compose up -d openclaw-gateway
```

**Cloud**: Fly.io, Railway, Render, GCP, Hetzner, Cloudflare Workers, Ansible.
**Sandbox**: Docker isolation for untrusted sessions. Modes: `off`, `non-main`, `all`. Scopes: `session`, `agent`, `shared`.
**Remote access**: Tailscale/VPN preferred, SSH tunnel fallback.

For full deployment guide, read `references/deployment.md`.

---

## CLI Essentials

| Command | Purpose |
|---------|---------|
| `openclaw onboard` | Interactive first-time setup |
| `openclaw gateway start/stop/status` | Service management |
| `openclaw channels add/list/status/login` | Channel management |
| `openclaw models list/set/auth/scan` | Model config + auth |
| `openclaw skills list/info/check` | Skill management |
| `openclaw hooks list/enable/disable/install` | Hook management |
| `openclaw agent --message "..."` | Single agent turn |
| `openclaw agents list/add/delete` | Multi-agent management |
| `openclaw sessions` | List/manage sessions |
| `openclaw browser` | Browser control (50+ subcommands) |
| `openclaw cron list/add/run` | Scheduled jobs |
| `openclaw config get/set/unset` | Config helpers |
| `openclaw doctor [--fix]` | Health checks + auto-repair |
| `openclaw security audit [--deep]` | Security audit |
| `openclaw logs [--follow]` | Tail gateway logs |
| `openclaw memory search "query"` | Vector search |
| `openclaw tui` | Terminal UI |

**Global flags**: `--dev`, `--profile <name>`, `--json`, `--no-color`

---

## When to Read Reference Files

| If you need… | Read |
|--------------|------|
| Full openclaw.json, model providers, env vars, auth, OAuth | `references/configuration.md` |
| Per-channel setup, routing, access control, streaming, multi-account | `references/channels.md` |
| Memory files, vector search, QMD, embeddings, hybrid search | `references/memory.md` |
| Exec, browser, skills, hooks, tool access, sub-agents | `references/tools.md` |
| Docker, cloud deploy, sandboxing, native install, security | `references/deployment.md` |
| Multi-agent config, bindings, broadcast, sub-agents, workspaces | `references/multi-agent.md` |
