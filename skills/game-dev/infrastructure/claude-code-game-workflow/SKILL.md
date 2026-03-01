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

## Sources

- This ecosystem's own architecture
