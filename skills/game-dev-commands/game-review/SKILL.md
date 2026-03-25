---
name: game-review
description: Audits existing game code against design principles — checks server-authority, schema conventions, auth security, payment safety, narrative coherence, and MVP scope drift. Extract the optional component name or path from the user's message (defaults to entire src/). Use after building components or before committing.
---

# Game Review — Code Auditor

## Prerequisites

- Apply relevant engineering and design skills based on the detected code domains (see Phase 0)

---

## Phase 0 — Context Load (silent)

1. READ `docs/mvp-first-draft.md` if it exists (provides architectural intent for comparison)
2. READ `docs/build-registry.md` if it exists (tracks what's built vs mocked)
3. Determine scope from the user's message:
   - If a component name or path was provided: focus on `src/[component]/` or the specified path
   - If nothing provided: review all of `src/`
4. Scan the target scope to identify which technology domains are present (auth, payments, WebSocket, Redis, BullMQ, quests, etc.)
5. Apply only the skills relevant to the detected domains:
   - Auth detected → Apply the `betterauth-integration` skill
   - Payments/Stripe detected → Apply the `stripe-game-payments` skill
   - WebSocket/game state detected → Apply the `game-state-sync` skill
   - Redis detected → Apply the `redis-game-patterns` skill
   - BullMQ detected → Apply the `bullmq-game-queues` skill
   - Quest/narrative code detected → Apply the `quest-narrative-coherence` skill
   - Database/Drizzle detected → Apply the `postgres-game-schema` skill
   - Matchmaking detected → Apply the `matchmaking-system` skill
   - Analytics detected → Apply the `gameplay-analytics` skill

## Phase 1 — Engineering Review

Read all TypeScript files in the target scope. Apply these checks. For every finding, record: severity, file path, line number (approximate), description, fix suggestion, and the skill it violates.

### State Authority (multiplayer/WebSocket code)
- 🔴 CRITICAL: Any WebSocket handler that trusts `message.userId` or `message.playerId` from the client — must derive identity from server session
- 🔴 CRITICAL: Any game state mutation triggered directly by client message without server validation
- 🟡 WARNING: Game loop tick rate over 60Hz without justification

### Database / Schema
- 🔴 CRITICAL: Raw SQL template literals (`sql\`SELECT...\``) outside of Drizzle's `sql` tagged helper — must use Drizzle typed query builder
- 🟡 WARNING: Missing `deletedAt` soft-delete column on player-facing tables (players, inventory, characters)
- 🟡 WARNING: Hardcoded column names for game-specific attributes that should be in JSONB (e.g., `manaPoints`, `fireResistance` as top-level columns)
- 🟢 SUGGESTION: Indexes missing on `(playerId, type)` composite for event/log tables

### Auth & Sessions
- 🔴 CRITICAL: Any endpoint reading `req.body.userId` or `req.query.userId` to identify the actor — must use `auth.api.getSession()` and derive from session
- 🔴 CRITICAL: JWT verification without checking expiry
- 🟡 WARNING: No rate limiting on `/auth/login` or `/auth/signup` routes
- 🟡 WARNING: Admin/moderator role stored in a cookie or JWT claim (must be fetched from DB on each request)

### Payments (Stripe)
- 🔴 CRITICAL: Any purchase fulfillment triggered on checkout success redirect (GET `/success`) — must be webhook-driven
- 🔴 CRITICAL: Webhook handler that doesn't call `stripe.webhooks.constructEvent()` to verify the signature
- 🔴 CRITICAL: Stripe secret key referenced in client-side code (any file in `public/`, `client/`, `frontend/`)
- 🟡 WARNING: Missing idempotency check for `checkout.session.completed` events — could double-grant rewards on webhook replay

### Job Queues (BullMQ)
- 🟡 WARNING: BullMQ processor with no `attempts` config — all jobs should have retry policy
- 🟡 WARNING: BullMQ processor with no `backoff` config — should use exponential backoff
- 🟢 SUGGESTION: Consider adding `removeOnComplete` and `removeOnFail` options to prevent queue bloat

### Redis
- 🟡 WARNING: Redis keys that don't follow `{entity}:{id}:{field}` naming convention
- 🟡 WARNING: Session keys stored in Redis without `EXPIRE` — ephemeral state must have TTL
- 🟢 SUGGESTION: Leaderboard sorted sets should use `ZADD NX` or `GT` to only update when score improves

### General Security
- 🔴 CRITICAL: Any `.env` values or secrets hardcoded in source files
- 🔴 CRITICAL: `eval()` or `Function()` constructor called with user input
- 🟡 WARNING: Missing input validation on API endpoints that accept user-controlled data

## Phase 2 — Narrative Coherence Check

If `docs/world-lore.md` and `docs/quest-registry.md` both don't exist, output:
`📋 Narrative coherence check: skipped (docs/quest-registry.md not found — run the game-quest skill to create it)`
Then skip to Phase 3.

If either file exists:
1. Read `docs/world-lore.md` and `docs/quest-registry.md`
2. Scan source files for quest IDs, character names, faction names, location names
3. Check: do any hardcoded quest/character/faction/location strings in code contradict what's registered in the world lore?
4. Flag: `⚠️ LORE CONFLICT: Character "Mira" referenced in src/quests/main.ts but not registered in quest-registry.md`

## Phase 3 — MVP Scope Drift Check

If `docs/mvp-first-draft.md` doesn't exist, output:
`📋 Scope audit: skipped (docs/mvp-first-draft.md not found — run the game-architect skill first)`
Then skip to Phase 4.

1. Read Section 10 (Out of Scope) from `docs/mvp-first-draft.md`
2. Scan `src/` for implementations of explicitly deferred features
3. Flag: `⚠️ SCOPE DRIFT: [feature] found in [file] but listed as out-of-scope in MVP plan Section 10`

Also check `docs/build-registry.md` for components marked "built" that don't appear in the MVP build sequence (Section 9) — these may be gold-plating.

## Phase 4 — Report Output

Output a structured review report:

```
# Game Review Report
Scope: [path reviewed]
Generated: [timestamp]

## Summary
🔴 Critical: X | 🟡 Warning: Y | 🟢 Suggestion: Z
```

Then list all findings grouped by category (Engineering, Narrative, Scope). For each finding:
```
### [🔴/🟡/🟢] [Title]
**File:** `src/path/to/file.ts` (line ~42)
**Issue:** [what's wrong]
**Fix:** [concrete fix description]
**Skill ref:** [→ stripe-game-payments: webhook-first fulfillment]
```

End with:
```
## Next Steps
- Fix all 🔴 CRITICAL issues before committing
- Review the [top-violation-category] skill for correct patterns
- Run the game-build skill to rebuild any component with critical violations
```

If no issues found in a category, output:
```
### ✅ [Category] — No issues found
```

---

## Hard Constraints

1. **Never modify code** — this is a read-only audit command. Output findings only.
2. **Never report false positives** — if a pattern looks like a violation but context makes it acceptable, skip it or downgrade to 🟢
3. **Always link to a skill** — every finding must reference the skill that defines the correct pattern
4. **Be specific** — include file path and approximate line number for every finding
5. **Prioritize signal** — 5 real critical issues is more useful than 30 noise suggestions
