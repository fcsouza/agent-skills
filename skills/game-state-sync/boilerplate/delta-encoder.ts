export interface Delta {
	changes: Record<string, unknown>;
	removals: string[];
}

export interface BinaryDelta {
	buffer: Uint8Array;
	changeCount: number;
	removalCount: number;
}

// Path segments that reach an object's prototype. A delta naming one could
// write onto Object.prototype for every object in the process.
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Encode the difference between two states as a minimal delta.
 * Handles nested objects, arrays, additions, and removals.
 * Keys use dot-notation for nested paths: "players.p1.position.x"
 */
export function encodeDelta(
	prev: Record<string, unknown>,
	current: Record<string, unknown>,
	prefix = "",
): Delta {
	const changes: Record<string, unknown> = {};
	const removals: string[] = [];

	const prevKeys = new Set(Object.keys(prev));
	const currentKeys = new Set(Object.keys(current));
	for (const key of [...prevKeys, ...currentKeys]) {
		// JSON.parse makes "__proto__" an own key; refuse it here too.
		if (FORBIDDEN_SEGMENTS.has(key)) {
			throw new Error(`Refusing state key "${key}" at "${prefix}"`);
		}
	}

	// Detect additions and modifications
	for (const key of currentKeys) {
		const path = prefix ? `${prefix}.${key}` : key;
		const prevVal = prev[key];
		const currVal = current[key];

		if (!prevKeys.has(key)) {
			// New key added
			changes[path] = currVal;
			continue;
		}

		if (currVal === prevVal) continue;

		if (isPlainObject(prevVal) && isPlainObject(currVal)) {
			// Recurse into nested objects
			const nested = encodeDelta(
				prevVal as Record<string, unknown>,
				currVal as Record<string, unknown>,
				path,
			);
			Object.assign(changes, nested.changes);
			removals.push(...nested.removals);
		} else if (Array.isArray(prevVal) && Array.isArray(currVal)) {
			// Array diff: compare by index for small arrays, replace entirely for large changes
			if (arraysEqual(prevVal, currVal)) continue;

			const maxLen = Math.max(prevVal.length, currVal.length);
			let changedCount = 0;

			for (let i = 0; i < maxLen; i++) {
				if (i >= currVal.length) {
					removals.push(`${path}[${i}]`);
					changedCount++;
				} else if (i >= prevVal.length || !deepEqual(prevVal[i], currVal[i])) {
					changes[`${path}[${i}]`] = currVal[i];
					changedCount++;
				}
			}

			// If more than half the array changed, send the whole array
			if (changedCount > maxLen / 2) {
				// Remove individual entries, send full array
				for (const k of Object.keys(changes)) {
					if (k.startsWith(`${path}[`)) delete changes[k];
				}
				const filtered = removals.filter((r) => !r.startsWith(`${path}[`));
				removals.length = 0;
				removals.push(...filtered);
				changes[path] = currVal;
			}

			// Sync array length
			if (currVal.length !== prevVal.length) {
				changes[`${path}.length`] = currVal.length;
			}
		} else {
			// Primitive value changed
			changes[path] = currVal;
		}
	}

	// Detect removals
	for (const key of prevKeys) {
		if (!currentKeys.has(key)) {
			const path = prefix ? `${prefix}.${key}` : key;
			removals.push(path);
		}
	}

	return { changes, removals };
}

/**
 * Reconstruct state by applying a delta to a base state.
 * Returns a new state object (does not mutate base).
 */
export function decodeDelta(
	base: Record<string, unknown>,
	delta: Delta,
): Record<string, unknown> {
	const result = structuredClone(base);

	// Apply removals first
	for (const path of delta.removals) {
		removePath(result, path);
	}

	// Apply changes
	for (const [path, value] of Object.entries(delta.changes)) {
		setPath(result, path, structuredClone(value));
	}

	return result;
}

/**
 * Encode a delta as a compact binary representation.
 * Format: [changeCount:u16][removalCount:u16][...entries]
 * Each entry: [pathLength:u16][pathBytes][valueLength:u32][valueBytes]
 */
export function toBinaryDelta(delta: Delta): BinaryDelta {
	const encoder = new TextEncoder();
	const entries: Uint8Array[] = [];

	// Encode changes
	for (const [path, value] of Object.entries(delta.changes)) {
		const pathBytes = encoder.encode(path);
		const valueBytes = encoder.encode(JSON.stringify(value));

		const entry = new Uint8Array(2 + pathBytes.length + 4 + valueBytes.length);
		const view = new DataView(entry.buffer);

		view.setUint16(0, pathBytes.length);
		entry.set(pathBytes, 2);
		view.setUint32(2 + pathBytes.length, valueBytes.length);
		entry.set(valueBytes, 6 + pathBytes.length);

		entries.push(entry);
	}

	// Encode removals (value length = 0 signals removal)
	for (const path of delta.removals) {
		const pathBytes = encoder.encode(path);
		const entry = new Uint8Array(2 + pathBytes.length + 4);
		const view = new DataView(entry.buffer);

		view.setUint16(0, pathBytes.length);
		entry.set(pathBytes, 2);
		view.setUint32(2 + pathBytes.length, 0); // 0 length = removal

		entries.push(entry);
	}

	// Combine with header
	const totalSize = 4 + entries.reduce((sum, e) => sum + e.length, 0);
	const buffer = new Uint8Array(totalSize);
	const headerView = new DataView(buffer.buffer);

	headerView.setUint16(0, Object.keys(delta.changes).length);
	headerView.setUint16(2, delta.removals.length);

	let offset = 4;
	for (const entry of entries) {
		buffer.set(entry, offset);
		offset += entry.length;
	}

	return {
		buffer,
		changeCount: Object.keys(delta.changes).length,
		removalCount: delta.removals.length,
	};
}

