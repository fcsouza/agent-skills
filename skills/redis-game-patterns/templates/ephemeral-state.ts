// Verified against: ioredis 6.0.0 (2026-11-14)
import type { Redis } from "ioredis";

// Short-lived game state that may vanish on restart: live match state,
// player presence, timed buffs. Durable outcomes (results, rewards,
// currency) go to the database, not here.

// --- Match state ---

export interface MatchState {
	matchId: string;
	players: string[];
	status: "waiting" | "active" | "finished";
	startedAt: number;
	data: Record<string, unknown>;
}

const matchKey = (matchId: string) => `match:${matchId}`;

// Writes ARGV[2] with a TTL of ARGV[3] seconds only if the key still holds
// ARGV[1], the JSON this caller read. Redis runs a script atomically, so no
// other write lands between the comparison and the SET. Returns 1 on write,
// 0 when another writer changed the key first.
const COMPARE_AND_SET = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

export const createMatchState = (redis: Redis, ttlSeconds = 3600) => {
	// Updates to one match from this process run one after another, so they
	// never race each other. The compare-and-set covers writers on other
	// servers: a lost race reads again and retries.
	const queues = new Map<string, Promise<unknown>>();
	const serialise = <T>(key: string, run: () => Promise<T>): Promise<T> => {
		const result = (queues.get(key) ?? Promise.resolve()).then(run, run);
		const tail = result.catch(() => undefined);
		queues.set(key, tail);
		void tail.then(() => {
			if (queues.get(key) === tail) queues.delete(key);
		});
		return result;
	};

	return {
		async create(state: MatchState) {
			await redis.set(matchKey(state.matchId), JSON.stringify(state), "EX", ttlSeconds);
		},

		async get(matchId: string): Promise<MatchState | null> {
			const raw = await redis.get(matchKey(matchId));
			return raw ? (JSON.parse(raw) as MatchState) : null;
		},

		// Read, apply, compare-and-set. `apply` must be pure: it can run more
		// than once when another server wins the race.
		update(
			matchId: string,
			apply: (current: MatchState) => MatchState,
			maxAttempts = 5,
		): Promise<MatchState | null> {
			const key = matchKey(matchId);
			return serialise(key, async () => {
				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					const raw = await redis.get(key);
					if (!raw) return null;
					const next = apply(JSON.parse(raw) as MatchState);
					const written = await redis.eval(
						COMPARE_AND_SET,
						1,
						key,
						raw,
						JSON.stringify(next),
						ttlSeconds,
					);
					if (written === 1) return next;
				}
				throw new Error(`match ${matchId}: update lost ${maxAttempts} races`);
			});
		},

		async delete(matchId: string) {
			await redis.del(matchKey(matchId));
		},
	};
};

// --- Player presence ---
// Clients heartbeat every few seconds; a missing key means offline.
// Set PRESENCE_TTL to about three heartbeat intervals so one dropped
// packet does not flash the player offline.

const presenceKey = (playerId: string) => `presence:${playerId}`;

export const createPresence = (redis: Redis, presenceTtlSeconds = 30) => ({
	async heartbeat(playerId: string, serverId: string) {
		await redis.set(
			presenceKey(playerId),
			JSON.stringify({ serverId, lastSeen: Date.now() }),
			"EX",
			presenceTtlSeconds,
		);
	},

	async getPresence(
		playerId: string,
	): Promise<{ serverId: string; lastSeen: number } | null> {
		const raw = await redis.get(presenceKey(playerId));
		return raw ? (JSON.parse(raw) as { serverId: string; lastSeen: number }) : null;
	},

	// Friends list / party screen: one round trip for many players.
	async filterOnline(playerIds: string[]): Promise<string[]> {
		if (playerIds.length === 0) return [];
		const values = await redis.mget(...playerIds.map(presenceKey));
		return playerIds.filter((_, i) => values[i] !== null);
	},
});

// --- Timed buffs and effects ---
// Each effect is its own key with EX, so it expires on time with no sweeper.
// A sorted set per player, scored by expiry time, lists the effects so we
// can read them without scanning keys.

export interface TempEffect {
	effectId: string;
	type: string;
	value: number;
	appliedAt: number;
}

const effectKey = (playerId: string, effectId: string) =>
	`effect:${playerId}:${effectId}`;
const effectIndexKey = (playerId: string) => `effects:${playerId}`;

// The index lives as long as the longest allowed effect.
export const createTempEffects = (redis: Redis, maxEffectSeconds = 24 * 3600) => ({
	async apply(playerId: string, effect: TempEffect, durationSeconds: number) {
		if (durationSeconds > maxEffectSeconds) {
			throw new Error(`effect longer than ${maxEffectSeconds}s`);
		}
		const expiresAt = Date.now() + durationSeconds * 1000;
		const results = await redis
			.multi()
			.set(effectKey(playerId, effect.effectId), JSON.stringify(effect), "EX", durationSeconds)
			.zadd(effectIndexKey(playerId), expiresAt, effect.effectId)
			.expire(effectIndexKey(playerId), maxEffectSeconds)
			.exec();
		if (!results) throw new Error("apply effect transaction aborted");
		for (const [err] of results) if (err) throw err;
	},

	async getActive(playerId: string): Promise<TempEffect[]> {
		const index = effectIndexKey(playerId);
		await redis.zremrangebyscore(index, 0, Date.now());
		const ids = await redis.zrange(index, 0, "-1");
		if (ids.length === 0) return [];
		const values = await redis.mget(...ids.map((id) => effectKey(playerId, id)));
		return values
			.filter((raw): raw is string => raw !== null)
			.map((raw) => JSON.parse(raw) as TempEffect);
	},

	async remove(playerId: string, effectId: string) {
		await redis
			.multi()
			.del(effectKey(playerId, effectId))
			.zrem(effectIndexKey(playerId), effectId)
			.exec();
	},
});
