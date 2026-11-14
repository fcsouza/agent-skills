---
name: story-structure-game
description: Structures a game's story: act framework, branching and endings, and story beats. Use when planning how a game's plot is delivered and how player choices change it, or when a branching story grows too big to write or test.
---

# Story Structure for Games

## Pick a method first

Choose one before you draw any beats.

- String of pearls: fixed story scenes alternate with free-play stretches. You control the plot and the player stays on the story path. Pick this when the story is the main draw.
- Story machine: you write no plot ahead. The rules and systems produce events players want to retell. Pick this when the systems are the main draw.

Ask of either method: which conflicts and choices let different stories arise, how can players make the story theirs, and does play produce a good interest curve.

For modular narrative built from small recombinable pieces, see Ken Levine's GDC 2014 talk "Narrative Legos" in `references/sources.md`.

## Frame the arc

An act frame gives a story shape. Use it as a skeleton, not a formula.

- Setup: hook, world, inciting incident, first real player choice.
- Confrontation: rising challenges, major choices, consequences that compound, a midpoint turn.
- Resolution: climax, final choice, outcome shaped by earlier choices, denouement.

Give the protagonist goals, obstacles and conflicts that match what the player does in play. Space tense beats with quiet ones. Keep world logic consistent; see `quest-narrative-coherence` and `worldbuilding`.

## Plan branching

Choice trees grow fast: ten levels of three choices give a tree of 88,573 nodes (Schell's figure). You cannot write or test the full tree. Decide how you will cut it before you write branches.

1. List the choices the player must feel. Mark the rest as flags that change later text, not new scenes.
2. Converge branches where you must. Convergence cheapens the early choices, so carry their effects forward: the world, the dialogue and the available options change after the merge, even if the next scene does not.
3. Plan the endings. Equal endings rarely work: players ask which one is the real one and dislike replaying to see the rest. Prefer one ending shaped by tracked choices. If you want two endings, make each a full, different story, such as a light path and a dark path.
4. Limit story verbs. Games offer few ways to speak or act in story terms, so each choice must map to something the game can show.
5. Decide whether the player can undo. Undo removes tragedy from a loss.
6. Test every path that remains after the cuts, from start to finish.

Use `templates/branching-diagram.md` to draw the graph and `templates/story-beat-template.md` to list beats, prerequisites and consequences.

## Show consequences

A choice with no visible effect reads as no choice. Show the effect soon after the choice and again later. Do not invalidate a decision the player made on purpose.

## Pitfalls

- Choices that all lead to the same result. Players notice and feel cheated.
- Gameplay that contradicts the story, such as a hero who mourns one death after killing hundreds in play.
- Long non-interactive sequences that take control away.
- Characters who explain the plot instead of the player seeing it.
- Side stories with no link to the main arc.

## Files

- `templates/branching-diagram.md`: copy when you document branches, merges and endings, in Mermaid or as an indented list.
- `templates/story-beat-template.md`: copy when you plan beats by act, with choices and consequences.
- `references/sources.md`: read when you need the source behind a claim here.
