# Combat Formulas

Complete combat system implementation in TypeScript for browser RPGs.

---

## Types

```typescript
interface CombatStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
  critRate: number;
  critDamage: number;
  element: Element;
}

interface Skill {
  id: string;
  name: string;
  type: 'physical' | 'magical';
  element: Element;
  multiplier: number;
  mpCost: number;
  targets: TargetType;
  statusEffects?: StatusApplication[];
  cooldown: number;
}

interface DamageResult {
  damage: number;
  isCrit: boolean;
  isHit: boolean;
  elementMod: number;
  statusApplied: string[];
}

type Element = 'fire' | 'ice' | 'wind' | 'earth' | 'light' | 'dark' | 'none';
type TargetType = 'single' | 'row' | 'all';
```

---

## Full Damage Calculation

```typescript
const calculateDamage = (
  attacker: CombatStats,
  defender: CombatStats,
  skill: Skill,
): DamageResult => {
  // Hit check
  const hitRate = Math.min(0.95, Math.max(0.05, 0.9 + attacker.accuracy - defender.evasion));
  const isHit = Math.random() < hitRate;

  if (!isHit) {
    return { damage: 0, isCrit: false, isHit: false, elementMod: 1, statusApplied: [] };
  }

  // Base damage by skill type
  const attackStat = skill.type === 'physical' ? attacker.attack : attacker.magicAttack;
  const defenseStat = skill.type === 'physical' ? defender.defense : defender.magicDefense;

  // Core formula
  const raw = Math.max(1, attackStat * skill.multiplier - defenseStat * 0.5);

  // Crit check
  const critRate = Math.min(0.75, Math.max(0.01, attacker.critRate));
  const isCrit = Math.random() < critRate;
  const critBonus = isCrit ? attacker.critDamage : 0;

  // Element modifier
  const elementMod = getElementModifier(skill.element, defender.element);

  // Variance ±10%
  const variance = 0.9 + Math.random() * 0.2;

  const damage = Math.floor(raw * (1 + critBonus) * elementMod * variance);

  // Status effects
  const statusApplied: string[] = [];
  if (skill.statusEffects) {
    for (const effect of skill.statusEffects) {
      if (Math.random() < effect.chance) {
        statusApplied.push(effect.statusId);
      }
    }
  }

  return { damage, isCrit, isHit, elementMod, statusApplied };
};
```

---

## Defense Models

### Flat Reduction

```typescript
const flatReduction = (rawDamage: number, defense: number): number =>
  Math.max(1, rawDamage - defense);
```

Simple but breaks at high defense values — enemies deal 1 damage.

### Percentage Reduction

```typescript
const percentReduction = (rawDamage: number, defense: number): number =>
  Math.floor(rawDamage * (100 / (100 + defense)));
```

Scales smoothly. 100 DEF = 50% reduction, 200 DEF = 66%, 300 DEF = 75%. Never reaches 100%.

### Hybrid (Flat + Percentage)

```typescript
const hybridReduction = (
  rawDamage: number,
  flatDef: number,
  percentDef: number,
): number => {
  const afterFlat = Math.max(1, rawDamage - flatDef);
  return Math.floor(afterFlat * (100 / (100 + percentDef)));
};
```

### Armor Penetration

```typescript
const armorPen = (
  rawDamage: number,
  defense: number,
  flatPen: number,
  percentPen: number,
): number => {
  const effectiveDef = Math.max(0, (defense - flatPen) * (1 - percentPen));
  return Math.floor(rawDamage * (100 / (100 + effectiveDef)));
};
```

---

## Elemental System

### Element Wheel

```
Fire > Ice > Wind > Earth > Fire (cycle)
Light <> Dark (mutual weakness)
```

### Element Modifier Matrix

