---
name: game-lore
description: Adds or updates a single world lore entry (faction, location, NPC, or event) — validates against existing lore for consistency, applies the right template, and updates docs/world-lore.md. Extract the entry type (faction/location/npc/event) and name from the user's message.
---

# Game Lore — Lore Entry Command

## Prerequisites

- Requires `docs/world-lore.md` in the project (run `game-architect` first, or create it manually)
- Apply the `worldbuilding` skill
- Apply the `quest-narrative-coherence` skill

---

## Phase 0 — Context Load (silent, mandatory)

Execute in this exact order:

1. Apply the `worldbuilding` skill
2. Apply the `quest-narrative-coherence` skill
3. READ `docs/world-lore.md`
   - If it does NOT exist: output `⛔ Cannot proceed. docs/world-lore.md not found. Run the game-architect skill first to generate the world foundation, or create docs/world-lore.md manually with a World Overview, Factions, Locations, Characters, and History sections.` and stop.
4. Parse the user's message to detect entry type:
   - Contains "faction" → FACTION mode
   - Contains "location" → LOCATION mode
   - Contains "npc" or "character" → NPC mode
   - Contains "event" or "history" → HISTORICAL EVENT mode
   - Not recognized → ask: "What type of lore entry is this? Reply with: faction / location / npc / event"
5. Extract the entry name from the user's message (the text after the type keyword)
6. READ `docs/quest-registry.md` if it exists (for cross-reference in Phase 4)

## Phase 1 — Consistency Check (mandatory before creating anything)

Validate the proposed entry against the existing content of `docs/world-lore.md`.

Run through each check — output the checklist explicitly:

```
## Consistency Check: [entry type] — [entry name]

[ ] No name collision — "[name]" does not already exist in world-lore.md
[ ] Faction alignment — faction relationships don't contradict existing alliances/enmities
[ ] Geographic plausibility — location fits within established world geography
[ ] NPC faction match — NPC's stated faction exists and their alignment is consistent with it
[ ] Timeline consistency — any historical events respect the established world timeline
[ ] Tone consistency — entry matches the world's established tone (dark/whimsical/gritty/etc.)
```

Mark each as ✅ (passed), ⚠️ (minor concern — proceed with note), or 🔴 (conflict — must resolve before proceeding).

For any 🔴 conflict:
Output `⚠️ LORE CONFLICT: [describe the contradiction clearly]. Proposed resolution: [specific suggestion that would fix it]. Proceed with the proposed fix? (confirm to continue with correction)`

Wait for user confirmation before continuing if any 🔴 conflicts exist.

## Phase 2 — Entry Creation

Apply the appropriate template based on the entry type detected in Phase 0:

### FACTION template:

```markdown
## Faction: [name]

**Public goal:** [what they publicly claim to want — the face they show to others]
**Hidden goal:** [what they actually want — internal motivation the player can discover]
**Territory:** [regions, cities, or areas they control or heavily influence]
**Resources:** [what they control: trade goods, military, information, wealth, magic, tech]
**Allies:** [faction names — and why they're allied]
**Enemies:** [faction names — and what the conflict is about]
**Neutral toward:** [faction names — and why there's no strong relationship]
**Gameplay role:** [how players interact with them: quest giver, merchant, enemy, obstacle, ally]
**Internal politics:** [sub-factions, internal tensions, succession disputes, or ideological splits]
**Distinguishing trait:** [one thing that makes this faction memorable and unique]
```

### LOCATION template:

```markdown
## Location: [name]

**Region:** [which larger geographic area this is part of]
**Type:** [city / dungeon / wilderness / settlement / landmark / ruin / outpost]
**Climate & Terrain:** [brief environmental description that affects gameplay/mood]
**Notable NPCs:** [named characters who live, work, or frequent this location]
**Factions present:** [which factions control or operate here, and in what capacity]
**Gameplay role:** [what players do here: quest hub, combat zone, trading post, dungeon, safe house]
**Lore significance:** [why this location matters to world history or current events]
**Atmosphere note:** [1-2 sentences on the feeling — helps with future dialogue and description writing]
```

