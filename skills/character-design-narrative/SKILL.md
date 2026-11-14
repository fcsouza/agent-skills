---
name: character-design-narrative
description: >-
  Covers designing game characters: NPCs, companions, antagonists, player avatars, character bibles and branching dialogue. Use when a game needs a new character written, an NPC feels flat or interchangeable, or dialogue needs a branching format with conditions and effects.
---

# Character Design (Narrative)

Read `worldbuilding` first when the game has a world; characters must fit its rules. Check new characters against `quest-narrative-coherence` so they do not contradict established lore.

## Principles

1. Every character wants something. That want drives what they do.
2. Keep behaviour consistent. A character who acts out of type needs a story event that explains it.
3. Give NPCs routines and goals that do not depend on the player.
4. Show personality in action and in dialogue and animation, not in exposition.
5. Give each character a flaw or contradiction. Test the design for inner contradictions that work against the game's purpose.
6. Give each character a distinct voice. A player should tell two NPCs apart without seeing names.

## Design steps

1. List the functions the character serves: quest giver, shop, companion, boss, tutorial, lore.
2. Pick several traits. Decide how dialogue and animation will show each one.
3. Plot relationships. Place each pair on two axes: hostile to friendly, and submissive to dominant. Draw a character web of who feels what about whom. Mark who has higher status.
4. Plan any visible transformation: how the character looks or acts before and after their arc.
5. For a player avatar, choose between an idealised form and a blank, iconic slate the player fills in.
6. Fill in the bible: copy `templates/character-bible.md` when a character is significant. Minor characters need only Identity and Gameplay Role.
7. Write dialogue: copy `templates/dialogue-tree.md` when a conversation branches, has conditions, or sets flags.

Writing a diverse cast takes research and care, and carries the risk of getting it wrong. Treat that as a reason to research, not to avoid it.

## Multiplayer and MMO characters

- Players often keep several characters per account. Decide early how many slots, and whether wallets and inventory belong to a character or to the account. `postgres-game-schema` has a `characters` table (several per account, name unique per shard). Wallets and inventory ship on the account; the game decides whether they move to the character.
- Plan for abuse of multiple characters: disposable characters used to move risk or gear to a main.
- Names must be unique within whatever scope you choose, such as per shard.

## Pitfalls

- Walking exposition: the NPC exists only to deliver information.
- Personality-free quest giver: a quest marker with a face.
- Sudden betrayal with no foreshadowing.
- One-note villain with no understandable motive.
- Static cast: nobody changes across the game.
- Everyone talks the same.

## Files

- `templates/character-bible.md`: copy when documenting a significant character.
- `templates/dialogue-tree.md`: copy when authoring branching dialogue.
- `references/sources.md`: read when you need the citations behind the design steps.

## Related skills

- `worldbuilding`: the world's rules.
- `quest-narrative-coherence`: consistency checks.
- `story-structure-game`: where character arcs sit in the plot.
- `quest-mission-design`: characters as quest givers.
- `elevenlabs-sound-music`: voice acting.
