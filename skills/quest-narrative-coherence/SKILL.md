---
name: quest-narrative-coherence
description: Checks a quest, mission or story beat against the world-lore document and the quest registry before it is written, then records it. Use when adding or changing any quest or story beat in a game that keeps world lore, so the new content does not contradict lore, double-book an NPC or inflate rewards.
---

# Quest Narrative Coherence

This skill owns the coherence check, the quest registry format and the world-lore sections. `quest-mission-design` and the `game-quest` command apply it and do not restate it.

The registry is the only record of which NPCs are busy, which locations are hubs and how much reward the game has issued. A quest written without reading it contradicts something. Reject a quest that skipped the check.

Files, in the game project:

- `docs/world-lore.md`: the world as established. Copy `templates/world-lore.md` when the file does not exist. Read it when you need the section list.
- `docs/quest-registry.md`: every quest, by status. Copy `templates/quest-registry.md` when the file does not exist. Read it when you need the column list.
- `templates/coherence-checklist.md`: copy it once per quest and tick it as you go.

## The five-step check

1. **Load the world.** Read `docs/world-lore.md`. Note the factions and how they relate, the characters and their status, the locations, the active conflicts and the timeline. If the file is missing, stop and create it from the template first.
2. **Load the registry.** Read `docs/quest-registry.md`. Note the NPCs already giving quests, the locations already used as hubs, the rewards already issued (the Economy Impact Log), the chains and the arcs.
3. **Validate.** Tick each item or flag it:
   - No faction, character or location clashes with another quest.
   - No contradiction with lore, including character motives and the timeline.
   - Every NPC in the quest is alive and free. One NPC cannot give two quests in two places.
   - Every location exists, or the quest introduces it and says so.
   - Faction involvement fits current faction relations.
   - Rewards fit the economy and the quests already in the registry (`game-economy-design`).
   - Difficulty fits the progression curve.
4. **Anchor.** The quest names at least one established lore element (character, faction, location or event) and advances at least one existing thread. A new element needs a reason in the world, and an entry in `docs/world-lore.md`.
5. **Register.** Append one row to the Active Quests table in `docs/quest-registry.md`. Use a Planned row while the quest is a draft. Fill every column. Append one row to the Economy Impact Log. When a quest completes, move its row to Completed and write its world consequence (a death, a changed faction relation) into `docs/world-lore.md`.

If step 3 flags anything, stop. Describe the conflict, propose a fix and wait for the user.

## Registry columns

Every quest table (Active, Completed, Planned) uses these columns, in this order:

`Quest ID | Name | Type | Quest Giver NPC | Primary Location | Factions Affected | Rewards Summary | Prerequisites | Story Arc`

`Type` takes one value from the type list in `quest-mission-design`. The table a row sits in (Active, Completed, Planned) is its status, so there is no Status column.

The Economy Impact Log is a separate table: `Quest ID | Currency Given | Items Given | Estimated Player Level`.

## World-lore sections

`docs/world-lore.md` has these sections, in this order: World Overview, Factions, Locations, Characters / Notable NPCs, History / Timeline, Active Conflicts, Rules and Constraints. Step 1 reads all of them.

## Pitfalls

- Writing a quest because it sounds fun, without a lore anchor (orphan quest).
- Forgetting what is established and contradicting it.
- Making a character act against their established motive.
- Rewards that break the economy.
- Events that cannot coexist in time.
- A world whose own logic contradicts itself. Keep the world's rules consistent from quest to quest.

## Related

- `references/sources.md`: read when you need the book support for this skill.
- `quest-mission-design`: type list, objective trees, rewards. Read it after this check passes.
- `worldbuilding`: creates the lore this check reads.
- `character-design-narrative`: character motives for step 3.
- `story-structure-game`: arc alignment for step 4.
- `game-economy-design`: reward scale for step 3.
