// Verified against: drizzle-orm 0.45.4 (2026-11-14)
/**
 * Server-side save slots in Postgres with an optimistic revision check.
 *
 * A save slot holds state the server does not need to trust: settings,
 * single-player progress, camera position, tutorial flags. Currency, items,
 * ranked progress and anything else with value stay in the normalized tables
 * from `postgres-game-schema`, written by server logic, never uploaded here.
 *
 * Every function takes the database first, as `postgres-game-schema` does.
 * This file imports no driver, but `saveToSlot` needs one with interactive
 * transactions (postgres-js, node-postgres, neon-serverless). The 0.45
 * neon-http driver throws "No transactions support in neon-http driver".
 */

import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
	bigint,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// Same definition as `GameDb` in postgres-game-schema's query patterns:
// any Drizzle Postgres database, or a transaction from `db.transaction`.
export type GameDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

// ─── Tables ─────────────────────────────────────────────────────────────────

export const saveSlots = pgTable(
	"save_slots",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		// In your schema: .references(() => players.id, { onDelete: "cascade" })
		playerId: text("player_id").notNull(),
		slot: text("slot").notNull(), // "auto", "1", "2", ...
		revision: integer("revision").notNull().default(1), // +1 on every write
		formatVersion: integer("format_version").notNull(), // version of `payload`, normally spec.current
		// bigint: an int4 of milliseconds overflows after about 24 days of play.
		playedMs: bigint("played_ms", { mode: "number" }).notNull().default(0),
		payload: jsonb("payload").$type<unknown>().notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [uniqueIndex("save_slots_player_id_slot_idx").on(t.playerId, t.slot)],
);

// The previous versions of each slot, newest kept, oldest pruned.
export const saveSlotHistory = pgTable(
	"save_slot_history",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		saveSlotId: text("save_slot_id")
			.notNull()
			.references(() => saveSlots.id, { onDelete: "cascade" }),
		revision: integer("revision").notNull(),
		formatVersion: integer("format_version").notNull(),
		playedMs: bigint("played_ms", { mode: "number" }).notNull(),
		payload: jsonb("payload").$type<unknown>().notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		index("save_slot_history_save_slot_id_revision_idx").on(
			t.saveSlotId,
			t.revision,
		),
	],
);

// How many replaced versions each slot keeps. This skill's default; tune it
// to the size of your saves and how far back players need to go.
const KEEP_HISTORY = 5;

// ─── Save with a revision check ─────────────────────────────────────────────

export type SaveInput = {
	playerId: string; // from the session, never from the request body
	slot: string;
	expectedRevision: number; // the revision the client loaded; 0 for a new slot
	formatVersion: number; // spec.current: the upload was migrated by loadSave
	playedMs: number;
	payload: unknown; // loadSave(...).data from the upload, run on the server
};

export type SaveResult =
	| { status: "saved"; revision: number }
	| {
			status: "conflict";
			// Shown to the player beside the local save so they can choose.
			// Keep local: save again with expectedRevision = server.revision,
			// or with 0 when server is null (the slot was deleted).
			// Keep server: loadSlot and discard the local save.
			server: {
				revision: number;
				formatVersion: number;
				playedMs: number;
				updatedAt: Date;
			} | null;
	  };

const slotWhere = (playerId: string, slot: string) =>
	and(eq(saveSlots.playerId, playerId), eq(saveSlots.slot, slot));

const serverMeta = (db: GameDb, playerId: string, slot: string) =>
	db
		.select({
			revision: saveSlots.revision,
			formatVersion: saveSlots.formatVersion,
			playedMs: saveSlots.playedMs,
			updatedAt: saveSlots.updatedAt,
		})
		.from(saveSlots)
		.where(slotWhere(playerId, slot))
		.limit(1)
		.then((rows) => rows[0] ?? null);

