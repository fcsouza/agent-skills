/**
 * Versioned save envelope: write the current version, migrate old versions
 * one step at a time, validate before the game sees the data.
 *
 * Runs in the browser and on Bun (both expose `crypto.subtle` and
 * `TextEncoder`). Imports nothing, so the client and the server can share it.
 *
 * Rules this file enforces:
 * - Every save carries `format` and `version`. Writes always use the current version.
 * - A save older than `minLoadable` or newer than `current` is refused, not guessed at.
 * - Migrations go from version n to n + 1 only. A missing step is an error.
 * - The payload is checked against a SHA-256 digest of its exact string, so
 *   accidental damage is caught before parsing. The digest is not tamper
 *   protection: the player can recompute it.
 * - Validation runs after migration, on the current shape only.
 */

export type SaveEnvelope = {
	format: string; // your game's id; refuses files from another game
	version: number; // payload shape version, an integer starting at 1
	savedAt: string; // ISO time, shown when the player picks between saves
	playedMs: number; // total play time, shown beside savedAt
	sha256: string; // hex digest of `payload`
	payload: string; // JSON.stringify of the game data, plain data only
};

// Same shape as a Zod schema's `.safeParse()` result, so `schema.safeParse`
// can be passed as-is. A hand-written type guard works too.
export type Validate<T> = (
	data: unknown,
) => { success: true; data: T } | { success: false; error: unknown };

// migrations[n] turns a version-n payload into a version-(n + 1) payload.
export type Migrations = Record<number, (data: unknown) => unknown>;

export type SaveSpec<T> = {
	format: string;
	current: number;
	minLoadable: number;
	migrations: Migrations;
	validate: Validate<T>;
};

export type LoadResult<T> =
	| { ok: true; data: T; migratedFrom: number | null; envelope: SaveEnvelope }
	| {
			ok: false;
			reason:
				| "not-an-envelope"
				| "wrong-game"
				| "corrupt"
				| "too-old"
				| "too-new"
				| "missing-migration"
				| "migration-failed"
				| "invalid";
			detail?: unknown;
	  };

const sha256Hex = async (text: string): Promise<string> => {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(digest), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
};

const isEnvelope = (value: unknown): value is SaveEnvelope => {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.format === "string" &&
		Number.isInteger(v.version) &&
		typeof v.savedAt === "string" &&
		typeof v.playedMs === "number" &&
		typeof v.sha256 === "string" &&
		typeof v.payload === "string"
	);
};

// Validate before writing too: a save that would fail to load must not
// replace one that loads.
export const createSave = async <T>(
	spec: SaveSpec<T>,
	data: T,
	playedMs: number,
): Promise<SaveEnvelope> => {
	const checked = spec.validate(data);
	if (!checked.success) {
		throw new Error("refusing to write a save that fails validation", {
			cause: checked.error,
		});
	}
	const payload = JSON.stringify(checked.data);
	return {
		format: spec.format,
		version: spec.current,
		savedAt: new Date().toISOString(),
		playedMs,
		sha256: await sha256Hex(payload),
		payload,
	};
};

export const loadSave = async <T>(
	spec: SaveSpec<T>,
	raw: unknown,
): Promise<LoadResult<T>> => {
	if (!isEnvelope(raw)) return { ok: false, reason: "not-an-envelope" };
	if (raw.format !== spec.format) return { ok: false, reason: "wrong-game" };
	if ((await sha256Hex(raw.payload)) !== raw.sha256) {
		return { ok: false, reason: "corrupt" };
	}
	let data: unknown;
	try {
		data = JSON.parse(raw.payload);
	} catch (error) {
		return { ok: false, reason: "corrupt", detail: error };
	}
	const result = migrateAndValidate(spec, raw.version, data);
	return result.ok ? { ...result, envelope: raw } : result;
};

export type MigrateResult<T> =
	| { ok: true; data: T; migratedFrom: number | null }
	| Extract<LoadResult<T>, { ok: false }>;

// The version window, the migration chain and validation, without the
// envelope. The server uses it on `save_slots.payload` with
// `save_slots.format_version`; `loadSave` uses it after the digest check.
export const migrateAndValidate = <T>(
	spec: SaveSpec<T>,
	version: number,
	input: unknown,
): MigrateResult<T> => {
	if (version > spec.current) return { ok: false, reason: "too-new" };
	if (version < spec.minLoadable) return { ok: false, reason: "too-old" };

	let data = input;
	for (let v = version; v < spec.current; v++) {
		const step = spec.migrations[v];
		if (!step) return { ok: false, reason: "missing-migration", detail: v };
		try {
			data = step(data);
		} catch (error) {
			return { ok: false, reason: "migration-failed", detail: { from: v, error } };
		}
	}

	const checked = spec.validate(data);
	if (!checked.success) {
		return { ok: false, reason: "invalid", detail: checked.error };
	}
	return {
		ok: true,
		data: checked.data,
		migratedFrom: version === spec.current ? null : version,
	};
};

// ─── Example spec (delete when you write your own) ──────────────────────────

type SaveV3 = {
	seed: string; // world seed; generated content is rebuilt from it
	generatorVersion: number;
	level: number;
	position: { x: number; y: number }; // engine vectors stored as plain numbers
	openedChests: string[]; // player changes to generated content
};

const isSaveV3 = (d: unknown): d is SaveV3 => {
	if (typeof d !== "object" || d === null) return false;
	const s = d as Record<string, unknown>;
	const pos = s.position as Record<string, unknown> | null | undefined;
	return (
		typeof s.seed === "string" &&
		Number.isInteger(s.generatorVersion) &&
		Number.isInteger(s.level) &&
		typeof pos === "object" &&
		pos !== null &&
		typeof pos.x === "number" &&
		typeof pos.y === "number" &&
		Array.isArray(s.openedChests) &&
		s.openedChests.every((c) => typeof c === "string")
	);
};

export const exampleSpec: SaveSpec<SaveV3> = {
	format: "my-game-save",
	current: 3,
	minLoadable: 2, // version 1 saves are refused with "too-old"
	migrations: {
		// v2 stored position as [x, y]; v3 stores { x, y }.
		2: (d) => {
			const old = d as { position: [number, number] } & Record<string, unknown>;
			const [x, y] = old.position;
			return { ...old, position: { x, y } };
		},
	},
	validate: (d) =>
		isSaveV3(d)
			? { success: true, data: d }
			: { success: false, error: "save does not match SaveV3" },
};
