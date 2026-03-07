# Level Design Document: [Level Name]

## Overview

- **Level Name**: [Name]
- **Type**: [Tutorial / Early / Mid / Late / Endgame / Optional / Social Hub]
- **Position in Progression**: [Where this sits in the overall game — after what, before what]
- **Estimated Playtime**: [First playthrough time]
- **Replayability**: [None / Low / Medium / High — and why]
- **Primary Mechanics Tested**: [List the mechanics this level focuses on]

---

## Layout

### Top-Down Sketch

```
[Draw a simple ASCII map of the level layout]

Example:
  ┌─────────────────────────────────┐
  │  START                          │
  │    ↓                            │
  │  [Safe Zone] → [Challenge 1]    │
  │                    ↓            │
  │              [Rest Area]        │
  │                    ↓            │
  │              [Challenge 2] → [Secret] │
  │                    ↓            │
  │              [Peak Encounter]   │
  │                    ↓            │
  │                 [EXIT]          │
  └─────────────────────────────────┘
```

### Flow Description

[Describe the intended player path through the level. Where are choices? Where are bottlenecks? Where can players explore off the main path?]

### Points of Interest

| # | Name | Type | Purpose |
|---|------|------|---------|
| 1 | [Name] | [Start / Safe / Challenge / Rest / Secret / Exit] | [Why it exists] |
| 2 | [Name] | [Type] | [Purpose] |

---

## Encounters / Challenges

| # | Name | Type | Difficulty (1-10) | Mechanics Tested | Estimated Time |
|---|------|------|-------------------|-----------------|---------------|
| 1 | [Name] | [Combat / Puzzle / Exploration / Skill Check] | [1-10] | [Mechanics] | [Time] |
| 2 | [Name] | [Type] | [1-10] | [Mechanics] | [Time] |

---

## Pacing Graph

```
Intensity
10 │              ████
 8 │          ████    ██
 6 │      ████            ██
 4 │  ████                    ████
 2 │██                            ██
 0 └──────────────────────────────────
   Start    Mid              End
```

**Target rhythm**: [Describe the intended pacing — e.g., "gradual ramp with a rest before the peak, then quick resolution"]

---

## Mechanics

### Introduced in This Level

| Mechanic | How It's Taught | First Use | Test | Twist |
|----------|----------------|-----------|------|-------|
| [Mechanic] | [Environmental hint / NPC / Forced use] | [Where] | [Where] | [Where, if any] |

### Assumed Known

[List mechanics the player should already understand from previous levels]

---

## Secrets & Optional Content

| # | Name | How to Find | Reward | Difficulty |
|---|------|------------|--------|-----------|
| 1 | [Name] | [Hidden path / puzzle / exploration] | [What player gets] | [1-10] |

---

## Environmental Storytelling

| Location | Story Beat | How It's Conveyed |
|----------|-----------|-------------------|
| [Where] | [What story is told] | [Visual cues / audio / items / NPC dialogue] |

---

## Technical Requirements

### Assets Needed

- **Environment**: [Terrain, structures, props]
- **Characters**: [NPCs, enemies specific to this level]
- **Audio**: [Ambient sounds, music track, SFX]
- **UI**: [Any level-specific UI elements]

### Performance Considerations

[Any performance concerns? Large number of entities? Complex lighting? Streaming requirements?]

---

## Accessibility

- [ ] Clear visual language for interactive elements
- [ ] Colorblind-friendly indicators (not color-only)
- [ ] Audio cues have visual alternatives
- [ ] Text is readable at target resolution
- [ ] Difficulty can be adjusted without breaking the level
- [ ] No required quick-time events without alternatives
- [ ] Navigation is clear (no confusing dead ends)

---

## Playtesting Questions

Answer these after playtesting:

1. Did players understand where to go?
2. Did the difficulty curve feel right?
3. Were there any frustration points?
4. Did players find the secrets?
5. How long did it actually take vs. estimate?
6. Did the pacing feel right or were there dead spots?
7. Was the mechanic introduction clear?
8. Did environmental storytelling land?
