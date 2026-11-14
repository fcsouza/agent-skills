---
name: game-dev
description: "Entry point for game development work: routes a task to the right game-dev skill and states the project conventions. Use when starting or continuing work on a game project, or when it is unclear which game-dev skill applies."
---

# Game Dev

Find the task in the table, then load the skill named beside it. Commands run a whole workflow; start with them when one fits.

## Route

### Design

| Need | Skill |
|---|---|
| Core loop, feedback, motivation, progression curves | `game-design-fundamentals` |
| Currencies, sinks and faucets, loot, crafting, shops | `game-economy-design` |
| Level layout, pacing, encounter placement, difficulty curve | `level-design` |
| Dungeons, maps, seeds, noise, generated loot | `procedural-gen` |
| Quests, missions, objectives, rewards | `quest-mission-design` |
| HUD, menus, onboarding, accessibility | `ui-ux-game` |

### Engineering

| Need | Skill |
|---|---|
| Login, OAuth, sessions, roles | `betterauth-integration` |
| Queues, delayed jobs, scheduled work | `bullmq-game-queues` |
| Sound effects, music, voice | `elevenlabs-sound-music` |
| Game server, WebSocket, rooms, tick loop | `game-backend-architecture` |
| Lag, desync, jitter; prediction, reconciliation, interpolation | `game-state-sync` |
| Player events, retention, funnels | `gameplay-analytics` |
| Pairing players, lobbies, ranks | `matchmaking-system` |
| Tables, player data, inventory, Drizzle | `postgres-game-schema` |
| Leaderboards, presence, rate limits, cache-aside | `redis-game-patterns` |
| Skill trees, talent trees, unlock graphs | `skill-progression-trees` |
| Payments, purchases, subscriptions, webhooks | `stripe-game-payments` |

### Narrative

| Need | Skill |
|---|---|
| Characters, NPCs, dialogue, arcs | `character-design-narrative` |
| Check new content against existing lore and quests | `quest-narrative-coherence` |
| Branching story, acts, player agency | `story-structure-game` |
| World, factions, geography, timeline | `worldbuilding` |

### Infrastructure

| Need | Skill |
|---|---|
| Pipelines, deploys, migrations, a database per pull request | `ci-cd-game` |
| Logging, alerts, server health, tick time, error rates | `monitoring-game-ops` |

### Workflows

| Need | Skill |
|---|---|
| Start a project: interview, research, MVP plan | `/game-architect` (`game-architect`) |
| Check economy, difficulty or progression balance | `/game-balance` (`game-balance`) |
| Build one component from the plan | `/game-build` (`game-build`) |
| Add a post-MVP feature to the plan | `/game-expand` (`game-expand`) |
| Add a faction, location, NPC or event to the lore | `/game-lore` (`game-lore`) |
| Design one quest end to end | `/game-quest` (`game-quest`) |
| Audit code against the design rules | `/game-review` (`game-review`) |

Installed as the Claude Code plugin, the commands are `/game-dev:<name>`, for example `/game-dev:game-build`.

## Project files

- `docs/mvp-first-draft.md`: the MVP plan, created by `game-architect`, then extended by `game-expand`.
- `docs/build-registry.md`: components built so far, created and kept by `game-build`.
- `docs/world-lore.md`: canonical world state, created by `game-architect`, then kept by `game-lore`.
- `docs/quest-registry.md`: every quest, created by `game-architect` (or by `game-quest` when missing), then kept by `game-quest`.

## Rules

- Run all game logic on the server and treat the client as display only. A client the player controls can be edited.
- Apply `quest-narrative-coherence` before writing a quest, character or lore entry. New content then cannot contradict what exists.
- Read `postgres-game-schema` before writing database code. Queries written without the schema drift from it.
- Keep shared code free of genre-specific mechanics. Genre-specific logic in shared code breaks the next game that reuses it.

## Missing skill

If a skill in the table is not installed, run:

```bash
bunx skills add fcsouza/agent-skills --skill <name>
```

## New project

Paste `templates/game-project-claude.md` into the game repo as its `CLAUDE.md` and fill in the placeholders.
