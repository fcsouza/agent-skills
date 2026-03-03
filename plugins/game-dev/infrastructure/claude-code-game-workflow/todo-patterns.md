---
name: todo-patterns
description: TodoWrite task tracking patterns for game dev — creating and managing implementation task lists for multi-step game features.
---

# TodoWrite Patterns for Game Dev

TodoWrite creates a visible, persistent task list for the session. Without it, Claude drifts — completing 2 of 5 steps and stopping. With it, every step is tracked and the session ends only when all todos are marked complete.

## Core Pattern

Always follow this sequence:

```
1. Plan (plan-mode.md or explicit prompt)
2. Create todos from the plan — before writing any code
3. Work through todos in order
4. Mark each todo complete immediately after finishing (never batch)
5. Never close a todo with unresolved errors
```

Todos come verbatim from the plan steps. If the plan says "Add quests table with JSONB prerequisites column", the todo is exactly that.

## Example: Quest Chain Implementation

8 steps for a complete quest system with prerequisites:

```
Schema: add quests table (id, title, prerequisites JSONB, rewards JSONB, factionId)
Schema: add quest_progress table (playerId, questId, status, startedAt, completedAt)
Migration: generate and apply drizzle migration
API: GET /quests/available?playerId= with prerequisite filter
API: POST /quests/:id/start
API: POST /quests/:id/complete
BullMQ: job to check and unlock dependent quests after completion
WebSocket: quest:available event when a quest unlocks
Tests: integration tests for full quest lifecycle (start → complete → unlock)
```

Active forms (shown while in progress):
- "Creating quests schema"
- "Creating quest_progress schema"
- "Generating and applying migration"
- "Implementing GET /quests/available"
- "Implementing POST /quests/:id/start"
- "Implementing POST /quests/:id/complete"
- "Creating prerequisite-check BullMQ job"
- "Adding quest:available WebSocket event"
- "Writing quest lifecycle integration tests"

## Example: Matchmaking with Elo

7 steps for real-time matchmaking:

```
Redis: design sorted set key structure (matchmaking:queue, scored by Elo)
Schema: add player_ratings table (playerId, elo INT default 1000, gamesPlayed INT)
Migration: generate and apply drizzle migration
API: POST /matchmaking/join — add player to Redis queue, return queuePosition
BullMQ: matching job — poll queue every 5s, match within ±150 Elo, expand ±50 every 30s
WebSocket: matched event with lobbyId to both players; dequeue both on match
API + job: POST /matches/:id/complete — update Elo for both players (K factor: 32 if <30 games, 16 after)
Tests: integration test full flow (join → match → complete → Elo update)
```

## Example: Multi-Currency Economy

6 steps for soft + hard currency:

```
Schema: update player_wallets (add crystals INT default 0, add gems_earned_today INT, add last_earn_reset TIMESTAMP)
Migration: generate and apply drizzle migration
Middleware: daily earn cap enforcement (reset gems_earned_today at midnight via BullMQ cron)
API: POST /wallet/convert — crystals to gems at 1:10 ratio, validate crystals balance
Stripe: webhook handler for checkout.session.completed — credit crystals to player wallet
Tests: unit test earn cap enforcement; integration test crystal purchase → webhook → wallet credit
```

## Example: Adding Sound to a Game Event

4 steps for ElevenLabs sound integration on quest completion:

```
API: create sound generation job in BullMQ when quest completes (pass quest title + reward text)
BullMQ: job to call ElevenLabs API with quest completion narration text
Storage: save generated audio to CDN (Fly.io volume or S3), store URL in quest_completions table
WebSocket: quest:completed event now includes audioUrl field for client to play
```

## Anti-Patterns

| Anti-pattern | Correct pattern |
|---|---|
| Creating todos after starting the first task | Create ALL todos before writing any code |
| Marking multiple todos complete at once ("done schema and migration") | Mark each one immediately as it finishes |
| One giant todo ("implement quest system") | Break into atomic steps, each completable in <30 min |
| Keeping a failed todo open and moving on | Surface the failure, fix it, then mark complete |
| Skipping todos for "obvious" steps | If it's a step, it gets a todo — no exceptions |
| Reordering todos mid-task without reason | Follow the dependency order from the plan |

## When Session Compacts

If the session compacts (context limit), the todo list is lost. To recover:

1. Check `MEMORY.md` for the active feature being worked on
2. Read the relevant plan (from plan mode output or `docs/plans/`)
3. Check git status and recent commits to see what's already done
4. Recreate todos for remaining steps only

This is why CLAUDE.md's "When Compacting" section matters — it tells Claude to preserve the current feature being built.

## Cross-References

- `plan-mode.md` — todos come verbatim from approved plans
- `settings-full.md` — TodoWrite and TodoRead are in the allow list (never blocked)
- `templates/game-project-claude.md` — "When Compacting" section covers todo recovery
