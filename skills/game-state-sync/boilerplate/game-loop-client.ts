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
	maxExtrapolationMs: 250,
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
	// Engine-driven mode: step() was called. Excludes start().
	private externallyDriven = false;
	// True until the first step() (or after resetClock()) seeds the clock.
	private clockPending = true;

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
		if (this.externallyDriven) {
			throw new Error(
				'ClientGameLoop: step() already drives this loop; do not also call start()',
			);
		}
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

		const alpha = this.advance(timestamp);

		// Render: interpolate between previous and current state
		this.render(alpha);

		this.rafId = requestAnimationFrame((ts) => this.loop(ts));
	}

	/**
	 * Accumulate the time since the last call and run the fixed ticks it
	 * covers. Shared by the self-driven loop and step(). Returns the alpha.
	 */
	private advance(timestamp: number): number {
		// Cap spiral of death at 250 ms; a timestamp older than the last one
		// adds nothing (callers must use one time source throughout).
		const dt = Math.max(0, Math.min(timestamp - this.previousTimestamp, 250));
		this.previousTimestamp = timestamp;
		this.accumulator += dt;

		// Fixed timestep: advance simulation in discrete steps
		while (this.accumulator >= this.tickDuration) {
			this.tick();
			this.accumulator -= this.tickDuration;
		}

		return this.accumulator / this.tickDuration;
	}

	/**
	 * Engine-driven mode: advance the loop from the engine's own frame
	 * callback (Phaser update, a PixiJS ticker, three.js setAnimationLoop,
	 * R3F useFrame), so only one requestAnimationFrame loop runs. Pass the
	 * frame timestamp in milliseconds from one time source: the rAF time or
	 * performance.now(), never a mix. An earlier timestamp adds no time.
	 * Runs the same fixed ticks and 250 ms cap as start() and returns the
	 * render alpha. It does not call onRender or schedule a frame; read
	 * getRenderState() and draw.
	 *
	 * Do not call start() when you use step(): step() throws while the
	 * self-driven loop runs, and start() throws once step() has been used.
	 * The first call (and the first after resetClock()) only seeds the clock
	 * and returns 0.
	 */
	step(nowMs: number): number {
		if (this.running) {
			throw new Error(
				'ClientGameLoop: start() already drives this loop; do not also call step()',
			);
		}
		this.externallyDriven = true;
		if (this.clockPending) {
			this.clockPending = false;
			this.previousTimestamp = nowMs;
			this.accumulator = 0;
			return 0;
		}
		return this.advance(nowMs);
	}

	/**
	 * Engine-driven mode: forget the elapsed time so the next step() starts
	 * fresh, with no catch-up ticks. Call it when the tab becomes visible
	 * again, where the self-driven mode would call stop() and start().
	 */
	resetClock(): void {
		this.clockPending = true;
		this.accumulator = 0;
	}

	/**
	 * Per-frame read for rendering. Returns the previous and current state by
	 * reference (no copy) and the alpha of the last step or frame. Treat both
	 * states as read-only, and do not keep them past the frame: the next tick
	 * replaces them.
	 */
	getRenderState(): {
		prev: Readonly<TState>;
		current: Readonly<TState>;
		alpha: number;
	} {
		return {
			prev: this.prevState,
			current: this.currentState,
			alpha: this.accumulator / this.tickDuration,
		};
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
	 * Align the client's tick counter with the server's. Call it when the
	 * room is joined (the server's join message carries its tick), before
	 * start() or the first step(): inputs are tagged with this counter, and reconciliation
	 * replays ticks by it, so both sides must count the same ticks.
	 */
	syncTick(serverTick: number): void {
		this.currentTick = serverTick;
	}

	/**
	 * Handle an authoritative state update from the server.
	 * Performs server reconciliation:
	 * 1. Accept server state (at serverTick) as ground truth
	 * 2. Discard acknowledged inputs
	 * 3. Re-simulate every tick from serverTick + 1 to the current tick the way
	 *    tick() ran it: that tick's unacknowledged input (applyInput), then
	 *    onTick. Ticks with no input still step, or idle physics would snap
	 *    back on every update. Client and server must count ticks the same
	 *    way (syncTick). If the client is behind the server, or further ahead
	 *    than the input buffer covers, it takes the server's state and tick.
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

		const applyInput = this.applyInput;
		if (!applyInput) return;

		let reconciledState = structuredClone(serverState);
		const unacknowledged = this.getUnacknowledgedInputs(lastProcessedSequence);

		// Inputs the server has not processed although their tick has passed
		// on the server: apply them first so they are not lost.
		for (const buffered of unacknowledged) {
			if (buffered.tick <= serverTick) {
				reconciledState = applyInput(reconciledState, buffered.input);
			}
		}
		const ahead = this.currentTick - serverTick;
		if (ahead <= 0 || ahead > this.config.inputBufferSize) {
			this.currentTick = serverTick;
			this.currentState = reconciledState;
			return;
		}
		for (let tick = serverTick + 1; tick <= this.currentTick; tick++) {
			for (const buffered of unacknowledged) {
				if (buffered.tick === tick) {
					reconciledState = applyInput(reconciledState, buffered.input);
				}
			}
			if (this.onTick) {
				reconciledState = this.onTick(reconciledState, tick);
			}
		}

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
	 * Deep-clones both states (structuredClone) on every call; for per-frame
	 * rendering use getRenderState(), which returns references.
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
