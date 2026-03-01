import { type Delta, decodeDelta, encodeDelta } from "./delta-encoder";
import { RollbackBuffer } from "./rollback-buffer";

export interface SyncEngineConfig {
	tickRate: number;
	snapshotInterval: number;
	historyLength: number;
	interpolationDelay: number;
}

export interface PlayerInput<TAction = unknown> {
	tick: number;
	playerId: string;
	actions: TAction[];
	sequence: number;
}

export interface SyncSnapshot<T> {
	tick: number;
	state: T;
	timestamp: number;
}

export interface ReconciliationResult<T> {
	corrected: boolean;
	state: T;
	replayFrom: number;
	replayTo: number;
}

const DEFAULT_CONFIG: SyncEngineConfig = {
	tickRate: 20,
	snapshotInterval: 3,
	historyLength: 64,
	interpolationDelay: 2,
};

export class StateSyncEngine<T extends Record<string, unknown>> {
	private config: SyncEngineConfig;
	private currentTick = 0;
	private currentState: T;
	private rollbackBuffer: RollbackBuffer<T>;
	private pendingInputs: PlayerInput[] = [];
	private lastAcknowledgedSequence = 0;
	private serverState: T | null = null;
	private serverTick = 0;

	constructor(initialState: T, config: Partial<SyncEngineConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.currentState = structuredClone(initialState);
		this.rollbackBuffer = new RollbackBuffer<T>(this.config.historyLength);
		this.rollbackBuffer.push(0, structuredClone(initialState));
	}

	getState(): Readonly<T> {
		return this.currentState;
	}

	getTick(): number {
		return this.currentTick;
	}

	getTickRate(): number {
		return this.config.tickRate;
	}

	getTickDuration(): number {
		return 1000 / this.config.tickRate;
	}

	/**
	 * Advance the simulation by one tick.
	 * Call the provided step function to mutate state.
	 */
	tick(step: (state: T, tick: number) => T): void {
		this.currentTick++;
		this.currentState = step(
			structuredClone(this.currentState),
			this.currentTick,
		);

		if (this.currentTick % this.config.snapshotInterval === 0) {
			this.rollbackBuffer.push(
				this.currentTick,
				structuredClone(this.currentState),
			);
		}
	}

	/**
	 * Store a snapshot at the current tick.
	 * Returns the snapshot for external use (e.g., broadcasting).
	 */
	snapshot(): SyncSnapshot<T> {
		const snap: SyncSnapshot<T> = {
			tick: this.currentTick,
			state: structuredClone(this.currentState),
			timestamp: Date.now(),
		};
		this.rollbackBuffer.push(snap.tick, snap.state);
		return snap;
	}

	/**
	 * Restore the engine to a previously captured snapshot tick.
	 * Returns null if the tick is not in the history buffer.
	 */
	restoreSnapshot(tick: number): T | null {
		const state = this.rollbackBuffer.getAt(tick);
		if (!state) return null;

		this.currentTick = tick;
		this.currentState = structuredClone(state);
		return structuredClone(state);
	}

	/**
	 * Apply a server delta to the local state.
	 * Returns the updated state.
	 */
	applyDelta(delta: Delta): T {
		this.currentState = decodeDelta(this.currentState, delta) as T;
		return structuredClone(this.currentState);
	}

	/**
	 * Generate a delta between two states.
	 * Returns null if states are identical.
	 */
	generateDelta(oldState: T, newState: T): Delta | null {
		const delta = encodeDelta(oldState, newState);
		if (
			Object.keys(delta.changes).length === 0 &&
			delta.removals.length === 0
		) {
			return null;
		}
		return delta;
	}

	/**
	 * Record a local input for client-side prediction.
	 * The input is stored until acknowledged by the server.
	 */
	recordInput(input: PlayerInput): void {
		this.pendingInputs.push(input);
	}

	/**
	 * Apply local input optimistically.
	 * The applier function mutates a clone of the current state.
	 */
	applyLocalInput(
		input: PlayerInput,
		applier: (state: T, input: PlayerInput) => T,
	): T {
		this.recordInput(input);
		this.currentState = applier(structuredClone(this.currentState), input);
		this.rollbackBuffer.push(
			this.currentTick,
			structuredClone(this.currentState),
		);
		return structuredClone(this.currentState);
	}

