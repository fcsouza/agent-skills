/**
 * Genre-agnostic core loop architecture.
 * Provides a system manager that registers and runs game systems in order
 * with configurable tick rate and deterministic update scheduling.
 */

// -----------------------------------------------------------------------------
// GameSystem Interface
// -----------------------------------------------------------------------------

export interface GameSystem {
	/** Initialize the system. Called once when the system is first registered. */
	init(): void;

	/** Update the system. Called every tick with delta time in seconds. */
	update(dt: number): void;

	/** Serialize system state for save/load. */
	serialize(): Record<string, unknown>;

	/** Restore system state from serialized data. */
	deserialize(data: Record<string, unknown>): void;
}

// -----------------------------------------------------------------------------
// SystemManager Configuration
// -----------------------------------------------------------------------------

export interface SystemManagerConfig {
	/** Target ticks per second. Defaults to 60. */
	tickRate?: number;

	/** Maximum delta time (seconds) to prevent spiral of death. Defaults to 0.25. */
	maxDt?: number;
}

// -----------------------------------------------------------------------------
// SystemManager
// -----------------------------------------------------------------------------

export class SystemManager {
	private readonly systems: Map<string, GameSystem> = new Map();
	private readonly order: string[] = [];
	private readonly tickRate: number;
	private readonly maxDt: number;
	private readonly fixedDt: number;

	private accumulator = 0;
	private running = false;
	private lastTime = 0;
	private animationFrameId: number | null = null;

	constructor(config: SystemManagerConfig = {}) {
		this.tickRate = config.tickRate ?? 60;
		this.maxDt = config.maxDt ?? 0.25;
		this.fixedDt = 1 / this.tickRate;
	}

	/** Register a system with a unique name. Systems update in registration order. */
	register(name: string, system: GameSystem): void {
		if (this.systems.has(name)) {
			throw new Error(`System "${name}" is already registered.`);
		}
		this.systems.set(name, system);
		this.order.push(name);
		system.init();
	}

	/** Unregister a system by name. */
	unregister(name: string): void {
		this.systems.delete(name);
		const index = this.order.indexOf(name);
		if (index !== -1) {
			this.order.splice(index, 1);
		}
	}

	/** Get a registered system by name. */
	get<T extends GameSystem>(name: string): T | undefined {
		return this.systems.get(name) as T | undefined;
	}

	/** Manually step all systems by a given delta time (seconds). */
	step(dt: number): void {
		const clampedDt = Math.min(dt, this.maxDt);
		for (const name of this.order) {
			const system = this.systems.get(name);
			if (system) {
				system.update(clampedDt);
			}
		}
	}

	/**
	 * Run a fixed-timestep loop. Uses requestAnimationFrame in browser
	 * environments. Call stop() to halt.
	 */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.lastTime = performance.now();
		this.accumulator = 0;
		this.tick();
	}

	/** Stop the game loop. */
	stop(): void {
		this.running = false;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/** Serialize all system states into a single save object. */
	serializeAll(): Record<string, Record<string, unknown>> {
		const state: Record<string, Record<string, unknown>> = {};
		for (const [name, system] of this.systems) {
			state[name] = system.serialize();
		}
		return state;
	}

	/** Deserialize and restore all system states from a save object. */
	deserializeAll(state: Record<string, Record<string, unknown>>): void {
		for (const [name, data] of Object.entries(state)) {
			const system = this.systems.get(name);
			if (system) {
				system.deserialize(data);
			}
		}
	}

	/** Returns the configured fixed delta time per tick. */
	getFixedDt(): number {
		return this.fixedDt;
	}

	/** Returns the configured tick rate. */
	getTickRate(): number {
		return this.tickRate;
	}

	/** Returns the list of registered system names in update order. */
	getSystemNames(): readonly string[] {
		return this.order;
	}

	private tick(): void {
		if (!this.running) return;

		const now = performance.now();
		const rawDt = (now - this.lastTime) / 1000;
		const frameDt = Math.min(rawDt, this.maxDt);
		this.lastTime = now;
		this.accumulator += frameDt;

		while (this.accumulator >= this.fixedDt) {
			for (const name of this.order) {
				const system = this.systems.get(name);
				if (system) {
					system.update(this.fixedDt);
				}
			}
			this.accumulator -= this.fixedDt;
		}

		this.animationFrameId = requestAnimationFrame(() => this.tick());
	}
}

// -----------------------------------------------------------------------------
// Abstract System Examples
// -----------------------------------------------------------------------------

/** Abstract input system. Extend with platform-specific input handling. */
export abstract class InputSystem implements GameSystem {
	abstract init(): void;
	abstract update(dt: number): void;

	serialize(): Record<string, unknown> {
		return {};
	}

	deserialize(_data: Record<string, unknown>): void {
		// Input state is transient — nothing to restore.
	}
}

/** Abstract physics/simulation system. Extend with genre-specific logic. */
export abstract class PhysicsSystem implements GameSystem {
	abstract init(): void;
	abstract update(dt: number): void;
	abstract serialize(): Record<string, unknown>;
	abstract deserialize(data: Record<string, unknown>): void;
}

/** Abstract render system. Extend with your rendering target (Canvas, WebGL, DOM, terminal). */
export abstract class RenderSystem implements GameSystem {
	abstract init(): void;
	abstract update(dt: number): void;

	serialize(): Record<string, unknown> {
		return {};
	}

	deserialize(_data: Record<string, unknown>): void {
		// Render state is ephemeral — nothing to restore.
	}
}
