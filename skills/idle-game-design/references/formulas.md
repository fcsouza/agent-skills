# Idle Game Formulas

Complete formula catalog with TypeScript implementations for idle/incremental games.

---

## Cost Formulas

### Linear Cost

Flat increment per level. Rarely used alone — too easy to outpace.

```typescript
const linearCost = (base: number, level: number, increment: number): number =>
  base + level * increment;
```

### Polynomial Cost

Power curve. Good for mid-game pacing.

```typescript
const polynomialCost = (base: number, level: number, exponent: number): number =>
  base * level ** exponent;
```

### Exponential Cost (Most Common)

Standard idle game cost scaling. Each purchase multiplies cost.

```typescript
const exponentialCost = (base: number, multiplier: number, level: number): number =>
  base * multiplier ** level;
```

Typical multipliers by game feel:

| Multiplier | Feel |
|-----------|------|
| 1.07 | Very gradual, long sessions between prestiges |
| 1.10 | Smooth, standard for most idle games |
| 1.15 | Noticeable jumps, encourages prestige |
| 1.25 | Aggressive, short runs |
| 1.50 | Very aggressive, rapid prestige cycling |

### Bulk Buy (Sum of N Purchases)

Geometric series — total cost to buy N items starting from current level:

```typescript
const bulkBuyCost = (
  base: number,
  multiplier: number,
  currentLevel: number,
  quantity: number,
): number => {
  if (multiplier === 1) return base * quantity;
  const currentCost = base * multiplier ** currentLevel;
  return currentCost * (multiplier ** quantity - 1) / (multiplier - 1);
};
```

### Max Affordable

How many items can the player buy with their current currency:

```typescript
const maxAffordable = (
  currency: number,
  base: number,
  multiplier: number,
  currentLevel: number,
): number => {
  if (multiplier === 1) return Math.floor(currency / base);
  const currentCost = base * multiplier ** currentLevel;
  return Math.floor(
    Math.log(currency * (multiplier - 1) / currentCost + 1) / Math.log(multiplier),
  );
};
```

### Cost After Bulk Buy

Remaining currency after buying max affordable:

```typescript
const buyMax = (
  currency: number,
  base: number,
  multiplier: number,
  currentLevel: number,
): { bought: number; remaining: number; newLevel: number } => {
  const count = maxAffordable(currency, base, multiplier, currentLevel);
  const spent = bulkBuyCost(base, multiplier, currentLevel, count);
  return {
    bought: count,
    remaining: currency - spent,
    newLevel: currentLevel + count,
  };
};
```

---

## Production Formulas

### Base Production

```typescript
const baseProduction = (baseRate: number, count: number): number =>
  baseRate * count;
```

### Production with Bonuses

```typescript
const totalProduction = (
  baseRate: number,
  count: number,
  bonusPercent: number,
  globalMultiplier: number,
): number => baseRate * count * (1 + bonusPercent / 100) * globalMultiplier;
```

### Per-Second Display

```typescript
const perSecond = (productionPerTick: number, ticksPerSecond: number): number =>
  productionPerTick * ticksPerSecond;

const formatPerSecond = (value: number): string =>
  `${formatNumber(value)}/s`;
```

### Synergy Bonus

Bonus from owning multiple generator types:

```typescript
const synergyBonus = (
  generatorCounts: number[],
  synergyFactor: number,
): number => {
  const activeGenerators = generatorCounts.filter((c) => c > 0).length;
  return 1 + (activeGenerators - 1) * synergyFactor;
};
```

---

## Prestige Formulas

### Simple Prestige (Square Root)

Standard conversion — diminishing returns built in:

```typescript
const simplePrestige = (lifetimeEarned: number, threshold: number): number =>
  Math.floor(Math.sqrt(lifetimeEarned / threshold));
```

### Logarithmic Prestige

Slower growth, good for games with very large numbers:

```typescript
const logPrestige = (
  lifetimeEarned: number,
  threshold: number,
  scale: number,
): number => {
  if (lifetimeEarned < threshold) return 0;
  return Math.floor(Math.log10(lifetimeEarned / threshold) * scale);
};
```

### Scaled Prestige (Cookie Clicker Style)

```typescript
const scaledPrestige = (lifetimeEarned: number): number =>
  Math.floor(150 * Math.sqrt(lifetimeEarned / 1e10));
```

### Prestige Multiplier

How much the prestige currency boosts production:

