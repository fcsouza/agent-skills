---
name: quest-mission-design
description: Defines the quest type list, objective trees, quest briefs and reward rules for any game genre. Use when designing a quest, mission, quest chain or reward structure, or when a quest feels like a fetch task with no point.
---

# Quest and Mission Design

Apply `quest-narrative-coherence` before you design any quest, and again at the end to register it. It owns the five-step check and the registry format. This skill does not repeat them.

## Quest types

One list, used in the quest brief, in `docs/quest-registry.md` and in the `QuestType` union in `boilerplate/quest-system.ts`.

| Type | Use for |
|------|---------|
| `main` | Advances the primary story arc |
| `faction` | Advances one faction's storyline and standing |
| `side` | Optional, enriches the world |
| `chain` | Several steps, each unlocks the next |
| `repeatable` | Can be done more than once |
| `discovery` | Starts from exploration |
| `social` | Needs other players |
| `timed` | Has a deadline |
| `collection` | Gather a set of items |
| `escort` | Keep a target safe |

A quest of any type can contain a choice. A choice is an objective, not a type.

## Steps

1. Apply `quest-narrative-coherence` steps 1 to 4.
2. Pick the type from the list above.
3. Design the objective tree (below).
4. Set rewards. Check the scale against `game-economy-design` and against similar quests in the registry.
5. Write the brief. Copy `templates/quest-template.md` when you start a brief.
6. Apply `quest-narrative-coherence` step 5 to register the quest.

## Rules

- Main and faction quests have at least two ways to complete them. Other types may be linear.
- A quest that is mechanically simple needs a narrative reason. A collection quest says why the items matter and asks for a reasonable count.
- Write the required action in plain words. Put the mystery in the story, not in what the player has to do.
- Make the goal obvious, show progress, and give a stuck player a hint. These are Schell's puzzle principles; they apply to puzzle objectives.
- Keep quest text short.
- In a persistent shared economy, prefer goods over coin as rewards, so their value floats with supply and demand. Goods still inflate if everyone gets the same one.
- Vary quest types in a sequence. Do not stack several of one type in a row.
- Do not open many quests at once. A map full of markers makes the player lose track of the story.

## Objective tree

Read `boilerplate/quest-system.ts` when you implement the tree and the quest state machine. It has the types, the transitions between states and the completion logic.

```
Quest: [Name]
├── Objective 1: [Required]
│   ├── 1a: [Required]
│   └── 1b: [Optional bonus]
├── Objective 2: [Choice A or Choice B]
│   ├── A: [Path, consequence X]
│   └── B: [Path, consequence Y]
└── Objective 3: [Final, depends on the choice]
```

## Pitfalls

- A collection quest with no reason.
- Rewards that inflate the economy.
- A main or faction quest with one solution.
- An NPC who talks for minutes while the player does nothing.
- A prerequisite the player cannot discover.

## Related

- `quest-narrative-coherence`: the check and the registry.
- `references/sources.md`: read when you need the support for the rules above.
- `game-economy-design`: reward scale.
- `worldbuilding`: world context for the setting.
- `character-design-narrative`: NPC roles.
- `postgres-game-schema`: persisting quest state.
