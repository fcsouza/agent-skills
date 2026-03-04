#!/usr/bin/env bash
# Detects destructive database commands in Bash tool usage.
# Called by hooks.json PreToolUse hook (Bash matcher).
# Exits with code 2 to block the command if destructive.

CMD=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.tool_input.command // ""')

echo "$CMD" | grep -qiE '(DROP TABLE|DROP DATABASE|TRUNCATE|DELETE FROM .* WHERE 1=1|pg_drop)' \
  && echo "[game-dev] DANGER: Destructive DB command detected. Verify this is intentional and you have a backup." \
  && exit 2

exit 0