```typescript
const prestigeMultiplier = (
  prestigeCurrency: number,
  baseMultiplier: number,
  diminishingFactor: number,
): number => 1 + prestigeCurrency * baseMultiplier / (prestigeCurrency + diminishingFactor);
```

### Multi-Layer Prestige

Each layer's currency is derived from the previous layer's lifetime earnings:

```typescript
interface PrestigeLayer {
  currency: number;
  lifetimeEarned: number;
  threshold: number;
  scale: number;
}

const calculateLayerCurrency = (
  layerBelow: PrestigeLayer,
): number => {
  if (layerBelow.lifetimeEarned < layerBelow.threshold) return 0;
  return Math.floor(
    Math.log10(layerBelow.lifetimeEarned / layerBelow.threshold) * layerBelow.scale,
  );
};

const performPrestige = (layers: PrestigeLayer[], layerIndex: number): PrestigeLayer[] => {
  const updated = [...layers];
  const gained = calculateLayerCurrency(updated[layerIndex - 1]);
  updated[layerIndex] = {
    ...updated[layerIndex],
    currency: updated[layerIndex].currency + gained,
    lifetimeEarned: updated[layerIndex].lifetimeEarned + gained,
  };
  // Reset all layers below
  for (let i = 0; i < layerIndex; i++) {
    updated[i] = { ...updated[i], currency: 0 };
  }
  return updated;
};
```

---

## Diminishing Returns

### Softcap

Halves gains above the cap:

```typescript
const softcap = (value: number, cap: number, reduction = 0.5): number => {
  if (value <= cap) return value;
  return cap + (value - cap) * reduction;
};
```

### Hardcap

Absolute maximum:

```typescript
const hardcap = (value: number, max: number): number =>
  Math.min(value, max);
```

### Logarithmic Softcap

Smooth curve above cap — feels fairer than linear softcap:

```typescript
const logSoftcap = (value: number, cap: number): number => {
  if (value <= cap) return value;
  return cap + cap * Math.log(value / cap + 1);
};
```

### Stacked Softcaps

Multiple softcap layers for extreme values:

```typescript
const stackedSoftcap = (
  value: number,
  caps: { threshold: number; reduction: number }[],
): number => {
  let result = value;
  for (const { threshold, reduction } of caps) {
    if (result > threshold) {
      result = threshold + (result - threshold) * reduction;
    }
  }
  return result;
};

// Example: gentle softcap at 1e6, harsh at 1e9
const balanced = stackedSoftcap(value, [
  { threshold: 1e6, reduction: 0.5 },
  { threshold: 1e9, reduction: 0.1 },
]);
```

---

## Offline Progress

### Simple Offline

```typescript
const simpleOffline = (
  productionPerSecond: number,
  elapsedSeconds: number,
  maxOfflineSeconds: number,
  offlineEfficiency: number,
): number => {
  const capped = Math.min(elapsedSeconds, maxOfflineSeconds);
  return productionPerSecond * capped * offlineEfficiency;
};
```

### Tiered Offline Efficiency

```typescript
interface OfflineTier {
  maxHours: number;
  efficiency: number;
}

const DEFAULT_TIERS: OfflineTier[] = [
  { maxHours: 4, efficiency: 1.0 },
  { maxHours: 8, efficiency: 0.5 },
  { maxHours: 24, efficiency: 0.25 },
];

const tieredOffline = (
  productionPerSecond: number,
  elapsedSeconds: number,
  tiers: OfflineTier[] = DEFAULT_TIERS,
): number => {
  let remaining = elapsedSeconds;
  let total = 0;
  let previousMax = 0;

  for (const { maxHours, efficiency } of tiers) {
    const tierSeconds = (maxHours - previousMax) * 3600;
    const used = Math.min(remaining, tierSeconds);
    total += productionPerSecond * used * efficiency;
    remaining -= used;
    previousMax = maxHours;
    if (remaining <= 0) break;
  }

  return total;
};
```

### Fast-Forward Tick Simulation

```typescript
const tickSimulation = (
  state: GameState,
  elapsedSeconds: number,
  tickDuration: number,
  maxTicks: number,
  tickFn: (state: GameState, dt: number) => GameState,
): GameState => {
  const totalTicks = Math.min(
    Math.ceil(elapsedSeconds / tickDuration),
    maxTicks,
  );
  const adjustedDt = elapsedSeconds / totalTicks;

  let current = state;
  for (let i = 0; i < totalTicks; i++) {
    current = tickFn(current, adjustedDt);
  }
  return current;
};
```

