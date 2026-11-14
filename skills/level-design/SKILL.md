---
name: level-design
description: >-
  Use when designing game levels, environments, difficulty curves, pacing, encounter placement, or spatial layouts for any game genre. Triggers: level, pacing, difficulty curve, encounter, environment, spatial design.
---

# Level Design

## Purpose

Environment layout, pacing, difficulty curves, accessibility, and spatial design for any game type.

## When to Use

Trigger: level design, environment layout, pacing, difficulty curve, level flow, spatial design, map design, area design, zone design, encounter design, tutorial level.

## Prerequisites

- `game-design-fundamentals`

## Core Principles

1. **"The level teaches the mechanic"** — Miyamoto. Every level introduces, tests, then twists a mechanic. The player should understand through doing, not reading.

2. **Pacing is rhythm** — Alternate intensity (combat/puzzle) with rest (exploration/story). A level without pacing variation is monotonous. Think of it like music: tension, release, tension, release.

3. **Spatial storytelling** — The environment tells a story without words. Broken furniture, scorch marks, an abandoned camp — the player pieces together what happened. Miyazaki's environmental narrative rewards observation.

4. **The golden path with optional detours** — There must be a clear main route so no player gets lost, but rewarding side paths for the curious. Jenova Chen's flow theory: the player should always feel pulled forward, never stuck.

5. **Difficulty is a curve, not a line** — Ramp, plateau, spike, rest. Never linear increase. Jonathan Blow's principle of mechanic honesty: each challenge should feel like a genuine insight, not an arbitrary wall.

6. **Accessibility is not optional** — Multiple difficulty modes, clear visual language, colorblind support, subtitles, remappable controls. Fumito Ueda's restraint and clarity: if a player can't parse what's happening, the design has failed.

7. **Playtesting reveals truth** — Your intuition about difficulty is wrong until proven by playtesters. Watch players silently. Where they get stuck is where your design failed, not where the player failed.

## Step-by-Step Instructions

### Phase 1: Concept

1. Define the level's **purpose** in the overall game progression. What does the player learn, feel, or achieve here?
2. Identify the **core mechanic(s)** this level introduces, tests, or twists.
3. Determine the **emotional arc** — what should the player feel at the start, middle, and end?
4. Set **constraints**: estimated playtime, difficulty band, technical budget.

### Phase 2: Layout

5. Sketch a **top-down layout** (pen and paper or text diagram). Mark:
   - Entry and exit points
   - Main path (golden path)
   - Side paths and optional areas
   - Encounter locations
   - Rest areas / safe zones
   - Key landmarks for orientation
6. Apply the **three-beat structure** to the main path:
   - **Introduction**: teach or reintroduce the mechanic in a safe context.
   - **Development**: test the mechanic with increasing complexity.
   - **Twist**: combine the mechanic with something unexpected or subvert expectations.
7. Place **landmarks** so the player always knows where they are. If you can't describe "you're near the [landmark]" for every area, add more landmarks.

### Phase 3: Pacing

8. Map **intensity over time** using a pacing graph. Plot encounters by intensity (1-10) against progression (0-100%).
9. Ensure **valleys** exist between peaks. Two high-intensity encounters back-to-back is exhausting. Insert exploration, story, or resource gathering between them.
10. Place the **climax** at roughly 75-85% through the level, then provide resolution / reward.

### Phase 4: Encounters

11. Design each encounter using the encounter template. For every encounter, answer:
    - What is the player supposed to learn or prove?
    - What happens if they fail?
    - Is there more than one valid approach?
12. Ensure **difficulty progression** within the level matches the difficulty curve template.

### Phase 5: Environmental Storytelling

13. Add **environmental details** that reward observation. These should never block progress but should enrich the experience.
14. Use the **show, don't tell** principle. A locked door with claw marks tells more than a text log explaining "the creature escaped."

### Phase 6: Accessibility Pass

15. Review all visual communication — can a colorblind player parse every important element?
16. Ensure all audio cues have visual alternatives.
17. Check that the critical path is navigable without precision timing (or provide an alternative in accessibility mode).
18. Verify text readability, subtitle availability, and input remapping support.

### Phase 7: Playtest

19. Run **silent playtests** — watch without helping. Record where players:
    - Get lost (navigation failure)
    - Get stuck (difficulty spike)
    - Get bored (pacing failure)
    - Miss content (discoverability failure)
20. Iterate based on playtest data, not personal preference.

## Code Examples

N/A — this is a design skill. Implementation code lives in `game-backend-architecture`.

## Cross-References

- `game-design-fundamentals` — Core design pillars and mechanics framework.
- `quest-mission-design` — Mission/quest structure that overlays on level layouts.
- `worldbuilding` — Lore, world rules, and narrative context for environments.
- `ui-ux-game` — HUD, minimap, waypoints, and player guidance systems.

## Pitfalls

- **Linear corridors with no player choice** — Even a simple fork that reconnects gives the player agency. Straight lines feel like you're being pushed.
- **Difficulty spikes without buildup** — A sudden hard encounter after easy ones feels unfair. Ramp into difficulty so the player feels prepared.
- **Empty spaces that waste player time** — Every area should have a purpose: encounter, story, resource, or scenic reward. Walking through nothing is not "atmosphere," it's boredom.
- **Inconsistent visual language** — If glowing objects mean "interactable" in one area, they must mean that everywhere. Breaking visual conventions confuses players.
- **Tutorial levels that are boring** — The tutorial IS the game. If the tutorial isn't fun, players quit before reaching the "real" game.
- **Overreliance on text or UI for guidance** — If you need a waypoint marker to prevent players from getting lost, the level layout itself has failed. Fix the layout first, add markers as a secondary aid.
- **Designing for yourself instead of the player** — You know the solution. The player doesn't. What feels "obvious" to you is often invisible to a first-time player.

## Designer Philosophy

- **Shigeru Miyamoto**: "A good game is one that you can always feel you are progressing in."
- **Hidetaka Miyazaki**: "The environment should make you wonder what happened here."
- **Jenova Chen**: "I want players to feel a sense of journey."
- **Jonathan Blow**: "Every puzzle should feel like a genuine insight."
- **Fumito Ueda**: "Minimalism in design amplifies emotional impact."

## Sources

- GDC Vault — Level design talks (particularly "The Level Design of God of War," "Designing Unforgettable Levels," "10 Principles of Good Level Design")
- *Level Up! The Guide to Great Video Game Design* — Scott Rogers
- Nintendo design philosophy — Miyamoto's "garden" approach to level design
- *A Theory of Fun for Game Design* — Raph Koster
- *The Art of Game Design: A Book of Lenses* — Jesse Schell
- *Dark Souls* postmortems — Miyazaki on environmental storytelling and interconnected world design
- *Journey* postmortem — Jenova Chen on flow and emotional pacing
- *The Witness* developer commentary — Jonathan Blow on puzzle integrity and mechanic honesty
