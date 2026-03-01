# RPG Economy

Currencies, loot tables, crafting, shops, and database schemas for browser RPG economies.

---

## Currencies

### Currency Types

| Currency | Purpose | Source | Sink |
|----------|---------|--------|------|
| Gold | Primary economy | Monster drops, quests, selling items | Equipment, consumables, repairs |
| Gems | Premium / rare purchases | Achievements, daily login, IAP | Cosmetics, convenience, respec |
| Prestige tokens | Post-endgame progression | Prestige resets | Permanent stat boosts |
| Faction points | Faction-locked gear | Faction quests, PvP | Faction shop items |

### Gold Sinks

Essential to prevent inflation:

- **Equipment repair** — 5-10% of item value per death
- **Crafting fees** — gold cost in addition to materials
- **Respec cost** — increasing cost per respec
- **Auction house tax** — 5-10% on sales
- **Consumables** — potions, scrolls, food buffs
- **Housing / cosmetics** — vanity gold sinks
- **Enchanting** — gold + materials, can fail
- **Fast travel** — convenience fee

---

## Loot Tables

### Weighted Random Implementation

```typescript
interface LootEntry {
  itemId: string;
  weight: number;
  minQuantity: number;
  maxQuantity: number;
  levelReq?: number;
}

interface LootTable {
  id: string;
  entries: LootEntry[];
  guaranteedDrops?: string[];
  rollCount: number;
}

interface LootDrop {
  itemId: string;
  quantity: number;
}

const rollLootTable = (table: LootTable, playerLevel: number): LootDrop[] => {
  const drops: LootDrop[] = [];

  // Guaranteed drops
  if (table.guaranteedDrops) {
    for (const itemId of table.guaranteedDrops) {
      drops.push({ itemId, quantity: 1 });
    }
  }

  // Weighted random rolls
  const eligible = table.entries.filter(
    (e) => !e.levelReq || playerLevel >= e.levelReq,
  );
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);

  for (let i = 0; i < table.rollCount; i++) {
    let roll = Math.random() * totalWeight;
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) {
        const quantity = entry.minQuantity + Math.floor(
          Math.random() * (entry.maxQuantity - entry.minQuantity + 1),
        );
        drops.push({ itemId: entry.itemId, quantity });
        break;
      }
    }
  }

  return drops;
};
```

### Rarity Distribution

| Rarity | Weight | Approx. Drop Rate |
|--------|--------|--------------------|
| Common | 60 | 60% |
| Uncommon | 25 | 25% |
| Rare | 10 | 10% |
| Epic | 4 | 4% |
| Legendary | 1 | 1% |

### Pity System

Guarantees rare drops after a streak of bad luck.

```typescript
interface PityCounter {
  rollsSinceRare: number;
  rollsSinceEpic: number;
  rollsSinceLegendary: number;
}

interface PityConfig {
  rareGuarantee: number;
  epicGuarantee: number;
  legendaryGuarantee: number;
}

const DEFAULT_PITY: PityConfig = {
  rareGuarantee: 15,
  epicGuarantee: 50,
  legendaryGuarantee: 100,
};

const rollWithPity = (
  table: LootTable,
  playerLevel: number,
  pity: PityCounter,
  config = DEFAULT_PITY,
): { drops: LootDrop[]; pity: PityCounter } => {
  const updatedPity = {
    rollsSinceRare: pity.rollsSinceRare + 1,
    rollsSinceEpic: pity.rollsSinceEpic + 1,
    rollsSinceLegendary: pity.rollsSinceLegendary + 1,
  };

  // Force rarity based on pity
  if (updatedPity.rollsSinceLegendary >= config.legendaryGuarantee) {
    const legendary = table.entries.find((e) => e.weight <= 1);
    if (legendary) {
      return {
        drops: [{ itemId: legendary.itemId, quantity: 1 }],
        pity: { rollsSinceRare: 0, rollsSinceEpic: 0, rollsSinceLegendary: 0 },
      };
    }
  }

  if (updatedPity.rollsSinceEpic >= config.epicGuarantee) {
    const epic = table.entries.find((e) => e.weight <= 4 && e.weight > 1);
    if (epic) {
      return {
        drops: [{ itemId: epic.itemId, quantity: 1 }],
        pity: { ...updatedPity, rollsSinceEpic: 0, rollsSinceLegendary: updatedPity.rollsSinceLegendary },
      };
    }
  }

  if (updatedPity.rollsSinceRare >= config.rareGuarantee) {
    const rare = table.entries.find((e) => e.weight <= 10 && e.weight > 4);
    if (rare) {
      return {
        drops: [{ itemId: rare.itemId, quantity: 1 }],
        pity: { ...updatedPity, rollsSinceRare: 0 },
      };
    }
  }

  return { drops: rollLootTable(table, playerLevel), pity: updatedPity };
};
```