---

## Big Number Formatting

### Native Number Formatter

Works up to ~1e308 (JavaScript `number` limit):

```typescript
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

const formatNumber = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return 'Infinity';
  if (value < 0) return `-${formatNumber(-value, decimals)}`;
  if (value < 1e3) return value.toFixed(0);
  if (value >= 1e36) return value.toExponential(decimals);

  const tier = Math.floor(Math.log10(value) / 3);
  const scaled = value / 10 ** (tier * 3);
  return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
};
```

### break_infinity.js Patterns

```typescript
import Decimal from 'break_infinity.js';

// Creating values
const a = new Decimal(1e308);
const b = new Decimal('1e1000');
const c = Decimal.fromMantissaExponent(1.5, 500);

// Arithmetic
const sum = a.plus(b);
const product = a.times(b);
const power = a.pow(2);
const log = Decimal.log10(a);

// Comparisons
const isGreater = a.gt(b);
const isEqual = a.eq(b);
const isLessThan = a.lt(b);
const maxVal = Decimal.max(a, b);

// Formatting
const formatDecimal = (value: Decimal, decimals = 2): string => {
  if (value.lt(1e3)) return value.toFixed(0);
  if (value.lt(1e36)) {
    const tier = Math.floor(value.log10() / 3);
    const scaled = value.div(Decimal.pow(10, tier * 3));
    return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
  }
  return `${value.mantissa.toFixed(decimals)}e${value.exponent}`;
};

// Common patterns
const canAfford = (currency: Decimal, cost: Decimal): boolean =>
  currency.gte(cost);

const spend = (currency: Decimal, cost: Decimal): Decimal =>
  Decimal.max(currency.minus(cost), 0);

// Exponential cost with Decimal
const decimalExpCost = (
  base: Decimal,
  multiplier: Decimal,
  level: number,
): Decimal => base.times(multiplier.pow(level));
```

### Notation Toggle

```typescript
type Notation = 'standard' | 'scientific' | 'engineering';

const formatWithNotation = (
  value: number | Decimal,
  notation: Notation,
  decimals = 2,
): string => {
  const num = value instanceof Decimal ? value.toNumber() : value;

  switch (notation) {
    case 'standard':
      return formatNumber(num, decimals);
    case 'scientific':
      return num < 1e3 ? num.toFixed(0) : num.toExponential(decimals);
    case 'engineering': {
      if (num < 1e3) return num.toFixed(0);
      const exp = Math.floor(Math.log10(num));
      const engExp = exp - (exp % 3);
      const mantissa = num / 10 ** engExp;
      return `${mantissa.toFixed(decimals)}e${engExp}`;
    }
  }
};
```

---

## Game Tick Engine

### Basic Tick Loop

```typescript
interface GameState {
  resources: Record<string, number>;
  generators: Generator[];
  multipliers: number;
  lastTick: number;
}

interface Generator {
  id: string;
  count: number;
  baseRate: number;
  bonusPercent: number;
  resource: string;
}

const tick = (state: GameState, dt: number): GameState => {
  const updated = { ...state, resources: { ...state.resources } };

  for (const gen of updated.generators) {
    const production = totalProduction(
      gen.baseRate,
      gen.count,
      gen.bonusPercent,
      updated.multipliers,
    );
    updated.resources[gen.resource] =
      (updated.resources[gen.resource] ?? 0) + production * dt;
  }

  updated.lastTick = Date.now();
  return updated;
};

const gameLoop = (
  getState: () => GameState,
  setState: (s: GameState) => void,
  tickRate = 20,
): (() => void) => {
  const interval = setInterval(() => {
    const state = getState();
    const now = Date.now();
    const dt = (now - state.lastTick) / 1000;
    setState(tick(state, dt));
  }, 1000 / tickRate);

  return () => clearInterval(interval);
};
```

### Save/Load

```typescript
const SAVE_KEY = 'idle-game-save';
const AUTO_SAVE_INTERVAL = 30_000;

const saveGame = (state: GameState): void => {
  const json = JSON.stringify(state);
  localStorage.setItem(SAVE_KEY, json);
};

const loadGame = (): GameState | null => {
  const json = localStorage.getItem(SAVE_KEY);
  if (!json) return null;
  return JSON.parse(json) as GameState;
};

const exportSave = (state: GameState): string =>
  btoa(JSON.stringify(state));

const importSave = (encoded: string): GameState =>
  JSON.parse(atob(encoded)) as GameState;
```