/**
 * Decode a binary delta back into a Delta object.
 */
export function fromBinaryDelta(binary: BinaryDelta): Delta {
	const decoder = new TextDecoder();
	// Respect the view's offset: a Uint8Array received from the network can be
	// a slice of a larger ArrayBuffer.
	const view = new DataView(
		binary.buffer.buffer,
		binary.buffer.byteOffset,
		binary.buffer.byteLength,
	);
	const changeCount = view.getUint16(0);
	const removalCount = view.getUint16(2);

	const changes: Record<string, unknown> = {};
	const removals: string[] = [];

	let offset = 4;
	const totalEntries = changeCount + removalCount;

	for (let i = 0; i < totalEntries; i++) {
		const pathLen = view.getUint16(offset);
		offset += 2;

		const pathBytes = binary.buffer.slice(offset, offset + pathLen);
		const path = decoder.decode(pathBytes);
		parsePath(path); // throws on a prototype segment before we index by it
		offset += pathLen;

		const valueLen = view.getUint32(offset);
		offset += 4;

		if (valueLen === 0) {
			removals.push(path);
		} else {
			const valueBytes = binary.buffer.slice(offset, offset + valueLen);
			const valueStr = decoder.decode(valueBytes);
			changes[path] = JSON.parse(valueStr);
			offset += valueLen;
		}
	}

	return { changes, removals };
}

/**
 * Calculate the byte size of a delta (JSON-encoded).
 * Useful for bandwidth monitoring.
 */
export function deltaByteSize(delta: Delta): number {
	return new TextEncoder().encode(JSON.stringify(delta)).length;
}

// --- Internal helpers ---

function setPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	const segments = parsePath(path);
	let current: unknown = obj;

	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		// Step only into own properties; never follow an inherited one.
		if (typeof seg === "number") {
			if (!Array.isArray(current)) return;
			if (!Object.hasOwn(current, seg) || current[seg] === undefined) {
				current[seg] = typeof segments[i + 1] === "number" ? [] : {};
			}
			current = current[seg];
		} else {
			if (!isPlainObject(current)) return;
			if (!Object.hasOwn(current, seg) || current[seg] === undefined) {
				current[seg] = typeof segments[i + 1] === "number" ? [] : {};
			}
			current = current[seg];
		}
	}

	const lastSeg = segments[segments.length - 1];
	if (typeof lastSeg === "number") {
		if (Array.isArray(current)) {
			(current as unknown[])[lastSeg] = value;
		}
	} else if (lastSeg === "length" && Array.isArray(current)) {
		(current as unknown[]).length = value as number;
	} else {
		(current as Record<string, unknown>)[lastSeg] = value;
	}
}

function removePath(obj: Record<string, unknown>, path: string): void {
	const segments = parsePath(path);
	let current: unknown = obj;

	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		// Step only into own properties; never follow an inherited one.
		if (typeof current !== "object" || current === null) return;
		if (!Object.hasOwn(current, seg)) return;
		current = (current as Record<string | number, unknown>)[seg];
	}

	const lastSeg = segments[segments.length - 1];
	if (typeof lastSeg === "number") {
		if (Array.isArray(current)) {
			(current as unknown[]).splice(lastSeg, 1);
		}
	} else {
		delete (current as Record<string, unknown>)[lastSeg];
	}
}

/**
 * Split a delta path into segments. Throws on a segment that reaches a
 * prototype, so decodeDelta refuses the whole delta and returns nothing.
 */
function parsePath(path: string): (string | number)[] {
	const segments: (string | number)[] = [];
	const parts = path.split(".");

	for (const part of parts) {
		// Only bracket suffixes are array indices. Dot parts stay strings, so a
		// Record key such as "123" or "1p" is not mistaken for an array index.
		const bracketMatch = part.match(/^(.+?)\[(\d+)\]$/);
		if (bracketMatch) {
			segments.push(bracketMatch[1]);
			segments.push(Number.parseInt(bracketMatch[2], 10));
		} else {
			segments.push(part);
		}
	}

	for (const seg of segments) {
		if (typeof seg === "string" && FORBIDDEN_SEGMENTS.has(seg)) {
			throw new Error(`Refusing delta path "${path}": segment "${seg}"`);
		}
	}

	return segments;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return false;

	if (Array.isArray(a) && Array.isArray(b)) {
		return arraysEqual(a, b);
	}

	if (isPlainObject(a) && isPlainObject(b)) {
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		if (keysA.length !== keysB.length) return false;
		return keysA.every((key) => deepEqual(a[key], b[key]));
	}

	return false;
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((val, i) => deepEqual(val, b[i]));
}
