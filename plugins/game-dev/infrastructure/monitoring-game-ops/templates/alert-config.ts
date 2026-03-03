// ============================================================
// Alert Rule Definitions — Game Server Monitoring
// ============================================================

// ============================================================
// Types
// ============================================================

export type AlertSeverity = "info" | "warning" | "critical" | "fatal";

export type AlertChannel =
	| "slack"
	| "email"
	| "pagerduty"
	| "webhook"
	| "discord";

export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

export interface AlertRule {
	/** Unique rule name */
	name: string;
	/** Human-readable description */
	description: string;
	/** Metric to evaluate (e.g., "server.tick_time_p95") */
	metric: string;
	/** Comparison operator */
	operator: ComparisonOperator;
	/** Threshold value that triggers the alert */
	threshold: number;
	/** Evaluation window in seconds */
	windowSeconds: number;
	/** Minimum number of data points in the window to evaluate */
	minDataPoints: number;
	/** Alert severity */
	severity: AlertSeverity;
	/** Notification channels */
	channels: AlertChannel[];
	/** Cooldown between repeated alerts in seconds */
	cooldownSeconds: number;
	/** Tags for grouping and filtering */
	tags: string[];
}

// ============================================================
// Preset: High Error Rate
// ============================================================

export const HIGH_ERROR_RATE: AlertRule = {
	name: "high_error_rate",
	description: "Server error rate exceeds acceptable threshold",
	metric: "server.error_rate_percent",
	operator: "gt",
	threshold: 5,
	windowSeconds: 300,
	minDataPoints: 10,
	severity: "critical",
	channels: ["slack", "pagerduty"],
	cooldownSeconds: 600,
	tags: ["server", "reliability"],
};

// ============================================================
// Preset: Player Spike
// ============================================================

export const PLAYER_SPIKE: AlertRule = {
	name: "player_spike",
	description: "Sudden increase in concurrent players beyond capacity planning",
	metric: "server.concurrent_players",
	operator: "gt",
	threshold: 1000,
	windowSeconds: 60,
	minDataPoints: 3,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 300,
	tags: ["capacity", "players"],
};

// ============================================================
// Preset: Memory Pressure
// ============================================================

export const MEMORY_PRESSURE: AlertRule = {
	name: "memory_pressure",
	description: "Server memory usage exceeds safe operating threshold",
	metric: "server.memory_usage_percent",
	operator: "gt",
	threshold: 85,
	windowSeconds: 120,
	minDataPoints: 5,
	severity: "critical",
	channels: ["slack", "pagerduty"],
	cooldownSeconds: 300,
	tags: ["server", "resources"],
};

// ============================================================
// Preset: Queue Backup
// ============================================================

export const QUEUE_BACKUP: AlertRule = {
	name: "queue_backup",
	description: "Job queue depth exceeds processing capacity",
	metric: "queue.waiting_jobs",
	operator: "gt",
	threshold: 500,
	windowSeconds: 180,
	minDataPoints: 5,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 600,
	tags: ["queue", "processing"],
};

// ============================================================
// Preset: Match Timeout
// ============================================================

export const MATCH_TIMEOUT: AlertRule = {
	name: "match_timeout",
	description: "Game matches exceeding maximum expected duration",
	metric: "game.match_duration_seconds_p95",
	operator: "gt",
	threshold: 3600,
	windowSeconds: 600,
	minDataPoints: 3,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 900,
	tags: ["game", "matches"],
};

// ============================================================
// Preset: Tick Overrun
// ============================================================

export const TICK_OVERRUN: AlertRule = {
	name: "tick_overrun",
	description: "Server tick processing time exceeds budget (causes lag)",
	metric: "server.tick_time_ms_p95",
	operator: "gt",
	threshold: 50,
	windowSeconds: 60,
	minDataPoints: 10,
	severity: "critical",
	channels: ["slack", "pagerduty"],
	cooldownSeconds: 300,
	tags: ["server", "performance"],
};

// ============================================================
// Preset: API Latency
// ============================================================

export const API_LATENCY: AlertRule = {
	name: "api_latency",
	description: "API response time exceeds acceptable p95 threshold",
	metric: "server.api_response_ms_p95",
	operator: "gt",
	threshold: 500,
	windowSeconds: 300,
	minDataPoints: 20,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 600,
	tags: ["server", "api", "performance"],
};

// ============================================================
// Preset: Economy Inflation
// ============================================================

export const ECONOMY_INFLATION: AlertRule = {
	name: "economy_inflation",
	description: "Currency net inflow exceeds safe balance ratio",
	metric: "economy.balance_ratio",
	operator: "gt",
	threshold: 0.3,
	windowSeconds: 3600,
	minDataPoints: 50,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 3600,
	tags: ["economy", "balance"],
};

// ============================================================
// Preset: WebSocket Disconnects
// ============================================================

export const WEBSOCKET_DISCONNECTS: AlertRule = {
	name: "websocket_disconnects",
	description: "Abnormal rate of WebSocket disconnections",
	metric: "server.ws_disconnect_rate_per_minute",
	operator: "gt",
	threshold: 50,
	windowSeconds: 120,
	minDataPoints: 5,
	severity: "warning",
	channels: ["slack"],
	cooldownSeconds: 300,
	tags: ["server", "connectivity"],
};

// ============================================================
// All Presets
// ============================================================

export const ALERT_PRESETS: AlertRule[] = [
	HIGH_ERROR_RATE,
	PLAYER_SPIKE,
	MEMORY_PRESSURE,
	QUEUE_BACKUP,
	MATCH_TIMEOUT,
	TICK_OVERRUN,
	API_LATENCY,
	ECONOMY_INFLATION,
	WEBSOCKET_DISCONNECTS,
];
