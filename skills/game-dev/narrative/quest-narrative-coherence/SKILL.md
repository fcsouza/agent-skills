# Quest Narrative Coherence

## Purpose

Standalone enforcement skill: ensures every quest, mission, or story beat is consistent with existing world lore, prior quests, and active story arcs. No orphan quests. Ever.

## When to Use

Trigger: quest creation, mission design, story beat, narrative content, new quest, quest writing, lore check, narrative consistency, story coherence

MANDATORY: This skill must be read BEFORE `quest-mission-design`, `worldbuilding`, `story-structure-game`, or `character-design-narrative` when creating any narrative content.

## Prerequisites

None — this is a foundational enforcement skill.

## Core Principles (cite Ken Levine: "world-as-story", Hidetaka Miyazaki: "environmental storytelling")

1. Every quest must reference at least one previously established lore element
2. No quest can contradict established world history or character motivations
3. Quest rewards must be consistent with the game economy (cross-ref `game-economy-design`)
4. Characters in quests must match their established personality and arc
5. Locations must exist in the world map or be explicitly introduced
6. Faction involvement must respect existing faction relationships
7. Quest difficulty must fit the intended progression curve
8. Temporal consistency — events must respect the world's timeline

## Step-by-Step Instructions — The 5-Step Coherence Check

### MANDATORY BEFORE WRITING ANY QUEST:

**Step 1: Load Current World State**

Read `world-lore.md` (or equivalent lore document) to understand:

- Established factions, their relationships, and current state
- Major characters and their last known status
- World geography and accessible locations
- Active conflicts, alliances, and treaties
- Timeline of significant events

**Step 2: Check Quest Registry**

Read `quest-registry.md` to understand:

- All existing quests and their status (active, completed, planned)
- Quest chains and dependencies
- Which NPCs are already involved in quests
- Which locations are already quest hubs
- Reward amounts already distributed (to prevent economy inflation)

**Step 3: Validate Against Existing Content**

Before writing the quest, verify:

- [ ] No faction/character/location conflicts with existing quests
- [ ] No contradictions with established lore
- [ ] Referenced characters are alive and available
- [ ] Referenced locations exist and are accessible
- [ ] Reward scale is consistent with existing economy
- [ ] Difficulty fits the progression curve

**Step 4: Reference Existing Lore**

The quest MUST:

- Reference at least one established lore element (character, event, location, faction)
- Build upon or advance at least one existing narrative thread
- Not introduce entirely disconnected storylines without world-building justification

**Step 5: Register the Quest**

After creating the quest, add it to `quest-registry.md` with:

- Quest ID, name, and brief description
- NPCs involved
- Locations used
- Factions affected
- Rewards given
- Prerequisites (other quests that must be complete)
- Story arc it belongs to

> An AI agent that skips this 5-step check has produced **invalid output**. The quest must be rejected.

## Code Examples

Reference `templates/` for registry format and validation checklist:

- `templates/world-lore.md` — empty world lore document with required sections
- `templates/quest-registry.md` — empty quest registry with required fields
- `templates/coherence-checklist.md` — per-quest validation checklist

## Cross-References

- `quest-mission-design` — uses this skill as prerequisite
- `worldbuilding` — provides the lore this skill validates against
- `character-design-narrative` — character consistency checks
- `story-structure-game` — narrative arc alignment
- `game-economy-design` — reward consistency

## Pitfalls & Anti-Patterns

- **"Cool quest, no context"** — writing a quest because it sounds fun without checking if it fits the world
- **"Lore amnesia"** — forgetting what was established and contradicting it
- **"Economy inflation"** — giving rewards that break the game economy
- **"Character assassination"** — making a character act against their established personality
- **"Orphan quest"** — quest that connects to nothing and advances no narrative
- **"Timeline paradox"** — events that can't coexist chronologically

## Designer Philosophy

**Ken Levine** (BioShock): "The world IS the story." Every quest must feel like a natural part of the world, not a gameplay task glued onto it. If a quest doesn't make the world feel more real, it shouldn't exist.

**Hidetaka Miyazaki** (Dark Souls, Elden Ring): Environmental storytelling means every element tells a story. Quests should reveal world history, not just provide objectives. Cryptic doesn't mean incoherent — every mystery should have a consistent answer in the lore.

**Hideo Kojima** (Metal Gear): Meta-awareness of the player's role. Quests can acknowledge the nature of the game world without breaking immersion, but they must always respect internal logic.

## Sources

- "Building Worlds" — GDC 2019 Ken Levine
- "Designing Dark Souls" — GDC 2012 Hidetaka Miyazaki
- "The Art of Game Design" — Jesse Schell, Chapter on World Building
- "Narrative Design for Indie Games" — GDC 2020
