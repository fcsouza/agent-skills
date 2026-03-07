// ============================================================
// Job Type Definitions — Genre-Agnostic Game Queue Types
// ============================================================

// Queue name constants
export const QUEUE_NAMES = {
	MATCHMAKING: "matchmaking",
	GAME_EVENT: "game-event",
	REWARD: "reward",
	NOTIFICATION: "notification",
	ANALYTICS: "analytics",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Priority levels (lower number = higher priority in BullMQ)
export enum Priority {
	CRITICAL = 1,
	HIGH = 2,
	NORMAL = 5,
	LOW = 10,
	BACKGROUND = 20,
}

// Default priority per queue
export const QUEUE_PRIORITY: Record<QueueName, Priority> = {
	[QUEUE_NAMES.MATCHMAKING]: Priority.CRITICAL,
	[QUEUE_NAMES.GAME_EVENT]: Priority.HIGH,
	[QUEUE_NAMES.REWARD]: Priority.NORMAL,
	[QUEUE_NAMES.NOTIFICATION]: Priority.LOW,
	[QUEUE_NAMES.ANALYTICS]: Priority.BACKGROUND,
};

// ============================================================
// Matchmaking
// ============================================================

export interface MatchmakingJobData {
	playerId: string;
	skillRating: number;
	region: string;
	preferences: {
		mode: string;
		teamSize: number;
		[key: string]: unknown;
	};
	queuedAt: number; // timestamp
}

export interface MatchmakingJobResult {
	sessionId: string;
	players: string[];
	region: string;
	mode: string;
	matchedAt: number;
}

// ============================================================
// Game Events
// ============================================================

export interface GameEventJobData {
	eventType: string;
	sessionId: string;
	participants: string[];
	outcome: Record<string, unknown>;
	timestamp: number;
}

export interface GameEventJobResult {
	processed: boolean;
	updatedEntities: string[];
	sideEffects: string[]; // IDs of follow-up jobs spawned
}

// ============================================================
// Rewards
// ============================================================

export interface RewardJobData {
	playerId: string;
	rewardType: string;
	payload: {
		currency?: number;
		items?: string[];
		experience?: number;
		[key: string]: unknown;
	};
	reason: string;
	idempotencyKey: string;
}

export interface RewardJobResult {
	credited: boolean;
	playerId: string;
	rewardType: string;
	appliedAt: number;
}

// ============================================================
// Notifications
// ============================================================

export interface NotificationJobData {
	playerId: string;
	channel: "push" | "in-game" | "email";
	title: string;
	body: string;
	data?: Record<string, unknown>;
	expiresAt?: number;
}

export interface NotificationJobResult {
	delivered: boolean;
	channel: string;
	deliveredAt: number;
}

// ============================================================
// Analytics
// ============================================================

export interface AnalyticsJobData {
	eventName: string;
	playerId?: string;
	sessionId?: string;
	properties: Record<string, unknown>;
	timestamp: number;
}

export interface AnalyticsJobResult {
	ingested: boolean;
	eventName: string;
}

// ============================================================
// Union types for convenience
// ============================================================

export type JobData =
	| MatchmakingJobData
	| GameEventJobData
	| RewardJobData
	| NotificationJobData
	| AnalyticsJobData;

export type JobResult =
	| MatchmakingJobResult
	| GameEventJobResult
	| RewardJobResult
	| NotificationJobResult
	| AnalyticsJobResult;

// ============================================================
// Job name maps per queue
// ============================================================

export const MATCHMAKING_JOBS = {
	FIND_MATCH: "find-match",
	CANCEL_MATCH: "cancel-match",
	REQUEUE: "requeue",
} as const;

export const GAME_EVENT_JOBS = {
	PROCESS_EVENT: "process-event",
	RESOLVE_ACTION: "resolve-action",
	SESSION_COMPLETE: "session-complete",
} as const;

export const REWARD_JOBS = {
	DISTRIBUTE: "distribute-reward",
	DAILY_LOGIN: "daily-login",
	ACHIEVEMENT: "achievement",
	QUEST_COMPLETE: "quest-complete",
} as const;

export const NOTIFICATION_JOBS = {
	SEND: "send",
	BROADCAST: "broadcast",
	SCHEDULED: "scheduled",
} as const;

export const ANALYTICS_JOBS = {
	TRACK_EVENT: "track-event",
	AGGREGATE: "aggregate",
	EXPORT: "export",
} as const;
