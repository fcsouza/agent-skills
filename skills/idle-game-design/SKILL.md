---
name: idle-game-design
version: 1.0.0
description: >-
  Use when designing idle/incremental game mechanics — prestige systems,
  exponential scaling, big number math, offline progress calculation,
  upgrade trees, automation unlocks, resource generators, ascension layers,
  or balancing idle economies.
---

# Idle Game Design

Design patterns, formulas, and architecture for idle/incremental games.

---

## Core Loop Anatomy

Every idle game is a nested loop:

```
Generator → Resource → Upgrade → Multiplier → Prestige → Meta-currency → Loop
```

| Element | Role | Example |
|---------|------|---------|
| **Generator** | Produces resources over time | Cookie grandmas, antimatter dimensions |
| **Resource** | Primary currency spent on upgrades | Cookies, gold, antimatter |
| **Upgrade** | Increases generator output or unlocks new generators | "Grandmas are 2x faster" |
| **Multiplier** | Stacking bonuses that scale production globally | Achievements, milestones, synergies |
| **Prestige** | Sacrifice progress for permanent meta-currency | Heavenly chips, infinity points |
| **Meta-currency** | Permanent upgrades that persist across resets | Prestige shop items |
| **Loop** | The cycle restarts with boosted power | Each run faster than the last |

**The 30-second test**: If the core loop isn't engaging within 30 seconds of play, it needs rework. Players should feel the generator-resource-upgrade cycle immediately.

---

## Resource Systems

### Growth Curves

| Type | Formula | Feel |
|------|---------|------|
| Linear | `base + (level * increment)` | Boring fast — production never outpaces costs |
| Polynomial | `base * level^exponent` | Better — noticeable power spikes |
| Exponential | `base * multiplier^level` | Standard for idle — dramatic scaling |

### Cost Scaling

```typescript
const cost = (baseCost: number, multiplier: number, owned: number): number =>
  baseCost * multiplier ** owned;
```

Typical multipliers: 1.07 (slow), 1.15 (standard), 1.5 (aggressive).

### Production

```typescript
const production = (
  baseRate: number,
  count: number,
  bonusPercent: number,
  globalMultiplier: number,
): number => baseRate * count * (1 + bonusPercent / 100) * globalMultiplier;
```

For full formula catalog with bulk-buy, max-affordable, and diminishing returns, read `references/formulas.md`.

---

## Prestige / Ascension

**What it is**: Sacrifice all current progress in exchange for a permanent meta-currency that provides multipliers on the next run.

**When to trigger**: When progress slows meaningfully — the player should feel "stuck" but see a clear prestige reward that makes the next run significantly faster.

### Prestige Currency Conversion

```typescript
const prestigeCurrency = (lifetimeEarned: number): number =>
  Math.floor(150 * Math.sqrt(lifetimeEarned / 1e10));
```

### Multi-Layer Prestige (Antimatter Dimensions Pattern)

| Layer | Resets | Currency | Unlocks |
|-------|--------|----------|---------|
| Layer 1 (Prestige) | Base generators + resources | Prestige points | Prestige upgrades |
| Layer 2 (Transcend) | Layer 1 + prestige points | Transcend points | Transcend upgrades |
| Layer 3 (Ascend) | Everything below | Ascension points | Ascension upgrades |

### Reset Scope

Each prestige layer must clearly define:
- **Resets**: Resources, generators, upgrades from lower layers
- **Persists**: Meta-currency, meta-upgrades, achievements, statistics
- **Design rule**: Each prestige should roughly 2x progress speed initially

For detailed prestige layer design and progression pacing, read `references/progression-patterns.md`.

---

## Offline Progress

| Strategy | Pros | Cons | Best For |
|----------|------|------|----------|
| **Fast-forward ticks** | Accurate simulation | CPU-heavy; cap iterations (max ~1000) | Complex systems with events |
| **Analytical formula** | Instant calculation | Only works for simple math | Pure resource generation |
| **Hybrid** | Best of both | More code | Analytical for resources, tick for events/unlocks |

