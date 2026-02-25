# OpenClaw Multi-Agent Reference

## Overview

Single gateway hosts multiple isolated agents. Each agent has its own workspace, session store, memory, auth profiles, and optional sandbox. Default single-agent mode uses `agentId: "main"`.

## Agent Configuration (openclaw.json)

```jsonc
{
  "agents": {
    "list": [
      { "id": "home", "default": true, "workspace": "~/.openclaw/workspace-home" },
      { "id": "work", "workspace": "~/.openclaw/workspace-work",
        "model": { "primary": "openai/gpt-4o" },
        "tools": { "profile": "coding", "allow": ["browser*"], "deny": [] },
        "sandbox": { "mode": "all", "scope": "agent" }
      }
    ]
  }
}
```

### Agent Properties
| Property | Description |
|----------|-------------|
| `id` | Unique agent identifier |
| `default` | Default agent for unrouted messages |
| `workspace` | Isolated workspace directory |
| `model` | Primary model + fallbacks override |
| `tools` | Tool profile, allow/deny overrides |
| `sandbox` | Per-agent sandbox config |
| `identity` | Name, emoji, avatar |

Never reuse `agentDir` across agents (causes auth/session collisions).

## Per-Agent Workspaces

```
~/.openclaw/
├── workspace-home/              # "home" agent
│   ├── SOUL.md                  # Personality
│   ├── IDENTITY.md              # Name, emoji, avatar
│   ├── USER.md                  # User profile
│   ├── MEMORY.md                # Long-term memory
│   ├── TOOLS.md                 # Tool usage guidance
│   ├── BOOTSTRAP.md             # One-time init (deleted after)
│   ├── HEARTBEAT.md             # Periodic check-in instructions
│   ├── memory/                  # Daily logs
│   ├── skills/                  # Agent-specific skills
│   └── hooks/                   # Agent-specific hooks
├── workspace-work/              # "work" agent (same structure)
├── agents/home/                 # Agent state
│   ├── sessions/                # Session store + transcripts
│   └── agent/auth-profiles.json
└── agents/work/
```

- **Managed skills** (`~/.openclaw/skills/`) shared across all agents
- **Workspace skills/hooks** are per-agent (highest precedence)
- Each agent has independent memory, sessions, and vector indices

## Routing Rules (Bindings)

```jsonc
{
  "bindings": [
    { "agentId": "home", "match": { "channel": "whatsapp", "accountId": "personal" } },
    { "agentId": "work", "match": { "channel": "whatsapp", "accountId": "biz" } },
    { "agentId": "dev", "match": { "channel": "discord", "guildId": "123", "roles": ["456"] } },
    { "agentId": "support", "match": { "channel": "telegram", "peer": { "kind": "group", "id": "-100123" } } }
  ]
}
```

### Match Fields
`channel`, `accountId` (or `"*"`), `peer.kind` (`"direct"`/`"group"`), `peer.id`, `guildId`, `roles`, `teamId`. Multiple fields use AND.

### Priority (deterministic)
1. Exact peer match (channel + peer ID)
2. Parent peer match (thread inheritance)
3. Guild ID + roles (Discord)
4. Guild ID alone
5. Team ID (Slack)
6. Account ID (exact)
7. Channel-level (`accountId: "*"`)
8. Default agent fallback

First match in config order wins within the same tier.

## Broadcast Groups

Multiple agents process the same message. Currently **WhatsApp-only** (v2026.1.9+). Takes priority over bindings.

```jsonc
{
  "broadcast": {
    "strategy": "parallel",      // parallel | sequential
    "120363403215116621@g.us": ["assistant", "coder", "reviewer"],
    "+15551234567": ["agent1", "agent2"]
  }
}
```

**Parallel**: All agents respond independently. **Sequential**: Each sees previous agents' responses.

Each agent maintains completely isolated sessions, history, workspace, tools, and memory. Agents fail independently. No hard limit but 10+ may degrade performance.

## Sub-Agents

Background agent runs spawned from parent session. Isolated execution with immediate return.

```jsonc
{
  "agents": {
    "defaults": {
      "subagents": {
        "maxSpawnDepth": 2,          // 1-5, nesting depth
        "maxChildrenPerAgent": 5,    // 1-20
        "maxConcurrent": 8,
        "runTimeoutSeconds": 900,
        "archiveAfterMinutes": 60,
        "model": "anthropic/claude-haiku-4-5-20251001",
        "thinking": "low"
      }
    }
  }
}
```

- Session key: `agent:<agentId>:subagent:<uuid>`
- Depth-1: orchestrator tools. Depth-2+: leaf (no session tools).
- Default deny for sub-agents: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`.
- Results announce back to requester chat.

**Slash commands**: `/subagents spawn|list|kill|log|info|send|steer`, `/focus <target>`, `/unfocus`, `/session ttl`.

## Agent-to-Agent Messaging

Disabled by default:
```jsonc
{
  "tools": {
    "agentToAgent": { "enabled": false, "allow": ["home", "work"] }
  }
}
```

## Session Isolation

### Session Key Format
- DMs: `agent:<agentId>:<mainKey>` (default: `agent:main:main`)
- Per-peer: `agent:<agentId>:dm:<peerId>`
- Per-channel-peer: `agent:<agentId>:<channel>:dm:<peerId>`
- Groups: `agent:<agentId>:<channel>:group:<groupId>`
- Threads: append `:thread:<threadTs>` (Slack/Discord) or `:topic:<topicId>` (Telegram)
- Sub-agents: `agent:<agentId>:subagent:<uuid>`
- Cron: `cron:<jobId>`
- Webhooks: `hook:<uuid>`

### DM Scope Options
| Scope | Behavior |
|-------|----------|
| `main` (default) | All DMs share one session |
| `per-peer` | Isolated by sender ID across channels |
| `per-channel-peer` | Isolated by channel + sender (recommended multi-user) |
| `per-account-channel-peer` | Isolated by account + channel + sender |

**Identity links**: Map cross-platform identities to one user:
```jsonc
{ "session": { "identityLinks": { "alice": ["telegram:123", "discord:456"] } } }
```

**Security**: Without per-peer scoping, different senders share conversation context (privacy leak). Use `per-channel-peer` or stricter in multi-user setups.

## Session Maintenance

Modes: `warn` (default) and `enforce`. Enforce: prune stale (30d), cap entries (500), archive transcripts, rotate (10MB), enforce disk budget.

Storage: `~/.openclaw/agents/<agentId>/sessions/sessions.json` + `<SessionId>.jsonl` transcripts.

## CLI

```bash
openclaw agents list [--json --bindings]
openclaw agents add <name> [--workspace]
openclaw agents delete <id> [--force]
openclaw agents set-identity [--agent --name --emoji --avatar]
openclaw agent --message "..." --agent <name>  # Single turn as specific agent
openclaw sessions [--agent <name> --json]
openclaw status --all --deep                    # Full system overview
```
