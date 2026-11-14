// Verified against: drizzle-orm 0.45.4, ioredis 6.0.0 (2026-11-14)
import { and, eq, isNull, lt } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type Redis from "ioredis";
import {
	analyticsEvents,
	analyticsSessions,
	type NewAnalyticsEvent,
} from "./analytics-schema";

/** Any Drizzle Postgres database: postgres-js, node-postgres, neon-http, ... */
export type AnalyticsDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

type LogLevel = "info" | "warn" | "error";

const REDIS_KEY = "analytics:events";
const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

interface AnalyticsClientOptions {
	/** The caller owns the Redis connection (see the `redis-game-patterns` skill). */
	redis: Redis;
	/** The caller owns the Drizzle database and its driver. */
	db: AnalyticsDb;
	userId: string;
	platform: string;
	version: string;
	redisKey?: string;
	batchSize?: number;
	logger?: (level: LogLevel, message: string) => void;
}

/** One client per connected player. `flush()` belongs to a single worker. */
export class AnalyticsClient {
	private readonly redis: Redis;
	private readonly db: AnalyticsDb;
	private readonly userId: string;
	private readonly platform: string;
	private readonly version: string;
	private readonly redisKey: string;
	private readonly batchSize: number;
	private readonly log: (level: LogLevel, message: string) => void;
	private sessionId: string | null = null;

	constructor(options: AnalyticsClientOptions) {
		this.redis = options.redis;
		this.db = options.db;
		this.userId = options.userId;
		this.platform = options.platform;
		this.version = options.version;
		this.redisKey = options.redisKey ?? REDIS_KEY;
		this.batchSize = options.batchSize ?? BATCH_SIZE;
		this.log =
			options.logger ??
			((level, message) => {
				if (level === "error") console.error(`[analytics] ${message}`);
				else console.log(`[analytics] ${message}`);
			});
	}

	/**
	 * Fire-and-forget. Buffers the event in Redis with LPUSH and never throws.
	 * Events tracked before `trackSession('start')` are dropped with a warning,
	 * so they never merge into one fake session in session-keyed funnels.
	 */
	track(eventName: string, properties?: Record<string, unknown>): void {
		if (!this.sessionId) {
			this.log("warn", `Dropped "${eventName}": no active session`);
			return;
		}
		const event: NewAnalyticsEvent = {
			id: crypto.randomUUID(),
			userId: this.userId,
			sessionId: this.sessionId,
			eventName,
			properties: properties ?? {},
			platform: this.platform,
			version: this.version,
			createdAt: new Date(),
		};

		this.redis.lpush(this.redisKey, JSON.stringify(event)).catch((err) => {
			this.log("error", `Failed to buffer "${eventName}": ${err.message}`);
		});
	}

	/**
	 * Session lifecycle. 'start' creates the session row, 'heartbeat' bumps
	 * lastHeartbeatAt, 'end' sets endedAt. Close sessions that miss heartbeats
	 * with `closeIdleSessions()` on a schedule.
	 */
	trackSession(event: "start" | "heartbeat" | "end"): void {
		switch (event) {
			case "start":
				this.handleSessionStart();
				break;
			case "heartbeat":
				this.handleSessionHeartbeat();
				break;
			case "end":
				this.handleSessionEnd();
				break;
		}
	}

	/**
	 * Drain the Redis buffer into PostgreSQL until it is empty.
	 * LPUSH adds at the head, so the oldest events sit at the tail: read the
	 * tail with LRANGE, insert, then LTRIM the same count off the tail.
	 * The three steps are not atomic. A crash between insert and LTRIM replays
	 * the batch, so the insert skips ids that already exist. Run one flusher
	 * per Redis key: two flushers read the same tail.
	 */
	async flush(): Promise<number> {
		let total = 0;
		for (;;) {
			const flushed = await this.flushBatch();
			if (flushed === null) {
				this.log(
					"error",
					`Flush failed after ${MAX_RETRIES} retries; events stay in Redis`,
				);
				return total;
			}
			if (flushed === 0) return total;
			total += flushed;
		}
	}

