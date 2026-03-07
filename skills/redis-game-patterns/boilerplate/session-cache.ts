import { redis } from "./redis-client";

const key = (playerId: string) => `session:${playerId}`;

const DEFAULT_TTL = 3600; // 1 hour

export interface PlayerSession {
	playerId: string;
	username: string;
	level: number;
	faction?: string;
	serverId?: string;
	lastActivity: number;
	[key: string]: unknown;
}

export const sessionCache = {
	async get(playerId: string): Promise<PlayerSession | null> {
		const raw = await redis.get(key(playerId));
		if (!raw) return null;

		try {
			return JSON.parse(raw) as PlayerSession;
		} catch {
			await redis.del(key(playerId));
			return null;
		}
	},

	async set(playerId: string, data: PlayerSession, ttl = DEFAULT_TTL) {
		const serialized = JSON.stringify(data);
		await redis.set(key(playerId), serialized, "EX", ttl);
	},

	async delete(playerId: string) {
		await redis.del(key(playerId));
	},

	async refresh(playerId: string, ttl = DEFAULT_TTL): Promise<boolean> {
		const result = await redis.expire(key(playerId), ttl);
		return result === 1;
	},

	async getOrLoad(
		playerId: string,
		loadFn: (playerId: string) => Promise<PlayerSession | null>,
		ttl = DEFAULT_TTL,
	): Promise<PlayerSession | null> {
		const cached = await this.get(playerId);
		if (cached) return cached;

		const fromDb = await loadFn(playerId);
		if (!fromDb) return null;

		await this.set(playerId, fromDb, ttl);
		return fromDb;
	},

	async updateField(
		playerId: string,
		field: keyof PlayerSession,
		value: unknown,
		ttl = DEFAULT_TTL,
	) {
		const session = await this.get(playerId);
		if (!session) return false;

		(session as Record<string, unknown>)[field] = value;
		session.lastActivity = Date.now();
		await this.set(playerId, session, ttl);
		return true;
	},

	async exists(playerId: string): Promise<boolean> {
		const result = await redis.exists(key(playerId));
		return result === 1;
	},
};
