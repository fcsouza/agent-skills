---
name: game-lore
description: Adds or updates one world lore entry (faction, location, NPC, event, conflict or rule) in docs/world-lore.md after a consistency check against the existing lore. Takes the entry type and name as `$ARGUMENTS`, or from the user's message. Use when the world needs a new faction, place, character, historical event, active conflict or world rule, or when an existing entry must change.
argument-hint: type and name (e.g. "faction The Iron Court", "location Ashfall Crossing", "npc Mira the Keeper", "event The Founding War", "conflict The Salt Dispute", "rule Magic needs iron")
---

# Game Lore: Lore Entry Command

## Requires

- `worldbuilding`
- `quest-narrative-coherence`

Before you apply a skill listed here, check that it is installed. If it is not, name it, give this install line, and stop: `bunx skills add fcsouza/agent-skills --skill <name>`.

## Prerequisites

- `docs/world-lore.md` in the project (run `/game-architect` first, or create it by hand)

## Phase 0: Context load (silent)

Input: `$ARGUMENTS`. If it is empty, take it from the user's message. It holds the entry type and name.

In this order:

1. Apply the `worldbuilding` skill.
2. Apply the `quest-narrative-coherence` skill. Its "World-lore sections" list gives the section names this command writes to.
3. Read `docs/world-lore.md`. If it does not exist, say: "Cannot proceed. docs/world-lore.md not found. Run `/game-architect` to generate the world foundation, or create the file with the seven sections listed in `quest-narrative-coherence`." Then stop.
4. Detect the entry type from the input:
   - "faction": faction
   - "location": location
   - "npc" or "character": NPC
   - "event" or "history": historical event
   - "conflict": active conflict
   - "rule" or "constraint": rule or constraint
   - Anything else: ask "What type of lore entry is this? Reply with: faction / location / npc / event / conflict / rule".
5. Take the entry name from the text after the type keyword.
6. Read `docs/quest-registry.md` if it exists (used in Phase 4).

## Phase 1: Consistency check (before writing anything)

Check the proposed entry against `docs/world-lore.md`. Print the checklist with a result per line: "pass", "note" (minor, proceed and say so) or "conflict" (resolve first).

```
## Consistency Check: [entry type] - [entry name]

[ ] No name collision: "[name]" is not already in world-lore.md
[ ] Faction alignment: relationships do not contradict existing alliances or enmities
[ ] Geographic plausibility: the location fits the established geography
[ ] NPC faction match: the NPC's faction exists and their alignment fits it
[ ] Timeline consistency: events respect the established timeline
[ ] Conflict and rule consistency: the entry does not contradict an Active Conflicts or Rules and Constraints entry
[ ] Tone consistency: the entry matches the world's established tone
```

On any conflict, say: "Lore conflict: [the contradiction]. Proposed resolution: [specific fix]. Proceed with the fix?" Wait for the user's confirmation before you continue.

## Phase 2: Write the entry

Copy the template for the detected type from `templates/lore-entries.md` (copy when you reach this phase). Fill every field. A genuinely unknown field reads "Unknown / to be determined" and goes on the open-questions list.

Write NPC personality as concrete traits. Vague words ("nice", "mean", "mysterious") give the next writer nothing to act on.

## Phase 3: Update docs/world-lore.md

Append the entry under its section:

| Entry type | Section |
|---|---|
| Faction | Factions |
| Location | Locations |
| NPC | Characters / Notable NPCs |
| Event | History / Timeline |
| Conflict | Active Conflicts |
| Rule | Rules and Constraints |

If the section is missing, create it with that heading.

Relationships go both ways. If the new entry names an enemy, ally or other tie to an existing entry, open that entry and add the matching note. Mark each such edit in the file with a comment: `// Updated: [existing entry] - added [relationship] with [new entry]`.

After writing, report:

```
Updated: docs/world-lore.md
  Added [type]: [name]
  [If existing entries changed]: Updated: [entry name] - [what was added]
```

## Phase 4: Cross-reference

If `docs/quest-registry.md` exists, scan it for the entry name and close variants. Report:

```
Quest registry cross-reference:
  Quests referencing this entry: [quest IDs and names, or "none found"]
  [If any]: Run `/game-quest` to update those quests with the new lore.
```

If it does not exist: "Quest registry: not yet created. Run `/game-quest` to start quests that use this lore."

## Rules

1. Run Phase 1 every time. New lore written without a check contradicts old lore.
2. Match the world's tone. Read it from `docs/world-lore.md` before writing; a whimsical entry in a grim world breaks the setting.
3. Do not invent a new faction or major location inside an NPC or event entry. If the entry implies one, stop and ask whether to run `/game-lore` for that faction or location first.
4. Date events with the world's own time markers. Real-world dates (AD, BC, CE) break the setting.

## Files

- `templates/lore-entries.md`: copy when Phase 2 writes an entry.