	private async flushBatch(): Promise<number | null> {
		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const batch = await this.redis.lrange(
					this.redisKey,
					-this.batchSize,
					-1,
				);
				if (batch.length === 0) return 0;

				const rows = batch.flatMap((raw) => this.parse(raw));
				if (rows.length > 0) {
					await this.db
						.insert(analyticsEvents)
						.values(rows)
						.onConflictDoNothing({ target: analyticsEvents.id });
				}
				await this.redis.ltrim(this.redisKey, 0, -(batch.length + 1));
				this.log("info", `Flushed ${rows.length} events`);
				return batch.length;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this.log(
					"warn",
					`Flush attempt ${attempt}/${MAX_RETRIES} failed: ${message}`,
				);
				if (attempt < MAX_RETRIES) {
					const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}
		return null;
	}

	/**
	 * One bad element is skipped and logged instead of blocking the buffer.
	 * A row the insert would reject (missing NOT NULL field, invalid date)
	 * counts as bad: left in, it would fail every retry of its batch and the
	 * buffer would never drain.
	 */
	private parse(raw: string): NewAnalyticsEvent[] {
		let value: unknown;
		try {
			value = JSON.parse(raw);
		} catch {
			value = null;
		}
		const event = toEvent(value);
		if (!event) {
			this.log("error", `Skipped invalid event: ${raw.slice(0, 200)}`);
			return [];
		}
		return [event];
	}

	private handleSessionStart(): void {
		const sessionId = crypto.randomUUID();
		this.sessionId = sessionId;
		this.track("session_started", { sessionId });

		this.db
			.insert(analyticsSessions)
			.values({
				id: sessionId,
				userId: this.userId,
				platform: this.platform,
				startedAt: new Date(),
				lastHeartbeatAt: new Date(),
			})
			.catch((err: Error) => {
				this.log("error", `Failed to create session: ${err.message}`);
			});
	}

	private handleSessionHeartbeat(): void {
		if (!this.sessionId) return;

		this.db
			.update(analyticsSessions)
			.set({ lastHeartbeatAt: new Date() })
			.where(eq(analyticsSessions.id, this.sessionId))
			.catch((err: Error) => {
				this.log("error", `Failed to update heartbeat: ${err.message}`);
			});
	}

	private handleSessionEnd(): void {
		if (!this.sessionId) return;

		const sessionId = this.sessionId;
		this.track("session_ended", { sessionId });
		this.sessionId = null;

		this.db
			.update(analyticsSessions)
			.set({ endedAt: new Date() })
			.where(eq(analyticsSessions.id, sessionId))
			.catch((err: Error) => {
				this.log("error", `Failed to end session: ${err.message}`);
			});
	}
}

/**
 * Close sessions whose client vanished without 'end' (crash, lost network).
 * endedAt takes the last heartbeat, so durations stay honest. Run it on a
 * schedule with idleMs set to a few heartbeat intervals.
 */
export async function closeIdleSessions(
	db: AnalyticsDb,
	idleMs: number,
): Promise<void> {
	const cutoff = new Date(Date.now() - idleMs);
	await db
		.update(analyticsSessions)
		.set({ endedAt: analyticsSessions.lastHeartbeatAt })
		.where(
			and(
				isNull(analyticsSessions.endedAt),
				lt(analyticsSessions.lastHeartbeatAt, cutoff),
			),
		);
}

const text = (value: unknown): string | null =>
	typeof value === "string" && value !== "" ? value : null;

/** A buffered event as the insert needs it, or null if it is not one. */
function toEvent(value: unknown): NewAnalyticsEvent | null {
	if (typeof value !== "object" || value === null) return null;
	const record: Record<string, unknown> = { ...value };
	const id = text(record.id);
	const userId = text(record.userId);
	const sessionId = text(record.sessionId);
	const eventName = text(record.eventName);
	const platform = text(record.platform);
	const version = text(record.version);
	const created = text(record.createdAt);
	if (!(id && userId && sessionId && eventName && platform && version && created)) {
		return null;
	}
	const createdAt = new Date(created);
	if (Number.isNaN(createdAt.getTime())) return null;
	const properties = record.properties ?? {};
	if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
		return null;
	}
	return {
		id,
		userId,
		sessionId,
		eventName,
		platform,
		version,
		properties: { ...properties },
		createdAt,
	};
}