```typescript
const ELEMENT_MATRIX: Record<Element, Record<Element, number>> = {
  fire:  { fire: 0.5, ice: 1.5, wind: 1.0, earth: 0.5, light: 1.0, dark: 1.0, none: 1.0 },
  ice:   { fire: 0.5, ice: 0.5, wind: 1.5, earth: 1.0, light: 1.0, dark: 1.0, none: 1.0 },
  wind:  { fire: 1.0, ice: 0.5, wind: 0.5, earth: 1.5, light: 1.0, dark: 1.0, none: 1.0 },
  earth: { fire: 1.5, ice: 1.0, wind: 0.5, earth: 0.5, light: 1.0, dark: 1.0, none: 1.0 },
  light: { fire: 1.0, ice: 1.0, wind: 1.0, earth: 1.0, light: 0.5, dark: 1.5, none: 1.0 },
  dark:  { fire: 1.0, ice: 1.0, wind: 1.0, earth: 1.0, light: 1.5, dark: 0.5, none: 1.0 },
  none:  { fire: 1.0, ice: 1.0, wind: 1.0, earth: 1.0, light: 1.0, dark: 1.0, none: 1.0 },
};

const getElementModifier = (attackElement: Element, defenderElement: Element): number =>
  ELEMENT_MATRIX[attackElement][defenderElement];
```

---

## Status Effects

### Types

```typescript
type StatusType = 'dot' | 'cc' | 'buff' | 'debuff';

interface StatusEffect {
  id: string;
  name: string;
  type: StatusType;
  duration: number;
  maxStacks: number;
  tickInterval: number;
  onApply?: (target: CombatStats) => CombatStats;
  onTick?: (target: CombatStats, stacks: number) => CombatStats;
  onExpire?: (target: CombatStats) => CombatStats;
}

interface StatusApplication {
  statusId: string;
  chance: number;
  stacks: number;
}

interface ActiveStatus {
  effect: StatusEffect;
  stacks: number;
  remainingDuration: number;
  immuneUntil?: number;
}
```

### Common Status Effects

```typescript
const STATUS_EFFECTS: Record<string, StatusEffect> = {
  poison: {
    id: 'poison',
    name: 'Poison',
    type: 'dot',
    duration: 3,
    maxStacks: 5,
    tickInterval: 1,
    onTick: (target, stacks) => ({
      ...target,
      hp: target.hp - Math.floor(target.maxHp * 0.03 * stacks),
    }),
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    type: 'dot',
    duration: 2,
    maxStacks: 3,
    tickInterval: 1,
    onTick: (target, stacks) => ({
      ...target,
      hp: target.hp - Math.floor(target.maxHp * 0.05 * stacks),
    }),
    onApply: (target) => ({
      ...target,
      defense: Math.floor(target.defense * 0.9),
    }),
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    type: 'cc',
    duration: 1,
    maxStacks: 1,
    tickInterval: 0,
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze',
    type: 'cc',
    duration: 2,
    maxStacks: 1,
    tickInterval: 0,
    onApply: (target) => ({
      ...target,
      speed: 0,
      evasion: 0,
    }),
  },
  attackUp: {
    id: 'attackUp',
    name: 'Attack Up',
    type: 'buff',
    duration: 3,
    maxStacks: 3,
    tickInterval: 0,
    onApply: (target) => ({
      ...target,
      attack: Math.floor(target.attack * 1.25),
    }),
  },
  defenseDown: {
    id: 'defenseDown',
    name: 'Defense Down',
    type: 'debuff',
    duration: 3,
    maxStacks: 3,
    tickInterval: 0,
    onApply: (target) => ({
      ...target,
      defense: Math.floor(target.defense * 0.75),
    }),
  },
};
```

### Status Manager

```typescript
const applyStatus = (
  activeStatuses: ActiveStatus[],
  effect: StatusEffect,
  stacks = 1,
): ActiveStatus[] => {
  const existing = activeStatuses.find((s) => s.effect.id === effect.id);

  if (existing) {
    return activeStatuses.map((s) =>
      s.effect.id === effect.id
        ? {
            ...s,
            stacks: Math.min(s.stacks + stacks, effect.maxStacks),
            remainingDuration: effect.duration,
          }
        : s,
    );
  }

  return [...activeStatuses, { effect, stacks, remainingDuration: effect.duration }];
};

const tickStatuses = (
  target: CombatStats,
  activeStatuses: ActiveStatus[],
): { stats: CombatStats; statuses: ActiveStatus[] } => {
  let stats = { ...target };
  const remaining: ActiveStatus[] = [];

  for (const status of activeStatuses) {
    if (status.effect.onTick && status.effect.tickInterval > 0) {
      stats = status.effect.onTick(stats, status.stacks);
    }

    const updated = { ...status, remainingDuration: status.remainingDuration - 1 };
    if (updated.remainingDuration > 0) {
      remaining.push(updated);
    } else if (status.effect.onExpire) {
      stats = status.effect.onExpire(stats);
    }
  }

  return { stats, statuses: remaining };
};
```

