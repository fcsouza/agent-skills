---
name: settings-full
description: Complete Claude Code settings.json configuration for game projects — permissions, hooks, env vars, and project vs user level settings.
---

# Full Claude Code Settings for Game Dev

## Project vs User Level

Claude Code merges settings from two locations:

| Location | Scope | Committed? |
|---|---|---|
| `~/.claude/settings.json` | All projects on your machine | No (personal) |
| `.claude/settings.json` (project root) | This project only | Yes (shared with team) |

**Recommendation for game dev:**
- User-level: Biome formatting hook, skill routing hook — these apply to all your projects
- Project-level: narrative guard hook, destructive DB command block — these reference project-specific paths

Deny rules in either file are always enforced. If both files allow the same tool, allow wins. If either file denies it, deny wins.

## Full Example `.claude/settings.json`

Copy and adapt for your game project:

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git log*)",
      "Bash(git diff*)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(git worktree*)",
      "Bash(git branch*)",
      "Bash(bun run typecheck)",
      "Bash(bun run test*)",
      "Bash(bun test*)",
      "Bash(bunx biome check*)",
      "Bash(bunx drizzle-kit generate*)",
      "Bash(bunx drizzle-kit studio*)",
      "Read(*)",
      "Glob(*)",
      "Grep(*)",
      "TodoWrite(*)",
      "TodoRead(*)"
    ],
    "deny": [
      "Bash(rm -rf*)",
      "Bash(DROP TABLE*)",
      "Bash(DROP DATABASE*)",
      "Bash(TRUNCATE*)"
    ]
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "PROMPT=$(echo \"$CLAUDE_HOOK_INPUT\" | jq -r '.prompt // \"\"'); for kw in quest character NPC story lore narrative; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Narrative detected — read quest-narrative-coherence/SKILL.md first\" && break; done; for kw in schema database inventory drizzle migration table; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] DB detected — read postgres-game-schema/SKILL.md\" && break; done; for kw in matchmaking lobby ELO rank queue skill-based; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Matchmaking detected — read matchmaking-system/SKILL.md\" && break; done; for kw in analytics retention funnel D1 D7 D30 cohort telemetry; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Analytics detected — read gameplay-analytics/SKILL.md\" && break; done; for kw in redis leaderboard pubsub cache presence sorted; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Redis detected — read redis-game-patterns/SKILL.md\" && break; done; for kw in state sync netcode delta rollback prediction; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Netcode detected — read game-state-sync/SKILL.md\" && break; done; for kw in economy currency gem crystal coin monetize IAP price; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Economy detected — read game-economy-design/SKILL.md\" && break; done; for kw in auth login session token JWT OAuth betterauth; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Auth detected — read betterauth-integration/SKILL.md\" && break; done; for kw in payment stripe webhook transaction subscription; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Payments detected — read stripe-game-payments/SKILL.md\" && break; done; for kw in sound music audio elevenlabs lyria sfx soundtrack; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Audio detected — read elevenlabs-sound-music/SKILL.md\" && break; done; for kw in deploy pipeline CI CD workflow action Fly Docker; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"[game-dev] Infra detected — read ci-cd-game/SKILL.md\" && break; done; exit 0"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo \"$CLAUDE_HOOK_INPUT\" | jq -r '.tool_input.file_path // .tool_input.path // \"\"'); echo \"$FILE\" | grep -qiE '(quest|character|story|narrative|lore|npc)' && echo \"[game-dev] ⚠️  Narrative file: ensure quest-narrative-coherence check is complete.\"; exit 0"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "CMD=$(echo \"$CLAUDE_HOOK_INPUT\" | jq -r '.tool_input.command // \"\"'); echo \"$CMD\" | grep -qiE '(DROP TABLE|DROP DATABASE|TRUNCATE|DELETE FROM .* WHERE 1=1|pg_drop)' && echo \"[game-dev] DANGER: Destructive DB command detected. Verify this is intentional and you have a backup.\" && exit 2; exit 0"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && [ -f biome.json ] || [ -f biome.jsonc ] && bunx biome check --write . 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[game-dev] Session ended. If you created narrative content, update quest-registry.md and world-lore.md.\""
          }
        ]
      }
    ]
  },
  "env": {
    "SKILL_PATH": "/path/to/your/skills/game-dev"
  }
}
```

## Permissions Reference

| Tool | Recommendation | Reason |
|---|---|---|
| `Read(*)` | Allow | No destructive side effects |
| `Glob(*)` | Allow | Read-only |
| `Grep(*)` | Allow | Read-only |
| `TodoWrite(*), TodoRead(*)` | Allow | Task tracking; no system effects |
| `Bash(git log*)`, `git diff*`, `git status` | Allow | Safe inspection |
| `Bash(bunx biome check*)` | Allow | Formatting only |
| `Bash(bun test*)` | Allow | Tests read-only against DB |
| `Bash(bunx drizzle-kit generate*)` | Allow | Generates files, no DB changes |
| `Bash(bun run dev)` | Prompt | Starts a long-running server process |
| `Write(*)`, `Edit(*)` | Prompt | File writes |
| `Bash(bunx drizzle-kit migrate*)` | Prompt | Irreversible DB changes |
| `Bash(git push*)` | Prompt | Affects remote |
| `Bash(rm -rf*)` | Deny | Destructive filesystem |
| `Bash(DROP TABLE*)`, `TRUNCATE*` | Deny | Irreversible DB destruction |

## Hook Exit Codes

| Exit code | Behavior |
|---|---|
| `0` | Continue — show any output as info |
| `1` | Continue — output shown as warning |
| `2` | **Block** — tool call is cancelled, output shown as error |

The destructive DB hook uses exit `2` to block. The narrative file hook uses exit `0` (warn only — you might legitimately edit narrative files).

## Environment Variables in Hooks

Hooks receive context via `$CLAUDE_HOOK_INPUT` (JSON string) and these env vars:

| Variable | Value |
|---|---|
| `$CLAUDE_PROJECT_DIR` | Absolute path to the project root |
| `$CLAUDE_HOOK_INPUT` | JSON with tool name and input parameters |

To pass custom env vars into hooks, add them to the `"env"` key in settings.json. Example:
```json
"env": {
  "SKILL_PATH": "/Users/you/skills/game-dev",
  "GAME_DB_URL": "${DATABASE_URL}"
}
```

These are available as `$SKILL_PATH` inside hook commands.

## Splitting User vs Project Settings

**User-level** (`~/.claude/settings.json`) — put these hooks here:
- Biome PostToolUse hook (formats all your projects)
- Skill routing UserPromptSubmit hook (useful everywhere)

**Project-level** (`.claude/settings.json`) — put these here:
- Narrative guard PreToolUse hook (specific to game projects)
- Destructive DB PreToolUse block hook (protect production DB)
- Project-specific `env` vars

## Cross-References

- `templates/claude-hooks-config.json` — copy-paste ready hooks block
- `mcp-setup.md` — GITHUB_TOKEN env var setup
- `worktrees.md` — `git worktree*` in the allow list
