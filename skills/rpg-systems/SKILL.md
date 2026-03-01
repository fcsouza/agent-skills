---
name: rpg-systems
version: 1.0.0
description: >-
  Use when designing or implementing RPG systems — character stats, combat
  formulas, damage calculations, skill trees, equipment/inventory, loot tables,
  experience curves, class systems, turn-based or real-time combat, status
  effects, or enemy AI for browser RPGs.
---

# RPG Systems

Design patterns, formulas, and architecture for RPG mechanics in browser games.

---

## Stat Architecture

### Primary Stats

| Stat | Abbr | Affects |
|------|------|---------|
| Strength | STR | Physical attack, carry weight |
| Dexterity | DEX | Accuracy, evasion, speed |
| Intelligence | INT | Magic attack, MP pool, skill power |
| Vitality | VIT | HP, defense, status resistance |
| Luck | LCK | Crit rate, loot quality, rare procs |

### Derived Stats

Calculated from primary stats + equipment:

| Derived Stat | Formula |
|-------------|---------|
| HP | `VIT * 10 + baseHP` |
| MP | `INT * 5 + baseMP` |
| Attack | `STR * 2 + weaponPower` |
| Magic Attack | `INT * 2.5 + weaponMagic` |
| Defense | `VIT + armorDefense` |
| Magic Defense | `INT * 0.5 + armorMagicDef` |
| Crit Rate | `LCK * 0.5%` (clamped 1%-75%) |
| Speed | `DEX * 1.5 + baseSpeed` |
| Evasion | `DEX * 0.3%` (clamped 0%-40%) |

### Stat Scaling

| Approach | Formula | Best For |
|----------|---------|----------|
| Linear | `baseStat + level * growth` | Predictable, easy to balance |
| Diminishing returns | `baseStat + growth * sqrt(level)` | Prevents late-game stat explosion |
| Class-based | Fixed growth table per class | Encourages build diversity |

```typescript
const linearGrowth = (base: number, level: number, growth: number): number =>
  base + level * growth;

const diminishingGrowth = (base: number, level: number, growth: number): number =>
  base + growth * Math.sqrt(level);
```

---

## Combat System

### Turn-Based Flow

```
Initiative (sort by Speed) → Action Selection → Resolution → Effects → Check Win/Lose
```

| Phase | Description |
|-------|-------------|
| **Initiative** | Sort combatants by Speed stat, resolve ties randomly |
| **Action Selection** | Player chooses: Attack, Skill, Item, Defend, Flee |
| **Resolution** | Apply hit check → damage calc → defense reduction |
| **Effects** | Apply status effects, buffs, debuffs, DoT ticks |
| **Check** | If all enemies dead → Victory. If party dead → Defeat |

### Core Damage Formula

```typescript
const calculateDamage = (
  attack: number,
  defense: number,
  skillMult: number,
  critBonus: number,
  elementMod: number,
): number => {
  const raw = Math.max(1, attack * skillMult - defense * 0.5);
  const variance = 0.9 + Math.random() * 0.2;
  return Math.floor(raw * (1 + critBonus) * elementMod * variance);
};
```

### Hit Chance

```typescript
const hitChance = (baseHit: number, accuracy: number, evasion: number): number =>
  Math.min(0.95, Math.max(0.05, baseHit + accuracy - evasion));
```

Clamped 5%-95% — attacks should never be guaranteed or impossible.

### Critical Hits

```typescript
const critCheck = (baseCrit: number, luckBonus: number): boolean => {
  const rate = Math.min(0.75, Math.max(0.01, baseCrit + luckBonus));
  return Math.random() < rate;
};
```

For full combat system with elemental matrix, status effects, and turn order variants, read `references/combat-formulas.md`.

---

## Experience & Leveling

### XP Curve

```typescript
const xpToNextLevel = (level: number, base = 100, exponent = 1.5): number =>
  Math.floor(base * level ** exponent);
```

### XP Table (Levels 1-10, Standard Curve)

