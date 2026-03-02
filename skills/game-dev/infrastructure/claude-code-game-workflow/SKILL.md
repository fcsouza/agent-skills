---
name: claude-code-game-workflow
description: >-
  Use when starting a game project, choosing which skill to read, or navigating the game-dev skill ecosystem. Entry point for AI agents working on game development. Triggers: workflow, which skill, how to start, game project setup.
---

# Claude Code Game Workflow

## Purpose

How AI coding agents navigate this game development skill ecosystem — file conventions, which skills to read first, dependency order, and workflow patterns.

## When to Use

Trigger: game dev workflow, skill navigation, which skill to use, game dev setup, project structure, skill dependencies, agent workflow, how to start, game dev ecosystem

## Prerequisites

None — this is the entry point for the entire ecosystem.

## Core Principles

1. **Read skills before coding** — always check if a relevant skill exists before implementing from scratch
2. **Follow dependency order** — skills have prerequisites; reading them out of order misses critical context
3. **Coherence check is non-negotiable** — any narrative content requires `quest-narrative-coherence` first
4. **Genre-agnostic always** — never assume a specific game genre in shared code
5. **Schema first, logic second** — start with `postgres-game-schema` before writing game logic

## Skill Dependency Graph

```
                    [claude-code-game-workflow] (YOU ARE HERE)
                              |
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     [postgres-game-schema] [game-design-fundamentals] [quest-narrative-coherence]
         |         |              |                         |
         ▼         ▼              ▼                         ▼
    [redis]  [bullmq]    [level-design]              [worldbuilding]
         |         |      [game-economy]             [story-structure]
         ▼         ▼      [ui-ux-game]              [character-design]
    [game-backend-architecture]  |                   [quest-mission-design]
              |                  |
              ▼                  ▼
    [game-state-sync]    [stripe-game-payments]
    [betterauth]         [elevenlabs-sound-music]
```

## Workflow: Starting a New Game

1. Read `claude-code-game-workflow` (this skill)
2. Read `game-design-fundamentals` — define core loop, player motivation
3. Read `postgres-game-schema` — set up database
4. Read `game-backend-architecture` — set up Elysia server
5. Choose domain skills as needed (economy, quests, multiplayer, etc.)

## Workflow: Adding a Feature

1. Identify which skill covers the feature
2. Read that skill's SKILL.md
3. Check prerequisites — read those first if not already done
4. Copy boilerplate/ files as starting point
5. Customize using templates/ for configuration

## Workflow: Creating Narrative Content

1. **ALWAYS** read `quest-narrative-coherence` first
2. Read `worldbuilding` — load current world state
3. Read relevant narrative skill (story-structure, character-design, quest-mission)
4. Follow the 5-step coherence check
5. Register new content in quest-registry.md

## Skill Quick Reference

| Need | Skill | Domain |
|------|-------|--------|
| Database schemas | `postgres-game-schema` | Engineering |
| Job queues | `bullmq-game-queues` | Engineering |
| Game server + WebSocket | `game-backend-architecture` | Engineering |
| Caching + leaderboards | `redis-game-patterns` | Engineering |
| Authentication | `betterauth-integration` | Engineering |
| Payments / IAP | `stripe-game-payments` | Engineering |
| Sound / Music | `elevenlabs-sound-music` | Engineering |
| Netcode / State sync | `game-state-sync` | Engineering |
| Core game design | `game-design-fundamentals` | Design |
| Level / Area design | `level-design` | Design |
| Quests / Missions | `quest-mission-design` | Design |
| Economy / Currency | `game-economy-design` | Design |
| UI / UX | `ui-ux-game` | Design |
| World lore | `worldbuilding` | Narrative |
| Story / Plot | `story-structure-game` | Narrative |
| Characters / NPCs | `character-design-narrative` | Narrative |
| Narrative consistency | `quest-narrative-coherence` | Narrative |
| CI/CD | `ci-cd-game` | Infrastructure |
| Monitoring | `monitoring-game-ops` | Infrastructure |
| Cursor/Codex setup | `cursor-codex-integration` | Infrastructure |

## File Conventions

- `SKILL.md` — knowledge document, read first
- `boilerplate/` — copy as starting code
- `templates/` — configuration and document templates
- `ARCHITECTURE.md` — diagrams for infrastructure skills

## Claude Code Setup

How to configure Claude Code for a game project so agents have full context every session.

### 1. Project CLAUDE.md

Create a `CLAUDE.md` at the root of every game project. A ready-to-copy template lives at `templates/game-project-claude.md` in this skill folder. It must include:

