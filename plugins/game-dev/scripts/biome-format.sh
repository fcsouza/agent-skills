#!/usr/bin/env bash
FILE=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
# Only run on TypeScript files
echo "$FILE" | grep -qE '\.(ts|tsx)$' || exit 0
# Only run if biome config exists
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
([ -f biome.json ] || [ -f biome.jsonc ]) && bunx biome check --write "$FILE" 2>/dev/null || true
exit 0
