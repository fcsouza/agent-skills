// ============================================================
// Queue Configuration Template — BullMQ + Redis
// ============================================================

import type { QueueOptions, WorkerOptions } from "bullmq";
import type { RedisOptions } from "ioredis";
import { QUEUE_NAMES, type QueueName } from "./job-types";

// ============================================================
// Redis Connection
// ============================================================

export const redisConnection: RedisOptions = {
	host: process.env.REDIS_HOST ?? "localhost",
	port: Number(process.env.REDIS_PORT ?? 6379),
	password: process.env.REDIS_PASSWORD,
	db: Number(process.env.REDIS_DB ?? 0),
	maxRetriesPerRequest: null, // Required by BullMQ
	enableReadyCheck: false,
};

// ============================================================
// Default Retry Strategy — Exponential Backoff
// ============================================================

export const defaultRetryStrategy = {
	attempts: 5,
	backoff: {
		type: "exponential" as const,
		delay: 1_000, // 1s base, then 2s, 4s, 8s, 16s
	},
};

export const criticalRetryStrategy = {
	attempts: 10,
	backoff: {
		type: "exponential" as const,
		delay: 500,
	},
};

export const lowPriorityRetryStrategy = {
	attempts: 3,
	backoff: {
		type: "exponential" as const,
		delay: 5_000,
	},
};

// ============================================================
// Dead Letter Queue Config
// ============================================================

export const DEAD_LETTER_QUEUE = "dead-letter";

export const deadLetterConfig = {
	queueName: DEAD_LETTER_QUEUE,
	maxRetries: 0, // Don't retry in DLQ — manual inspection only
};

// ============================================================
// Rate Limiter Config Per Queue
// ============================================================

export interface RateLimitConfig {
	max: number;
	duration: number; // ms
}

export const rateLimiters: Record<QueueName, RateLimitConfig> = {
	[QUEUE_NAMES.MATCHMAKING]: { max: 5, duration: 10_000 }, // 5 per 10s per player
	[QUEUE_NAMES.GAME_EVENT]: { max: 100, duration: 1_000 }, // 100 per second
	[QUEUE_NAMES.REWARD]: { max: 10, duration: 60_000 }, // 10 per minute
	[QUEUE_NAMES.NOTIFICATION]: { max: 20, duration: 60_000 }, // 20 per minute
	[QUEUE_NAMES.ANALYTICS]: { max: 1_000, duration: 1_000 }, // 1000 per second
};

// ============================================================
// Concurrency Settings Per Queue
// ============================================================

export const concurrencySettings: Record<QueueName, number> = {
	[QUEUE_NAMES.MATCHMAKING]: 5,
	[QUEUE_NAMES.GAME_EVENT]: 10,
	[QUEUE_NAMES.REWARD]: 5,
	[QUEUE_NAMES.NOTIFICATION]: 20,
	[QUEUE_NAMES.ANALYTICS]: 50,
};

// ============================================================
// Queue Options Factory
// ============================================================

export const createQueueOptions = (queueName: QueueName): QueueOptions => ({
	connection: redisConnection,
	prefix: `game:queue:${queueName}`,
	defaultJobOptions: {
		attempts: defaultRetryStrategy.attempts,
		backoff: defaultRetryStrategy.backoff,
		removeOnComplete: {
			age: 24 * 60 * 60, // 24 hours
			count: 1_000,
		},
		removeOnFail: {
			age: 7 * 24 * 60 * 60, // 7 days
		},
	},
});

// ============================================================
// Worker Options Factory
// ============================================================

export const createWorkerOptions = (queueName: QueueName): WorkerOptions => ({
	connection: redisConnection,
	prefix: `game:queue:${queueName}`,
	concurrency: concurrencySettings[queueName],
	limiter: rateLimiters[queueName],
	stalledInterval: 30_000, // Check for stalled jobs every 30s
	maxStalledCount: 2, // Mark as failed after 2 stalls
	lockDuration: 60_000, // 60s lock per job
});

// ============================================================
// Environment-Specific Overrides
// ============================================================

export const isDevelopment = process.env.NODE_ENV === "development";

export const devOverrides: Partial<WorkerOptions> = {
	concurrency: 1,
	limiter: { max: 1_000, duration: 1_000 },
};

export const getWorkerOptions = (queueName: QueueName): WorkerOptions => {
	const base = createWorkerOptions(queueName);
	if (isDevelopment) {
		return { ...base, ...devOverrides };
	}
	return base;
};
