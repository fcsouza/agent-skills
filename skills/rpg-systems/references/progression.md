# Progression Systems

XP curves, class systems, skill allocation, prestige, and power creep prevention for browser RPGs.

---

## XP Curves

### Formulas

| Curve | Formula | Feel |
|-------|---------|------|
| Standard | `100 * level^1.5` | Balanced, good default |
| Steep | `100 * level^2` | Late-game grind, hardcore |
| Gentle | `100 * level^1.2` | Casual-friendly, fast progression |

```typescript
const xpToNextLevel = (level: number, base = 100, exponent = 1.5): number =>
  Math.floor(base * level ** exponent);

const totalXpForLevel = (targetLevel: number, base = 100, exponent = 1.5): number => {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += xpToNextLevel(i, base, exponent);
  }
  return total;
};

const levelFromXp = (totalXp: number, base = 100, exponent = 1.5, maxLevel = 100): number => {
  let accumulated = 0;
  for (let level = 1; level < maxLevel; level++) {
    accumulated += xpToNextLevel(level, base, exponent);
    if (accumulated > totalXp) return level;
  }
  return maxLevel;
};
```

### XP Table (Levels 1-20)

| Level | Standard (1.5) | Steep (2.0) | Gentle (1.2) |
|-------|---------------|-------------|-------------|
| 1 | 100 | 100 | 100 |
| 2 | 283 | 400 | 230 |
| 3 | 520 | 900 | 374 |
| 4 | 800 | 1,600 | 528 |
| 5 | 1,118 | 2,500 | 690 |
| 6 | 1,470 | 3,600 | 860 |
| 7 | 1,852 | 4,900 | 1,036 |
| 8 | 2,263 | 6,400 | 1,218 |
| 9 | 2,700 | 8,100 | 1,406 |
| 10 | 3,162 | 10,000 | 1,598 |
| 11 | 3,648 | 12,100 | 1,796 |
| 12 | 4,157 | 14,400 | 1,997 |
| 13 | 4,685 | 16,900 | 2,203 |
| 14 | 5,233 | 19,600 | 2,413 |
| 15 | 5,800 | 22,500 | 2,627 |
| 16 | 6,383 | 25,600 | 2,844 |
| 17 | 6,982 | 28,900 | 3,064 |
| 18 | 7,596 | 32,400 | 3,288 |
| 19 | 8,224 | 36,100 | 3,515 |
| 20 | 8,866 | 40,000 | 3,745 |

---

## Stat Growth Models

### Flat Growth

Every level grants fixed stat increases per class.

```typescript
interface ClassGrowth {
  str: number;
  dex: number;
  int: number;
  vit: number;
  lck: number;
}

const CLASS_GROWTHS: Record<string, ClassGrowth> = {
  warrior: { str: 3, dex: 1, int: 0, vit: 2, lck: 1 },
  mage: { str: 0, dex: 1, int: 3, vit: 1, lck: 1 },
  rogue: { str: 1, dex: 3, int: 0, vit: 1, lck: 2 },
  paladin: { str: 2, dex: 0, int: 1, vit: 3, lck: 1 },
  ranger: { str: 1, dex: 2, int: 1, vit: 1, lck: 2 },
};

const applyLevelUp = (
  stats: Record<string, number>,
  growth: ClassGrowth,
): Record<string, number> => ({
  str: stats.str + growth.str,
  dex: stats.dex + growth.dex,
  int: stats.int + growth.int,
  vit: stats.vit + growth.vit,
  lck: stats.lck + growth.lck,
});
```

### Percentage Growth

Stats grow by a percentage each level — scales with current value.

```typescript
const percentGrowth = (currentStat: number, growthPercent: number): number =>
  Math.floor(currentStat * (1 + growthPercent / 100));
```

### Hybrid (Base + Random)

Fire Emblem style — base growth plus random chance for bonus.

```typescript
const hybridGrowth = (
  currentStat: number,
  baseGrowth: number,
  growthChance: number,
): number => {
  const bonus = Math.random() < growthChance ? 1 : 0;
  return currentStat + baseGrowth + bonus;
};
```

---

## Class / Job Systems

### Simple Permanent Class

Player picks a class at creation. Stats and skills are locked to that class.

```typescript
interface CharacterClass {
  id: string;
  name: string;
  growth: ClassGrowth;
  skills: string[];
  equipAllowed: string[];
}
```

### Advanced Class (Base → Advanced)

Promote at a level threshold (e.g., level 20). Class tree branches.

```typescript
interface ClassPromotion {
  fromClass: string;
  toClass: string;
  levelReq: number;
  itemReq?: string;
  questReq?: string;
}

const CLASS_PROMOTIONS: ClassPromotion[] = [
  { fromClass: 'warrior', toClass: 'knight', levelReq: 20 },
  { fromClass: 'warrior', toClass: 'berserker', levelReq: 20 },
  { fromClass: 'mage', toClass: 'wizard', levelReq: 20 },
  { fromClass: 'mage', toClass: 'warlock', levelReq: 20 },
  { fromClass: 'rogue', toClass: 'assassin', levelReq: 20 },
  { fromClass: 'rogue', toClass: 'ranger', levelReq: 20 },
];

const getPromotions = (currentClass: string, level: number): ClassPromotion[] =>
  CLASS_PROMOTIONS.filter((p) => p.fromClass === currentClass && level >= p.levelReq);
```

### Multi-Class (FFT Job System)

Characters can switch jobs freely. Skills learned in one job can be equipped in another.

