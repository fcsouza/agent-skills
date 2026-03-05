#!/usr/bin/env bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only act in game projects with narrative files
HAS_LORE=false
HAS_REGISTRY=false
[ -f "$PROJECT_DIR/docs/world-lore.md" ] && HAS_LORE=true
[ -f "$PROJECT_DIR/docs/quest-registry.md" ] && HAS_REGISTRY=true

$HAS_LORE || $HAS_REGISTRY || exit 0

# Check if narrative files were modified (requires git)
NARRATIVE_CHANGED=false
if command -v git &>/dev/null && git -C "$PROJECT_DIR" rev-parse --git-dir &>/dev/null 2>&1; then
  git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | \
    grep -qiE '(quest|character|story|narrative|lore|npc)' && NARRATIVE_CHANGED=true
fi

if $NARRATIVE_CHANGED; then
  echo "[game-dev] Narrative files modified this session — remember to update:"
  $HAS_LORE     && echo "  • docs/world-lore.md — add new locations, factions, or lore facts"
  $HAS_REGISTRY && echo "  • docs/quest-registry.md — register new or modified quests"
fi
exit 0