### Anti-Exploit

- Cap offline time at **24 hours**
- Full efficiency for first **4 hours**
- **50% efficiency** after 8 hours
- **25% efficiency** after 16 hours

```typescript
const offlineEfficiency = (seconds: number): number => {
  const hours = seconds / 3600;
  if (hours <= 4) return 1.0;
  if (hours <= 8) return 0.5;
  return 0.25;
};
```

For tiered offline formulas, read `references/formulas.md`.

---

## Big Numbers

### When to Introduce

Past **1e6** — once numbers exceed what players can quickly read, switch to abbreviated formats.

### Display Formats

| Range | Format | Example |
|-------|--------|---------|
| < 1e6 | Raw with commas | 999,999 |
| 1e3–1e15 | Suffix notation | 1.23K, 4.56M, 7.89B, 1.23T |
| > 1e15 | Scientific | 1.23e15, 4.56e42 |

### Libraries

| Library | Range | Speed | Use When |
|---------|-------|-------|----------|
| `break_infinity.js` | Up to 1e9e15 | Fast | Most idle games |
| `decimal.js` | Arbitrary precision | Slower | Need exact math beyond 1e308 |

### Formatting Function

```typescript
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

const formatNumber = (value: number, decimals = 2): string => {
  if (value < 1e3) return value.toFixed(0);
  if (value >= 1e36) return value.toExponential(decimals);
  const tier = Math.floor(Math.log10(value) / 3);
  const scaled = value / 10 ** (tier * 3);
  return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
};
```

For `break_infinity.js` patterns and Decimal comparison operators, read `references/formulas.md`.

---

## Automation

Progressive automation makes each layer idle:

| Unlock Order | Automates | Player Focus Shifts To |
|-------------|-----------|----------------------|
| 1. Manual clicking | Nothing | Clicking generators |
| 2. Auto-generators | Resource production | Choosing upgrades |
| 3. Auto-upgraders | Upgrade purchasing | Prestige timing |
| 4. Auto-prestige | Prestige resets | Meta-strategy, layer 2+ |

### Design Principles

- Each automation layer should unlock **after** the player has mastered that mechanic manually
- Automation makes the **previous** loop idle, not the current one
- Managers/automation should be upgradeable (speed, efficiency, priority)
- Gate automation behind prestige currencies or milestone achievements

---

## Balancing Quick Reference

| Tuning Knob | Low Value | High Value | Effect |
|-------------|-----------|------------|--------|
| Cost multiplier | 1.05 | 1.50 | Low = generators stay cheap, fast scaling. High = each purchase meaningful |
| Production scaling | Linear | Exponential | Low = slow, predictable. High = dramatic power spikes |
| Prestige threshold | 1e6 | 1e12 | Low = frequent resets, fast loop. High = longer runs, bigger payoff |
| Offline cap | 4h | 24h | Low = encourages check-ins. High = casual-friendly |
| Offline efficiency | 25% | 100% | Low = rewards active play. High = pure idle |
| Automation unlock | Early | Late | Early = casual focus. Late = mastery required |
| Prestige multiplier | 1.5x | 10x | Low = incremental gains. High = dramatic power jumps |

### Golden Rules

1. **Costs should grow ~10-15% faster than production** to ensure prestige feels necessary
2. **First prestige at 30-60 minutes** for web games, 2-4 hours for mobile
3. **Never let the player feel stuck for more than 5 minutes** without a clear path forward
4. **Each prestige run should be 30-50% faster** than the previous one

---

## Cross-References

| Need | Skill |
|------|-------|
| Game architecture and implementation | `game-architecture` |
| RPG systems for idle-RPG hybrids | `rpg-systems` |
| Visual assets and procedural generation | `game-asset-gen` |

---

## When to Read Reference Files

| If you need… | Read |
|--------------|------|
| Complete formula catalog with TypeScript code | `references/formulas.md` |
| Progression pacing, unlock sequencing, case studies | `references/progression-patterns.md` |
| React + Tailwind UI components for idle games | `references/ui-patterns.md` |
