---
description: Analyzes a game system against plugin design principles — economy health metrics, difficulty curve, reward schedules, and progression cost curves. Flags imbalances with severity levels.
argument-hint: "economy", "difficulty", "progression", "rewards", or "all" (default: all)
---

# Game Balance — Balance Analyzer Command

## Phase 0 — Context Load (silent, mandatory)

Execute in this exact order:

1. READ `docs/mvp-first-draft.md`
   - If it does NOT exist: output `⛔ Cannot proceed. docs/mvp-first-draft.md not found. Run /game-dev:game-architect first to generate the MVP plan before running a balance analysis.` and stop.
2. Determine scope from `$ARGUMENTS`:
   - If empty or "all": analyze all systems (Phases 1–4)
   - If "economy": run Phase 1 only
   - If "difficulty": run Phase 2 only
   - If "progression": run Phases 2 + 3
   - If "rewards": run Phases 1 + 4
3. Load skills based on scope:
   - economy or all → READ `${CLAUDE_PLUGIN_ROOT}/design/game-economy-design/SKILL.md`
   - difficulty or progression or all → READ `${CLAUDE_PLUGIN_ROOT}/design/game-design-fundamentals/SKILL.md`
   - progression or all → READ `${CLAUDE_PLUGIN_ROOT}/design/skill-progression-trees/SKILL.md`
4. READ `docs/build-registry.md` if it exists
5. READ `docs/quest-registry.md` if it exists (for reward cross-reference in Phase 4)

Extract from `docs/mvp-first-draft.md`:
- Game genre and core loop description
- Currency types and economy parameters (faucets, sinks, amounts)
- Difficulty settings and intended player progression
- Progression system details (skill trees, level gates, cost tables)
- Reward tables and schedules

## Phase 1 — Economy Health Check

*Skip this phase entirely if $ARGUMENTS is "difficulty" or "progression".*

Apply the Economy Health Metrics table from `game-economy-design`. For each metric, find the relevant value in `docs/mvp-first-draft.md` (or flag as "not defined"):

| Metric | Target Range | Found in Plan | Status |
|--------|------------|--------------|--------|
| Daily currency earn/spend ratio | 0.8–1.2 | [value or "not defined"] | 🟢/🟡/🔴 |
| Median player currency held | 2–5× avg purchase cost | [value or "not defined"] | 🟢/🟡/🔴 |
| Premium conversion rate | 2–5% of active players | [value or "not defined"] | 🟢/🟡/🔴 |
| Time to first meaningful purchase | 5–15 minutes | [value or "not defined"] | 🟢/🟡/🔴 |

Status legend:
- 🟢 Within target range
- 🟡 Outside range but recoverable — specific fix suggested
- 🔴 Critical imbalance or not defined at all — blocks healthy launch

Also check for these anti-patterns from the skill:
- **Hyperinflation** — unlimited currency faucets with no corresponding sinks → 🔴 CRITICAL
- **Pay-to-win** — premium currency or IAP that grants direct gameplay power → 🔴 CRITICAL
- **Currency confusion** — more than 3 currency types without clear differentiation → 🟡 WARNING
- **Dead economy** — currency accumulates with nothing interesting to buy → 🟡 WARNING
- **Early abundance** — excessive rewards in first 10 minutes that devalue later rewards → 🟡 WARNING
- **Exploitable loops** — crafting or trading paths that generate infinite value → 🔴 CRITICAL

For each flagged issue, cite the specific skill principle: e.g., `[→ design-game-economy-design: every faucet needs a sink]`

## Phase 2 — Difficulty & Flow Channel Check

*Skip this phase entirely if $ARGUMENTS is "economy" or "rewards".*

Apply the flow channel framework from `game-design-fundamentals` (Csikszentmihalyi principle: challenge must scale with skill).

Analyze the intended difficulty curve from mvp-first-draft.md against the four progression phases:

| Phase | Expected Pattern | Found in Plan | Assessment |
|-------|----------------|--------------|------------|
| Early game | Rapid unlocks, teaching mechanics, high success rate | [from plan] | 🟢/🟡/🔴 |
| Mid game | Meaningful choices, branching paths, ~65% success rate | [from plan] | 🟢/🟡/🔴 |
| Late game | Mastery optimization, meaningful challenge | [from plan] | 🟢/🟡/🔴 |
| Endgame | Social/competitive/infinite scaling | [from plan] | 🟢/🟡/🔴 |

Check for these anti-patterns from the skill:
- **Flat difficulty curve** — no meaningful challenge increase → 🔴 (players master and leave)
- **Punishing failure** — harsh penalties that discourage experimentation → 🟡
- **Tutorial as separate experience** — tutorial feels disconnected from core gameplay → 🟡
- **Single player-type focus** — designed exclusively for one Bartle type → 🟡
- **Boredom cliff** — player masters the game too quickly → 🔴