- **Tech stack declaration** — tells Claude which conventions apply (Bun, Elysia, Drizzle, Neon, Redis, BullMQ, BetterAuth, Stripe, Fly.io)
- **Skill references section** — maps task types to the correct SKILL.md so agents self-route
- **Mandatory rules** — narrative coherence, server-authoritative logic, schema-first development, Biome before done
- **Memory file paths** — `quest-registry.md`, `world-lore.md`, and `~/.claude/projects/<project>/memory/MEMORY.md`

### 2. Skill @ Mentions

In any prompt, reference skill files directly to inject their context before Claude responds:

```
@skills/game-dev/engineering/postgres-game-schema/SKILL.md — add inventory table
@skills/game-dev/narrative/quest-narrative-coherence/SKILL.md — create merchant quest
@skills/game-dev/engineering/matchmaking-system/SKILL.md — implement ELO queue
```

This is equivalent to pasting the skill content — Claude reads it and applies its patterns immediately.

### 3. Memory Files

Persist cross-session design decisions so agents never re-derive them:

- `~/.claude/projects/<project>/memory/MEMORY.md` — loaded automatically every session
- Example entries:
  - "Chose Glicko-2 over ELO — handles new players better (fewer games played)"
  - "Player attributes use JSONB — indexed on `attributes->>'class'`"
  - "Gem earn rate: 10/day soft cap. First-time bonus: 200 gems."
  - "Factions: Merchant Guild (neutral), Iron Brotherhood (hostile), Arcane Circle (allied)"

## Hooks for Game Dev

Copy the full hooks config from `templates/claude-hooks-config.json`. Four patterns:

### Hook 1 — Skill Routing (UserPromptSubmit)

Detects keywords in the user's prompt and prints the relevant skill path before Claude responds. Runs on every prompt — zero false-negative cost.

- **Event**: `UserPromptSubmit`
- **What it does**: Scans prompt for domain keywords → prints the matching skill path as a hint
- **Keywords mapped**:
  - `quest / character / NPC / story / lore / narrative` → `quest-narrative-coherence/SKILL.md`
  - `schema / database / inventory / drizzle / migration` → `postgres-game-schema/SKILL.md`
  - `matchmaking / lobby / ELO / rank / queue` → `matchmaking-system/SKILL.md`
  - `analytics / retention / funnel / D1 / D7 / cohort` → `gameplay-analytics/SKILL.md`
  - `redis / leaderboard / pubsub / cache / presence` → `redis-game-patterns/SKILL.md`
  - `state / sync / netcode / delta / rollback / prediction` → `game-state-sync/SKILL.md`
- **When to use**: Always. Put in project `.claude/settings.json`.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "PROMPT=$(echo \"$CLAUDE_HOOK_INPUT\" | jq -r '.prompt // \"\"'); for kw in quest character NPC story lore narrative; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"📚 Narrative skill: Read narrative/quest-narrative-coherence/SKILL.md first\" && break; done; for kw in schema database inventory drizzle migration; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"📚 Engineering skill: Read engineering/postgres-game-schema/SKILL.md\" && break; done; for kw in matchmaking lobby elo rank queue; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"📚 Engineering skill: Read engineering/matchmaking-system/SKILL.md\" && break; done; for kw in analytics retention funnel D1 D7 D30 cohort; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"📚 Engineering skill: Read engineering/gameplay-analytics/SKILL.md\" && break; done; for kw in redis leaderboard pubsub cache presence; do echo \"$PROMPT\" | grep -qi \"$kw\" && echo \"📚 Engineering skill: Read engineering/redis-game-patterns/SKILL.md\" && break; done; exit 0"
          }
        ]
      }
    ]
  }
}
```

### Hook 2 — Narrative Coherence Guard (PreToolUse: Write/Edit)

Blocks careless writes to narrative files by injecting a reminder before Claude touches them.

- **Event**: `PreToolUse`
- **Matcher**: `Write|Edit`
- **What it does**: Checks if the target file path matches `quest|character|story|narrative|lore|npc` — if yes, prints a reminder
- **Behavior**: Exit code 0 (reminder only, not a hard block — Claude can still proceed)
- **When to use**: Any project with narrative content

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "FILE=$(echo \"$CLAUDE_HOOK_INPUT\" | jq -r '.tool_input.file_path // .tool_input.path // \"\"'); echo \"$FILE\" | grep -qiE '(quest|character|story|narrative|lore|npc)' && echo \"[game-dev] ⚠️  Narrative file: ensure quest-narrative-coherence check is complete.\"; exit 0"
    }
  ]
}
```

### Hook 3 — Biome Guard (PostToolUse: Write/Edit)

Auto-formats TypeScript after every file write. Game projects accumulate debt fast when formatting is skipped.

