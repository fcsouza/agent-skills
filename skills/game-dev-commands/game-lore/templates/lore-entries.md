# Lore entry templates

Fill every field. If a field is unknown, write "Unknown / to be determined" and list it as an open question.

## Faction

```markdown
## Faction: [name]

**Public goal:** [what they claim to want]
**Hidden goal:** [what they want; the player can discover it]
**Territory:** [regions, cities or areas they control or heavily influence]
**Resources:** [trade goods, military, information, wealth, magic, tech]
**Allies:** [faction names, and why]
**Enemies:** [faction names, and what the conflict is about]
**Neutral toward:** [faction names, and why there is no strong tie]
**Gameplay role:** [quest giver, merchant, enemy, obstacle, ally]
**Internal politics:** [sub-factions, tensions, succession disputes, ideological splits]
**Distinguishing trait:** [one memorable thing]
```

## Location

```markdown
## Location: [name]

**Region:** [the larger area this belongs to]
**Type:** [city / dungeon / wilderness / settlement / landmark / ruin / outpost]
**Climate & Terrain:** [environment that affects gameplay or mood]
**Notable NPCs:** [named characters who live, work or pass through]
**Factions present:** [who controls or operates here, and how]
**Gameplay role:** [quest hub, combat zone, trading post, dungeon, safe house]
**Lore significance:** [why it matters to world history or current events]
**Atmosphere note:** [1-2 sentences on the feeling, for later dialogue and description]
```

## NPC

```markdown
## NPC: [name]

**Faction:** [primary faction; must exist in the Factions section]
**Role:** [merchant, quest giver, antagonist, ally, informant, guard]
**Personality:** [3 concrete traits that shape how they act]
**Current status:** [alive / dead / unknown, location, what they are doing]
**Relationships:**
  - [NPC name]: [relationship type and why]
  - [Faction name]: [loyal / disillusioned / secretly opposed / etc.]
**Quest involvement:** [quest IDs from docs/quest-registry.md, or "none yet"]
**Voice & Dialogue notes:** [speech patterns, vocabulary level, topics they avoid, verbal tics]
**Personal secret:** [something the player can discover]
```

## Historical event

```markdown
## Event: [name]

**When:** [relative to the world's own time markers, e.g. "~50 years ago", "during the Third Era"]
**What happened:** [2-4 factual sentences]
**Factions involved:** [who took part and in what role]
**Casualties/Cost:** [scale; include if significant]
**Consequences:** [effects on the present: borders, factions formed or dissolved, power shifts, destroyed places]
**Player-facing traces:** [ruins, surviving NPCs, items, architecture, lore fragments the player can find]
**Common knowledge vs. hidden truth:** [what most people believe vs. what happened; optional]
```

## Active conflict

```markdown
## Conflict: [name]

**Parties:** [factions or NPCs on each side]
**Stakes:** [what each side gains or loses]
**Current state:** [where the conflict stands now]
**Player access:** [how the player can affect it or be affected]
**Linked entries:** [factions, locations, NPCs, events that this conflict touches]
```

## Rule or constraint

```markdown
## Rule: [name]

**Statement:** [one plain sentence: what is always true in this world]
**Scope:** [where and for whom it holds, and any exceptions]
**Gameplay effect:** [how it limits or shapes play]
**Linked entries:** [entries that depend on this rule]
```
