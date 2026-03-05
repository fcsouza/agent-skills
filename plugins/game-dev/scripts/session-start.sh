#!/usr/bin/env bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check for game project indicators
HAS_DRAFT=false
HAS_LORE=false
HAS_REGISTRY=false

[ -f "$PROJECT_DIR/docs/mvp-first-draft.md" ] && HAS_DRAFT=true
[ -f "$PROJECT_DIR/docs/world-lore.md" ] && HAS_LORE=true
[ -f "$PROJECT_DIR/docs/quest-registry.md" ] && HAS_REGISTRY=true

# Only output if this looks like a game project
if $HAS_DRAFT || $HAS_LORE || $HAS_REGISTRY; then
  echo "[game-dev plugin active]"
  $HAS_DRAFT && echo "  • docs/mvp-first-draft.md — game plan exists, read it before making architecture decisions"
  $HAS_LORE  && echo "  • docs/world-lore.md — world state exists, check before adding narrative content"
  $HAS_REGISTRY && echo "  • docs/quest-registry.md — quest registry exists, update after quest changes"
  echo "  Use /game-dev:game-architect to plan a new game, or /game-dev:engineering-* /game-dev:design-* skills for domain help."
fi
exit 0
