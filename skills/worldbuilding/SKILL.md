---
name: worldbuilding
description: Covers game world creation: rules, history, geography, factions, culture, tone and the world bible. Use when a game needs a setting, lore, factions or regions designed, when new lore must not contradict what exists, or when NPCs or quests feel disconnected from the world.
---

# Worldbuilding

The output is `docs/world-lore.md`, the file `quest-narrative-coherence` checks quests, characters and locations against. Read it first if it exists. `templates/world-bible.md` is the working document you fill while you design; step 8 distils it into `docs/world-lore.md`.

## Principles

1. Keep every fact consistent. Contradictions break believability. One timeline in one file is the source of truth.
2. Put lore where the player already looks: environments, item text, NPC lines, architecture. Players spend most of their time moving through the world, not watching cutscenes. Traces left behind (a ransacked camp, a half-finished letter) tell a story without stopping play.
3. Give every faction wants: a public goal, a hidden goal, resources, enemies, and a role in play.
4. Let geography cause culture: climate, terrain and resources decide trade, conflict and building.
5. Set the rules before the exceptions. Magic and technology need costs and limits, or power creep follows.
6. Make history cause the present. Each past event must explain a current border, conflict or alliance.
7. Pick a tone and hold it. Change tone on purpose, not by accident.
8. Make the world believable to the player rather than accurate to reality. Offer a world simpler than real life, with more power for the player than real life. Include one strange thing and explain it.

## Procedure

1. **Foundation.** Fill the overview in `templates/world-bible.md`: name, genre, tone, themes, era. Write a one-sentence pitch of what makes this world differ from others in its genre.
2. **Core rules.** List what exists, hard rules that never break, soft rules with the conditions that break them, and the power ceiling.
3. **History, backward.** Start from the present state. For each feature (border, ruin, technology), write the event that caused it. Cut any event that explains nothing.
4. **Geography.** Map regions, climate, resources and routes. Fill `templates/location-template.md` for each place the player visits. Give each region a distinct look, a distinct play difference, and at least one landmark.
5. **Factions.** Fill `templates/faction-bible.md` per faction. Write at least three, with ally, enemy and neutral ties that force the player to choose.
6. **Culture.** For each major group write customs, belief, language and norms. Derive them from its geography, history and goals.
7. **Tone guide.** List what fits and what does not, plus reference media. Contributors use it to avoid drift.
8. **Write `docs/world-lore.md`.** If the file is missing, copy the `world-lore` template from `quest-narrative-coherence`. If it exists, keep what is there and fill the empty sections. Either way keep exactly its seven sections. Fill each from the world bible:
   - World Overview: the bible's World Overview and Tone Guide.
   - Factions: the bible's Factions and each filled faction file.
   - Locations: the bible's Geography and each filled location file.
   - Characters / Notable NPCs: the NPCs you have named so far, from faction and location files. Leave it empty if none.
   - History / Timeline: the bible's History, one table row per event.
   - Active Conflicts: the open wars, disputes and mysteries from History and Factions.
   - Rules and Constraints: the bible's Core Rules, Technology / Magic System and the Tone Guide's "is not" list.

   New quests, characters and locations then go through `quest-narrative-coherence`.

## Files

- `templates/world-bible.md`: read when starting a world or adding a rule, era, culture or economy section.
- `templates/faction-bible.md`: read when designing or revising a faction.
- `templates/location-template.md`: read when designing a region or a single location.
- `references/sources.md`: read when you need the support for a claim above, or before adding one.

## Pitfalls

- Stock genre races with no twist and no reason to exist in this world. Give each a role only this world creates.
- Lore the player never meets. If it affects neither play nor the environment, cut it.
- Two NPCs give different dates for the same event. Look up the timeline before writing any date.
- NPCs who exist only to deliver exposition. Give them a task, a want, or a place in a faction.
- Factions with a look but no goals or internal politics.
- Regions that feel the same. Change terrain, climate, resources and what the player can do there.
- Tone shifts with no purpose, such as grim drama broken by slapstick.

## Related skills

- `quest-narrative-coherence`: validates new content against `docs/world-lore.md`.
- `story-structure-game`: arc design inside this world.
- `character-design-narrative`: characters must match the world's tone, factions and history.
- `quest-mission-design`: quests must use established locations, factions and lore.
