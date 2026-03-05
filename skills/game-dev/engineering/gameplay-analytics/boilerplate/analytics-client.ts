import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type Redis from "ioredis";
import {
	analyticsEvents,
	analyticsSessions,
	type NewAnalyticsEvent,
} from "./analytics-schema";

const REDIS_KEY = "analytics:events";
const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

interface AnalyticsClientOptions {
	redis: Redis;
	db: PostgresJsDatabase;
	userId: string;
	platform: string;
	version: string;
	redisKey?: string;
	batchSize?: number;
	logger?: (level: "info" | "warn" | "error", message: string) => void;
}

export class AnalyticsClient {
	private redis: Redis;
	private db: PostgresJsDatabase;
	private userId: string;
	private platform: string;
	private version: string;
	private sessionId: string | null = null;
	private redisKey: string;
	private batchSize: number;
	private log: (level: "info" | "warn" | "error", message: string) => void;

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
	 * Fire-and-forget event tracking. Buffers in Redis via LPUSH.
	 * Never throws — logs errors silently.
	 */
	track(eventName: string, properties?: Record<string, unknown>): void {
		const event: NewAnalyticsEvent = {
			id: crypto.randomUUID(),
			userId: this.userId,
			sessionId: this.sessionId ?? "unknown",
			eventName,
			properties: properties ?? {},
			platform: this.platform,
			version: this.version,
			createdAt: new Date(),
		};

		this.redis.lpush(this.redisKey, JSON.stringify(event)).catch((err) => {
			this.log(
				"error",
				`Failed to buffer event "${eventName}": ${err.message}`,
			);
		});
	}

	/**
	 * Track session lifecycle events.
	 * - 'start': creates a new session row, stores sessionId
	 * - 'heartbeat': updates lastHeartbeatAt on the current session
	 * - 'end': sets endedAt on the current session, clears sessionId
	 */
	trackSession(event: "start" | "heartbeat" | "end"): void {
		try {
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
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log("error", `Failed to track session "${event}": ${message}`);
		}
	}

	/**
	 * Drain the Redis event buffer into PostgreSQL in batches.
	 * Call this from a worker process, not the game server.
	 */
	async flush(): Promise<void> {
		let retries = 0;

		while (retries < MAX_RETRIES) {
			try {
				const batch = await this.redis.lrange(
					this.redisKey,
					-this.batchSize,
					-1,
				);

				if (batch.length === 0) return;

				const rows: NewAnalyticsEvent[] = batch.map((raw) => {
					const parsed = JSON.parse(raw);
					return {
						...parsed,
						createdAt: new Date(parsed.createdAt),
					};
				});

				await this.db.insert(analyticsEvents).values(rows);
				await this.redis.ltrim(this.redisKey, 0, -(batch.length + 1));

				this.log("info", `Flushed ${rows.length} events to database`);
				return;
			} catch (err) {
				retries++;
				const message = err instanceof Error ? err.message : String(err);
				this.log(
					"warn",
					`Flush attempt ${retries}/${MAX_RETRIES} failed: ${message}`,
				);

				if (retries < MAX_RETRIES) {
					const delay = BASE_DELAY_MS * 2 ** (retries - 1);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		this.log(
			"error",
			`Flush failed after ${MAX_RETRIES} retries — events remain in Redis buffer`,
		);
	}

	// ─── Private Methods ──────────────────────────────────────────────────────

	private handleSessionStart(): void {
		const sessionId = crypto.randomUUID();
		this.sessionId = sessionId;

		this.db
			.insert(analyticsSessions)
			.values({
				id: sessionId,
				userId: this.userId,
				platform: this.platform,
				startedAt: new Date(),
				lastHeartbeatAt: new Date(),
			})
			.then(() => {
				this.track("session_started", { sessionId });
			})
			.catch((err) => {
				this.log("error", `Failed to create session: ${err.message}`);
			});
	}

	private handleSessionHeartbeat(): void {
		if (!this.sessionId) return;

		const now = new Date();
		this.db
			.update(analyticsSessions)
			.set({ lastHeartbeatAt: now })
			.where(eq(analyticsSessions.id, this.sessionId))
			.catch((err) => {
				this.log("error", `Failed to update heartbeat: ${err.message}`);
			});
	}

	private handleSessionEnd(): void {
		if (!this.sessionId) return;

		const now = new Date();
		const sessionId = this.sessionId;
		this.sessionId = null;

		this.track("session_ended", { sessionId });

		this.db
			.update(analyticsSessions)
			.set({ endedAt: now })
			.where(eq(analyticsSessions.id, sessionId))
			.catch((err) => {
				this.log("error", `Failed to end session: ${err.message}`);
			});
	}
}
