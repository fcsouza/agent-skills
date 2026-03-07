/**
 * Genre-agnostic feedback and reward system scaffold.
 * Event-driven architecture for game events, reward triggers,
 * streak/combo tracking, and achievement progress.
 */

// -----------------------------------------------------------------------------
// Game Event Types
// -----------------------------------------------------------------------------

export interface GameEvent {
	type: string;
	data: Record<string, unknown>;
	timestamp: number;
}

export type EventHandler = (event: GameEvent) => void;

// -----------------------------------------------------------------------------
// Event Bus
// -----------------------------------------------------------------------------

export class GameEventBus {
	private readonly listeners: Map<string, Set<EventHandler>> = new Map();
	private readonly wildcardListeners: Set<EventHandler> = new Set();

	/** Subscribe to a specific event type. Returns an unsubscribe function. */
	on(type: string, handler: EventHandler): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)?.add(handler);
		return () => this.off(type, handler);
	}

	/** Subscribe to all events. Returns an unsubscribe function. */
	onAny(handler: EventHandler): () => void {
		this.wildcardListeners.add(handler);
		return () => this.wildcardListeners.delete(handler);
	}

	/** Unsubscribe a handler from a specific event type. */
	off(type: string, handler: EventHandler): void {
		this.listeners.get(type)?.delete(handler);
	}

	/** Emit an event to all matching listeners. */
	emit(type: string, data: Record<string, unknown> = {}): void {
		const event: GameEvent = {
			type,
			data,
			timestamp: Date.now(),
		};

		const handlers = this.listeners.get(type);
		if (handlers) {
			for (const handler of handlers) {
				handler(event);
			}
		}

		for (const handler of this.wildcardListeners) {
			handler(event);
		}
	}

	/** Remove all listeners. */
	clear(): void {
		this.listeners.clear();
		this.wildcardListeners.clear();
	}
}

// -----------------------------------------------------------------------------
// Reward System
// -----------------------------------------------------------------------------

export interface Reward {
	type: string;
	id: string;
	amount: number;
}

export interface RewardTrigger {
	id: string;
	condition: (event: GameEvent) => boolean;
	reward: Reward;
	/** If true, trigger fires only once. Defaults to false. */
	once?: boolean;
}

export class RewardSystem {
	private readonly triggers: Map<string, RewardTrigger> = new Map();
	private readonly firedOnce: Set<string> = new Set();
	private readonly bus: GameEventBus;
	private readonly pendingRewards: Reward[] = [];

	constructor(bus: GameEventBus) {
		this.bus = bus;
		this.bus.onAny((event) => this.evaluate(event));
	}

	/** Register a reward trigger. */
	register(trigger: RewardTrigger): void {
		this.triggers.set(trigger.id, trigger);
	}

	/** Unregister a reward trigger by ID. */
	unregister(id: string): void {
		this.triggers.delete(id);
	}

	/** Drain and return all pending rewards since last call. */
	flush(): Reward[] {
		const rewards = [...this.pendingRewards];
		this.pendingRewards.length = 0;
		return rewards;
	}

	/** Serialize fired-once state for save/load. */
	serialize(): { firedOnce: string[] } {
		return { firedOnce: [...this.firedOnce] };
	}

	/** Restore fired-once state from save data. */
	deserialize(data: { firedOnce: string[] }): void {
		this.firedOnce.clear();
		for (const id of data.firedOnce) {
			this.firedOnce.add(id);
		}
	}

	private evaluate(event: GameEvent): void {
		for (const [id, trigger] of this.triggers) {
			if (trigger.once && this.firedOnce.has(id)) continue;

			if (trigger.condition(event)) {
				this.pendingRewards.push({ ...trigger.reward });
				this.bus.emit("reward_granted", {
					triggerId: id,
					reward: trigger.reward,
				});

				if (trigger.once) {
					this.firedOnce.add(id);
				}
			}
		}
	}
}

// -----------------------------------------------------------------------------
// Streak / Combo Tracker
// -----------------------------------------------------------------------------

export interface StreakConfig {
	/** Event type that increments the streak. */
	incrementEvent: string;
	/** Event type that breaks the streak. Optional. */
	breakEvent?: string;
	/** Maximum time (ms) between increments before the streak breaks. 0 = no timeout. */
	timeoutMs?: number;
	/** Multiplier applied per streak level. Defaults to 1.0 (no bonus). */
	multiplierPerLevel?: number;
}

export interface StreakState {
	count: number;
	maxCount: number;
	lastIncrementTime: number;
	multiplier: number;
}

export class StreakTracker {
	private readonly streaks: Map<
		string,
		{ config: StreakConfig; state: StreakState }
	> = new Map();
	private readonly bus: GameEventBus;

	constructor(bus: GameEventBus) {
		this.bus = bus;
		this.bus.onAny((event) => this.handleEvent(event));
	}

