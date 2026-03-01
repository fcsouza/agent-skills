# Zustand Game State Patterns

## Store Architecture

**One store per game system** — keeps state isolated, reduces re-renders, simplifies serialization.

```
useResourceStore  — gold, gems, rates
useUpgradeStore   — purchased upgrades, costs, effects
useCombatStore    — enemies, damage, loot
useInventoryStore — items, equipment, stacks
useQuestStore     — active quests, progress, rewards
useSettingsStore  — volume, speed, UI preferences (NOT serialized to save)
```

Avoid a single mega-store — every tick would trigger re-renders across all subscribed components.

---

## Example Stores

### Resource Store

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

interface Resource {
  amount: number;
  perSecond: number;
  total: number;
}

interface ResourceState {
  resources: Record<string, Resource>;
  addResource: (id: string, amount: number) => void;
  setRate: (id: string, rate: number) => void;
  tick: (dt: number) => void;
}

const useResourceStore = create<ResourceState>()(
  immer((set) => ({
    resources: {
      gold: { amount: 0, perSecond: 1, total: 0 },
      gems: { amount: 0, perSecond: 0, total: 0 },
    },
    addResource: (id, amount) =>
      set((state) => {
        const res = state.resources[id];
        if (res) {
          res.amount += amount;
          res.total += amount;
        }
      }),
    setRate: (id, rate) =>
      set((state) => {
        const res = state.resources[id];
        if (res) res.perSecond = rate;
      }),
    tick: (dt) =>
      set((state) => {
        for (const res of Object.values(state.resources)) {
          const gained = res.perSecond * dt;
          res.amount += gained;
          res.total += gained;
        }
      }),
  })),
);
```

### Upgrade Store

```typescript
interface Upgrade {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effect: number;
  effectPerLevel: number;
}

interface UpgradeState {
  upgrades: Record<string, Upgrade>;
  purchase: (id: string) => boolean;
  getCost: (id: string) => number;
  getTotalEffect: (id: string) => number;
}

const useUpgradeStore = create<UpgradeState>()(
  immer((set, get) => ({
    upgrades: {
      pickaxe: {
        id: 'pickaxe',
        name: 'Pickaxe',
        level: 0,
        maxLevel: 100,
        baseCost: 10,
        costMultiplier: 1.15,
        effect: 0,
        effectPerLevel: 1,
      },
    },
    getCost: (id) => {
      const upgrade = get().upgrades[id];
      if (!upgrade) return Infinity;
      return Math.floor(upgrade.baseCost * upgrade.costMultiplier ** upgrade.level);
    },
    getTotalEffect: (id) => {
      const upgrade = get().upgrades[id];
      if (!upgrade) return 0;
      return upgrade.level * upgrade.effectPerLevel;
    },
    purchase: (id) => {
      const cost = get().getCost(id);
      const gold = useResourceStore.getState().resources.gold?.amount ?? 0;

      if (gold < cost) return false;

      useResourceStore.getState().addResource('gold', -cost);
      set((state) => {
        const upgrade = state.upgrades[id];
        if (upgrade && upgrade.level < upgrade.maxLevel) {
          upgrade.level += 1;
          upgrade.effect = upgrade.level * upgrade.effectPerLevel;
        }
      });
      return true;
    },
  })),
);
```

### Combat Store

```typescript
interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  reward: Record<string, number>;
}

interface CombatState {
  currentEnemy: Enemy | null;
  dps: number;
  kills: number;
  spawnEnemy: (enemy: Enemy) => void;
  tick: (dt: number) => void;
}

const useCombatStore = create<CombatState>()(
  immer((set) => ({
    currentEnemy: null,
    dps: 1,
    kills: 0,
    spawnEnemy: (enemy) =>
      set((state) => {
        state.currentEnemy = enemy;
      }),
    tick: (dt) =>
      set((state) => {
        if (!state.currentEnemy) return;

        state.currentEnemy.hp -= state.dps * dt;

        if (state.currentEnemy.hp <= 0) {
          // Grant rewards
          const rewards = state.currentEnemy.reward;
          for (const [resource, amount] of Object.entries(rewards)) {
            useResourceStore.getState().addResource(resource, amount);
          }
          state.kills += 1;
          state.currentEnemy = null;
        }
      }),
  })),
);
```

---

## Store Slicing for Cross-System Reads

When one system needs to read another's state without subscribing to all changes.

```typescript
// Derived DPS from all sources — computed once per render, not per tick
const useTotalDps = () => {
  const baseDps = useCombatStore((s) => s.dps);
  const pickaxeEffect = useUpgradeStore((s) => s.upgrades.pickaxe?.effect ?? 0);
  return baseDps + pickaxeEffect;
};

// Outside React — direct state access (no subscription)
const getTotalDps = () => {
  const base = useCombatStore.getState().dps;
  const pickaxe = useUpgradeStore.getState().upgrades.pickaxe?.effect ?? 0;
  return base + pickaxe;
};
```

---

## Selector Patterns

```typescript
import { useShallow } from 'zustand/react/shallow';