The getDifficultyMultiplier formula from the skill: `1 + (playerSuccessRate - targetSuccessRate) * 0.3` — note if the plan accounts for adaptive difficulty or not.

For each flagged issue, cite the skill: `[→ design-game-design-fundamentals: flow channel — challenge must scale with skill]`

## Phase 3 — Progression Cost Curve Check

*Skip this phase entirely if $ARGUMENTS is "economy", "difficulty", or "rewards".*

Apply the cost scaling principles from `skill-progression-trees`.

**Expected formula:** `cost = baseCost × tier^exponent` where exponent should be 1.5–2.0.

Analyze the plan's progression costs:

| Progression System | Cost Structure in Plan | Expected Formula Applied? | Issue |
|-------------------|----------------------|--------------------------|-------|
| [system 1 from plan] | [flat / linear / exponential] | 🟢/🟡/🔴 | [if flagged] |
| [system 2 from plan] | ... | ... | ... |

Check for these anti-patterns from the skill:
- **Flat cost curves** — every node/level costs the same → 🟡 (endgame nodes become trivially cheap as income scales)
- **Missing respec mechanic** — players locked into bad choices permanently → 🟡
- **All nodes visible upfront** — full tree shown immediately, spoiling discovery → 🟡
- **Client-side tree state** — plan mentions client-side unlock validation → 🔴 CRITICAL
- **Hardcoded effects** — effects in code instead of data config → 🟡

For each flagged issue, cite the skill: `[→ design-skill-progression-trees: cost = baseCost * tier^exponent]`

## Phase 4 — Reward Schedule Check

*Skip this phase entirely if $ARGUMENTS is "difficulty" or "progression".*

Apply reward schedule principles from `game-design-fundamentals` (variable ratio > fixed ratio — B.F. Skinner principle).

Analyze the reward structure:

| Reward Type | Schedule in Plan | Variable? | Assessment |
|-------------|----------------|-----------|------------|
| Quest rewards | [fixed / variable] | [yes/no] | 🟢/🟡/🔴 |
| Daily login | [fixed / variable] | [yes/no] | 🟢/🟡/🔴 |
| Loot drops | [fixed / variable] | [yes/no] | 🟢/🟡/🔴 |
| Achievement rewards | [fixed / variable] | [yes/no] | 🟢/🟡/🔴 |

If `docs/quest-registry.md` exists, cross-reference quest reward amounts against the economy metrics from Phase 1.

Check for these anti-patterns:
- **Reward inflation** — too many rewards too fast; all future rewards feel devalued → 🟡
- **Predictable schedules** — fixed ratio rewards sustain engagement much less than variable → 🟡
- **Nothing to spend on** — rewards accumulate with no meaningful sink → connects to Phase 1 dead economy → 🔴

For each flagged issue, cite the skill: `[→ design-game-design-fundamentals: variable ratio reward schedules sustain engagement longer]`

## Phase 5 — Balance Report

Output the complete report:

```markdown
# Balance Report — [game name from mvp-first-draft.md] — [current date]

## Executive Summary
🔴 Critical issues: [count]
🟡 Warnings: [count]
🟢 Healthy systems: [count]

[If 0 critical issues]: ✅ No blockers found — safe to proceed with current design.
[If critical issues exist]: ⛔ [count] critical issue(s) must be resolved before launch.

---

## Economy Health [only if analyzed]
[metrics table from Phase 1]
[anti-pattern findings]

## Difficulty Curve [only if analyzed]
[phase table from Phase 2]
[anti-pattern findings]

## Progression Costs [only if analyzed]
[table from Phase 3]
[anti-pattern findings]

## Reward Schedules [only if analyzed]
[table from Phase 4]
[anti-pattern findings]

---

## Recommended Actions

### 🔴 Critical (resolve before building)
1. [Issue description] — [specific fix] `[→ skill-name: principle]`
...

### 🟡 Warnings (address before launch)
1. [Issue description] — [specific fix] `[→ skill-name: principle]`
...

### 🟢 Notes (optional improvements)
1. [Suggestion] `[→ skill-name: principle]`
...
```

---

## Hard Constraints

1. **Always cite the skill** for every flagged issue — no undocumented opinions
2. **Never flag "not defined" as healthy** — undefined parameters are 🔴 by default (you can't launch without them)
3. **Pay-to-win is always 🔴 CRITICAL** — no exceptions
4. **Client-side game state is always 🔴 CRITICAL** — server-authoritative is non-negotiable
5. **Provide a specific fix** for every 🔴 and 🟡 finding — do not just flag without recommendation