| Level | XP to Next | Cumulative XP |
|-------|-----------|---------------|
| 1 | 100 | 0 |
| 2 | 283 | 100 |
| 3 | 520 | 383 |
| 4 | 800 | 903 |
| 5 | 1,118 | 1,703 |
| 6 | 1,470 | 2,821 |
| 7 | 1,852 | 4,291 |
| 8 | 2,263 | 6,143 |
| 9 | 2,700 | 8,406 |
| 10 | 3,162 | 11,106 |

### Level-Up Stat Growth

Per-class growth: Warrior (+3 STR, +2 VIT), Mage (+3 INT, +1 VIT), Rogue (+3 DEX, +2 LCK), Paladin (+3 VIT, +2 STR). Each level grants fixed stat points based on class.

For full progression systems, prestige, and class/job mechanics, read `references/progression.md`.

---

## Equipment System

### Slots

```typescript
type EquipSlot = 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory1' | 'accessory2';
```

### Rarity Tiers

| Rarity | Color | Stat Multiplier | Drop Weight |
|--------|-------|----------------|-------------|
| Common | White | 1.0x | 60% |
| Uncommon | Green | 1.2x | 25% |
| Rare | Blue | 1.5x | 10% |
| Epic | Purple | 2.0x | 4% |
| Legendary | Gold | 3.0x | 1% |

### Equipment Data

```typescript
interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stats: Partial<Record<string, number>>;
  setId?: string;
  levelReq: number;
}
```

### Set Bonuses

Track equipped `setId` counts. When count >= required pieces, apply bonus stats additively. See `references/economy.md` for full item schemas.

---

## Skill Trees

### Node Structure

```typescript
interface SkillNode {
  id: string;
  name: string;
  effects: SkillEffect[];
  requires: string[];
  cost: number;
  maxRank: number;
}

interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'passive';
  stat?: string;
  value: number;
  scaling?: { stat: string; ratio: number };
}
```

### Unlock Check

```typescript
const canUnlock = (nodeId: string, tree: SkillNode[], unlocked: Set<string>, points: number): boolean => {
  const node = tree.find((n) => n.id === nodeId);
  if (!node || unlocked.has(nodeId) || node.cost > points) return false;
  return node.requires.every((req) => unlocked.has(req));
};
```

---

## Enemy Design

### Stat Scaling by Area

```typescript
const enemyStats = (baseHP: number, baseDamage: number, areaLevel: number) => ({
  hp: Math.floor(baseHP * (1 + areaLevel * 0.3)),
  attack: Math.floor(baseDamage * (1 + areaLevel * 0.25)),
  defense: Math.floor(5 + areaLevel * 2),
  xpReward: Math.floor(20 * areaLevel ** 1.2),
  goldReward: Math.floor(10 * areaLevel ** 1.1),
});
```

### AI Patterns

| Pattern | Behavior | When HP < 30% |
|---------|----------|---------------|
| Aggressive | Always attack strongest target | Enrage (+50% ATK, -25% DEF) |
| Defensive | Attack weakest, buff self | Heal or flee |
| Balanced | Mix of attacks and skills | Use strongest skill |

### Boss Mechanics

- **Phase transitions** at HP thresholds (75%, 50%, 25%) with unique skills per phase
- **Damage caps** to prevent one-shot kills
- **Mechanic checks** — dodge telegraphs, interrupt casts
- Data: `BossPhase { hpThreshold, skills: string[], statModifiers }`

---

## Cross-References

| Need | Skill |
|------|-------|
| Idle-RPG hybrids (auto-combat, offline XP) | `idle-game-design` |
| Game state management, ECS, save/load | `game-architecture` |
| PvP, factions, energy systems | `browser-mmo-design` |

---

## When to Read Reference Files

| If you need… | Read |
|--------------|------|
| Full combat formulas, elemental matrix, status effects | `references/combat-formulas.md` |
| XP curves, class systems, prestige, power creep | `references/progression.md` |
| Loot tables, crafting, shops, Drizzle schemas | `references/economy.md` |
