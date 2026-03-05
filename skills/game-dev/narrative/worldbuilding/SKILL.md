---
name: narrative-worldbuilding
description: >-
  Use when creating game worlds, lore, factions, geography, timelines, or establishing world consistency rules. Genre-agnostic — works for fantasy, sci-fi, modern, or abstract settings. Triggers: lore, factions, geography, world bible, world creation.
---

# Worldbuilding

## Purpose

Lore creation, geography design, faction dynamics, tone consistency, and world bible maintenance for any game setting. Genre-agnostic — works for fantasy, sci-fi, modern, horror, abstract, or any other setting.

## When to Use

Trigger: worldbuilding, lore, factions, geography, world design, setting, game world, tone, world bible, lore bible, world history, faction design, region design, location design

## Prerequisites

- `quest-narrative-coherence` (must be read first — ensures all world content stays internally consistent)

## Core Principles

> Hidetaka Miyazaki: "I always try to think about what kind of story the world itself tells."
> Ken Levine: "The world IS the story. Every corner should whisper something to the player."
> Will Wright: "A great simulation world has rules players can intuit without reading a manual."

1. **Internal consistency above all** — every fact, rule, and relationship must hold true across the entire world; contradictions destroy believability
2. **Show, don't exposition** — embed lore in the environment, item descriptions, NPC dialogue, and architecture rather than text dumps
3. **Factions need wants, not just labels** — every group must have goals (public and hidden), resources, enemies, and a reason to exist beyond "they're the bad guys"
4. **Geography shapes culture** — climate, terrain, and resources determine how civilizations develop, trade, fight, and build
5. **Rules before exceptions** — establish what is possible and impossible in the world before introducing special cases; magic/tech systems need clear costs and limits
6. **History creates present tension** — past events (wars, disasters, discoveries) should directly cause current conflicts and alliances
7. **Tone is a contract with the player** — once established, the world's tone (dark, whimsical, gritty, absurd) must be maintained; tonal whiplash breaks immersion

## Step-by-Step Instructions

### 1. Define the World Foundation

Start with `templates/world-bible.md`. Fill in the world overview first: name, genre, tone, themes, and time period. This anchors every decision that follows.

### 2. Establish Core Rules

Define what is possible and impossible. Does magic exist? Technology? Both? What are the costs and limits? These rules constrain everything else and prevent power creep.

### 3. Build History Backward

Start from the present state of the world and work backward. What war caused this border? What disaster made this region uninhabitable? What discovery enabled this technology? History should explain the present, not exist for its own sake.

### 4. Design Geography

Map regions, climates, resources, and travel routes. Geography determines trade, conflict, and cultural development. Use `templates/location-template.md` for each significant location.

### 5. Create Factions

Use `templates/faction-bible.md` for each faction. Every faction needs goals, enemies, allies, territory, and a gameplay role. Aim for at least 3 factions with interlocking relationships (ally/enemy/neutral dynamics that create player choice).

### 6. Define Cultural Elements

Customs, religions, languages, art, and social norms for each major group. Culture should emerge naturally from geography, history, and faction goals.

### 7. Write the Tone Guide

Document what fits and what doesn't. List reference media. This prevents tonal drift as more content is added by different contributors.

### 8. Register with Quest Narrative Coherence

All established lore becomes the canonical reference for `quest-narrative-coherence` validation. New quests, characters, and locations must align with the world bible.

## Code Examples

Reference `templates/` for all document structures:

- `templates/world-bible.md` — comprehensive world bible with all required sections
- `templates/faction-bible.md` — per-faction deep dive template
- `templates/location-template.md` — per-location design template

## Cross-References

- `quest-narrative-coherence` — validates all narrative content against this world
- `story-structure-game` — narrative arc design within this world
- `character-design-narrative` — characters must fit the world's tone, factions, and history
- `quest-mission-design` — quests must use established locations, factions, and lore

## Pitfalls & Anti-Patterns

- **"Generic fantasy #4,827"** — elves, dwarves, and orcs with no twist, no unique culture, no reason to exist in this specific world
- **"Lore encyclopedia syndrome"** — pages of history the player never encounters; if it doesn't affect gameplay or environmental storytelling, cut it
- **"Inconsistent lore"** — NPC A says the war was 100 years ago, NPC B says 50; maintain a single timeline source of truth
- **"Info dump NPCs"** — characters who exist only to deliver paragraphs of exposition instead of living in the world naturally
- **"Aesthetic without substance"** — a faction that looks cool but has no goals, no internal politics, no reason for the player to care
- **"Flat geography"** — every region feels the same; terrain, climate, and resources should create distinct identities and gameplay differences
- **"Tone whiplash"** — mixing grim dark with slapstick comedy without intentional purpose; tonal shifts need to be deliberate and earned

## Designer Philosophy

**Hidetaka Miyazaki** (Dark Souls, Elden Ring): Environmental storytelling is world design. Every crumbling ruin, every item description, every enemy placement tells a story. The world should reward curiosity — players who look closely find layers of meaning. Cryptic doesn't mean random; every mystery has an answer buried somewhere in the world. The feeling of discovery IS the narrative.

**Ken Levine** (BioShock): The world is the story. Rapture and Columbia aren't backdrops — they ARE the narrative. Every poster, every audio log, every architectural choice communicates ideology, history, and decay. When the world tells the story, the player feels like an archaeologist uncovering truth rather than a passive audience receiving exposition.

**Will Wright** (SimCity, The Sims, Spore): Simulation worlds emerge from rules. Define the systems — resources, needs, relationships, constraints — and the world generates stories on its own. Players don't need to be told the world is alive if they can see cause and effect playing out. The best worlds are ones where players form their own theories about how things work.

## Sources

- "Building Worlds That Tell Stories" — GDC 2019 Ken Levine
- "Designing Dark Souls: The Interconnected World" — GDC 2012 Hidetaka Miyazaki
- "The Art of Game Design" — Jesse Schell, Chapters on World Building and Story
- "Creating Compelling Game Worlds" — GDC 2017
- "Environmental Storytelling: Techniques and Best Practices" — GDC 2020
- "Simulation and World Systems in Game Design" — Will Wright, various GDC talks
