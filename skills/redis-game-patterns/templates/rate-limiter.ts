// Verified against: ioredis 6.0.0 (2026-11-14)
import type { Redis } from "ioredis";

// Per-player, per-action sliding-window limit on a sorted set.
// Each attempt is a member scored by its timestamp in milliseconds.

export interface RateLimitConfig {
	maxRequests: number;
	windowSeconds: number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds?: number;
}

// Example limits. Tune them per game; the action names are yours.
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
	attack: { maxRequests: 1, windowSeconds: 5 },
	chat_global: { maxRequests: 1, windowSeconds: 3 },
	trade: { maxRequests: 5, windowSeconds: 10 },
	craft: { maxRequests: 3, windowSeconds: 10 },
	default: { maxRequests: 60, windowSeconds: 60 },
};

const rlKey = (action: string, playerId: string) => `rl:${action}:${playerId}`;

export const checkRateLimit = async (
	redis: Redis,
	playerId: string,
	action: string,
	config: RateLimitConfig = RATE_LIMITS[action] ?? RATE_LIMITS.default,
): Promise<RateLimitResult> => {
	const key = rlKey(action, playerId);
	const now = Date.now();
	const windowMs = config.windowSeconds * 1000;
	const member = `${now}:${crypto.randomUUID()}`;

	// MULTI, not a plain pipeline: no other client's command runs between
	// these steps, so two concurrent attempts cannot both see the old count.
	const results = await redis
		.multi()
		.zremrangebyscore(key, 0, now - windowMs)
		.zadd(key, now, member)
		.zcard(key)
		.expire(key, config.windowSeconds)
		.exec();
	if (!results) throw new Error("rate limiter transaction aborted");
	for (const [err] of results) if (err) throw err;

	const count = results[2][1];
	if (typeof count !== "number") throw new Error("unexpected ZCARD reply");

	if (count <= config.maxRequests) {
		return { allowed: true, remaining: config.maxRequests - count };
	}

	// Denied attempts do not count: remove this one so a player who spams
	// the action is not locked out longer than the window.
	await redis.zrem(key, member);
	const oldest = await redis.zrange(key, 0, "0", "WITHSCORES");
	const oldestMs = oldest.length >= 2 ? Number(oldest[1]) : now;
	return {
		allowed: false,
		remaining: 0,
		retryAfterSeconds: Math.max(
			1,
			Math.ceil((oldestMs + windowMs - now) / 1000),
		),
	};
};

export const resetRateLimit = async (
	redis: Redis,
	playerId: string,
	action: string,
) => {
	await redis.del(rlKey(action, playerId));
};
