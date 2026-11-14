/**
 * Browser save slots in IndexedDB. Each write moves the current slot to a
 * backup key and stores the new envelope in ONE readwrite transaction, so the
 * slot is either the old save or the new one, never half of each. A Web Lock
 * keeps two tabs from writing the same slot at once.
 *
 * Browser only (uses `indexedDB`, `navigator.locks`, `navigator.storage`).
 * Imports nothing but the envelope type.
 */

import type { SaveEnvelope } from "./save-envelope";

const DB_NAME = "game-saves";
const DB_VERSION = 1; // IndexedDB store layout, not the save payload version
const STORE = "slots";

const backupKey = (slot: string) => `${slot}:backup`;

const promisify = <T>(req: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

const done = (tx: IDBTransaction) =>
	new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error ?? new Error("save transaction aborted"));
		tx.onerror = () => reject(tx.error);
	});

export const openSaveDb = (onBlocked?: () => void) =>
	new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		// Store and index changes happen only here.
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		// Another tab still holds the old version open.
		req.onblocked = () => onBlocked?.();
		req.onsuccess = () => {
			const db = req.result;
			// A newer tab wants to upgrade: close so it can, then reload this tab.
			db.onversionchange = () => db.close();
			resolve(db);
		};
		req.onerror = () => reject(req.error);
	});

export const readSlot = async (db: IDBDatabase, slot: string) => {
	const tx = db.transaction(STORE, "readonly");
	const store = tx.objectStore(STORE);
	const [current, backup] = await Promise.all([
		promisify<unknown>(store.get(slot)),
		promisify<unknown>(store.get(backupKey(slot))),
	]);
	// Raw values: run each through loadSave, and fall back to the backup
	// when the current one fails.
	return { current, backup };
};

// Throws QuotaExceededError when the origin is full; catch it, tell the
// player, and offer to delete other slots or export the save.
export const writeSlot = (
	db: IDBDatabase,
	slot: string,
	envelope: SaveEnvelope,
) =>
	navigator.locks.request(`save:${slot}`, async () => {
		const tx = db.transaction(STORE, "readwrite");
		const store = tx.objectStore(STORE);
		const finished = done(tx);
		const getPrevious = store.get(slot);
		getPrevious.onsuccess = () => {
			// Requests are queued inside the open transaction, so the commit
			// covers both puts or neither.
			if (getPrevious.result !== undefined) {
				store.put(getPrevious.result, backupKey(slot));
			}
			store.put(envelope, slot);
		};
		await finished;
	});

// Ask once, when the player first saves, ideally from a click handler.
// Chrome decides without a prompt; Firefox asks the player.
export const requestPersistence = async (): Promise<boolean> => {
	if (!navigator.storage?.persist) return false;
	if (await navigator.storage.persisted()) return true;
	return navigator.storage.persist();
};

// Autosave when the page is hidden: the last event a page can rely on.
// `save` should be the same function the save button calls.
export const autosaveOnHide = (save: () => Promise<void>) => {
	const onChange = () => {
		if (document.visibilityState === "hidden") void save();
	};
	document.addEventListener("visibilitychange", onChange);
	return () => document.removeEventListener("visibilitychange", onChange);
};
