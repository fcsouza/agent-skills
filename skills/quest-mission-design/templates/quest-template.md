# Quest Design: [Quest Name]

## Coherence Check
- [ ] Step 1: World state loaded (read world-lore.md)
- [ ] Step 2: Quest registry checked (read quest-registry.md)
- [ ] Step 3: Validated against existing content
- [ ] Step 4: References existing lore element: ___________
- [ ] Step 5: Registered in quest-registry.md

## Overview

- **Quest ID**: [Unique identifier]
- **Name**: [Display name]
- **Type**: [Main Story / Side Quest / Chain / Branching / Repeatable / Discovery / Social / Timed]
- **Arc**: [Which story arc this belongs to]
- **Difficulty**: [1-10]
- **Estimated Duration**: [Time to complete]
- **Repeatable**: [Yes / No]
- **Prerequisites**: [Other quests, level requirements, faction standing]

## Story Context

### Why This Quest Exists
[What narrative purpose does this quest serve? What does it reveal about the world?]

### Lore Connection
[Which existing lore element does this quest reference or expand?]

### Narrative Thread
[Which ongoing story arc does this advance?]

## NPCs Involved

| NPC | Role in Quest | Faction | Current Status |
|-----|-------------|---------|---------------|
| [Name] | [Quest giver / Target / Ally / Antagonist] | [Faction] | [Alive, available] |

## Objectives

### Objective Tree

```
[Quest Name]
├── Obj 1: [Description] — [Required/Optional]
├── Obj 2: [Description] — [Choice A / Choice B]
│   ├── A: [Path and consequence]
│   └── B: [Path and consequence]
└── Obj 3: [Final objective]
```

### Detailed Objectives

| # | Objective | Type | Required | Success Condition | Fail Condition |
|---|-----------|------|----------|------------------|---------------|
| 1 | [Description] | [Go to / Interact / Defeat / Collect / Choose / Protect] | [Yes/No] | [What counts as success] | [What counts as failure, if any] |

## Branching Paths (if applicable)

| Choice | Consequence | Faction Impact | Reward Difference |
|--------|------------|---------------|-------------------|
| [Choice A] | [What happens] | [Who likes/dislikes this] | [Reward variation] |
| [Choice B] | [What happens] | [Who likes/dislikes this] | [Reward variation] |

## Rewards

| Reward | Type | Amount | Condition |
|--------|------|--------|-----------|
| [Reward] | [Currency / Item / XP / Unlock / Reputation] | [Amount] | [Completion / Bonus / Choice-dependent] |

### Economy Check
- [ ] Reward amount reviewed against `game-economy-design` guidelines
- [ ] No reward inflation (compared to similar-level quests in registry)
- [ ] Sink included if reward is large (cost to start quest, material requirements)

## Locations

| Location | Purpose in Quest | Exists in World? |
|----------|-----------------|-----------------|
| [Location] | [Where objective happens] | [Yes — existing / No — needs creation] |

## Dialogue Summary

| Beat | Speaker | Content Summary | Player Choices |
|------|---------|----------------|---------------|
| [Intro] | [NPC] | [What they say] | [Accept / Decline / Ask more] |
| [Mid] | [NPC] | [Update/twist] | [Choice A / Choice B] |
| [End] | [NPC] | [Resolution] | [None — cutscene] |

## Quest Registry Entry

```
ID: [quest_id]
Name: [Quest Name]
Arc: [Arc name]
NPCs: [NPC1, NPC2]
Locations: [Loc1, Loc2]
Factions: [Affected factions]
Rewards: [Summary]
Prerequisites: [quest_ids or conditions]
Status: [planned / active / completed]
```