	/**
	 * Reconcile local state with authoritative server state.
	 * Replays unacknowledged inputs on top of server state.
	 *
	 * @param authoritativeState - The server's confirmed state
	 * @param serverTick - The tick the server state corresponds to
	 * @param lastProcessedSequence - The last input sequence the server has processed
	 * @param replayer - Function to re-apply a single input to a state
	 */
	reconcile(
		authoritativeState: T,
		serverTick: number,
		lastProcessedSequence: number,
		replayer: (state: T, input: PlayerInput) => T,
	): ReconciliationResult<T> {
		this.serverState = structuredClone(authoritativeState);
		this.serverTick = serverTick;
		this.lastAcknowledgedSequence = lastProcessedSequence;

		// Discard acknowledged inputs
		this.pendingInputs = this.pendingInputs.filter(
			(input) => input.sequence > lastProcessedSequence,
		);

		// Start from server state and replay unacknowledged inputs
		let reconciledState = structuredClone(authoritativeState);
		for (const input of this.pendingInputs) {
			reconciledState = replayer(reconciledState, input);
		}

		const corrected = !shallowEqual(this.currentState, reconciledState);

		this.currentState = reconciledState;
		this.rollbackBuffer.push(
			this.currentTick,
			structuredClone(this.currentState),
		);

		return {
			corrected,
			state: structuredClone(this.currentState),
			replayFrom: serverTick,
			replayTo: this.currentTick,
		};
	}

	/**
	 * Perform a full rollback to a specific tick and replay.
	 * Used when server correction requires rewinding multiple ticks.
	 *
	 * @param targetTick - The tick to roll back to
	 * @param replayer - Step function to advance one tick
	 * @returns The state after replay, or null if targetTick is not in buffer
	 */
	rollbackAndReplay(
		targetTick: number,
		replayer: (state: T, tick: number) => T,
	): T | null {
		const historicalState = this.rollbackBuffer.rollbackTo(targetTick);
		if (!historicalState) return null;

		let state = structuredClone(historicalState);
		for (let t = targetTick + 1; t <= this.currentTick; t++) {
			state = replayer(state, t);
			if (t % this.config.snapshotInterval === 0) {
				this.rollbackBuffer.push(t, structuredClone(state));
			}
		}

		this.currentState = state;
		return structuredClone(state);
	}

	/**
	 * Get interpolation data between two ticks for smooth rendering.
	 * Returns the two bounding states and the interpolation factor (0-1).
	 */
	getInterpolationStates(renderTime: number): {
		prev: T | null;
		next: T | null;
		alpha: number;
	} {
		const tickDuration = this.getTickDuration();
		const renderTick =
			this.currentTick -
			this.config.interpolationDelay +
			(renderTime % tickDuration) / tickDuration;

		const prevTick = Math.floor(renderTick);
		const nextTick = Math.ceil(renderTick);
		const alpha = renderTick - prevTick;

		return {
			prev: this.rollbackBuffer.getAt(prevTick),
			next: this.rollbackBuffer.getAt(nextTick),
			alpha,
		};
	}

	/**
	 * Get all unacknowledged inputs (for debug / metrics).
	 */
	getPendingInputCount(): number {
		return this.pendingInputs.length;
	}

	/**
	 * Clear all state and reset to initial conditions.
	 */
	reset(initialState: T): void {
		this.currentTick = 0;
		this.currentState = structuredClone(initialState);
		this.rollbackBuffer = new RollbackBuffer<T>(this.config.historyLength);
		this.rollbackBuffer.push(0, structuredClone(initialState));
		this.pendingInputs = [];
		this.lastAcknowledgedSequence = 0;
		this.serverState = null;
		this.serverTick = 0;
	}
}

function shallowEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object") return false;
	if (a === null || b === null) return false;

	const keysA = Object.keys(a as Record<string, unknown>);
	const keysB = Object.keys(b as Record<string, unknown>);
	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (
			(a as Record<string, unknown>)[key] !==
			(b as Record<string, unknown>)[key]
		) {
			return false;
		}
	}
	return true;
}
