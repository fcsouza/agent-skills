// Verified against: drizzle-orm 0.45.4 (2026-11-14)
/**
 * Common query patterns for the game schema in ../boilerplate/schema.ts.
 *
 * Every function takes the database as its first argument. Pass the client
 * your project builds (neon-http, postgres-js, node-postgres): each of their
 * 0.45 database classes extends `PgDatabase`, so it fits `GameDb`. This file imports no driver.
 */

import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
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

// Any Drizzle Postgres database. The queries use only the core query
// builder, so the relational schema generic does not matter here.
export type GameDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "seasonal" | "alltime";

// ─── Get player with inventory (skips soft-deleted players) ─────────────────

export const getPlayerWithInventory = async (db: GameDb, playerId: string) => {
	const [player] = await db
		.select()
		.from(players)
		.where(and(eq(players.id, playerId), isNull(players.deletedAt)))
		.limit(1);

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

export const getLeaderboardTopN = (
	db: GameDb,
	category: string,
	period: LeaderboardPeriod,
	limit = 100,
) =>
	db
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
			and(
				eq(leaderboards.category, category),
				eq(leaderboards.period, period),
				isNull(players.deletedAt),
			),
		)
		.orderBy(desc(leaderboards.score))
		.limit(limit);

// ─── Event aggregation: player activity in a time range ─────────────────────

export const getPlayerActivitySummary = (
	db: GameDb,
	playerId: string,
	since: Date,
) =>
	db
		.select({
			eventType: events.type,
			eventCount: count(events.id),
		})
		.from(events)
		.where(and(eq(events.playerId, playerId), gte(events.createdAt, since)))
		.groupBy(events.type)
		.orderBy(desc(count(events.id)));

// ─── Inventory search on a JSONB property ───────────────────────────────────

export const searchInventoryByProperty = (
	db: GameDb,
	playerId: string,
	propertyKey: string,
	propertyValue: string,
) =>
	db
		.select()
		.from(inventory)
		.innerJoin(
			itemDefinitions,
			eq(inventory.itemDefinitionId, itemDefinitions.id),
		)
		.where(
			and(
				eq(inventory.playerId, playerId),
				sql`${inventory.properties} ->> ${propertyKey} = ${propertyValue}`,
			),
		);

// ─── Items whose base stat meets a threshold ────────────────────────────────

export const findItemsByStatThreshold = (
	db: GameDb,
	statKey: string,
	minValue: number,
) =>
	db
		.select()
		.from(itemDefinitions)
		.where(
			sql`(${itemDefinitions.baseStats} ->> ${statKey})::numeric >= ${minValue}`,
		);

// ─── Bulk insert events (batch analytics) ───────────────────────────────────

export const insertBatchEvents = (
	db: GameDb,
	eventBatch: {
		playerId: string;
		type: string;
		data: Record<string, unknown>;
	}[],
) => db.insert(events).values(eventBatch);

// ─── Player currencies ──────────────────────────────────────────────────────

export const getPlayerCurrencies = (db: GameDb, playerId: string) =>
	db.select().from(currencies).where(eq(currencies.playerId, playerId));

// ─── Credit currency with an atomic increment ───────────────────────────────

// Credits only. A debit goes through spendCurrency, which refuses to overdraw.
export const addCurrency = (
	db: GameDb,
	playerId: string,
	currencyType: string,
	amount: number,
) => {
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new Error("addCurrency takes a positive integer; use spendCurrency to debit");
	}
	return db
		.insert(currencies)
		.values({ playerId, currencyType, amount, lifetimeEarned: amount })
		.onConflictDoUpdate({
			target: [currencies.playerId, currencies.currencyType],
			set: {
				amount: sql`${currencies.amount} + ${amount}`,
				lifetimeEarned: sql`${currencies.lifetimeEarned} + ${amount}`,
			},
		});
};

// ─── Spend currency without overdrawing ─────────────────────────────────────

// One UPDATE with `amount >= cost` in its WHERE: two parallel spends cannot
// both pass, because the second re-checks the row after the first commits.
// Returns false when the balance was too low (or the wallet row is missing);
// the caller refuses the purchase. Pass a transaction to spend and grant
// together.
export const spendCurrency = async (
	db: GameDb,
	playerId: string,
	currencyType: string,
	cost: number,
): Promise<boolean> => {
	if (!Number.isInteger(cost) || cost <= 0) {
		throw new Error("spendCurrency takes a positive integer cost");
	}
	const spent = await db
		.update(currencies)
		.set({ amount: sql`${currencies.amount} - ${cost}` })
		.where(
			and(
				eq(currencies.playerId, playerId),
				eq(currencies.currencyType, currencyType),
				gte(currencies.amount, cost),
			),
		)
		.returning({ id: currencies.id });
	return spent.length === 1;
};

// ─── Player achievements ────────────────────────────────────────────────────

export const getPlayerAchievements = (db: GameDb, playerId: string) =>
	db.select().from(achievements).where(eq(achievements.playerId, playerId));

// ─── Guild with members ─────────────────────────────────────────────────────

export const getGuildWithMembers = async (db: GameDb, guildId: string) => {
	const [guild] = await db
		.select()
		.from(guilds)
		.where(eq(guilds.id, guildId))
		.limit(1);

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
		.where(and(eq(guildMembers.guildId, guildId), isNull(players.deletedAt)));

	return { ...guild, members };
};

// ─── Upsert leaderboard score (keeps the best score) ────────────────────────

export const upsertLeaderboardScore = (
	db: GameDb,
	playerId: string,
	category: string,
	score: number,
	period: LeaderboardPeriod = "alltime",
) =>
	db
		.insert(leaderboards)
		.values({ playerId, category, score, period })
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

// ─── Count active players since a date ──────────────────────────────────────

export const countActivePlayers = async (db: GameDb, since: Date) => {
	const [result] = await db
		.select({
			activeCount: sql<number>`COUNT(DISTINCT ${events.playerId})`.mapWith(
				Number,
			),
		})
		.from(events)
		.where(gte(events.createdAt, since));

	return result?.activeCount ?? 0;
};
