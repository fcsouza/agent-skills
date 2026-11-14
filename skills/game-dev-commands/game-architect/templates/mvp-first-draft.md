# [Game Title / Working Title]

> MVP First Draft Plan, written by `/game-architect`
> Genre: [genre] | Platform: [platform] | Timeline: [timeline] | Multiplayer: [mode]

---

## 1. Concept Summary

- **One-Sentence Pitch**: [from interview]
- **Core Loop**: [Action] -> [Feedback] -> [Reward] -> [Decision] (diagram the cycle)
- **Player Fantasy**: [the feeling/power the player experiences]
- **Emotional Target**: [what the player should feel — tension, wonder, mastery, etc.]
- **Reference Games**:
  - [Game 1]: [what to learn from it — from research]
  - [Game 2]: [what to learn from it]
  - [Game 3]: [what to avoid from it]

---

## 2. Core Mechanic Definition

- **Primary Verb(s)**: [what the player does]
- **30-Second Loop**: [one cycle of the core mechanic, described concretely]
- **Session Loop** (5-30 min): [what constitutes a "session" — a run, a level, a match, a quest]
- **Feedback Loop**: Action -> Consequence -> Learning -> Improved Action
- **Difficulty Curve**: [linear or stepped; selectable difficulty levels first] [-> game-design-fundamentals] [-> level-design]
- **MVP Mechanic Scope**: [exactly what mechanics are IN for v0.1]
- **Deferred Mechanics**: [what will be added post-MVP]

---

## 3. World & Narrative Seed

> Include this section if narrative importance is 2 or more. Skip it if 1.

- **Setting**: [from interview]
- **Tone**: [from interview]
- **Core Themes**: [2-3 themes that drive the world]
- **World Rules**: [what is possible and impossible — magic system, tech level, physics]
- **Lore Seed**: [2-3 sentences of foundational world truth]
- **Key Locations (MVP)**: [3-5 locations with one-line descriptions]
- **Key Characters (MVP)**: [3-5 characters with role and motivation — if applicable]
- **Lore Delivery Method**: [environmental / dialogue / codex / items / none] [-> worldbuilding]

---

## 4. Technical Architecture

### Selected Skills for This Game

| Skill | Why Needed | Priority |
|-------|-----------|----------|
| [skill-name] | [specific reason for THIS game] | Must-have |
| [skill-name] | [specific reason for THIS game] | Must-have |
| [skill-name] | [specific reason for THIS game] | Nice-to-have |

### Stack Decisions

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Bun | Standard |
| Language | TypeScript (strict) | Standard |
| Backend | Elysia | [+ WebSocket if real-time] |
| ORM | Drizzle | Standard |
| Database | PostgreSQL (Neon) | [list key tables needed] |
| Cache | Redis | [needed? what for?] |
| Jobs | BullMQ | [needed? what queues?] |
| Auth | BetterAuth | [providers needed] |
| Payments | Stripe | [product types needed] |
| Audio | ElevenLabs / Lyria | [what audio needed] |
| Deploy | Fly.io | Standard |
| Lint | ultracite (wraps Biome) | Standard |

> Remove rows for technologies not needed by this game.

### State Authority
- [Server-authoritative / Client-only / Hybrid]
- [Justification based on multiplayer mode and real-time requirements]

### Database Schema (MVP)
[List only the tables needed for THIS game's MVP — derived from postgres-game-schema patterns]

| Table | Purpose | Key JSONB Fields |
|-------|---------|-----------------|
| players | Player accounts and stats | [game-specific stats] |
| ... | ... | ... |

---

## 5. Quest/Mission MVP

> Include only if game has quests/missions. Skip otherwise.

- **MVP Quest Count**: [number]
- **Quest Types Used**: [from quest-mission-design taxonomy]
- **First Quest** (fully specced):
  - Name: [quest name]
  - Type: [main/side/discovery/etc.]
  - Objective: [what the player must do]
  - Reward: [what they get]
  - Lore tie-in: [how it connects to world]
  - Completion paths: [at least 2 ways to complete, if significant quest]
- **Quest Arc for MVP**: [brief narrative arc across all MVP quests]
- Coherence check: [checked with the `quest-narrative-coherence` skill]

---

## 6. Economy MVP

> Include only if game has economy/currency. Skip otherwise.

- **Currencies**:
  - Soft: [name] — earned by [method], spent on [items]
  - Hard: [name] — earned by [method or purchased], spent on [items]
- **Primary Faucets**: [how player earns — list sources]
- **Primary Sinks**: [how player spends — list destinations]
- **Growth Model**: [linear income / exponential costs — or other]
- **Session Earn Target**: [how much soft currency per session]
- **Monetization Touch Points**: [where real money enters, if commercial]
- **Anti-Inflation**: [mechanisms to prevent currency devaluation]
  [-> game-economy-design]

---

## 7. UI/UX MVP

- **Core Screens**:
  | Screen | Purpose | Priority |
  |--------|---------|----------|
  | [screen] | [purpose] | Must-have |
  | ... | ... | ... |
- **HUD Elements**: [what's always visible during gameplay]
- **Onboarding Flow**: [how the first 60 seconds teach the game]
  [-> ui-ux-game]
- **Accessibility Baseline**:
  - [ ] Colorblind-safe palette
  - [ ] Scalable text
  - [ ] Remappable controls (if applicable)
  - [ ] Screen reader support for menus (if text-heavy)
  [-> ui-ux-game]

---

## 8. File & Folder Structure

[Generate the actual recommended structure for THIS game]

```
project-root/
├── src/
│   ├── routes/              # Elysia API routes
│   ├── db/
│   │   ├── schema/          # Drizzle table definitions
│   │   └── migrations/      # Generated migrations
│   ├── game/                # Core game logic (server-side)
│   │   ├── [domain]/        # Genre-specific modules
│   │   └── engine/          # Shared engine code
│   ├── jobs/                # BullMQ workers (if needed)
│   ├── lib/                 # Shared utilities
│   └── tests/
├── docs/
│   ├── mvp-first-draft.md   # This document
│   ├── world-lore.md        # World state (if narrative)
│   └── quest-registry.md    # Quest tracking (if quests)
├── CLAUDE.md                # Project config for Claude Code
├── drizzle.config.ts
├── tsconfig.json
└── package.json
```

> Adjust structure based on actual needs — remove unused directories.

---

## 9. MVP Build Sequence

Ordered by dependency. Each task references the skill to read before implementing.

| # | Task | Skill Reference | Depends On | Size |
|---|------|----------------|------------|------|
| 1 | Project scaffold + CLAUDE.md | game-dev | — | S |
| 2 | Database schema + migrations | postgres-game-schema | #1 | M |
| 3 | [next task based on THIS game] | [skill] | [deps] | S/M/L |
| ... | | | | |

> Size: S, M or L, relative to the other tasks in this table.

---

## 10. Out of Scope for MVP

Features explicitly excluded from the MVP. Prevents scope creep.

| Feature | Reason Deferred | When to Add |
|---------|----------------|-------------|
| [feature] | [why not now] | [post-MVP milestone] |
| ... | ... | ... |

---

## 11. Open Questions

Decisions that need resolution before or during implementation:

1. [Question about ambiguous requirement]
2. [Question about technical choice]
3. [Question about content scope]

---

## 12. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| [risk description] | [what goes wrong] | [how to prevent/reduce] |
| ... | ... | ... |