### Immunity

```typescript
const isImmune = (status: ActiveStatus, currentTurn: number): boolean =>
  status.immuneUntil !== undefined && currentTurn < status.immuneUntil;

const applyImmunity = (status: ActiveStatus, currentTurn: number, duration: number): ActiveStatus => ({
  ...status,
  immuneUntil: currentTurn + duration,
});
```

---

## Turn Order Systems

### Speed-Based (Standard Turn-Based)

```typescript
interface Combatant {
  id: string;
  name: string;
  stats: CombatStats;
  isPlayer: boolean;
  activeStatuses: ActiveStatus[];
}

const speedTurnOrder = (combatants: Combatant[]): Combatant[] =>
  [...combatants]
    .filter((c) => c.stats.hp > 0)
    .filter((c) => !c.activeStatuses.some((s) => s.effect.type === 'cc'))
    .sort((a, b) => {
      const diff = b.stats.speed - a.stats.speed;
      return diff !== 0 ? diff : Math.random() - 0.5;
    });
```

### ATB (Active Time Battle)

```typescript
interface ATBCombatant extends Combatant {
  chargeBar: number;
  chargeRate: number;
}

const ATB_THRESHOLD = 100;

const tickATB = (combatants: ATBCombatant[], dt: number): ATBCombatant[] =>
  combatants.map((c) => ({
    ...c,
    chargeBar: c.stats.hp > 0
      ? Math.min(ATB_THRESHOLD, c.chargeBar + c.chargeRate * c.stats.speed * dt)
      : 0,
  }));

const getReadyCombatants = (combatants: ATBCombatant[]): ATBCombatant[] =>
  combatants
    .filter((c) => c.chargeBar >= ATB_THRESHOLD)
    .sort((a, b) => b.chargeBar - a.chargeBar);

const resetCharge = (combatant: ATBCombatant): ATBCombatant => ({
  ...combatant,
  chargeBar: 0,
});
```

### Round-Robin

```typescript
const roundRobinOrder = (combatants: Combatant[], roundIndex: number): Combatant => {
  const alive = combatants.filter((c) => c.stats.hp > 0);
  return alive[roundIndex % alive.length];
};
```

### Initiative Roll (D&D Style)

```typescript
const rollInitiative = (combatants: Combatant[]): Combatant[] => {
  const rolls = combatants.map((c) => ({
    combatant: c,
    roll: Math.floor(Math.random() * 20) + 1 + c.stats.speed,
  }));
  return rolls.sort((a, b) => b.roll - a.roll).map((r) => r.combatant);
};
```

---

## Multi-Target & AoE

```typescript
const applyAoE = (
  result: DamageResult,
  targets: Combatant[],
  targetType: TargetType,
): { target: Combatant; damage: number }[] => {
  switch (targetType) {
    case 'single':
      return [{ target: targets[0], damage: result.damage }];
    case 'row':
      return targets.map((t, i) => ({
        target: t,
        damage: i === 0 ? result.damage : Math.floor(result.damage * 0.5),
      }));
    case 'all':
      return targets.map((t, i) => ({
        target: t,
        damage: i === 0 ? result.damage : Math.floor(result.damage * 0.5),
      }));
  }
};
```

AoE falloff: primary target takes 100%, secondary targets take 50%.

---

## Combat Log

```typescript
type CombatEventType =
  | 'attack'
  | 'skill'
  | 'item'
  | 'status_applied'
  | 'status_tick'
  | 'status_expired'
  | 'defeat'
  | 'victory'
  | 'flee';

interface CombatEvent {
  turn: number;
  type: CombatEventType;
  actorId: string;
  targetId?: string;
  skillId?: string;
  damage?: number;
  isCrit?: boolean;
  elementMod?: number;
  statusId?: string;
  message: string;
}

const createCombatLog = () => {
  const events: CombatEvent[] = [];

  return {
    log: (event: CombatEvent) => events.push(event),
    getEvents: () => [...events],
    getByTurn: (turn: number) => events.filter((e) => e.turn === turn),
    getByActor: (actorId: string) => events.filter((e) => e.actorId === actorId),
  };
};
```
