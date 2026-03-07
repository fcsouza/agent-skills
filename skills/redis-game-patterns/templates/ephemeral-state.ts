import { redis } from "../boilerplate/redis-client";

// --- Match State ---
// Short-lived state for active matches/instances that expire when the match ends.

interface MatchState {
	matchId: string;
	players: string[];
	status: "waiting" | "active" | "finished";
	startedAt: number;
	data: Record<string, unknown>;
}

const matchKey = (matchId: string) => `match:${matchId}`;

export const matchState = {
	async create(state: MatchState, ttlSeconds = 3600) {
		await redis.set(
			matchKey(state.matchId),
			JSON.stringify(state),
			"EX",
			ttlSeconds,
		);
	},

	async get(matchId: string): Promise<MatchState | null> {
		const raw = await redis.get(matchKey(matchId));
		return raw ? (JSON.parse(raw) as MatchState) : null;
	},

	async update(
		matchId: string,
		updates: Partial<MatchState>,
		ttlSeconds = 3600,
	) {
		const current = await this.get(matchId);
		if (!current) return null;

		const updated = { ...current, ...updates };
		await redis.set(
			matchKey(matchId),
			JSON.stringify(updated),
			"EX",
			ttlSeconds,
		);
		return updated;
	},

	async delete(matchId: string) {
		await redis.del(matchKey(matchId));
	},
};

// --- Player Presence ---
// Heartbeat-based presence detection. Players send periodic heartbeats;
// absence of heartbeat = offline.

const presenceKey = (playerId: string) => `presence:${playerId}`;
const PRESENCE_TTL = 30; // seconds — player must heartbeat within this window

export const presence = {
	async heartbeat(playerId: string, serverId?: string) {
		const data = JSON.stringify({
			serverId,
			lastSeen: Date.now(),
		});
		await redis.set(presenceKey(playerId), data, "EX", PRESENCE_TTL);
	},

	async isOnline(playerId: string): Promise<boolean> {
		const result = await redis.exists(presenceKey(playerId));
		return result === 1;
	},

	async getPresence(
		playerId: string,
	): Promise<{ serverId?: string; lastSeen: number } | null> {
		const raw = await redis.get(presenceKey(playerId));
		return raw ? JSON.parse(raw) : null;
	},

	async getOnlinePlayers(playerIds: string[]): Promise<string[]> {
		const pipeline = redis.pipeline();
		for (const id of playerIds) {
			pipeline.exists(presenceKey(id));
		}
		const results = await pipeline.exec();
		return playerIds.filter((_, i) => results?.[i]?.[1] === 1);
	},
};

// --- Temporary Buffs/Effects ---
// Time-limited effects that auto-expire. No cleanup needed.

interface TempEffect {
	effectId: string;
	type: string;
	value: number;
	appliedAt: number;
}

const effectKey = (playerId: string, effectId: string) =>
	`effect:${playerId}:${effectId}`;
const effectIndexKey = (playerId: string) => `effects:${playerId}`;

export const tempEffects = {
	async apply(playerId: string, effect: TempEffect, durationSeconds: number) {
		const pipeline = redis.pipeline();
		pipeline.set(
			effectKey(playerId, effect.effectId),
			JSON.stringify(effect),
			"EX",
			durationSeconds,
		);
		pipeline.sadd(effectIndexKey(playerId), effect.effectId);
		pipeline.expire(effectIndexKey(playerId), durationSeconds + 60);
		await pipeline.exec();
	},

	async getActive(playerId: string): Promise<TempEffect[]> {
		const effectIds = await redis.smembers(effectIndexKey(playerId));
		if (effectIds.length === 0) return [];

		const pipeline = redis.pipeline();
		for (const id of effectIds) {
			pipeline.get(effectKey(playerId, id));
		}
		const results = await pipeline.exec();

		const active: TempEffect[] = [];
		const expired: string[] = [];

		for (let i = 0; i < effectIds.length; i++) {
			const raw = results?.[i]?.[1] as string | null;
			if (raw) {
				active.push(JSON.parse(raw) as TempEffect);
			} else {
				expired.push(effectIds[i]);
			}
		}

		if (expired.length > 0) {
			await redis.srem(effectIndexKey(playerId), ...expired);
		}

		return active;
	},

	async remove(playerId: string, effectId: string) {
		const pipeline = redis.pipeline();
		pipeline.del(effectKey(playerId, effectId));
		pipeline.srem(effectIndexKey(playerId), effectId);
		await pipeline.exec();
	},
};
