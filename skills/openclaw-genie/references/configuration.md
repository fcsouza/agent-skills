# OpenClaw Configuration Reference

## Config File

- Path: `~/.openclaw/openclaw.json` (JSON5 — comments, trailing commas).
- Override: `OPENCLAW_CONFIG_PATH` env var. Absent = safe defaults.
- Strict validation: unknown keys or malformed values prevent Gateway startup.
- `$include` directive: nested file inclusion up to 10 levels. Single file replaces, array deep-merges.

## Model Providers

Format: `provider/model-name`. Built-in aliases: `opus` → `anthropic/claude-opus-4-6`, `sonnet` → `anthropic/claude-sonnet-4-5`, `gpt` → `openai/gpt-5.2`, `gemini` → `google/gemini-3-pro-preview`.

| Provider | Env Var | Example |
|----------|---------|---------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-5` |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-4o` |
| Google | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | `google/gemini-2.5-pro` |
| Mistral | `MISTRAL_API_KEY` | `mistral/mistral-large-latest` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/...` |
| Groq | `GROQ_API_KEY` | `groq/...` |
| xAI | `XAI_API_KEY` | `xai/grok-3` |
| Bedrock | AWS credentials | `bedrock/anthropic.claude-v2` |
| GitHub Copilot | `GH_TOKEN` / `GITHUB_TOKEN` | `github-copilot/...` |
| Ollama | Local, no key | `ollama/llama3` |

**Key rotation**: `OPENCLAW_LIVE_<PROVIDER>_KEY` > `<PROVIDER>_API_KEYS` (comma-separated) > `<PROVIDER>_API_KEY` > `<PROVIDER>_API_KEY_*` (numbered). Triggers on 429 errors only.

**Custom providers**:
```jsonc
{
  "models": {
    "providers": {
      "my-provider": {
        "baseUrl": "https://api.example.com/v1",
        "apiKey": "${CUSTOM_API_KEY}",
        "api": "openai-completions",  // or "anthropic-messages"
        "models": [{ "id": "model-id", "contextWindow": 128000 }]
      }
    }
  }
}
```

**Failover**: (1) Rotate auth profiles within provider. (2) Advance to fallback model. Exponential backoff: 1 → 5 → 25 → 60 min. Billing failures: 5h start, doubling, capped 24h.

## Full Config Structure

```jsonc
{
  "models": {
    "primary": "anthropic/claude-sonnet-4-5",
    "fallbacks": ["openai/gpt-4o"],
    "image": "openai/gpt-4o",
    "aliases": { "fast": "anthropic/claude-haiku-4-5-20251001" },
    "providers": {},             // custom provider definitions
    "mode": "merge"              // "merge" or "replace" for providers
  },
  "channels": {
    "discord": { "token": "", "dmPolicy": "pairing", "requireMention": true },
    "telegram": { "botToken": "", "dmPolicy": "pairing" },
    "whatsapp": { "dmPolicy": "pairing" },
    "slack": { "mode": "socket", "appToken": "", "botToken": "" }
  },
  "agents": {
    "list": [{ "id": "main", "default": true, "workspace": "~/.openclaw/workspace" }],
    "defaults": {
      "model": { "primary": "...", "fallbacks": [] },
      "compaction": { "memoryFlush": { "enabled": true, "softThresholdTokens": 4000 } },
      "memorySearch": { "enabled": true, "provider": "auto" },
      "subagents": { "maxSpawnDepth": 2, "maxConcurrent": 8 }
    }
  },
  "bindings": [],                // agent routing rules
  "broadcast": {},               // multi-agent broadcast groups
  "tools": {
    "profile": "coding",         // minimal | coding | messaging | full
    "allow": [], "deny": [],
    "byProvider": {},
    "exec": { "host": "sandbox", "security": "deny", "ask": "on-miss" },
    "loopDetection": { "warningThreshold": 3, "criticalThreshold": 5 },
    "agentToAgent": { "enabled": false }
  },
  "skills": {
    "entries": { "skill-name": { "enabled": true, "apiKey": "", "env": {} } },
    "load": { "extraDirs": [], "watch": true },
    "install": { "nodeManager": "npm" }
  },
  "browser": {
    "enabled": true, "defaultProfile": "openclaw",
    "ssrfPolicy": { "dangerouslyAllowPrivateNetwork": true },
    "evaluateEnabled": true, "profiles": {}
  },
  "sandbox": {
    "mode": "off",               // off | non-main | all
    "scope": "session",          // session | agent | shared
    "workspaceAccess": "none",   // none | ro | rw
    "docker": { "network": "none", "readOnlyRoot": false, "memory": "1g", "cpus": "1" }
  },
  "gateway": { "port": 18789, "auth": { "token": "" }, "discovery": {} },
  "session": {
    "dmScope": "main",           // main | per-peer | per-channel-peer | per-account-channel-peer
    "reset": { "daily": true, "hour": 4 },
    "identityLinks": {},
    "sendPolicy": { "rules": [], "default": "allow" }
  },
  "automation": { "heartbeat": {}, "cron": [], "webhooks": {} },
  "hooks": { "internal": { "enabled": true, "entries": {} } },
  "auth": { "profiles": {}, "order": {} }
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_HOME` | Override `~/.openclaw` base directory |
| `OPENCLAW_STATE_DIR` | Override state storage location |
| `OPENCLAW_CONFIG_PATH` | Override config file path |
| `OPENCLAW_GATEWAY_PORT` | Override gateway port |

Env files: `~/.openclaw/.env`, workspace `.env`. Substitution: `${VAR_NAME}` in any config string (uppercase only, missing vars throw error).

## Auth & OAuth

**OAuth** (PKCE flow) for OpenAI Codex/ChatGPT. **Setup-token** for Anthropic subscriptions.

```bash
openclaw models auth login --provider openai     # OAuth flow
openclaw models auth setup-token --provider anthropic
openclaw models status                            # Check all auth
```

Storage: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`. Auto-refresh under file lock.

```jsonc
{
  "auth": {
    "profiles": { "anthropic:work": { "provider": "anthropic", "mode": "api_key" } },
    "order": { "anthropic": ["anthropic:work", "anthropic:personal"] }
  }
}
```

## Profiles & Dev Mode

```bash
openclaw --profile work gateway start    # ~/.openclaw/profiles/work/
openclaw --dev agent                     # ~/.openclaw-dev/ (isolated)
```

## Hot Reload

Modes: `off`, `hot`, `restart`, `hybrid` (default). Most settings hot-apply (channels, models, tools, skills, hooks, cron, sessions). Gateway infrastructure (`gateway.*`, `discovery`) requires restart. Config RPC: `config.apply` (full replace) and `config.patch` (merge), rate-limited 3 req/60s.

## CLI Quick Reference

```bash
openclaw config get models.primary
openclaw config set models.primary '"anthropic/claude-opus-4-6"' --json
openclaw config unset channels.irc
openclaw models list [--all --provider anthropic]
openclaw models set anthropic/claude-opus-4-6
openclaw models scan            # Probe available models
openclaw models aliases list
openclaw models fallbacks add openai/gpt-4o
openclaw doctor [--fix --yes]   # Audit + auto-repair config
```