```typescript
interface JobProgress {
  jobId: string;
  level: number;
  xp: number;
  skillsLearned: string[];
}

interface CharacterJobs {
  activeJob: string;
  subJob?: string;
  jobs: Record<string, JobProgress>;
}

const switchJob = (character: CharacterJobs, newJobId: string): CharacterJobs => ({
  ...character,
  activeJob: newJobId,
  jobs: {
    ...character.jobs,
    [newJobId]: character.jobs[newJobId] ?? { jobId: newJobId, level: 1, xp: 0, skillsLearned: [] },
  },
});
```

### Classless System

No fixed classes — players allocate points freely into any stat or skill tree.

```typescript
interface ClasslessCharacter {
  level: number;
  statPoints: number;
  skillPoints: number;
  stats: Record<string, number>;
  skills: Set<string>;
}

const allocateStat = (
  character: ClasslessCharacter,
  stat: string,
  points: number,
): ClasslessCharacter => {
  if (points > character.statPoints) throw new Error('Not enough stat points');
  return {
    ...character,
    statPoints: character.statPoints - points,
    stats: {
      ...character.stats,
      [stat]: (character.stats[stat] ?? 0) + points,
    },
  };
};
```

---

## Skill Point Allocation

```typescript
interface SkillPointConfig {
  pointsPerLevel: number;
  bonusPointLevels: number[];
  bonusPointAmount: number;
}

const DEFAULT_CONFIG: SkillPointConfig = {
  pointsPerLevel: 1,
  bonusPointLevels: [10, 20, 30, 40, 50],
  bonusPointAmount: 2,
};

const skillPointsAtLevel = (level: number, config = DEFAULT_CONFIG): number => {
  let total = level * config.pointsPerLevel;
  for (const bonusLevel of config.bonusPointLevels) {
    if (level >= bonusLevel) total += config.bonusPointAmount;
  }
  return total;
};
```

### Respec Mechanics

```typescript
interface RespecConfig {
  freeBelowLevel: number;
  baseCost: number;
  costMultiplier: number;
  respecCount: number;
}

const respecCost = (config: RespecConfig, level: number): number => {
  if (level < config.freeBelowLevel) return 0;
  return Math.floor(config.baseCost * config.costMultiplier ** config.respecCount);
};
```

Options:
- **Free respec** below a level threshold (e.g., level 10)
- **Increasing gold cost** per respec — discourages constant switching
- **Respec token** — rare item drop or shop purchase
- **Partial respec** — refund individual skill nodes instead of full reset

---

## Prestige for RPGs

Reset character level while keeping permanent bonuses.

```typescript
interface PrestigeBonus {
  statMultiplier: number;
  xpMultiplier: number;
  startingLevel: number;
  unlockedPerks: string[];
}

const calculatePrestigeBonus = (
  prestigeCount: number,
  maxLevel: number,
  currentLevel: number,
): PrestigeBonus => {
  const completionRatio = currentLevel / maxLevel;
  return {
    statMultiplier: 1 + prestigeCount * 0.1 * completionRatio,
    xpMultiplier: 1 + prestigeCount * 0.15,
    startingLevel: Math.min(prestigeCount * 5, maxLevel * 0.25),
    unlockedPerks: [],
  };
};

const canPrestige = (currentLevel: number, maxLevel: number): boolean =>
  currentLevel >= maxLevel;
```

### What Resets vs. Persists

| Resets | Persists |
|--------|----------|
| Character level | Prestige count |
| Equipment (optional) | Prestige currency |
| Quest progress | Achievement unlocks |
| Map exploration | Cosmetics |
| Gold | Stat multipliers |
| Skill points | XP multipliers |

---

## Power Creep Prevention

### Soft Caps

```typescript
const softcap = (value: number, cap: number, reduction = 0.5): number => {
  if (value <= cap) return value;
  return cap + (value - cap) * reduction;
};

const doubleSoftcap = (
  value: number,
  softCap: number,
  hardCap: number,
): number => {
  let result = value;
  if (result > softCap) {
    result = softCap + (result - softCap) * 0.5;
  }
  if (result > hardCap) {
    result = hardCap + (result - hardCap) * 0.1;
  }
  return result;
};
```

### Content Scaling

Enemy stats scale with player level to maintain challenge.

```typescript
const scaledEnemy = (
  baseStats: Record<string, number>,
  enemyLevel: number,
  playerLevel: number,
  scaleFactor = 0.5,
): Record<string, number> => {
  const levelDiff = playerLevel - enemyLevel;
  const multiplier = 1 + Math.max(0, levelDiff) * scaleFactor * 0.1;

  const result: Record<string, number> = {};
  for (const [stat, value] of Object.entries(baseStats)) {
    result[stat] = Math.floor(value * multiplier);
  }
  return result;
};
```

### Horizontal Progression

Instead of raw stat increases, offer:
- New skill options (not stronger, just different)
- Cosmetic rewards
- Convenience features (larger inventory, fast travel)
- Side-grade equipment (elemental specialization)
- Achievement-based titles

### Balancing Checklist

1. **Stat audit** — graph total player power vs. level, look for exponential jumps
2. **TTK (time-to-kill)** — should stay roughly constant as player and enemies scale
3. **Floor/ceiling** — every stat needs a minimum floor and maximum ceiling
4. **New content pacing** — release content faster than players can outgear it, or use scaling
5. **Economy drain** — ensure gold sinks match gold generation at every level bracket
