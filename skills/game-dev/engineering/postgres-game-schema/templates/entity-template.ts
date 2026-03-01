/**
 * Reusable entity table template.
 *
 * Use this pattern to add new game entities that follow
 * the same conventions as the core schema:
 * - UUID primary keys
 * - JSONB for extensible data
 * - Timestamps for audit trails
 * - Soft deletes via deletedAt
 * - Composite indexes for common queries
 */

import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { players } from "../boilerplate/schema";

// ─── Pattern 1: Simple owned entity ─────────────────────────────────────────
// Use for entities that belong to a player (quests, pets, crafted items, etc.)

export const playerEntities = pgTable(
	"player_entities",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(),
		name: text("name").notNull(),
		level: integer("level").notNull().default(1),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({}),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("player_entities_player_id_idx").on(table.playerId),
		index("player_entities_type_idx").on(table.entityType),
		index("player_entities_player_type_idx").on(
			table.playerId,
			table.entityType,
		),
	],
);

// ─── Pattern 2: Definition + instance (template pattern) ────────────────────
// Use when you have a catalog of definitions and player-owned instances.
// Example: skill trees, unlockable abilities, card collections.

export const entityDefinitions = pgTable(
	"entity_definitions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		category: text("category").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		baseProperties: jsonb("base_properties")
			.$type<Record<string, unknown>>()
			.default({}),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		sortOrder: integer("sort_order").notNull().default(0),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("entity_definitions_category_idx").on(table.category),
		index("entity_definitions_category_sort_idx").on(
			table.category,
			table.sortOrder,
		),
	],
);

export const entityInstances = pgTable(
	"entity_instances",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		definitionId: text("definition_id")
			.notNull()
			.references(() => entityDefinitions.id),
		level: integer("level").notNull().default(1),
		xp: integer("xp").notNull().default(0),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({}),
		state: text("state").notNull().default("active"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("entity_instances_player_id_idx").on(table.playerId),
		index("entity_instances_definition_id_idx").on(table.definitionId),
		uniqueIndex("entity_instances_player_definition_idx").on(
			table.playerId,
			table.definitionId,
		),
	],
);

// ─── Pattern 3: Enum-driven entity ──────────────────────────────────────────
// Use when the entity has a fixed set of states or categories.

export const entityStatusEnum = pgEnum("entity_status", [
	"active",
	"inactive",
	"expired",
	"locked",
	"completed",
]);

export const timedEntities = pgTable(
	"timed_entities",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(),
		status: entityStatusEnum("status").notNull().default("active"),
		data: jsonb("data").$type<Record<string, unknown>>().default({}),
		startsAt: timestamp("starts_at").notNull().defaultNow(),
		expiresAt: timestamp("expires_at"),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("timed_entities_player_id_idx").on(table.playerId),
		index("timed_entities_status_idx").on(table.status),
		index("timed_entities_player_type_status_idx").on(
			table.playerId,
			table.entityType,
			table.status,
		),
		index("timed_entities_expires_at_idx").on(table.expiresAt),
	],
);