- **Event**: `PostToolUse`
- **Matcher**: `Write|Edit`
- **What it does**: If `biome.json` or `biome.jsonc` exists in the project root, runs `bunx biome check --write` on the written file
- **When to use**: Any TypeScript game project

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "cd \"$CLAUDE_PROJECT_DIR\" && [ -f biome.json ] || [ -f biome.jsonc ] && bunx biome check --write . 2>/dev/null || true"
    }
  ]
}
```

### Hook 4 — Quest Registry Reminder (Stop)

After every session, reminds the developer to update the narrative registry files.

- **Event**: `Stop`
- **What it does**: Prints a reminder to update `quest-registry.md` and `world-lore.md`
- **When to use**: Any project with narrative content
- **Note**: Fires unconditionally — cheap and hard to miss

```json
{
  "hooks": {
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
  }
}
```

## Subagent Patterns

Use parallel Claude Code agents when a feature spans multiple domains. Each agent reads its own skills, works in isolation, and produces a concrete output you merge at the end.

### Pattern 1 — Design + Engineering in Parallel

When adding a major feature, split into two agents running simultaneously:

- **Agent A** (Design): reads design skills → produces GDD section, economy balance, quest design
- **Agent B** (Engineering): reads engineering skills → implements schema + backend routes

They work on separate concerns with no shared state. Use `"worktree"` isolation to give each agent its own git branch. Merge when both complete.

**Prompt:**
```
Use the Agent tool to run 2 parallel agents:
- Agent 1: Read skills/game-dev/design/game-economy-design/SKILL.md and design the currency economy for our idle game. Output: economy-design.md
- Agent 2: Read skills/game-dev/engineering/postgres-game-schema/SKILL.md and create the initial player schema. Output: modify db/schema.ts
```

### Pattern 2 — Narrative Team

For a narrative-heavy session with multiple interconnected characters and quests:

- **Agent A**: reads `quest-narrative-coherence` + creates new quest (loads `world-lore.md`, checks consistency)
- **Agent B**: reads `character-design-narrative` + creates NPCs for that quest

Run in parallel. Then have the coherence agent review both outputs before merging to catch conflicts.

**Prompt:**
```
Use the Agent tool to run 2 parallel agents:
- Agent 1: Read narrative/quest-narrative-coherence/SKILL.md and narrative/worldbuilding/SKILL.md. Create a new merchant guild quest. Check world-lore.md for faction alignment. Output: quests/merchant-guild-q1.md
- Agent 2: Read narrative/character-design-narrative/SKILL.md. Create 2 NPCs for a merchant guild quest — a quest giver and antagonist. Output: characters/merchant-npcs.md
```

### Pattern 3 — Full-Stack Feature

Breaking down "add matchmaking" into parallel workstreams:

1. **Design agent**: reads `matchmaking-system` + `game-economy-design` → produces matchmaking config doc
2. **Backend agent**: reads `matchmaking-system` + `bullmq-game-queues` → implements server-side queue logic
3. **DB agent**: reads `postgres-game-schema` + `redis-game-patterns` → creates tables + Redis key design

All three run in parallel. One integration agent (sequential, after all three complete) assembles the final feature.

**When not to parallelize**: When Agent B's output depends on Agent A's output. Keep those sequential.

## Memory Patterns

What to persist across Claude Code sessions so agents never lose context.

### What to Save in MEMORY.md

Write to `~/.claude/projects/<project>/memory/MEMORY.md` after making significant decisions:

- **Architectural decisions**: "Chose Glicko-2 over ELO for matchmaking — handles new players better"
- **Schema choices**: "Player attributes use JSONB for flexibility — indexed on `attributes->>'class'`"
- **Economy parameters**: "Gem earn rate: 10/day soft cap. First-time bonus: 200 gems."
- **World state summary**: "3 factions: Merchant Guild (neutral), Iron Brotherhood (hostile), Arcane Circle (allied). Merchants control trade routes."
- **Active quest registry**: link to `quest-registry.md`

### Memory File Structure

```
~/.claude/projects/<your-project>/memory/
  MEMORY.md             # key decisions — loaded every session automatically
  world-state.md        # factions, geography, lore summary
  economy-state.md      # current balance parameters
  schema-decisions.md   # why each schema looks the way it does
```

Keep companion files (`world-state.md`, etc.) in the project repo under `docs/memory/` and symlink or reference them from `MEMORY.md` so they travel with the codebase.

### Rules for Memory

- Write immediately after making a significant architectural or design decision
- Never write temporary or session-specific context (e.g., "currently debugging X")
- Review and update when a decision changes — stale memory is worse than no memory
- Keep `MEMORY.md` under 150 lines (Claude truncates at ~200)
- Use bullet points, not prose — agents scan memory, not read it

## Sources

- This ecosystem's own architecture
- Claude Code documentation: hooks, memory, subagents
- "Overwatch Gameplay Architecture and Netcode" — inspiration for subagent parallelism in game systems