	/** Register a named streak tracker. */
	register(name: string, config: StreakConfig): void {
		this.streaks.set(name, {
			config,
			state: {
				count: 0,
				maxCount: 0,
				lastIncrementTime: 0,
				multiplier: 1,
			},
		});
	}

	/** Get current state of a named streak. */
	get(name: string): StreakState | undefined {
		return this.streaks.get(name)?.state;
	}

	/** Reset a specific streak to zero. */
	reset(name: string): void {
		const entry = this.streaks.get(name);
		if (entry) {
			const prevCount = entry.state.count;
			entry.state.count = 0;
			entry.state.multiplier = 1;
			if (prevCount > 0) {
				this.bus.emit("streak_broken", { name, count: prevCount });
			}
		}
	}

	/** Serialize all streak states. */
	serialize(): Record<string, StreakState> {
		const result: Record<string, StreakState> = {};
		for (const [name, entry] of this.streaks) {
			result[name] = { ...entry.state };
		}
		return result;
	}

	/** Restore streak states from save data. */
	deserialize(data: Record<string, StreakState>): void {
		for (const [name, state] of Object.entries(data)) {
			const entry = this.streaks.get(name);
			if (entry) {
				entry.state = { ...state };
			}
		}
	}

	private handleEvent(event: GameEvent): void {
		for (const [name, entry] of this.streaks) {
			const { config, state } = entry;

			if (event.type === config.incrementEvent) {
				if (
					config.timeoutMs &&
					config.timeoutMs > 0 &&
					state.lastIncrementTime > 0
				) {
					const elapsed = event.timestamp - state.lastIncrementTime;
					if (elapsed > config.timeoutMs) {
						this.reset(name);
					}
				}

				state.count += 1;
				state.lastIncrementTime = event.timestamp;
				state.maxCount = Math.max(state.maxCount, state.count);
				state.multiplier =
					1 + (state.count - 1) * (config.multiplierPerLevel ?? 0);

				this.bus.emit("streak_incremented", {
					name,
					count: state.count,
					multiplier: state.multiplier,
				});
			}

			if (config.breakEvent && event.type === config.breakEvent) {
				this.reset(name);
			}
		}
	}
}

// -----------------------------------------------------------------------------
// Achievement Progress Tracker
// -----------------------------------------------------------------------------

export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	/** Total progress required to unlock. */
	target: number;
	/** Event type that contributes progress. */
	trackEvent: string;
	/** Extract progress increment from event data. Defaults to 1 per event. */
	extractProgress?: (event: GameEvent) => number;
}

export interface AchievementProgress {
	id: string;
	current: number;
	target: number;
	unlocked: boolean;
	unlockedAt: number | null;
}

export class AchievementTracker {
	private readonly definitions: Map<string, AchievementDef> = new Map();
	private readonly progress: Map<string, AchievementProgress> = new Map();
	private readonly bus: GameEventBus;

	constructor(bus: GameEventBus) {
		this.bus = bus;
		this.bus.onAny((event) => this.handleEvent(event));
	}

	/** Register an achievement definition. */
	register(def: AchievementDef): void {
		this.definitions.set(def.id, def);
		if (!this.progress.has(def.id)) {
			this.progress.set(def.id, {
				id: def.id,
				current: 0,
				target: def.target,
				unlocked: false,
				unlockedAt: null,
			});
		}
	}

	/** Get progress for a specific achievement. */
	get(id: string): AchievementProgress | undefined {
		return this.progress.get(id);
	}

	/** Get all achievement progress entries. */
	getAll(): AchievementProgress[] {
		return [...this.progress.values()];
	}

	/** Get only unlocked achievements. */
	getUnlocked(): AchievementProgress[] {
		return [...this.progress.values()].filter((a) => a.unlocked);
	}

	/** Serialize all progress for save/load. */
	serialize(): Record<string, AchievementProgress> {
		const result: Record<string, AchievementProgress> = {};
		for (const [id, prog] of this.progress) {
			result[id] = { ...prog };
		}
		return result;
	}

	/** Restore progress from save data. */
	deserialize(data: Record<string, AchievementProgress>): void {
		for (const [id, prog] of Object.entries(data)) {
			this.progress.set(id, { ...prog });
		}
	}

	private handleEvent(event: GameEvent): void {
		for (const [id, def] of this.definitions) {
			if (event.type !== def.trackEvent) continue;

			const prog = this.progress.get(id);
			if (!prog || prog.unlocked) continue;

			const increment = def.extractProgress ? def.extractProgress(event) : 1;
			prog.current = Math.min(prog.current + increment, prog.target);

			if (prog.current >= prog.target) {
				prog.unlocked = true;
				prog.unlockedAt = Date.now();
				this.bus.emit("achievement_unlocked", {
					id: def.id,
					name: def.name,
					description: def.description,
				});
			}
		}
	}
}
