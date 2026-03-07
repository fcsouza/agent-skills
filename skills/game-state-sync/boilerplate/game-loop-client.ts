export interface GameLoopConfig {
	tickRate: number;
	inputBufferSize: number;
	interpolationDelay: number;
	maxExtrapolationMs: number;
}

export interface BufferedInput<TInput = unknown> {
	tick: number;
	input: TInput;
	sequence: number;
}

const DEFAULT_CONFIG: GameLoopConfig = {
	tickRate: 20,
	inputBufferSize: 128,
	interpolationDelay: 2,
	maxExtrapolationMs: 500,
};

/**
 * Client-side game loop with fixed timestep simulation,
 * client-side prediction, server reconciliation, and
 * requestAnimationFrame-based rendering.
 *
 * Generic over TState (your game state) and TInput (your input type).
 */
export class ClientGameLoop<
	TState extends Record<string, unknown>,
	TInput = unknown,
> {
	private config: GameLoopConfig;
	private running = false;
	private rafId = 0;

	// Timing
	private tickDuration: number;
	private previousTimestamp = 0;
	private accumulator = 0;
	private currentTick = 0;

	// State
	private prevState: TState;
	private currentState: TState;

	// Input buffer (ring buffer for replay during reconciliation)
	private inputBuffer: (BufferedInput<TInput> | null)[];
	private inputHead = 0;
	private inputSequence = 0;
	private lastAcknowledgedSequence = 0;

	// Server state tracking
	private lastServerTick = 0;
	private lastServerTimestamp = 0;

	// Callbacks — set these before calling start()
	onTick: ((state: TState, tick: number) => TState) | null = null;
	onRender: ((state: TState, alpha: number) => void) | null = null;
	onServerUpdate: ((serverState: TState, serverTick: number) => void) | null =
		null;
	onSendInput: ((input: BufferedInput<TInput>) => void) | null = null;
	captureInput: (() => TInput | null) | null = null;
	applyInput: ((state: TState, input: TInput) => TState) | null = null;

	constructor(initialState: TState, config: Partial<GameLoopConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.tickDuration = 1000 / this.config.tickRate;
		this.prevState = structuredClone(initialState);
		this.currentState = structuredClone(initialState);
		this.inputBuffer = new Array(this.config.inputBufferSize).fill(null);
	}

	/**
	 * Start the game loop. Uses requestAnimationFrame for rendering
	 * and a fixed timestep accumulator for simulation ticks.
	 */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.previousTimestamp = performance.now();
		this.accumulator = 0;
		this.rafId = requestAnimationFrame((ts) => this.loop(ts));
	}

	/**
	 * Stop the game loop.
	 */
	stop(): void {
		this.running = false;
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
	}

	/**
	 * Core loop: accumulate time, run fixed ticks, render with interpolation.
	 */
	private loop(timestamp: number): void {
		if (!this.running) return;

		const dt = Math.min(timestamp - this.previousTimestamp, 250); // Cap spiral of death
		this.previousTimestamp = timestamp;
		this.accumulator += dt;

		// Fixed timestep: advance simulation in discrete steps
		while (this.accumulator >= this.tickDuration) {
			this.tick();
			this.accumulator -= this.tickDuration;
		}

		// Render: interpolate between previous and current state
		const alpha = this.accumulator / this.tickDuration;
		this.render(alpha);

		this.rafId = requestAnimationFrame((ts) => this.loop(ts));
	}

	/**
	 * Process one simulation tick:
	 * 1. Capture input
	 * 2. Store in input buffer
	 * 3. Apply input locally (client-side prediction)
	 * 4. Send input to server
	 * 5. Advance simulation via onTick callback
	 */
	private tick(): void {
		this.currentTick++;
		this.prevState = structuredClone(this.currentState);

		// Capture and buffer input
		const rawInput = this.captureInput?.();
		if (rawInput && this.applyInput) {
			this.inputSequence++;
			const buffered: BufferedInput<TInput> = {
				tick: this.currentTick,
				input: rawInput,
				sequence: this.inputSequence,
			};

			// Store in ring buffer
			this.inputBuffer[this.inputHead] = buffered;
			this.inputHead = (this.inputHead + 1) % this.config.inputBufferSize;

			// Client-side prediction: apply input locally
			this.currentState = this.applyInput(
				structuredClone(this.currentState),
				rawInput,
			);

			// Send to server
			this.onSendInput?.(buffered);
		}

		// Advance simulation (physics, AI, etc.)
		if (this.onTick) {
			this.currentState = this.onTick(
				structuredClone(this.currentState),
				this.currentTick,
			);
		}
	}

	/**
	 * Render with interpolation between previous and current state.
	 * Alpha is the fraction between the two states (0.0 = prev, 1.0 = current).
	 */
	private render(alpha: number): void {
		if (!this.onRender) return;

		// For simple cases, pass current state and alpha.
		// The renderer is responsible for interpolating positions, rotations, etc.
		this.onRender(this.currentState, alpha);
	}

	/**
	 * Handle an authoritative state update from the server.
	 * Performs server reconciliation:
	 * 1. Accept server state as ground truth
	 * 2. Discard acknowledged inputs
	 * 3. Replay unacknowledged inputs on top of server state
	 */
	handleServerUpdate(
		serverState: TState,
		serverTick: number,
		lastProcessedSequence: number,
	): void {
		this.lastServerTick = serverTick;
		this.lastServerTimestamp = performance.now();
		this.lastAcknowledgedSequence = lastProcessedSequence;

		// Notify callback
		this.onServerUpdate?.(serverState, serverTick);

		if (!this.applyInput) return;

		// Start from authoritative server state
		let reconciledState = structuredClone(serverState);

		// Replay unacknowledged inputs
		const unacknowledged = this.getUnacknowledgedInputs(lastProcessedSequence);
		for (const buffered of unacknowledged) {
			reconciledState = this.applyInput(reconciledState, buffered.input);
		}

		// Update local state to reconciled result
		this.currentState = reconciledState;
	}

	/**
	 * Get all inputs that the server has not yet acknowledged.
	 * These need to be replayed on top of the server state.
	 */
	private getUnacknowledgedInputs(
		lastAckedSequence: number,
	): BufferedInput<TInput>[] {
		const results: BufferedInput<TInput>[] = [];

		for (let i = 0; i < this.config.inputBufferSize; i++) {
			const entry = this.inputBuffer[i];
			if (entry && entry.sequence > lastAckedSequence) {
				results.push(entry);
			}
		}

		return results.sort((a, b) => a.sequence - b.sequence);
	}

	/**
	 * Get the current interpolation states for external renderers.
	 * Useful if you need to interpolate specific fields outside the onRender callback.
	 */
	getInterpolationData(): {
		prev: TState;
		current: TState;
		alpha: number;
	} {
		return {
			prev: structuredClone(this.prevState),
			current: structuredClone(this.currentState),
			alpha: this.accumulator / this.tickDuration,
		};
	}

	/**
	 * Check if the server state is stale (no update received recently).
	 * Returns the time in ms since the last server update.
	 */
	getTimeSinceLastServerUpdate(): number {
		if (this.lastServerTimestamp === 0) return Number.POSITIVE_INFINITY;
		return performance.now() - this.lastServerTimestamp;
	}

	/**
	 * Check if we should be dead reckoning (server update is overdue).
	 */
	isExtrapolating(): boolean {
		return this.getTimeSinceLastServerUpdate() > this.config.maxExtrapolationMs;
	}

	getCurrentTick(): number {
		return this.currentTick;
	}

	getState(): Readonly<TState> {
		return this.currentState;
	}

	getTickRate(): number {
		return this.config.tickRate;
	}

	getTickDuration(): number {
		return this.tickDuration;
	}

	isRunning(): boolean {
		return this.running;
	}
}
