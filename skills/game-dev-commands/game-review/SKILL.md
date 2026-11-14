---
name: game-review
description: Audits game code read-only against the engineering skills' rules (server authority, schema, auth, payments, queues, Redis), lore consistency and MVP scope, and writes a severity-ranked report. Takes an optional component name or path in `$ARGUMENTS` (falls back to the user's message, then all of `src/`). Use after building a component or before committing game code.
argument-hint: Optional component name or path to review (defaults to entire src/)
---

# Game Review

## Requires

- `betterauth-integration`
- `stripe-game-payments`
- `game-state-sync`
- `redis-game-patterns`
- `bullmq-game-queues`
- `quest-narrative-coherence`
- `postgres-game-schema`
- `matchmaking-system`
- `gameplay-analytics`

Before you apply a skill listed here, check that it appears in your available skills list. If it is not, name it, give this install line, and stop: `bunx skills add fcsouza/agent-skills --skill <name>`.

Phase 0 picks which of these apply to the code under review.

## Prerequisites

- `docs/mvp-first-draft.md` and `docs/build-registry.md` improve the scope check. Without them the command skips that check and says so.
- `docs/world-lore.md` enables the lore check. Without it the command skips that check and says so.

This command only reads. It writes the report to the chat and changes no file.

## Phase 0: scope and context

Input: `$ARGUMENTS`. If it is empty, take it from the user's message. It holds an optional component name or path.

1. Read `docs/mvp-first-draft.md` and `docs/build-registry.md` if they exist.
2. Set the scope: the named path or `src/<component>/`, else all of `src/`.
3. Scan the scope for the domains it contains, then apply only the matching skill:
   - Auth: the `betterauth-integration` skill
   - Stripe or payments: the `stripe-game-payments` skill
   - WebSocket or game state: the `game-state-sync` skill
   - Redis: the `redis-game-patterns` skill
   - BullMQ: the `bullmq-game-queues` skill
   - Quest or narrative code: the `quest-narrative-coherence` skill
   - Drizzle or SQL: the `postgres-game-schema` skill
   - Matchmaking: the `matchmaking-system` skill
   - Analytics events: the `gameplay-analytics` skill

## Phase 1: engineering review

Read every TypeScript file in scope. Each applied skill has a Pitfalls section (and some a Checklist). Flag code that matches a listed pitfall or breaks a numbered decision in the skill. The skill owns the rule, so do not invent a rule it does not state.

For every finding record: severity, file, approximate line, what is wrong, the fix, and the skill and section it comes from.

Severity:

- Critical: a player can cheat, take another player's identity, get currency or items without paying, or expose a secret.
- Warning: the code breaks a skill rule, but no exploit follows from it by itself.
- Suggestion: a skill's recommended pattern is missing.

Always check, in any scope. These three are this command's own baseline; no skill states them:

- A secret or `.env` value in source, or a Stripe secret key in code the client receives. Critical: anyone can read it.
- `eval()` or `new Function()` on user input. Critical: it runs attacker code.
- User-controlled data accepted by an endpoint without validation. Warning.

Where the domain is present, check these first (each skill gives the detail):

- Identity comes from the server session, never from a body, query or message field (`betterauth-integration`, `game-state-sync`). Critical.
- Game state changes only after the server validates the action (`game-state-sync`). Critical.
- Purchases are granted only from verified webhooks, with an idempotency check (`stripe-game-payments`). Critical.
- Schema follows the table conventions: soft delete, JSONB for per-genre extras, owner-key indexes (`postgres-game-schema`). Warning.
- Redis keys expire when the state is ephemeral (`redis-game-patterns`). Warning.
- Queue processors are idempotent and set their retry policy as the skill describes (`bullmq-game-queues`). Warning.

## Phase 2: narrative coherence

If `docs/world-lore.md` is missing, print `Narrative check skipped: docs/world-lore.md not found (run /game-architect)` and go to Phase 3. If `docs/quest-registry.md` is missing, run the check against the lore file only and say so.

1. Read both files.
2. Collect quest IDs, character, faction and location names from the source.
3. Compare each against the lore and the registry using steps 3 and 4 of `quest-narrative-coherence`. Report each failure.
4. Format each finding as `Lore conflict: character "Mira" is used in src/quests/main.ts but is not in docs/quest-registry.md`.

## Phase 3: MVP scope drift

If `docs/mvp-first-draft.md` is missing, print `Scope check skipped: docs/mvp-first-draft.md not found (run /game-architect)` and go to Phase 4.

1. Read Section 10 (Out of Scope).
2. Search `src/` for each deferred feature.
3. Report `Scope drift: <feature> in <file> is out of scope in MVP plan Section 10`.
4. In `docs/build-registry.md`, find components marked built that are not in the Section 9 build sequence. Report them as possible extra work.

## Phase 4: report

Use this shape:

```
# Game Review Report
Scope: <path>
Generated: <timestamp>

## Summary
Critical: X | Warning: Y | Suggestion: Z
```

List findings by category (Engineering, Narrative, Scope), each as:

```
### [Critical|Warning|Suggestion] <title>
File: src/path/to/file.ts (line ~42)
Issue: <what is wrong>
Fix: <concrete change>
Skill: <skill name and the section it comes from, or "baseline" for an always-check item>
```

If a category has no findings, write `<Category>: no issues found`.

End with:

```
## Next Steps
- Fix every Critical finding before committing.
- Read the <most-violated skill> skill for the correct pattern.
- Rebuild a component with Critical findings: `/game-build <component> --rebuild`.
```

## Rules

1. Never change code. This is an audit, and a fix made during review hides what the review found.
2. Skip a pattern that looks wrong but is fine in context. A false positive costs the reader's trust in the report.
3. Every finding names the skill and section that defines the correct pattern, except the three baseline items, which say "baseline".
4. Every finding names a file and an approximate line.
5. Report few real findings, not many doubtful ones.
