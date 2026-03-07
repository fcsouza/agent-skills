---
name: plan-mode
description: When and how to use Claude Code plan mode for game development — blocking all tool calls until you approve a written implementation plan.
---

# Plan Mode for Game Dev

Plan mode forces Claude to write a complete implementation plan and wait for your approval before executing any tool calls. For game dev, this prevents costly mistakes on irreversible operations like schema migrations and economy changes.

## What Plan Mode Does

Claude produces a written plan in a file, then presents it to you. All file writes, edits, and Bash commands are blocked until you approve. You can revise the plan or reject it before anything is changed.

## When to Enter Plan Mode

**Enter plan mode when:**
- Adding a new DB schema (irreversible without a new migration)
- Implementing a new game system that touches 5+ files
- Any multiplayer or real-time networking change
- Economy redesign (earn rates, currency caps, conversion ratios)
- Changing a shared abstraction (session model, player state structure)
- Implementing a feature for the first time on this stack
- Any change where getting it wrong mid-way would break other systems

**Skip plan mode when:**
- Fixing a typo or single-line bug
- Adding a single GET endpoint that reads from an existing table
- Updating `CLAUDE.md`, `MEMORY.md`, or design docs
- Running Biome, type checks, or migrations that were already planned
- The scope is 1-2 files you've already discussed

## How to Enter Plan Mode

**Method A: Keyboard shortcut**
Press `Shift+Tab` twice at the Claude Code prompt to toggle plan mode.

**Method B: Prompt prefix**
Start your prompt with "Plan only, do not implement yet:" — Claude will produce the plan without executing anything.

**Method C: From Claude Code settings**
Set `"mode": "plan"` in `.claude/settings.json` to default all sessions to plan mode.

## Example Plan Prompts for Game Features

### Quest system with prerequisites

```
Plan only, do not implement yet:

Add a quest system where quests have prerequisite quests that must be completed first.
Include:
- DB schema: quests table (id, title, description, prerequisites JSONB array of quest IDs, rewards JSONB)
- DB schema: quest_progress table (playerId, questId, status, completedAt)
- API: GET /quests/available?playerId= — returns quests where all prerequisites are completed
- API: POST /quests/:id/start — marks quest as in_progress
- API: POST /quests/:id/complete — marks complete, triggers prerequisite check for dependent quests
- WebSocket: quest:available event when a quest becomes available after prerequisite completion
- BullMQ: job that checks quest prerequisites after each quest_complete event
```

### Real-time matchmaking with Elo

```
Plan only, do not implement yet:

Implement real-time matchmaking with Elo rating.
- Players join a queue via WebSocket (POST /matchmaking/join)
- Redis sorted set stores queue, scored by Elo rating
- BullMQ job runs every 5s: match players within ±150 Elo
- Unmatched players after 30s expand search range by ±50 (up to ±400 max)
- Matched players receive a WebSocket matched event with lobby ID
- On match completion, Elo ratings update (K=32 for <30 games, K=16 after)
- Schema: player_ratings (playerId, elo, gamesPlayed), matches (id, player1Id, player2Id, winnerId, eloChange)
```

### Multi-currency economy

```
Plan only, do not implement yet:

Redesign economy with two currencies:
- Soft currency: gems (earned in-game, daily cap of 500)
- Hard currency: crystals (purchased via Stripe)
- Conversion: crystals → gems at 1:10 ratio (one-way only)
- Include: schema changes to player_wallets, earn-rate enforcement middleware,
  GET /wallet endpoint, POST /wallet/convert, Stripe webhook handler for crystal purchase
- Economy math: document earn rate assumptions for D1/D7/D30 players
```

### Faction reputation system

```
Plan only, do not implement yet:

Add faction reputation system with 3 factions.
- Players earn/lose reputation per faction through quests and actions
- Unlock thresholds: Friendly (1000), Honored (5000), Exalted (15000)
- Effects: faction shop price discounts, quest availability gating
- Schema: faction_reputations (playerId, factionId, points, tier)
- API: POST /reputation/update (called internally after quest completion)
- API: GET /reputation?playerId= (returns all faction standings)
- Hook into quest completion: award reputation based on quest faction_rewards JSONB field
- Price modifier: multiply shop prices by faction discount factor
```

## What to Check Before Approving a Plan

Read the plan and ask:

1. **Schema awareness**: if it touches the DB, does it reference `postgres-game-schema/SKILL.md`?
2. **Narrative coherence**: if it touches quests/NPCs, does it run the coherence check first?
3. **Scope**: is this achievable in one session? If the plan has 15+ steps, split it.
4. **Dependencies**: does the plan respect the skill dependency order? (schema before logic, schema before WebSocket events)
5. **Reversibility**: are migration steps included before any code that depends on the new schema?
6. **Tests**: does the plan include integration tests for the feature?

If any of these are missing, reject the plan and add the requirement to your prompt.

## Integration with Other Skills

Full workflow for a new game system:

```
1. /brainstorming   — explore the design space, define requirements
2. Plan mode        — Claude writes the implementation plan
3. Approve plan     — review against the checklist above
4. todo-patterns.md — create todos from the plan steps before coding starts
5. Execute          — Claude implements, marking todos complete as it goes
```

## Cross-References

- `todo-patterns.md` — creating TodoWrite task lists from approved plans
- `worktrees.md` — isolate large planned features in their own worktree
- `custom-agents.md` — plan mode works with custom agents; each agent can be run in plan mode independently
