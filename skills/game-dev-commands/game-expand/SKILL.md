---
name: game-expand
description: Adds a feature to an existing MVP plan with a scoped interview, a scope check against the original plan, and a place in the build sequence. Takes the feature name or description as `$ARGUMENTS`, or from the user's message when empty. Use when the user wants to add a feature (clan system, seasonal events, crafting) to a game that already has docs/mvp-first-draft.md.
argument-hint: feature name or description (e.g. "clan system", "seasonal events", "crafting")
---

# Game Expand: Feature Expansion

## Requires

None. This command applies no skill. It reads the plan file named under Prerequisites.

## Prerequisites

- `docs/mvp-first-draft.md` exists in the project. Run `/game-architect` first if it does not.

## Phase 0: Context load (silent)

Input is `$ARGUMENTS`. If it is empty, take the feature name or description from the user's message.

1. Read `docs/mvp-first-draft.md`. If it does not exist, output "Stopped: docs/mvp-first-draft.md not found. Run `/game-architect` first to create the MVP plan." and stop. The expansion must attach to an existing plan.
2. Read `docs/build-registry.md` if it exists. Note which components are built, mocked and remaining.
3. Compute MVP completion. Without a registry: "MVP completion: 0% (build registry not yet created)". With one: "MVP completion: [built]/[total] components ([%])".

## Phase 1: Scope validation (before any question)

Run these checks first so the interview does not spec a feature the plan already covers.

**Check 1: deferred features.** Search Section 10 (Out of Scope for MVP) of `docs/mvp-first-draft.md` for the feature name. If found, output: `Warning: "[feature]" was deferred in Section 10. Original reason: "[text from plan]". Adding it now grows the MVP. MVP completion is [%]. Proceed? (confirm to continue)`. Wait for the user's confirmation. If not found, continue.

**Check 2: already planned.** Search Section 9 (MVP Build Sequence) for the feature name.
- In the plan and `built` in the registry: output "Stopped: [feature] is already built (see docs/build-registry.md). To change it, audit it with `/game-review`." and stop.
- In the plan and not built: output "Stopped: [feature] is already in the MVP plan (Section 9) and not built. Implement it with `/game-build [feature]` instead of re-planning." and stop.

**Check 3: completion.** If MVP completion is below 50% and Check 1 did not already warn, output "Note: the MVP is [%] complete. Finishing the core MVP first is usually cheaper. Confirm to proceed." Wait for confirmation.

## Phase 2: Scoped interview (at most 3 questions)

`/game-architect` runs the full game interview. This command asks only what the feature spec needs. Do not re-ask what the plan answers (genre, stack, multiplayer type, core loop). Skip any question the plan already answers.

1. Required, ask first: "How does **[feature]** connect to your existing core loop? (for example: it extends the economy, it is a retention mechanic, it adds a PvP mode)"
2. Required: "Which existing MVP systems does this feature depend on? (for example: auth, matchmaking, quest system, economy)"
3. Optional, only when the scope is ambiguous: one clarification specific to the feature. Examples: for "clan system", do clans have their own economy or only social features; for "seasonal events", are they time-gated on the server or a cosmetic reset; for "crafting", does it consume inventory items or create new item types.

Do not ask about naming or code style. The topic skills already define those.

## Phase 3: Feature spec

Where the feature touches another domain, point to the skill that owns it instead of writing the rules here: economy sinks and faucets to `game-economy-design`, quests and lore to `quest-narrative-coherence`, persistent multiplayer worlds to `mmo-design`, tables to `postgres-game-schema`.

Produce this spec:

```markdown
## Feature: [name]

**Core loop integration:** [how it feeds the loop in the MVP plan]
**Depends on:** [existing components that this requires]
**New systems required:** [components built from scratch]
**Estimated complexity:** [Low = 1-2 new components, Medium = 3-4, High = 5 or more]

### Mechanics
**Player-facing:** [what the player does]
**Server-side validation:** [what the server enforces; name the authority boundaries]

### Data model sketch
[New tables or columns, brief, in the ORM the plan's Section 4 names. Not a full schema.]
- New table: `clans` (id, name, leader_id, created_at)
- Add column: `players.clan_id` references clans

### Build sequence addition
After: [existing component it depends on]
Before: [existing component that could use it]
1. [existing component]
2. [new component A]  (new)
3. [existing component that follows]

### Section 10 updates
[Sub-features to defer so the expansion stays small]
- Deferred: [sub-feature] ([reason])

### Open questions
1. [Decision to settle before building. Do not assume an answer.]
```

The complexity bands are this command's own sizing rule: they count new components and are not a time estimate.

## Phase 4: Update docs/mvp-first-draft.md

1. Append at the end of the file:
   ```markdown
   ---
   ## Expansion: [feature name]
   Added: [current date] via /game-expand

   [full feature spec from Phase 3]
   ```
2. Update Section 9. Insert the new components after their dependency. Do not renumber existing components.
3. Update Section 10 with the deferred sub-features from the spec.

## Phase 5: Output

```
Done: feature added: [name]
Plan updated: docs/mvp-first-draft.md

Depends on (build first if not built):
  - [existing component 1]: [built / not built]

New components to build:
  - [component A]

Updated MVP scope: [previous total] -> [new total] components

Next step:
  /game-build [first-unbuilt-dependency-or-new-component]
```

List unbuilt dependencies before the new components. The user must build them first.

## Rules

1. Never expand without `docs/mvp-first-draft.md`. The feature needs a plan to join.
2. Check Section 10 first. A deferred feature was cut for a reason the user should see again.
3. Ask at most 3 questions. The plan already holds the rest.
4. Sketch schema only as far as the feature description implies. Put anything else under Open questions, so no guess becomes a design.
5. Always update Section 9. A feature with no place in the build order cannot be built.
6. Always list deferred sub-features in Section 10. Untracked assumptions are how scope grows.