// Single value — re-renders only when gold changes
const gold = useResourceStore((s) => s.resources.gold?.amount ?? 0);

// Multiple values — useShallow for object/array selectors
const { gold, gems } = useResourceStore(
  useShallow((s) => ({
    gold: s.resources.gold?.amount ?? 0,
    gems: s.resources.gems?.amount ?? 0,
  })),
);

// Computed selector — memoized derivation
const goldPerSecond = useResourceStore((s) => s.resources.gold?.perSecond ?? 0);
```

---

## Middleware Stack

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

const useResourceStore = create<ResourceState>()(
  devtools(
    persist(
      immer((set) => ({
        // ... state and actions
      })),
      {
        name: 'resource-store',
        // Only persist specific fields
        partialize: (state) => ({
          resources: state.resources,
        }),
      },
    ),
    { name: 'ResourceStore' },
  ),
);
```

**Middleware order matters**: outermost wraps first. `devtools` → `persist` → `immer` is the standard order.

---

## State Serialization for Save/Load

Separate transient state (not saved) from persistent state (saved).

```typescript
interface GameSave {
  resources: Record<string, Resource>;
  upgrades: Record<string, { level: number }>;
  combat: { kills: number };
  // NOT saved: currentEnemy (transient), dps (derived)
}

const serializeGame = (): GameSave => ({
  resources: useResourceStore.getState().resources,
  upgrades: Object.fromEntries(
    Object.entries(useUpgradeStore.getState().upgrades).map(
      ([id, u]) => [id, { level: u.level }],
    ),
  ),
  combat: { kills: useCombatStore.getState().kills },
});

const deserializeGame = (save: GameSave) => {
  useResourceStore.setState({ resources: save.resources });
  // Restore upgrade levels, recalculate effects
  const upgrades = useUpgradeStore.getState().upgrades;
  for (const [id, data] of Object.entries(save.upgrades)) {
    if (upgrades[id]) {
      upgrades[id].level = data.level;
      upgrades[id].effect = data.level * upgrades[id].effectPerLevel;
    }
  }
  useUpgradeStore.setState({ upgrades });
  useCombatStore.setState({ kills: save.combat.kills });
};
```

---

## Save Migration System

Version-based migrations to handle save format changes across game updates.

```typescript
interface SaveFile {
  saveVersion: number;
  timestamp: number;
  data: GameSave;
}

type Migration = (save: SaveFile) => SaveFile;

const migrations: Migration[] = [
  // v1 → v2: Add gems resource
  (save) => {
    if (!save.data.resources.gems) {
      save.data.resources.gems = { amount: 0, perSecond: 0, total: 0 };
    }
    return { ...save, saveVersion: 2 };
  },
  // v2 → v3: Add kills tracking
  (save) => {
    if (!save.data.combat) {
      (save.data as Record<string, unknown>).combat = { kills: 0 };
    }
    return { ...save, saveVersion: 3 };
  },
];

const CURRENT_SAVE_VERSION = 3;

const migrateSave = (save: SaveFile): SaveFile => {
  let current = save;
  while (current.saveVersion < CURRENT_SAVE_VERSION) {
    const migration = migrations[current.saveVersion - 1];
    if (!migration) {
      throw new Error(`Missing migration for v${current.saveVersion}`);
    }
    current = migration(current);
  }
  return current;
};

const loadGame = (): SaveFile | null => {
  const raw = localStorage.getItem('game-save');
  if (!raw) return null;

  try {
    const save: SaveFile = JSON.parse(raw);
    return migrateSave(save);
  } catch {
    console.error('Failed to load save');
    return null;
  }
};

const saveGame = () => {
  const save: SaveFile = {
    saveVersion: CURRENT_SAVE_VERSION,
    timestamp: Date.now(),
    data: serializeGame(),
  };
  localStorage.setItem('game-save', JSON.stringify(save));
};
```

---

## Auto-Save and Export

```typescript
// Auto-save every 30 seconds
const startAutoSave = () => {
  return setInterval(saveGame, 30_000);
};

// Export as base64 for sharing
const exportSave = (): string => {
  const save = localStorage.getItem('game-save') ?? '';
  return btoa(save);
};

// Import from base64
const importSave = (encoded: string) => {
  try {
    const json = atob(encoded);
    const save: SaveFile = JSON.parse(json);
    const migrated = migrateSave(save);
    deserializeGame(migrated.data);
    localStorage.setItem('game-save', JSON.stringify(migrated));
    return true;
  } catch {
    return false;
  }
};

// Server sync via sendBeacon on tab close
window.addEventListener('beforeunload', () => {
  saveGame();
  const save = localStorage.getItem('game-save');
  if (save) {
    navigator.sendBeacon('/api/save', save);
  }
});
```