### NPC template:

```markdown
## NPC: [name]

**Faction:** [primary faction affiliation — must exist in world-lore.md Factions section]
**Role:** [their function: merchant, quest giver, antagonist, ally, informant, guard, etc.]
**Personality:** [3 traits that define how they interact — keep it concrete, not vague]
**Current status:** [alive/dead/unknown, current location, what they're actively doing]
**Relationships:**
  - [NPC name]: [relationship type and why]
  - [Faction name]: [loyal / disillusioned / secretly opposed / etc.]
**Quest involvement:** [quests they're part of — reference quest-registry.md IDs if applicable, or "none yet"]
**Voice & Dialogue notes:** [speech patterns, vocabulary level, what topics they avoid, verbal tics]
**Personal secret:** [something about them the player can discover — makes them feel real]
```

### HISTORICAL EVENT template:

```markdown
## Event: [name]

**When:** [relative timeline — "~50 years ago", "before the Founding", "during the Third Era", etc. — use the world's own time markers]
**What happened:** [factual summary — 2-4 sentences, no editorializing]
**Factions involved:** [who participated and what role they played]
**Casualties/Cost:** [scale of the event — optional, include if significant]
**Consequences:** [direct effects on the present world: borders changed, factions formed/dissolved, power shifted, locations destroyed]
**Player-facing traces:** [ruins, surviving NPCs, items, architecture, or lore fragments the player can find today]
**Common knowledge vs. hidden truth:** [what most people believe happened vs. what actually happened — optional but adds depth]
```

Fill in all fields completely. Do not leave placeholders — if a field is genuinely unknown, write "Unknown / to be determined" and flag it as an open question.

## Phase 3 — Update docs/world-lore.md

Append the completed entry to the appropriate section of `docs/world-lore.md`:
- Factions → append under the Factions section
- Locations → append under the Locations/Geography section
- NPCs/Characters → append under the Characters/Notable NPCs section
- Events → append under the History/Timeline section

If the appropriate section doesn't exist in world-lore.md, create it with a clear heading.

**Bidirectional consistency:** If the new entry creates a relationship with an existing entry (e.g., "Enemy of The Silver Hand"), find The Silver Hand's entry in world-lore.md and add the reciprocal relationship note:
```
// Updated: [The Silver Hand] entry — added enemy relationship with [new faction]
```

After writing, output:
```
Updated: docs/world-lore.md
  ✅ Added [type]: [name]
  [If any existing entries modified]: ✏️ Updated: [entry name] — [what was added]
```

## Phase 4 — Cross-Reference Check

If `docs/quest-registry.md` exists:
- Scan it for any references to the entry name (or close variants)
- List any quests that now directly reference or are affected by this new entry

Output:
```
🔗 Quest registry cross-reference:
  Quests referencing this entry: [list with quest IDs and names, or "none found"]
  [If quests reference it]: Consider running the game-quest skill to update those quests with the new lore.
```

If `docs/quest-registry.md` doesn't exist:
```
🔗 Quest registry: not yet created — run the game-quest skill to start creating quests that use this lore.
```

---

## Hard Constraints

1. **Never skip Phase 1** — writing new lore without a consistency check leads to contradictions
2. **Never use vague personality traits** for NPCs ("nice", "mean", "mysterious") — always use concrete, actionable descriptions
3. **Faction relationships must be bidirectional** — if faction A is enemy of faction B, check faction B and update if needed
4. **Tone must match the world** — extract the tone from world-lore.md before writing; whimsy in a grim dark world is a bug
5. **Never invent new factions or major locations inside an NPC or Event entry** — if a new faction is implied, stop and ask if user wants to run game-lore for that faction first
6. **All timeline references must use the world's own time markers** — never use real-world dates (AD/BC/CE)
