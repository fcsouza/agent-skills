---
name: story-structure-game
description: >-
  Use when designing interactive narratives, branching storylines, player agency systems, non-linear story structures, or act frameworks for games. Triggers: branching narrative, player agency, story arc, interactive story, dialogue.
---

# Story Structure for Games

## Purpose

Branching narratives, player agency, non-linear story structure, and act frameworks adapted for interactive media. Genre-agnostic — works for any game with narrative elements.

## When to Use

Trigger: story structure, branching narrative, player agency, non-linear story, act structure, story beats, narrative arc, dialogue tree, multiple endings, player choice, consequence system, narrative design

## Prerequisites

- `quest-narrative-coherence` — ensures all story content is consistent
- `worldbuilding` — provides the world context for the story

## Core Principles

> Hideo Kojima: "Games can tell stories that no other medium can — stories where the audience is the protagonist."
> Ken Levine: "Narrative should emerge from systems, not just scripted sequences."
> Hidetaka Miyazaki: "The best stories are the ones players piece together themselves."

1. **Player agency is sacred** — the player must feel their choices matter; never invalidate a meaningful decision
2. **Show consequences** — choices without visible consequences feel meaningless; show the impact
3. **Non-linear doesn't mean random** — structure the narrative so any path through it feels intentional
4. **Environmental storytelling first** — the world tells the story; dialogue and cutscenes support it (Miyazaki)
5. **Dramatic structure still applies** — even branching narratives need tension, climax, and resolution
6. **Multiple endings must all feel earned** — no "good ending" and "bad ending"; each ending should reflect the player's journey
7. **Pacing is controlled by the player** — design for players who rush AND players who explore

## Narrative Frameworks

### Three-Act Structure (Adapted for Games)
```
Act 1 — Setup (10-20% of game)
  Hook → World introduction → Inciting incident → Player given agency

Act 2 — Confrontation (60-70% of game)
  Rising challenges → Major choices → Consequences compound → Midpoint twist

Act 3 — Resolution (10-20% of game)
  Climax → Final choice → Resolution shaped by prior decisions → Denouement
```

### Branching Narrative Model
```
         [Start]
        /       \
    [Choice A] [Choice B]
      /    \      \
  [A1]    [A2]  [B1]
    \      |     /
     [Convergence Point]
        /       \
   [Final A]  [Final B]
```

### Kishōtenketsu (Eastern Structure — No Conflict Required)
```
Ki (Introduction) → Shō (Development) → Ten (Twist/Revelation) → Ketsu (Conclusion)
```

## Cross-References

- `quest-narrative-coherence` — story consistency validation
- `worldbuilding` — world context
- `character-design-narrative` — character arcs within the story
- `quest-mission-design` — quests as story delivery mechanism

## Pitfalls & Anti-Patterns

- **"Illusion of choice"** — choices that all lead to the same outcome; players notice and feel cheated
- **"Ludonarrative dissonance"** — gameplay contradicts the story (hero kills 500 people then mourns one death)
- **"Cutscene prison"** — long non-interactive sequences that remove player agency
- **"Exposition dump"** — characters explaining plot instead of showing it
- **"Disconnected side stories"** — narrative content that feels irrelevant to the main arc

## Designer Philosophy

**Hideo Kojima** (Metal Gear Solid): Games have a unique narrative advantage — the player IS the character. Use this. Break the fourth wall. Make the player's real-world actions part of the story. The controller, the save file, the screen itself can all be narrative tools.

**Ken Levine** (BioShock): "Would you kindly" works because it uses game mechanics as narrative. The best game stories are inseparable from the gameplay — they can't be a movie, they can't be a book. They can ONLY be a game.

**Hidetaka Miyazaki** (Dark Souls): Not every player needs to understand the story. Layer narrative so casual players get the broad strokes, and dedicated players who read item descriptions and explore every corner find a deeper, richer story beneath.

## Sources

- "Narrative Design for Indie Games" — GDC 2020
- "Writing for Games" — GDC 2018
- "The Art of Game Design" — Jesse Schell, Chapters on Story
- "Interactive Storytelling" — Chris Crawford
- "Designing BioShock's Narrative" — Ken Levine, GDC 2014