---

## Crafting

### Recipe-Based System

```typescript
interface CraftingRecipe {
  id: string;
  name: string;
  resultItemId: string;
  resultQuantity: number;
  materials: { itemId: string; quantity: number }[];
  goldCost: number;
  levelReq: number;
  successRate: number;
  craftingTime: number;
}

interface CraftResult {
  success: boolean;
  itemId?: string;
  quantity?: number;
  materialsConsumed: boolean;
}

const attemptCraft = (
  recipe: CraftingRecipe,
  inventory: Map<string, number>,
  gold: number,
  playerLevel: number,
): CraftResult => {
  // Check requirements
  if (playerLevel < recipe.levelReq) {
    return { success: false, materialsConsumed: false };
  }

  if (gold < recipe.goldCost) {
    return { success: false, materialsConsumed: false };
  }

  for (const mat of recipe.materials) {
    if ((inventory.get(mat.itemId) ?? 0) < mat.quantity) {
      return { success: false, materialsConsumed: false };
    }
  }

  // Consume materials regardless of success
  for (const mat of recipe.materials) {
    inventory.set(mat.itemId, (inventory.get(mat.itemId) ?? 0) - mat.quantity);
  }

  // Roll success
  const success = Math.random() < recipe.successRate;
  if (success) {
    return {
      success: true,
      itemId: recipe.resultItemId,
      quantity: recipe.resultQuantity,
      materialsConsumed: true,
    };
  }

  return { success: false, materialsConsumed: true };
};
```

### Material Combination (Experimental Crafting)

```typescript
interface MaterialProperty {
  element?: string;
  quality: number;
  traits: string[];
}

const combineMaterials = (
  materials: MaterialProperty[],
): MaterialProperty => {
  const allTraits = materials.flatMap((m) => m.traits);
  const uniqueTraits = [...new Set(allTraits)];
  const avgQuality = materials.reduce((sum, m) => sum + m.quality, 0) / materials.length;
  const elements = materials.map((m) => m.element).filter(Boolean);

  return {
    element: elements.length > 0 ? elements[Math.floor(Math.random() * elements.length)] : undefined,
    quality: Math.floor(avgQuality),
    traits: uniqueTraits.slice(0, 3),
  };
};
```

---

## Shop Design

### Static Shop

Fixed inventory, always available.

```typescript
interface ShopItem {
  itemId: string;
  price: number;
  currency: 'gold' | 'gems' | 'faction';
  stock: number | null;
  levelReq: number;
}

interface Shop {
  id: string;
  name: string;
  items: ShopItem[];
  buybackMultiplier: number;
}

const buyItem = (
  shop: Shop,
  itemId: string,
  playerGold: number,
): { success: boolean; remaining: number } => {
  const item = shop.items.find((i) => i.itemId === itemId);
  if (!item) return { success: false, remaining: playerGold };
  if (item.stock !== null && item.stock <= 0) return { success: false, remaining: playerGold };
  if (playerGold < item.price) return { success: false, remaining: playerGold };

  if (item.stock !== null) item.stock--;
  return { success: true, remaining: playerGold - item.price };
};

const sellItem = (shop: Shop, itemBasePrice: number): number =>
  Math.floor(itemBasePrice * shop.buybackMultiplier);
```