// The shared write path: lock the row, check the revision, keep the old
// version in history, update, prune. Call it inside a transaction.
const writeExisting = async (
	tx: GameDb,
	input: SaveInput,
): Promise<SaveResult> => {
	// Lock the row so a second save for the same slot waits for this one.
	const [current] = await tx
		.select()
		.from(saveSlots)
		.where(slotWhere(input.playerId, input.slot))
		.for("update");

	if (!current || current.revision !== input.expectedRevision) {
		return {
			status: "conflict",
			server: current
				? {
						revision: current.revision,
						formatVersion: current.formatVersion,
						playedMs: current.playedMs,
						updatedAt: current.updatedAt,
					}
				: null,
		};
	}

	await tx.insert(saveSlotHistory).values({
		saveSlotId: current.id,
		revision: current.revision,
		formatVersion: current.formatVersion,
		playedMs: current.playedMs,
		payload: current.payload,
	});

	const [updated] = await tx
		.update(saveSlots)
		.set({
			revision: sql`${saveSlots.revision} + 1`,
			formatVersion: input.formatVersion,
			playedMs: input.playedMs,
			payload: input.payload,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(saveSlots.id, current.id),
				eq(saveSlots.revision, input.expectedRevision),
			),
		)
		.returning({ revision: saveSlots.revision });

	if (!updated) {
		// Unreachable while the row lock holds; kept so a refactor that
		// drops the lock fails safe instead of overwriting.
		throw new Error("save slot changed under a row lock");
	}

	await tx
		.delete(saveSlotHistory)
		.where(
			and(
				eq(saveSlotHistory.saveSlotId, current.id),
				lte(saveSlotHistory.revision, current.revision - KEEP_HISTORY),
			),
		);

	return { status: "saved", revision: updated.revision };
};

export const saveToSlot = (db: GameDb, input: SaveInput): Promise<SaveResult> =>
	db.transaction(async (tx) => {
		// First save of this slot. If another device created it first, the
		// unique index turns the insert into a no-op and we report a conflict.
		if (input.expectedRevision === 0) {
			const inserted = await tx
				.insert(saveSlots)
				.values({
					playerId: input.playerId,
					slot: input.slot,
					formatVersion: input.formatVersion,
					playedMs: input.playedMs,
					payload: input.payload,
				})
				.onConflictDoNothing({ target: [saveSlots.playerId, saveSlots.slot] })
				.returning({ revision: saveSlots.revision });
			if (inserted[0]) return { status: "saved", revision: inserted[0].revision };
			return {
				status: "conflict",
				server: await serverMeta(tx, input.playerId, input.slot),
			};
		}
		return writeExisting(tx, input);
	});

// ─── Restore an older version ───────────────────────────────────────────────

// The player picks a row from listSlotHistory. The restore is a normal save
// of that row's payload: same revision check, and the version it replaces
// goes into history, so a restore can itself be undone. The join on
// playerId and slot stops one player restoring another's row. Migrate the
// result with migrateAndValidate on load, as for any row.
export const restoreFromHistory = (
	db: GameDb,
	playerId: string,
	slot: string,
	historyId: string,
	expectedRevision: number,
): Promise<SaveResult | { status: "not-found" }> =>
	db.transaction(async (tx) => {
		const [old] = await tx
			.select({
				formatVersion: saveSlotHistory.formatVersion,
				playedMs: saveSlotHistory.playedMs,
				payload: saveSlotHistory.payload,
			})
			.from(saveSlotHistory)
			.innerJoin(saveSlots, eq(saveSlotHistory.saveSlotId, saveSlots.id))
			.where(and(eq(saveSlotHistory.id, historyId), slotWhere(playerId, slot)))
			.limit(1);
		if (!old) return { status: "not-found" };
		return writeExisting(tx, {
			playerId,
			slot,
			expectedRevision,
			formatVersion: old.formatVersion,
			playedMs: old.playedMs,
			payload: old.payload,
		});
	});

// ─── Load ───────────────────────────────────────────────────────────────────

// Returns the stored row. Run migrateAndValidate(spec, row.formatVersion,
// row.payload) before the game uses it. Keep `revision` and send it back as
// `expectedRevision` on the next save.
export const loadSlot = (db: GameDb, playerId: string, slot: string) =>
	db
		.select()
		.from(saveSlots)
		.where(and(eq(saveSlots.playerId, playerId), eq(saveSlots.slot, slot)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

// The versions a player can restore, newest first. Scoped by playerId and
// slot through save_slots, never by a bare id from the client.
export const listSlotHistory = (db: GameDb, playerId: string, slot: string) =>
	db
		.select({
			id: saveSlotHistory.id,
			revision: saveSlotHistory.revision,
			formatVersion: saveSlotHistory.formatVersion,
			playedMs: saveSlotHistory.playedMs,
			createdAt: saveSlotHistory.createdAt,
		})
		.from(saveSlotHistory)
		.innerJoin(saveSlots, eq(saveSlotHistory.saveSlotId, saveSlots.id))
		.where(slotWhere(playerId, slot))
		.orderBy(desc(saveSlotHistory.revision));
