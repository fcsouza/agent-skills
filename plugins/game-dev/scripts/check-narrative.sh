#!/usr/bin/env bash
# Checks if a Write/Edit target is a narrative file and reminds about coherence check.
# Called by hooks.json PreToolUse hook (Write|Edit matcher).

FILE=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')

echo "$FILE" | grep -qiE '(quest|character|story|narrative|lore|npc)' \
  && echo "[game-dev] Narrative file: ensure quest-narrative-coherence check is complete."

exit 0