### Rotating Stock

Inventory refreshes on a timer.

```typescript
interface RotatingShop extends Shop {
  refreshInterval: number;
  lastRefresh: number;
  pool: ShopItem[];
  displayCount: number;
}

const refreshShop = (shop: RotatingShop, now: number): RotatingShop => {
  if (now - shop.lastRefresh < shop.refreshInterval) return shop;

  const shuffled = [...shop.pool].sort(() => Math.random() - 0.5);
  return {
    ...shop,
    items: shuffled.slice(0, shop.displayCount),
    lastRefresh: now,
  };
};
```

### Dynamic Pricing

Prices fluctuate based on supply/demand.

```typescript
const dynamicPrice = (
  basePrice: number,
  supply: number,
  demand: number,
  minMultiplier = 0.5,
  maxMultiplier = 3.0,
): number => {
  const ratio = demand / Math.max(1, supply);
  const multiplier = Math.min(maxMultiplier, Math.max(minMultiplier, ratio));
  return Math.floor(basePrice * multiplier);
};
```

---

## Drizzle ORM Schemas

```typescript
import { pgTable, text, integer, real, timestamp, jsonb, pgEnum, serial, boolean } from 'drizzle-orm/pg-core';

// Enums
export const rarityEnum = pgEnum('rarity', [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);

export const currencyEnum = pgEnum('currency_type', [
  'gold',
  'gems',
  'prestige',
  'faction',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'weapon',
  'armor',
  'helmet',
  'boots',
  'accessory',
  'consumable',
  'material',
  'quest',
]);

// Items table
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: itemTypeEnum('type').notNull(),
  rarity: rarityEnum('rarity').notNull().default('common'),
  basePrice: integer('base_price').notNull().default(0),
  levelReq: integer('level_req').notNull().default(1),
  stats: jsonb('stats').$type<Record<string, number>>().default({}),
  setId: text('set_id'),
  stackable: boolean('stackable').notNull().default(false),
  maxStack: integer('max_stack').default(99),
  createdAt: timestamp('created_at').defaultNow(),
});

// Inventory table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  characterId: integer('character_id').notNull(),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantity: integer('quantity').notNull().default(1),
  equipped: boolean('equipped').notNull().default(false),
  slot: text('slot'),
  enhanceLevel: integer('enhance_level').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Loot tables
export const lootTables = pgTable('loot_tables', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  entries: jsonb('entries').$type<{
    itemId: number;
    weight: number;
    minQuantity: number;
    maxQuantity: number;
    levelReq?: number;
  }[]>().notNull(),
  rollCount: integer('roll_count').notNull().default(1),
  guaranteedDrops: jsonb('guaranteed_drops').$type<number[]>().default([]),
});

// Crafting recipes
export const craftingRecipes = pgTable('crafting_recipes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  resultItemId: integer('result_item_id').notNull().references(() => items.id),
  resultQuantity: integer('result_quantity').notNull().default(1),
  materials: jsonb('materials').$type<{
    itemId: number;
    quantity: number;
  }[]>().notNull(),
  goldCost: integer('gold_cost').notNull().default(0),
  levelReq: integer('level_req').notNull().default(1),
  successRate: real('success_rate').notNull().default(1.0),
  craftingTime: integer('crafting_time').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Shop inventory
export const shopInventory = pgTable('shop_inventory', {
  id: serial('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  itemId: integer('item_id').notNull().references(() => items.id),
  price: integer('price').notNull(),
  currency: currencyEnum('currency').notNull().default('gold'),
  stock: integer('stock'),
  levelReq: integer('level_req').notNull().default(1),
  isRotating: boolean('is_rotating').notNull().default(false),
  availableFrom: timestamp('available_from'),
  availableUntil: timestamp('available_until'),
});
```
