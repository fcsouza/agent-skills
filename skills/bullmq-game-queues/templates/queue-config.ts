// Verified against: bullmq 6.7.6 (2026-11-14)
// ============================================================
// Queue Configuration Template — BullMQ + Redis
// ============================================================

import type {
	QueueEventsOptions,
	QueueOptions,
	RedisOptions,
	WorkerOptions,
} from "bullmq";
import { QUEUE_NAMES, type QueueName } from "./job-types";

// ============================================================
// Redis Connections
// BullMQ creates ioredis connections from these options by default.
// Never set ioredis `keyPrefix`; BullMQ uses its own `prefix` option.
// ============================================================

const redisBase: RedisOptions = {
	host: process.env.REDIS_HOST ?? "localhost",
	port: Number(process.env.REDIS_PORT ?? 6379),
	password: process.env.REDIS_PASSWORD,
	db: Number(process.env.REDIS_DB ?? 0),
};

// Producers (game API handlers that enqueue) fail fast when Redis is down,
// so the player gets an error instead of a hung request.
export const producerConnection: RedisOptions = {
	...redisBase,
	maxRetriesPerRequest: 1,
};

// Workers retry Redis commands until Redis is back. BullMQ throws if an
// ioredis client passed to a worker has any other value.
export const workerConnection: RedisOptions = {
	...redisBase,
	maxRetriesPerRequest: null,
};

// One prefix shared by every Queue, Worker and QueueEvents. A QueueEvents
// without it listens on the default `bull` prefix and hears nothing.
export const QUEUE_PREFIX = "game";

// ============================================================
// Retry Strategy — Exponential Backoff
// Waits 2^(attempts - 1) * delay ms before each retry: 1s, 2s, 4s, 8s.
// ============================================================

export const defaultRetryStrategy = {
	attempts: 5,
	backoff: {
		type: "exponential" as const,
		delay: 1_000,
	},
};

// ============================================================
// Rate Limits
// A worker limiter is global per queue, shared by all workers and players.
// Use it for an external provider's send limit, never for per-player abuse:
// limit players at the API before you enqueue.
// ============================================================

export interface RateLimitConfig {
	max: number;
	duration: number; // ms
}

export const rateLimiters: Partial<Record<QueueName, RateLimitConfig>> = {
	[QUEUE_NAMES.NOTIFICATION]: { max: 20, duration: 60_000 }, // set to your push provider's limit
};

// ============================================================
// Concurrency Per Queue
// This, not job priority, keeps matchmaking ahead of analytics:
// each domain has its own queue and its own worker capacity.
// ============================================================

export const concurrencySettings: Record<QueueName, number> = {
	[QUEUE_NAMES.MATCHMAKING]: 5,
	[QUEUE_NAMES.GAME_EVENT]: 10,
	[QUEUE_NAMES.REWARD]: 5,
	[QUEUE_NAMES.NOTIFICATION]: 20,
	[QUEUE_NAMES.ANALYTICS]: 50,
};

// ============================================================
// Options Factories
// ============================================================

export const createQueueOptions = (): QueueOptions => ({
	connection: producerConnection,
	prefix: QUEUE_PREFIX,
	defaultJobOptions: {
		attempts: defaultRetryStrategy.attempts,
		backoff: defaultRetryStrategy.backoff,
		removeOnComplete: {
			age: 24 * 60 * 60, // seconds: keep 24 hours
			count: 1_000,
		},
		// Failed jobs stay in the failed set for at least 7 days: inspect and retry them there.
		removeOnFail: {
			age: 7 * 24 * 60 * 60,
		},
	},
});

export const createQueueEventsOptions = (): QueueEventsOptions => ({
	connection: redisBase,
	prefix: QUEUE_PREFIX,
});

export const getWorkerOptions = (queueName: QueueName): WorkerOptions => ({
	connection: workerConnection,
	prefix: QUEUE_PREFIX,
	concurrency: concurrencySettings[queueName],
	limiter: rateLimiters[queueName],
	stalledInterval: 30_000,
	maxStalledCount: 2,
	lockDuration: 60_000,
});
