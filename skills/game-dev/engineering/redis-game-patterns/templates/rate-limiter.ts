import { redis } from "../boilerplate/redis-client";

interface RateLimitConfig {
	maxRequests: number;
	windowSeconds: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfter?: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
	attack: { maxRequests: 1, windowSeconds: 5 },
	chat_global: { maxRequests: 1, windowSeconds: 3 },
	chat_faction: { maxRequests: 1, windowSeconds: 1 },
	trade: { maxRequests: 5, windowSeconds: 10 },
	craft: { maxRequests: 3, windowSeconds: 10 },
	api_general: { maxRequests: 60, windowSeconds: 60 },
};

export const checkRateLimit = async (
	playerId: string,
	action: string,
	overrideConfig?: RateLimitConfig,
): Promise<RateLimitResult> => {
	const config =
		overrideConfig ?? RATE_LIMITS[action] ?? RATE_LIMITS.api_general;
	const key = `rl:${action}:${playerId}`;
	const now = Date.now();
	const windowStart = now - config.windowSeconds * 1000;

	const pipeline = redis.pipeline();
	pipeline.zremrangebyscore(key, 0, windowStart);
	pipeline.zcard(key);
	pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
	pipeline.expire(key, config.windowSeconds);

	const results = await pipeline.exec();
	const count = results?.[1]?.[1] as number;

	if (count >= config.maxRequests) {
		const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
		const retryAfter =
			oldest.length >= 2
				? Math.ceil(
						(parseInt(oldest[1]) + config.windowSeconds * 1000 - now) / 1000,
					)
				: config.windowSeconds;

		return {
			allowed: false,
			remaining: 0,
			retryAfter: Math.max(1, retryAfter),
		};
	}

	return {
		allowed: true,
		remaining: config.maxRequests - count - 1,
	};
};

export const resetRateLimit = async (playerId: string, action: string) => {
	await redis.del(`rl:${action}:${playerId}`);
};

export const getRateLimitConfig = (
	action: string,
): RateLimitConfig | undefined => RATE_LIMITS[action];
