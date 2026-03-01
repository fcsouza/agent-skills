/**
 * Common query patterns for game schemas.
 *
 * These examples use Drizzle ORM's query builder and SQL operators.
 * Adapt them to your game's specific needs.
 */

import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../boilerplate/migrations";
import {
	achievements,
	currencies,
	events,
	guildMembers,
	guilds,
	inventory,
	itemDefinitions,
	leaderboards,
	players,
} from "../boilerplate/schema";

// ─── Get player with inventory ──────────────────────────────────────────────

export const getPlayerWithInventory = async (playerId: string) => {
	const player = await db.query.players.findFirst({
		where: and(eq(players.id, playerId), sql`${players.deletedAt} IS NULL`),
	});

	if (!player) return null;

	const items = await db
		.select({
			inventoryId: inventory.id,
			quantity: inventory.quantity,
			equippedSlot: inventory.equippedSlot,
			properties: inventory.properties,
			itemName: itemDefinitions.name,
			itemType: itemDefinitions.type,
			itemRarity: itemDefinitions.rarity,
			baseStats: itemDefinitions.baseStats,
		})
		.from(inventory)
		.innerJoin(
			itemDefinitions,
			eq(inventory.itemDefinitionId, itemDefinitions.id),
		)
		.where(eq(inventory.playerId, playerId));

	return { ...player, inventory: items };
};

// ─── Leaderboard: top N by category and period ──────────────────────────────

export const getLeaderboardTopN = async (
	category: string,
	period: "daily" | "weekly" | "monthly" | "seasonal" | "alltime",
	limit = 100,
) => {
	return db
		.select({
			playerId: leaderboards.playerId,
			score: leaderboards.score,
			rank: leaderboards.rank,
			displayName: players.displayName,
			avatarUrl: players.avatarUrl,
		})
		.from(leaderboards)
		.innerJoin(players, eq(leaderboards.playerId, players.id))
		.where(
			and(eq(leaderboards.category, category), eq(leaderboards.period, period)),
		)
		.orderBy(desc(leaderboards.score))
		.limit(limit);
};

// ─── Event aggregation: player activity in time range ───────────────────────

export const getPlayerActivitySummary = async (
	playerId: string,
	since: Date,
) => {
	return db
		.select({
			eventType: events.type,
			eventCount: count(events.id),
		})
		.from(events)
		.where(and(eq(events.playerId, playerId), gte(events.createdAt, since)))
		.groupBy(events.type)
		.orderBy(desc(count(events.id)));
};

// ─── Inventory search with JSONB operators ──────────────────────────────────

export const searchInventoryByProperty = async (
	playerId: string,
	propertyKey: string,
	propertyValue: unknown,
) => {
	return db
		.select()
		.from(inventory)
		.innerJoin(
			itemDefinitions,
			eq(inventory.itemDefinitionId, itemDefinitions.id),
		)
		.where(
			and(
				eq(inventory.playerId, playerId),
				sql`${inventory.properties}->>
${propertyKey} = ${String(propertyValue)}`,
			),
		);
};

// ─── Search items by base stat threshold ────────────────────────────────────

export const findItemsByStatThreshold = async (
	statKey: string,
	minValue: number,
) => {
	return db
		.select()
		.from(itemDefinitions)
		.where(
			sql`(${itemDefinitions.baseStats}->>
${statKey})::numeric >= ${minValue}`,
		);
};

// ─── Bulk insert events (batch analytics) ───────────────────────────────────

export const insertBatchEvents = async (
	eventBatch: {
		playerId: string;
		type: string;
		data: Record<string, unknown>;
	}[],
) => {
	return db.insert(events).values(eventBatch);
};

// ─── Get player currencies ──────────────────────────────────────────────────

export const getPlayerCurrencies = async (playerId: string) => {
	return db.select().from(currencies).where(eq(currencies.playerId, playerId));
};

// ─── Update currency with atomic increment ──────────────────────────────────

export const addCurrency = async (
	playerId: string,
	currencyType: string,
	amount: number,
) => {
	return db
		.insert(currencies)
		.values({
			playerId,
			currencyType,
			amount,
			lifetimeEarned: amount > 0 ? amount : 0,
		})
		.onConflictDoUpdate({
			target: [currencies.playerId, currencies.currencyType],
			set: {
				amount: sql`${currencies.amount} + ${amount}`,
				lifetimeEarned:
					amount > 0
						? sql`${currencies.lifetimeEarned} + ${amount}`
						: sql`${currencies.lifetimeEarned}`,
			},
		});
};

// ─── Get player achievements with completion status ─────────────────────────

export const getPlayerAchievements = async (playerId: string) => {
	return db
		.select()
		.from(achievements)
		.where(eq(achievements.playerId, playerId));
};

// ─── Get guild with members ─────────────────────────────────────────────────

export const getGuildWithMembers = async (guildId: string) => {
	const guild = await db.query.guilds.findFirst({
		where: eq(guilds.id, guildId),
	});

	if (!guild) return null;

	const members = await db
		.select({
			memberId: guildMembers.id,
			playerId: guildMembers.playerId,
			role: guildMembers.role,
			joinedAt: guildMembers.joinedAt,
			displayName: players.displayName,
			level: players.level,
		})
		.from(guildMembers)
		.innerJoin(players, eq(guildMembers.playerId, players.id))
		.where(eq(guildMembers.guildId, guildId));

	return { ...guild, members };
};

// ─── Upsert leaderboard score ───────────────────────────────────────────────

export const upsertLeaderboardScore = async (
	playerId: string,
	category: string,
	score: number,
	period: "daily" | "weekly" | "monthly" | "seasonal" | "alltime" = "alltime",
) => {
	return db
		.insert(leaderboards)
		.values({
			playerId,
			category,
			score,
			period,
		})
		.onConflictDoUpdate({
			target: [
				leaderboards.playerId,
				leaderboards.category,
				leaderboards.period,
			],
			set: {
				score: sql`GREATEST(${leaderboards.score}, ${score})`,
				updatedAt: sql`now()`,
			},
		});
};

// ─── Count active players in time range ─────────────────────────────────────

export const countActivePlayers = async (since: Date) => {
	const result = await db
		.select({
			activeCount: sql<number>`COUNT(DISTINCT ${events.playerId})`,
		})
		.from(events)
		.where(gte(events.createdAt, since));

	return result[0]?.activeCount ?? 0;
};
