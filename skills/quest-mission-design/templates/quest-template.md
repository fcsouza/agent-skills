# Quest Design: [Quest Name]

## Coherence Check

Complete `quest-narrative-coherence` before this brief and tick its checklist.

## Overview

- **Quest ID**: [Unique identifier]
- **Name**: [Display name]
- **Type**: [main / faction / side / chain / repeatable / discovery / social / timed / collection / escort]
- **Story Arc**: [Which story arc this belongs to]
- **Difficulty**: [1-10]
- **Estimated Duration**: [Time to complete]
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
| 1 | [Description] | [fetch / kill / escort / explore / craft / social / puzzle / choice] | [Yes/No] | [What counts as success] | [What counts as failure, if any] |

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
- [ ] Reward amount reviewed against `game-economy-design`
- [ ] No reward inflation (compared to similar-level quests in registry)
- [ ] Sink included if reward is large (cost to start, material requirements)

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

## Quest Registry Row

Append to the Active Quests table in `docs/quest-registry.md`:

```
| [Quest ID] | [Name] | [Type] | [Quest Giver NPC] | [Primary Location] | [Factions Affected] | [Rewards Summary] | [Prerequisites] | [Story Arc] |
```
