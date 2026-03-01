---
name: game-dev-hub
version: 1.0.0
description: >-
  Use when the user asks about browser game development — idle/incremental games,
  text-based MMOs, tactical RPGs, game architecture, game loops, prestige systems,
  big numbers, combat, progression, economy, multiplayer, AI asset generation,
  or game music generation. Routes to specialized sub-skills.
---

# Game Dev Hub

Browser games are systems of interlocking loops — resource generation feeds
into upgrades, upgrades unlock new mechanics, mechanics create choices, and
choices drive engagement. Whether it's an idle clicker, a text-based MMO, or
a tactical RPG, the underlying architecture shares common patterns: state
management, tick systems, progression curves, and persistence.

This skill is the **orchestrator**. It helps you pick the right stack, scaffold
your project, and routes you to specialized sub-skills for specific game
systems. Think of it as the game design equivalent of a monorepo root — it
coordinates, delegates, and provides shared context.

---

## Recommended Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Language | TypeScript | Type safety across client + server + engine |
| UI Framework | React + Next.js (App Router) | SSR for landing/SEO, client-side game rendering |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI, accessible components, dark mode |
| Game State | Zustand | Lightweight, subscribe-based, middleware-friendly |
| Database | Drizzle ORM + Neon | Type-safe queries, serverless Postgres, branching |
| API | Elysia | Fast Bun-native API, WebSocket support, validation |
| Auth | Better Auth | Session management, OAuth, role-based access |
| Real-time | WebSockets (Elysia) | Live updates, multiplayer, chat |

**Why this stack works for browser games:**

- **Type safety end-to-end**: Game logic in `packages/game-engine/` is shared
  between client (prediction) and server (authority) with zero type drift.
- **SSR where it matters**: Landing pages, leaderboards, and profiles are
  server-rendered for SEO. The game client itself runs client-side.
- **Zustand for game state**: Simpler than Redux, supports middleware (persist,
  immer, devtools), and plays well with React concurrent features.
- **Elysia for real-time**: WebSocket-first with type-safe routes. Handles
  game ticks, multiplayer sync, and chat in one server.
- **Neon for persistence**: Serverless Postgres scales to zero, branches for
  dev/staging, and Drizzle gives you type-safe migrations.

---

## Skill Router

When the user's request matches a specific game system, route to the
appropriate sub-skill:

| Task | Sub-Skill | Trigger Keywords |
|------|-----------|-----------------|
| Idle/incremental mechanics | `idle-game-design` | idle, clicker, incremental, prestige, rebirth, ascension, big numbers, offline progress, generators, upgrades, automation |
| RPG stats, combat, items | `rpg-systems` | stats, combat, damage, HP, mana, inventory, equipment, skills, abilities, classes, leveling, loot, crafting, quests |
| Multiplayer, factions, PvP | `browser-mmo-design` | MMO, multiplayer, factions, guilds, PvP, chat, leaderboard, energy, timers, world map, territory, alliances |
| Game loops, state, engine | `game-architecture` | game loop, tick, ECS, state machine, save/load, serialization, performance, WebSocket, sync, engine |
| Generate art/sprites/icons | `game-asset-gen` | sprites, icons, art, pixel art, tilemap, character art, UI assets, generate images, AI art, Gemini |
| Generate music/audio | `game-music-gen` | music, soundtrack, SFX, sound effects, audio, BGM, ambient, battle music, Lyria, generate music |

If the request spans multiple areas, invoke multiple sub-skills in sequence.
Start with design (idle-game-design, rpg-systems, browser-mmo-design), then
architecture (game-architecture), then assets (game-asset-gen, game-music-gen).

---

## Project Scaffold Overview

Browser game monorepo using Turborepo:

```
my-game/
├── apps/
│   ├── game/          # Next.js — game client + landing pages
│   └── api/           # Elysia — API server + WebSocket
├── packages/
│   ├── game-engine/   # Core logic — systems, tick, formulas
│   └── shared/        # Types, constants, validation (Zod)
├── turbo.json
├── package.json
├── drizzle.config.ts
├── docker-compose.yml
└── .env.example
```

- **apps/game/**: Pages for `/` (landing), `/play` (game client),
  `/leaderboard`, `/profile`. Uses Zustand for client state.
- **apps/api/**: Elysia routes for `/api/game` (actions, state),
  `/api/auth` (sessions, OAuth), `/api/social` (chat, guilds).
- **packages/game-engine/**: Pure TypeScript — no React, no DOM. Runs on
  both client (prediction) and server (authority).
- **packages/shared/**: Zod schemas, shared types, constants, enums.

For the full scaffold with code examples, read `references/project-scaffold.md`.

---

## Cross-Skill Workflows

### 1. Building an Idle Game

```
idle-game-design    → Define generators, upgrades, prestige layers, offline calc
  ↓
game-architecture   → Implement tick system, state management, save/load
  ↓
game-asset-gen      → Generate resource icons, upgrade art, background tiles
```

**Example prompt chain:**
1. "Design a cookie-clicker-style idle game with 3 prestige layers"
2. "Build the game loop and state management for this design"
3. "Generate pixel art icons for each resource type"

### 2. Building a Text-Based MMO

```
browser-mmo-design  → Define factions, PvP rules, energy system, world map
  ↓
rpg-systems         → Design combat formulas, stats, equipment, progression
  ↓
game-architecture   → Build multiplayer sync, WebSocket API, server authority
```

**Example prompt chain:**
1. "Design a faction-based text MMO with territory control"
2. "Create the combat system with stats, equipment, and abilities"
3. "Architect the real-time multiplayer sync layer"

### 3. Full Game with AI Assets

```
game-dev-hub        → Pick stack, scaffold project
  ↓
idle-game-design    → or rpg-systems → or browser-mmo-design
  ↓
game-architecture   → Engine, loops, state
  ↓
game-asset-gen      → Sprites, icons, UI art (Gemini)
  ↓
game-music-gen      → Soundtrack, SFX, ambient (Lyria)
```

---

## Design Principles

- **Server-authoritative for multiplayer**: Never trust the client. All game
  state mutations go through the server. Client does optimistic prediction.
- **Offline-first for idle games**: Calculate offline progress on reconnect.
  Store last-seen timestamp, compute accumulated resources server-side.
- **Progressive disclosure**: Don't show all mechanics at once. Unlock systems
  as the player progresses. Tutorial → core loop → meta systems → endgame.
- **Mobile-responsive always**: Browser games must work on phones. Touch
  targets ≥ 44px, no hover-dependent UI, responsive layouts.
- **Deterministic game logic**: Same inputs → same outputs. Keep game engine
  pure (no side effects). This enables replay, testing, and server validation.
- **Efficient updates**: Only send deltas over WebSocket. Batch state updates.
  Use requestAnimationFrame for rendering, fixed timestep for logic.

---

## When to Read Reference Files

| If you need… | Read |
|--------------|------|
| Full monorepo scaffold, turbo.json, Drizzle schema, Docker setup | `references/project-scaffold.md` |
| Player psychology, retention loops, monetization, pacing, flow | `references/player-psychology.md` |
| Idle game formulas, prestige math, big numbers, offline calc | `idle-game-design` skill |
| Combat formulas, stat systems, loot tables, economy balance | `rpg-systems` skill |
| Multiplayer architecture, faction systems, PvP, energy timers | `browser-mmo-design` skill |
| Game loops, ECS, state machines, save/load, performance | `game-architecture` skill |
| AI art generation with Gemini, sprite sheets, tilesets | `game-asset-gen` skill |
| AI music generation with Vertex AI Lyria, adaptive audio | `game-music-gen` skill |
