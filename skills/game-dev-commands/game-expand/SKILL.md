---
name: game-expand
description: Adds a new feature to an existing MVP plan — scoped architect interview, scope validation against original plan, and integration into the build sequence. Extract the feature name or description from the user's message. Requires docs/mvp-first-draft.md — run game-architect first.
---

# Game Expand — Feature Expansion

## Prerequisites

- Requires `docs/mvp-first-draft.md` in the project (run `game-architect` first)

---

## Phase 0 — Context Load (silent, mandatory)

Execute in this exact order:

1. READ `docs/mvp-first-draft.md`
   - If it does NOT exist: output `⛔ Cannot proceed. docs/mvp-first-draft.md not found. Run the game-architect skill first to create your MVP plan before expanding it.` and stop.
2. READ `docs/build-registry.md` if it exists — note which components are built vs mocked vs remaining
3. Calculate MVP completion % from build-registry:
   - If build-registry doesn't exist: "MVP completion: 0% (build registry not yet created)"
   - If it exists: "MVP completion: [built]/[total] components ([%])"

## Phase 1 — Scope Validation (before asking any questions)

This phase runs before the interview to check if the requested feature conflicts with the existing plan.

**Check 1: Out-of-Scope / Deferred features (Section 10 of mvp-first-draft.md)**

Search `docs/mvp-first-draft.md` Section 10 for anything matching the feature name from the user's message:
- If found: output `⚠️ "[feature]" was explicitly deferred in your MVP plan (Section 10). Original reason: "[quote from plan]". Adding it now will increase scope beyond the original MVP. MVP completion is currently [%]. Proceed with expansion? (confirm to continue)`
  - Wait for user confirmation before proceeding
- If not found: continue silently

**Check 2: Already-planned features**

Search `docs/mvp-first-draft.md` Section 9 (Build Sequence) for the feature name:
- If it matches a component already IN the MVP plan and in build-registry as "built": output `⚠️ [feature] is already built (see docs/build-registry.md). Did you mean to refactor it? Use the game-review skill to audit the existing implementation.` and stop.
- If it matches a component already in the plan but NOT built yet: output `⚠️ [feature] is already in your MVP plan (Section 9) and not yet built. Use the game-build skill to implement it instead of re-planning.` and stop.

**Check 3: MVP completion warning**

If MVP completion < 50% and the deferred check did NOT trigger a warning:
Output: `📊 Note: Your MVP is [%] complete. Consider finishing the core MVP before expanding. This is informational — type your confirmation to proceed.`
Wait for user confirmation.

## Phase 2 — Scoped Feature Interview (maximum 3 questions)

Unlike `game-architect` which runs a full game interview, this skill asks ONLY what's needed to spec this specific feature.

Do NOT re-ask anything already answered in `docs/mvp-first-draft.md` (genre, tech stack, multiplayer type, core loop, etc.).

Ask exactly these questions (skip any that can be answered from the existing plan):

**Question 1 (required — ask this first):**
"How does **[feature]** connect to your existing core loop? (e.g. 'it extends the economy system', 'it's a new player retention mechanic', 'it adds a new player vs player mode')"

**Question 2 (required):**
"Which existing systems from your MVP does this feature depend on? (e.g. auth, matchmaking, quest system, economy)"

**Question 3 (optional — only ask if feature scope is genuinely ambiguous):**
One targeted clarification question specific to the feature. Examples:
- For "clan system": "Should clans have their own economy (shared currency, clan bank) or only social features?"
- For "seasonal events": "Are seasonal events time-gated server-side or just cosmetic resets?"
- For "crafting": "Does crafting consume items from the player inventory, or create new item types not in the MVP?"

Never ask about naming conventions, code style, or anything the skill files already define.

## Phase 3 — Feature Spec

Based on the existing MVP plan and the answers from Phase 2, produce a focused feature spec:

```markdown
## Feature: [name]

**Core loop integration:** [how it feeds into the existing loop from the MVP plan]
**Depends on:** [existing components from build-registry that this requires]
**New systems required:** [components that must be built from scratch]
**Estimated complexity:** [Low / Medium / High — based on: Low = 1-2 new components, Medium = 3-4, High = 5+]

### Mechanics
**Player-facing:** [what the player does]
**Server-side validation requirements:** [what the server must enforce — be specific about authority boundaries]

### Data Model Sketch
[New Drizzle tables or columns needed — brief, not full schema]
Example:
- New table: `clans` (id, name, leader_id, created_at)
- New table: `clan_members` (clan_id, player_id, role, joined_at)
- Add column: `players.clan_id` → references clans

### Build Sequence Addition
[Where this feature slots into the existing Section 9 build sequence]
Example:
- After: `[existing component it depends on]`
- Before: `[existing component that could optionally use it]`
New build order for affected section:
1. [existing component]
2. [new component A]  ← new
3. [new component B]  ← new
4. [existing component that follows]

### Section 10 Updates
[Sub-features or complexity that should be explicitly deferred to keep this expansion focused]
Example:
- Deferred: Clan leaderboards (requires analytics system)
- Deferred: Cross-clan tournaments (out of scope until clan system is stable)

### Open Questions
[Unresolved decisions — do not silently assume answers]
1. [Question that must be answered before building this feature]
```

## Phase 4 — Update docs/mvp-first-draft.md

After producing the spec, update the MVP plan document:

1. **Append the expansion section** at the end of `docs/mvp-first-draft.md`:
   ```markdown
   ---
   ## Expansion: [feature name]
   > Added: [current date] via game-expand skill

   [full feature spec from Phase 3]
   ```

2. **Update Section 9 (Build Sequence)** — integrate the new components at the correct dependency position in the existing sequence. Do not renumber existing components; append new ones after their dependency.

3. **Update Section 10 (Out of Scope)** — add any sub-features identified in "Section 10 Updates" above.

## Phase 5 — Output

Present the completion summary:

```
✅ Feature added: [name]
📋 MVP plan updated: docs/mvp-first-draft.md

🔗 Depends on (must be built first if not already):
  • [existing component 1] — status: [built / not built]
  • [existing component 2] — status: [built / not built]

🆕 New components to build:
  • [component A]
  • [component B]

📊 Updated MVP scope: [previous total] → [new total] components

Next step:
  game-build [first-unbuilt-dependency-or-new-component]
```

If any dependencies are not yet built, list them BEFORE the new components — the user must build dependencies first.

---

## Hard Constraints

1. **Never expand without mvp-first-draft.md** — the expansion must integrate into an existing plan
2. **Always check Section 10 first** — deferred features get a warning before proceeding
3. **Maximum 3 questions** — do not re-ask what's already in the plan
4. **Never invent schema details** not implied by the feature description — sketch only, flag open questions
5. **Always update Section 9 build sequence** — the expansion is only valid if it has a place in the build order
6. **Always list deferred sub-features** in Section 10 — scope creep happens one untracked assumption at a time
