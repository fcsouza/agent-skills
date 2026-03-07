// ============================================================
// Structured Game Logger — Bun/Elysia Compatible
// ============================================================

import type { Elysia } from "elysia";

// ============================================================
// Types
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
	playerId?: string;
	sessionId?: string;
	roomId?: string;
	requestId?: string;
	[key: string]: unknown;
}

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context: LogContext;
	data?: unknown;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

// ============================================================
// Log Level Priority
// ============================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

// ============================================================
// GameLogger Class
// ============================================================

export class GameLogger {
	private context: LogContext;
	private minLevel: LogLevel;

	constructor(context: LogContext = {}, minLevel?: LogLevel) {
		this.context = context;
		this.minLevel = minLevel ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
	}

	child(additionalContext: LogContext): GameLogger {
		return new GameLogger(
			{ ...this.context, ...additionalContext },
			this.minLevel,
		);
	}

	debug(message: string, data?: unknown): void {
		this.log("debug", message, data);
	}

	info(message: string, data?: unknown): void {
		this.log("info", message, data);
	}

	warn(message: string, data?: unknown): void {
		this.log("warn", message, data);
	}

	error(message: string, err?: unknown, data?: unknown): void {
		const entry = this.buildEntry("error", message, data);

		if (err instanceof Error) {
			entry.error = {
				name: err.name,
				message: err.message,
				stack: err.stack,
			};
		} else if (err !== undefined) {
			entry.error = {
				name: "UnknownError",
				message: String(err),
			};
		}

		this.write(entry);
	}

	private log(level: LogLevel, message: string, data?: unknown): void {
		if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
			return;
		}
		const entry = this.buildEntry(level, message, data);
		this.write(entry);
	}

	private buildEntry(
		level: LogLevel,
		message: string,
		data?: unknown,
	): LogEntry {
		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			context: { ...this.context },
		};
		if (data !== undefined) {
			entry.data = data;
		}
		return entry;
	}

	private write(entry: LogEntry): void {
		const line = JSON.stringify(entry);
		switch (entry.level) {
			case "error":
				console.error(line);
				break;
			case "warn":
				console.warn(line);
				break;
			case "debug":
				console.debug(line);
				break;
			default:
				console.log(line);
				break;
		}
	}
}

// ============================================================
// Default Logger Instance
// ============================================================

export const logger = new GameLogger({ service: "game-server" });

// ============================================================
// Elysia Request Logging Middleware
// ============================================================

export const requestLogger = (app: Elysia): Elysia => {
	const reqLogger = logger.child({ component: "http" });

	return app
		.onRequest(({ request, store }) => {
			const requestId = crypto.randomUUID();
			(store as Record<string, unknown>).requestId = requestId;
			(store as Record<string, unknown>).requestStart = performance.now();

			reqLogger.info("request_start", {
				requestId,
				method: request.method,
				url: request.url,
			});
		})
		.onAfterResponse(({ request, store, set }) => {
			const s = store as Record<string, unknown>;
			const durationMs = performance.now() - (s.requestStart as number);
			const status = typeof set.status === "number" ? set.status : 200;

			reqLogger.info("request_end", {
				requestId: s.requestId,
				method: request.method,
				url: request.url,
				status,
				durationMs: Math.round(durationMs * 100) / 100,
			});
		})
		.onError(({ request, error, store }) => {
			const s = store as Record<string, unknown>;

			reqLogger.error("request_error", error, {
				requestId: s.requestId,
				method: request.method,
				url: request.url,
			});
		}) as unknown as Elysia;
};

// ============================================================
// WebSocket Session Logger Factory
// ============================================================

export const createSessionLogger = (
	playerId: string,
	sessionId: string,
	roomId?: string,
): GameLogger => {
	return logger.child({
		component: "websocket",
		playerId,
		sessionId,
		roomId,
	});
};
