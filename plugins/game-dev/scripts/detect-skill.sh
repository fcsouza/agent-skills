#!/usr/bin/env bash
# Detects keywords in user prompts and suggests relevant game-dev skills.
# Called by hooks.json UserPromptSubmit hook.

# Only run in game projects
is_game_project() {
  [ -f "$CLAUDE_PROJECT_DIR/docs/mvp-first-draft.md" ] && return 0
  [ -f "$CLAUDE_PROJECT_DIR/docs/world-lore.md" ] && return 0
  [ -f "$CLAUDE_PROJECT_DIR/docs/quest-registry.md" ] && return 0
  grep -qi "game\|genre\|core.loop\|game-dev" "$CLAUDE_PROJECT_DIR/CLAUDE.md" 2>/dev/null && return 0
  return 1
}
is_game_project || exit 0

PROMPT=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.prompt // ""')

suggest() {
  echo "[game-dev] $1 detected — read $2/SKILL.md"
}

# Narrative
for kw in quest character NPC story lore narrative; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Narrative" "quest-narrative-coherence" && break
done

# Database
for kw in schema database inventory drizzle migration table; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "DB" "postgres-game-schema" && break
done

# Matchmaking
for kw in matchmaking lobby ELO rank queue skill-based; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Matchmaking" "matchmaking-system" && break
done

# Analytics
for kw in analytics retention funnel D1 D7 D30 cohort telemetry; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Analytics" "gameplay-analytics" && break
done

# Redis
for kw in redis leaderboard pubsub cache presence sorted ranking; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Redis" "redis-game-patterns" && break
done

# Netcode
for kw in "state sync" netcode delta rollback prediction; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Netcode" "game-state-sync" && break
done

# Economy
for kw in economy currency gem crystal coin monetize IAP price reward; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Economy" "game-economy-design" && break
done

# Auth
for kw in auth login session token JWT OAuth betterauth; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Auth" "betterauth-integration" && break
done

# Payments
for kw in payment stripe webhook transaction subscription purchase; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Payments" "stripe-game-payments" && break
done

# Audio
for kw in sound music audio elevenlabs lyria sfx soundtrack; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Audio" "elevenlabs-sound-music" && break
done

# Infrastructure
for kw in deploy pipeline CI CD workflow action Fly Docker container; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Infra" "ci-cd-game" && break
done

# Progression
for kw in "skill tree" "talent tree" progression prestige unlock; do
  echo "$PROMPT" | grep -qi "$kw" && suggest "Progression" "skill-progression-trees" && break
done

exit 0
