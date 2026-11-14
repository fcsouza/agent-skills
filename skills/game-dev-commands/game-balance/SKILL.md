---
name: game-balance
description: Analyzes the economy, difficulty curve, progression costs and reward schedules in docs/mvp-first-draft.md and reports imbalances by severity. Use when the MVP plan exists and you want it checked for balance before building. It takes a scope in `$ARGUMENTS` (economy, difficulty, progression, rewards or all) and falls back to the user's message.
argument-hint: '"economy", "difficulty", "progression", "rewards", or "all" (default: all)'
---

# Game Balance: Balance Analyzer

## Requires

- `game-economy-design`
- `game-design-fundamentals`
- `skill-progression-trees`

Before you apply a skill listed here, check that it is installed. If it is not, name it, give this install line, and stop: `bunx skills add fcsouza/agent-skills --skill <name>`.

## Prerequisites

- `docs/mvp-first-draft.md` exists in the project (run `/game-architect` first to create it)

## Phase 0: Load context

Input: `$ARGUMENTS`. If it is empty, take it from the user's message.

1. Read `docs/mvp-first-draft.md`. If it does not exist, output "Cannot proceed: docs/mvp-first-draft.md not found. Run /game-architect first to create the MVP plan." and stop.
2. Pick the phases from the scope:
   - empty or "all": Phases 1 to 4
   - "economy": Phase 1
   - "difficulty": Phase 2
   - "progression": Phases 2 and 3
   - "rewards": Phases 1 and 4
3. Apply the skills the chosen phases need: `game-economy-design` for Phases 1 and 4, `game-design-fundamentals` for Phases 2 and 4, `skill-progression-trees` for Phase 3.
4. Read `docs/build-registry.md` and `docs/quest-registry.md` if they exist. Phase 4 cross-checks quest rewards against the economy.
5. From the plan, extract the genre and core loop, currencies with their faucets and sinks, difficulty settings, progression systems with cost tables, and reward tables and schedules.

A value the plan does not define is a gap, not a pass. Record it as "not defined" and report it in Phase 5.

## Phase 1: Economy

Apply `game-economy-design`. That skill gives no universal target ranges, so do not invent any. Judge each value against the plan's own intent and against the simulation below.

1. For each currency, list the faucets and sinks the plan defines. Mark a currency with a faucet and no sink as a finding.
2. Simulate. Turn the plan's per-stage rates into stages with `hours`, `faucetPerHour` and `sinkPerHour`. Run `simulateStages` from `game-economy-design/boilerplate/economy-simulator.ts`, or edit the example stages in that file and run `bun boilerplate/economy-simulator.ts` from that skill's directory. Read each stage's `net`, `balanceRatio` and `endBalance`. A stage with a high positive `balanceRatio` inflates, and a negative one drains the player. Compare both with what the plan intends for that stage. If the plan has no per-hour rates, say so and ask the user for them instead of guessing.
3. Check the pitfalls listed in `game-economy-design`: hyperinflation, dead economy, currency confusion, early abundance, exploit loops (stack splits, trades, craft-sell-buy cycles, uncapped offline activity). For premium currency or purchases that sell power, apply its monetization step and `stripe-game-payments`.

## Phase 2: Difficulty

Apply `game-design-fundamentals` (Difficulty section).

1. From the plan, write down how challenge rises across early, mid, late and endgame. Check that challenge rises after successes, that rests exist, and that the first levels are easy.
2. Check the pitfalls in that skill: flat difficulty curve, penalties that permanently remove long-earned power, no selectable difficulty where the plan relies on dynamic difficulty, and dominant strategies in skill-challenge steps.
3. Onboarding belongs to `ui-ux-game`. If the plan treats the tutorial as a separate mode, report it and point there.

## Phase 3: Progression costs

Apply `skill-progression-trees`.

1. List each progression system and its cost structure (flat, linear, exponential, other).
2. Flag flat costs: late nodes get cheap as income grows. The skill gives `cost = baseCost * tier^exponent` and says to tune the exponent against player income per tier. Compare the plan's income per tier with its costs. If the plan has no income figures, report that gap.
3. Flag a missing respec, unlock state held on the client, and effects hardcoded in code instead of data. The server must validate unlocks: the client can be edited and drifts from the server.

## Phase 4: Reward schedules

Apply `game-design-fundamentals` (Rewards and punishment section).

1. For quest rewards, daily login, loot drops and achievements, record the schedule and whether it varies. Check that reward types are mixed and that reward value rises as play proceeds.
2. Flag too many rewards too fast (each one weakens), forced daily streaks (a penalty for not playing), and rewards with nothing to spend them on (a Phase 1 dead economy).
3. Drop tables and pity counters follow `game-economy-design`. Quest coherence follows `quest-narrative-coherence`.
4. If `docs/quest-registry.md` exists, compare quest reward amounts with the Phase 1 simulation.

## Phase 5: Report

Severity levels:

- Critical: blocks a healthy launch. Examples: a faucet with no sink, an exploitable loop, unlock state on the client, a parameter the plan needs but does not define.
- Warning: recoverable, fix before launch.
- Note: optional improvement.

Give every Critical and Warning finding a specific fix and name the skill and the rule behind it. Do not state a finding the skills do not support. Output:

```markdown
# Balance Report: [game name] ([current date])

## Summary
Critical: [count]
Warnings: [count]
Healthy systems: [count]

[No critical issues: "No blockers found."]
[Critical issues: "[count] critical issue(s) to resolve before building."]

## Economy [only if analyzed]
[stage table from the simulation, pitfall findings]

## Difficulty [only if analyzed]
[curve summary, findings]

## Progression costs [only if analyzed]
[table: system, cost structure, issue]

## Reward schedules [only if analyzed]
[table: reward type, schedule, varies, assessment]

## Recommended actions

### Critical
1. [Issue]: [fix] (skill-name: rule)

### Warnings
1. [Issue]: [fix] (skill-name: rule)

### Notes
1. [Suggestion] (skill-name: rule)
```

## Tasks for the user

These need a person. List them in the report when the plan leaves a gap you cannot fill:

- Real faucet and sink rates per hour, if the plan has none.
- Playtests at several skill levels. A short test cannot confirm flow, and one tester's verdict on feel is not enough (`game-design-fundamentals`).
- Target ranges for money supply, price index and wealth spread, set from playtest data.
