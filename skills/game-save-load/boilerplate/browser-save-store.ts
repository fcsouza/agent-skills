/**
 * Browser save slots in IndexedDB.
 *
 * Each slot record carries a local `revision`. A tab remembers the revision
 * it last loaded or wrote and passes it to `writeSlot`. Inside one readwrite
 * transaction, `writeSlot` compares it with the stored revision: on a match it
 * moves the current record to `<slot>:backup` and stores the new one with
 * revision + 1; on a mismatch it writes nothing and returns `stale`. This stops
 * a second tab with older progress (say, one left open in the background that
 * autosaves when hidden) from writing over newer progress from another tab.
 *
 * Readwrite transactions on the same object store run one at a time, in the
 * order they were created, so the compare and the write cannot interleave
 * with another tab's write.
 *
 * Browser only (uses `indexedDB`, `navigator.storage`, `document`).
 */

import type { SaveEnvelope } from "./save-envelope";

const DB_NAME = "game-saves";
const DB_VERSION = 1; // IndexedDB store layout, not the save payload version
const STORE = "slots";

export type SlotRecord = { revision: number; envelope: SaveEnvelope };

export type WriteResult =
	| { status: "saved"; revision: number }
	// Another tab saved since this tab loaded. Show the player both saves
	// (savedAt, playedMs) and let them choose, as for a server conflict.
	| { status: "stale"; stored: SlotRecord | undefined };

const backupKey = (slot: string) => `${slot}:backup`;

// The rule `writeSlot` applies inside its transaction. `expected` is the
// revision this tab loaded, 0 when it found the slot empty.
export const decideLocalWrite = (
	stored: { revision: number } | undefined,
	expected: number,
): { ok: true; next: number } | { ok: false } => {
	const current = stored?.revision ?? 0;
	return current === expected ? { ok: true, next: current + 1 } : { ok: false };
};

const isSlotRecord = (value: unknown): value is SlotRecord =>
	typeof value === "object" &&
	value !== null &&
	Number.isInteger((value as { revision?: unknown }).revision) &&
	"envelope" in value;

const promisify = <T>(req: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

export const openSaveDb = (opts: {
	// Another tab still holds the old version open; ask the player to close it.
	onBlocked?: () => void;
	// A newer tab wants to upgrade. The database is closed so it can; tell the
	// player to reload this tab, since its saves will fail from now on.
	onVersionChange: () => void;
}) =>
	new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		// Store and index changes happen only here.
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		req.onblocked = () => opts.onBlocked?.();
		req.onsuccess = () => {
			const db = req.result;
			db.onversionchange = () => {
				db.close();
				opts.onVersionChange();
			};
			resolve(db);
		};
		req.onerror = () => reject(req.error);
	});

// Raw records: run each envelope through loadSave and fall back to the backup
// when the current one fails. Keep `current.revision` (0 if absent) for the
// next writeSlot.
export const readSlot = async (db: IDBDatabase, slot: string) => {
	const tx = db.transaction(STORE, "readonly");
	const store = tx.objectStore(STORE);
	const [current, backup] = await Promise.all([
		promisify<unknown>(store.get(slot)),
		promisify<unknown>(store.get(backupKey(slot))),
	]);
	return {
		current: isSlotRecord(current) ? current : undefined,
		backup: isSlotRecord(backup) ? backup : undefined,
	};
};

// Rejects with QuotaExceededError when the origin is full; catch it, tell the
// player, and offer to delete other slots or export the save.
export const writeSlot = (
	db: IDBDatabase,
	slot: string,
	envelope: SaveEnvelope,
	expectedRevision: number,
) =>
	new Promise<WriteResult>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		const store = tx.objectStore(STORE);
		let result: WriteResult | undefined;
		const getCurrent = store.get(slot);
		getCurrent.onsuccess = () => {
			const stored = isSlotRecord(getCurrent.result)
				? getCurrent.result
				: undefined;
			const decision = decideLocalWrite(stored, expectedRevision);
			if (!decision.ok) {
				result = { status: "stale", stored };
				return; // no further requests: the transaction commits nothing
			}
			if (stored) store.put(stored, backupKey(slot));
			const next: SlotRecord = { revision: decision.next, envelope };
			store.put(next, slot);
			result = { status: "saved", revision: decision.next };
		};
		tx.oncomplete = () =>
			result ? resolve(result) : reject(new Error("save transaction ended without a result"));
		tx.onabort = () => reject(tx.error ?? new Error("save transaction aborted"));
	});

// Ask once, when the player first saves, ideally from a click handler.
// Chrome decides without a prompt; Firefox asks the player.
export const requestPersistence = async (): Promise<boolean> => {
	if (!navigator.storage?.persist) return false;
	if (await navigator.storage.persisted()) return true;
	return navigator.storage.persist();
};

// Best-effort save when the page is hidden. The browser may end the page
// before the write finishes, so checkpoint and timer saves are the main path;
// this one catches what happened since the last of them.
export const autosaveOnHide = (save: () => Promise<void>) => {
	const onChange = () => {
		if (document.visibilityState === "hidden") void save();
	};
	document.addEventListener("visibilitychange", onChange);
	return () => document.removeEventListener("visibilitychange", onChange);
};
