// Verified against: elysia 1.4.32 (2026-11-14)
// Structured JSON logger for a Bun + Elysia game server. One JSON object per
// line on stdout/stderr; no logging library.

import { Elysia } from "elysia";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
	service?: string;
	component?: string;
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
	error?: { name: string; message: string; stack?: string };
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const isLogLevel = (value: string | undefined): value is LogLevel =>
	value !== undefined && value in LOG_LEVEL_PRIORITY;

const envLevel = process.env.LOG_LEVEL;
const DEFAULT_LEVEL: LogLevel = isLogLevel(envLevel) ? envLevel : "info";

export class GameLogger {
	private readonly context: LogContext;
	private readonly minLevel: LogLevel;

	constructor(context: LogContext = {}, minLevel: LogLevel = DEFAULT_LEVEL) {
		this.context = context;
		this.minLevel = minLevel;
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
			entry.error = { name: err.name, message: err.message, stack: err.stack };
		} else if (err !== undefined) {
			entry.error = { name: "UnknownError", message: String(err) };
		}
		this.write(entry);
	}

	private log(level: LogLevel, message: string, data?: unknown): void {
		if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
			return;
		}
		this.write(this.buildEntry(level, message, data));
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
		if (entry.level === "error") {
			console.error(line);
		} else if (entry.level === "warn") {
			console.warn(line);
		} else {
			console.log(line);
		}
	}
}

export const logger = new GameLogger({ service: "game-server" });

const httpLogger = logger.child({ component: "http" });

const roundMs = (ms: number): number => Math.round(ms * 100) / 100;

// Per-request values come from `derive`, which runs once per request, after
// parse. Never put them in `store`: it is one object shared by every request,
// so concurrent requests overwrite each other's id and start time.
//
// Requests that fail before derive runs (no matching route, a body that does
// not parse) reach onAfterResponse and onError without `requestId`,
// `requestStart` or `log`. Both hooks handle that case.
//
// Register this plugin before the routes it should log: hooks apply only to
// routes registered after them.
export const requestLogger = new Elysia({ name: "game.request-logger" })
	.derive({ as: "global" }, ({ request }) => {
		const requestId = crypto.randomUUID();
		const log = httpLogger.child({ requestId });
		log.debug("request_start", { method: request.method, url: request.url });
		return { requestId, requestStart: performance.now(), log };
	})
	.onAfterResponse(
		{ as: "global" },
		({ request, set, requestId, requestStart, log }) => {
			const data: Record<string, unknown> = {
				method: request.method,
				url: request.url,
				status: set.status ?? 200,
			};
			if (typeof requestStart === "number") {
				data.durationMs = roundMs(performance.now() - requestStart);
			}
			(log ?? httpLogger.child({ requestId })).info("request_end", data);
		},
	)
	.onError({ as: "global" }, (context) => {
		const { request, error, code } = context;
		const requestId =
			"requestId" in context && typeof context.requestId === "string"
				? context.requestId
				: undefined;
		const log = httpLogger.child({ requestId });
		const data = { code, method: request.method, url: request.url };
		// Client mistakes are warnings, so an error-rate alert counts only
		// server faults.
		if (code === "NOT_FOUND" || code === "PARSE" || code === "VALIDATION") {
			log.warn("request_rejected", { ...data, reason: error.message });
			return;
		}
		log.error("request_error", error, data);
	});

// One logger per WebSocket connection. Pass it to the room so every line from
// that player's messages carries playerId, sessionId and roomId.
export const createSessionLogger = (
	playerId: string,
	sessionId: string,
	roomId?: string,
): GameLogger =>
	logger.child({ component: "websocket", playerId, sessionId, roomId });
