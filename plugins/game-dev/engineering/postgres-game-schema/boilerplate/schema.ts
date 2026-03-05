import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const rarityEnum = pgEnum("rarity", [
	"common",
	"uncommon",
	"rare",
	"epic",
	"legendary",
]);

export const itemTypeEnum = pgEnum("item_type", [
	"consumable",
	"equipment",
	"material",
	"collectible",
	"currency_pack",
	"key",
	"cosmetic",
	"misc",
]);

export const relationTypeEnum = pgEnum("relation_type", [
	"friend",
	"block",
	"guild",
	"rival",
	"follow",
]);

export const guildRoleEnum = pgEnum("guild_role", [
	"leader",
	"officer",
	"member",
	"recruit",
]);

export const leaderboardPeriodEnum = pgEnum("leaderboard_period", [
	"daily",
	"weekly",
	"monthly",
	"seasonal",
	"alltime",
]);

// ─── Players ─────────────────────────────────────────────────────────────────

export const players = pgTable(
	"players",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		username: text("username").notNull().unique(),
		email: text("email").notNull().unique(),
		displayName: text("display_name"),
		avatarUrl: text("avatar_url"),
		level: integer("level").notNull().default(1),
		xp: integer("xp").notNull().default(0),
		stats: jsonb("stats").$type<Record<string, number>>().default({}),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("players_level_idx").on(table.level),
		index("players_created_at_idx").on(table.createdAt),
	],
);

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = pgTable(
	"sessions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		gameMode: text("game_mode"),
		state: jsonb("state").$type<Record<string, unknown>>().default({}),
		startedAt: timestamp("started_at").notNull().defaultNow(),
		endedAt: timestamp("ended_at"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
	},
	(table) => [
		index("sessions_player_id_idx").on(table.playerId),
		index("sessions_game_mode_idx").on(table.gameMode),
	],
);

// ─── Item Definitions ────────────────────────────────────────────────────────

export const itemDefinitions = pgTable(
	"item_definitions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		type: itemTypeEnum("type").notNull(),
		rarity: rarityEnum("rarity").notNull().default("common"),
		baseStats: jsonb("base_stats").$type<Record<string, number>>().default({}),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		stackable: boolean("stackable").notNull().default(false),
		maxStack: integer("max_stack").default(99),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("item_definitions_type_idx").on(table.type),
		index("item_definitions_rarity_idx").on(table.rarity),
	],
);

// ─── Inventory ───────────────────────────────────────────────────────────────

export const inventory = pgTable(
	"inventory",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		itemDefinitionId: text("item_definition_id")
			.notNull()
			.references(() => itemDefinitions.id),
		quantity: integer("quantity").notNull().default(1),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({}),
		equippedSlot: text("equipped_slot"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("inventory_player_id_idx").on(table.playerId),
		index("inventory_player_item_idx").on(
			table.playerId,
			table.itemDefinitionId,
		),
	],
);

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = pgTable(
	"events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id").references(() => players.id, {
			onDelete: "set null",
		}),
		type: text("type").notNull(),
		data: jsonb("data").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("events_player_id_idx").on(table.playerId),
		index("events_type_idx").on(table.type),
		index("events_created_at_idx").on(table.createdAt),
		index("events_player_type_idx").on(table.playerId, table.type),
	],
);

// ─── Leaderboards ────────────────────────────────────────────────────────────

export const leaderboards = pgTable(
	"leaderboards",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		category: text("category").notNull(),
		score: real("score").notNull().default(0),
		rank: integer("rank"),
		period: leaderboardPeriodEnum("period").notNull().default("alltime"),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("leaderboards_player_category_period_idx").on(
			table.playerId,
			table.category,
			table.period,
		),
		index("leaderboards_category_score_idx").on(table.category, table.score),
		index("leaderboards_category_period_score_idx").on(
			table.category,
			table.period,
			table.score,
		),
	],
);

// ─── Achievements ────────────────────────────────────────────────────────────

export const achievements = pgTable(
	"achievements",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		achievementId: text("achievement_id").notNull(),
		unlockedAt: timestamp("unlocked_at"),
		progress: jsonb("progress").$type<Record<string, number>>().default({}),
	},
	(table) => [
		uniqueIndex("achievements_player_achievement_idx").on(
			table.playerId,
			table.achievementId,
		),
		index("achievements_player_id_idx").on(table.playerId),
	],
);

// ─── Currencies ──────────────────────────────────────────────────────────────

export const currencies = pgTable(
	"currencies",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		currencyType: text("currency_type").notNull(),
		amount: integer("amount").notNull().default(0),
		lifetimeEarned: integer("lifetime_earned").notNull().default(0),
	},
	(table) => [
		uniqueIndex("currencies_player_type_idx").on(
			table.playerId,
			table.currencyType,
		),
	],
);

// ─── Social Relations ────────────────────────────────────────────────────────

export const socialRelations = pgTable(
	"social_relations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		targetPlayerId: text("target_player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		type: relationTypeEnum("type").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("social_relations_pair_type_idx").on(
			table.playerId,
			table.targetPlayerId,
			table.type,
		),
		index("social_relations_player_id_idx").on(table.playerId),
		index("social_relations_target_id_idx").on(table.targetPlayerId),
	],
);

// ─── Guilds ──────────────────────────────────────────────────────────────────

export const guilds = pgTable(
	"guilds",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull().unique(),
		tag: text("tag").notNull().unique(),
		leaderId: text("leader_id")
			.notNull()
			.references(() => players.id),
		level: integer("level").notNull().default(1),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [index("guilds_leader_id_idx").on(table.leaderId)],
);

// ─── Guild Members ───────────────────────────────────────────────────────────

export const guildMembers = pgTable(
	"guild_members",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		guildId: text("guild_id")
			.notNull()
			.references(() => guilds.id, { onDelete: "cascade" }),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		role: guildRoleEnum("role").notNull().default("recruit"),
		joinedAt: timestamp("joined_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("guild_members_player_idx").on(table.playerId),
		index("guild_members_guild_id_idx").on(table.guildId),
		index("guild_members_guild_role_idx").on(table.guildId, table.role),
	],
);
