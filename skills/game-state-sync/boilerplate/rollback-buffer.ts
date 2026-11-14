export interface BufferEntry<T> {
	tick: number;
	state: T;
}

/**
 * Ring buffer for storing historical game state snapshots.
 * Provides O(1) push/access and bounded memory usage.
 *
 * Generic over any state shape T.
 */
export class RollbackBuffer<T> {
	private buffer: (BufferEntry<T> | null)[];
	private capacity: number;
	private head = 0;
	private count = 0;
	private oldestTick = -1;
	private newestTick = -1;

	constructor(capacity: number) {
		if (capacity < 1) {
			throw new Error("RollbackBuffer capacity must be >= 1");
		}
		this.capacity = capacity;
		this.buffer = new Array(capacity).fill(null);
	}

	/**
	 * Store a state snapshot at the given tick.
	 * A tick already in the buffer is replaced in place, so a replay or a
	 * second snapshot of the same tick never leaves a stale copy behind.
	 * Otherwise, if the buffer is full, the oldest entry is overwritten.
	 */
	push(tick: number, state: T): void {
		const entry: BufferEntry<T> = {
			tick,
			state: structuredClone(state),
		};

		const existing = this.findIndex(tick);
		if (existing !== -1) {
			this.buffer[existing] = entry;
			return;
		}

		this.buffer[this.head] = entry;
		this.head = (this.head + 1) % this.capacity;
		this.newestTick = tick;

		if (this.count < this.capacity) {
			this.count++;
			if (this.count === 1) {
				this.oldestTick = tick;
			}
		} else {
			// Oldest entry was overwritten, update oldestTick
			const oldestEntry = this.buffer[this.head];
			if (oldestEntry) {
				this.oldestTick = oldestEntry.tick;
			}
		}
	}

	/**
	 * Retrieve the state at a specific tick.
	 * Returns null if the tick is not in the buffer.
	 */
	getAt(tick: number): T | null {
		if (this.count === 0) return null;
		if (tick < this.oldestTick || tick > this.newestTick) return null;

		const entry = this.findEntry(tick);
		return entry ? structuredClone(entry.state) : null;
	}

	/**
	 * Rollback to the state at the given tick.
	 * Returns the state at that tick, or null if not found.
	 * Does NOT modify the buffer — caller decides what to do with the state.
	 */
	rollbackTo(tick: number): T | null {
		return this.getAt(tick);
	}

	/**
	 * Get the most recent state in the buffer.
	 */
	getLatest(): T | null {
		if (this.count === 0) return null;
		const idx = (this.head - 1 + this.capacity) % this.capacity;
		const entry = this.buffer[idx];
		return entry ? structuredClone(entry.state) : null;
	}

	/**
	 * Get the oldest state still in the buffer.
	 */
	getOldest(): T | null {
		if (this.count === 0) return null;

		const startIdx = this.count < this.capacity ? 0 : this.head;

		const entry = this.buffer[startIdx];
		return entry ? structuredClone(entry.state) : null;
	}

	/**
	 * Get the tick range currently stored in the buffer.
	 */
	getTickRange(): { oldest: number; newest: number } | null {
		if (this.count === 0) return null;
		return { oldest: this.oldestTick, newest: this.newestTick };
	}

	/**
	 * Check if a specific tick is available in the buffer.
	 */
	hasTick(tick: number): boolean {
		if (this.count === 0) return false;
		if (tick < this.oldestTick || tick > this.newestTick) return false;
		return this.findEntry(tick) !== null;
	}

	/**
	 * Get all entries between two ticks (inclusive).
	 * Returns entries sorted by tick ascending.
	 */
	getRange(fromTick: number, toTick: number): BufferEntry<T>[] {
		const entries: BufferEntry<T>[] = [];

		for (let i = 0; i < this.count; i++) {
			const idx =
				this.count < this.capacity ? i : (this.head + i) % this.capacity;

			const entry = this.buffer[idx];
			if (entry && entry.tick >= fromTick && entry.tick <= toTick) {
				entries.push({
					tick: entry.tick,
					state: structuredClone(entry.state),
				});
			}
		}

		return entries.sort((a, b) => a.tick - b.tick);
	}

	/**
	 * Find the newest entry at or before `tick` and the oldest entry after it.
	 * Use for interpolation when entries are stored every N ticks, not every tick.
	 */
	getBracket(tick: number): {
		before: BufferEntry<T> | null;
		after: BufferEntry<T> | null;
	} {
		let before: BufferEntry<T> | null = null;
		let after: BufferEntry<T> | null = null;
		for (const entry of this.buffer) {
			if (!entry) continue;
			if (entry.tick <= tick && (!before || entry.tick > before.tick)) {
				before = entry;
			} else if (entry.tick > tick && (!after || entry.tick < after.tick)) {
				after = entry;
			}
		}
		return {
			before: before && {
				tick: before.tick,
				state: structuredClone(before.state),
			},
			after: after && { tick: after.tick, state: structuredClone(after.state) },
		};
	}

	/**
	 * Current number of entries stored.
	 */
	size(): number {
		return this.count;
	}

	/**
	 * Maximum number of entries the buffer can hold.
	 */
	getCapacity(): number {
		return this.capacity;
	}

	/**
	 * Remove all entries from the buffer.
	 */
	clear(): void {
		this.buffer = new Array(this.capacity).fill(null);
		this.head = 0;
		this.count = 0;
		this.oldestTick = -1;
		this.newestTick = -1;
	}

	/**
	 * Iterate over all entries from oldest to newest.
	 */
	*[Symbol.iterator](): Iterator<BufferEntry<T>> {
		for (let i = 0; i < this.count; i++) {
			const idx =
				this.count < this.capacity ? i : (this.head + i) % this.capacity;

			const entry = this.buffer[idx];
			if (entry) {
				yield {
					tick: entry.tick,
					state: structuredClone(entry.state),
				};
			}
		}
	}

	// --- Internal ---

	private findEntry(tick: number): BufferEntry<T> | null {
		const idx = this.findIndex(tick);
		return idx === -1 ? null : (this.buffer[idx] ?? null);
	}

	private findIndex(tick: number): number {
		// Linear scan — buffer is small (typically 32-128 entries)
		for (let i = 0; i < this.count; i++) {
			const idx =
				this.count < this.capacity ? i : (this.head + i) % this.capacity;
			if (this.buffer[idx]?.tick === tick) return idx;
		}
		return -1;
	}
}
