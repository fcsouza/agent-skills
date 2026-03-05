// ============================================================
// Loot Table Configuration Types
// ============================================================

export const LootRarity = {
	COMMON: "common",
	UNCOMMON: "uncommon",
	RARE: "rare",
	EPIC: "epic",
	LEGENDARY: "legendary",
	MYTHIC: "mythic",
} as const;

export type LootRarity = (typeof LootRarity)[keyof typeof LootRarity];

// ============================================================
// Loot Conditions
// ============================================================

export interface LootCondition {
	type:
		| "player_level_min"
		| "player_level_max"
		| "quest_completed"
		| "flag_set"
		| "first_kill"
		| "world_event_active";
	value: string | number;
}

// ============================================================
// Loot Entry
// ============================================================

export interface LootEntry {
	/** Unique item identifier */
	itemId: string;
	/** Relative weight for drop probability (higher = more likely) */
	weight: number;
	/** Minimum quantity dropped */
	minQuantity: number;
	/** Maximum quantity dropped */
	maxQuantity: number;
	/** Item rarity tier */
	rarity: LootRarity;
	/** Conditions that must be met for this entry to be eligible */
	conditions: LootCondition[];
}

// ============================================================
// Loot Table
// ============================================================

export interface LootTable {
	/** Unique table identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Number of rolls on this table per drop event */
	rolls: number;
	/** Whether the same item can drop multiple times in one event */
	allowDuplicates: boolean;
	/** Guaranteed drops (always included regardless of rolls) */
	guaranteed: LootEntry[];
	/** Weighted random pool */
	entries: LootEntry[];
	/** Global conditions: all must be met for the table to be active */
	conditions: LootCondition[];
	/** Nested sub-tables (rolled independently) */
	subTables: LootTable[];
}

// ============================================================
// Roll Result
// ============================================================

export interface LootDrop {
	itemId: string;
	quantity: number;
	rarity: LootRarity;
	fromTable: string;
}

export type LootRollFn = (
	table: LootTable,
	context?: LootRollContext,
) => LootDrop[];

// ============================================================
// Roll Context (passed to the roll function)
// ============================================================

export interface LootRollContext {
	playerLevel: number;
	completedQuests: string[];
	activeFlags: string[];
	/** Luck modifier: 1.0 = normal, > 1.0 = improved drop rates for rarer items */
	luckMultiplier: number;
}

// ============================================================
// Rarity Weight Multipliers (for luck-based modification)
// ============================================================

export interface RarityWeightModifiers {
	[LootRarity.COMMON]: number;
	[LootRarity.UNCOMMON]: number;
	[LootRarity.RARE]: number;
	[LootRarity.EPIC]: number;
	[LootRarity.LEGENDARY]: number;
	[LootRarity.MYTHIC]: number;
}

export const DEFAULT_RARITY_WEIGHTS: RarityWeightModifiers = {
	[LootRarity.COMMON]: 1.0,
	[LootRarity.UNCOMMON]: 0.8,
	[LootRarity.RARE]: 0.5,
	[LootRarity.EPIC]: 0.2,
	[LootRarity.LEGENDARY]: 0.05,
	[LootRarity.MYTHIC]: 0.01,
};
