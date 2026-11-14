// Verified against: bullmq 6.7.6 (2026-11-14)
// ============================================================
// Queue Definitions — Typed BullMQ Queues for Game Systems
// ============================================================

import { Queue, QueueEvents } from "bullmq";
import {
	type AnalyticsJobData,
	type AnalyticsJobResult,
	type GameEventJobData,
	type GameEventJobResult,
	type MatchmakingJobData,
	type MatchmakingJobResult,
	type NotificationJobData,
	type NotificationJobResult,
	QUEUE_NAMES,
	type RewardJobData,
	type RewardJobResult,
} from "../templates/job-types";
import {
	createQueueEventsOptions,
	createQueueOptions,
} from "../templates/queue-config";

// ============================================================
// Matchmaking Queue
// Find opponents, create game sessions
// Players are actively waiting
// ============================================================

export const matchmakingQueue = new Queue<
	MatchmakingJobData,
	MatchmakingJobResult
>(QUEUE_NAMES.MATCHMAKING, createQueueOptions());

// ============================================================
// Game Event Queue
// Process game events: action resolution, state changes, outcomes
// Affects active gameplay
// ============================================================

export const gameEventQueue = new Queue<GameEventJobData, GameEventJobResult>(
	QUEUE_NAMES.GAME_EVENT,
	createQueueOptions(),
);

// ============================================================
// Reward Queue
// Distribute rewards: daily login, achievements, quest completion
// Important but not time-critical; must be idempotent
// ============================================================

export const rewardQueue = new Queue<RewardJobData, RewardJobResult>(
	QUEUE_NAMES.REWARD,
	createQueueOptions(),
);

// ============================================================
// Notification Queue
// Push notifications, in-game mail, alerts
// Informational, can be slightly delayed
// ============================================================

export const notificationQueue = new Queue<
	NotificationJobData,
	NotificationJobResult
>(QUEUE_NAMES.NOTIFICATION, createQueueOptions());

// ============================================================
// Analytics Queue
// Event tracking, metrics, telemetry
// Own queue, so analytics never blocks gameplay jobs
// ============================================================

export const analyticsQueue = new Queue<AnalyticsJobData, AnalyticsJobResult>(
	QUEUE_NAMES.ANALYTICS,
	createQueueOptions(),
);

// ============================================================
// Queue Events — For monitoring and logging
// QueueEvents sees events from every worker on the queue (worker.on only sees
// its own process) and reads a Redis stream, so events survive disconnects.
// ============================================================

export const createQueueEvents = (queueName: string) =>
	new QueueEvents(queueName, createQueueEventsOptions());

export const matchmakingEvents = createQueueEvents(QUEUE_NAMES.MATCHMAKING);
export const gameEventEvents = createQueueEvents(QUEUE_NAMES.GAME_EVENT);
export const rewardEvents = createQueueEvents(QUEUE_NAMES.REWARD);
export const notificationEvents = createQueueEvents(QUEUE_NAMES.NOTIFICATION);
export const analyticsEvents = createQueueEvents(QUEUE_NAMES.ANALYTICS);

// ============================================================
// Queue Registry — Access all queues by name
// ============================================================

export const queues = {
	[QUEUE_NAMES.MATCHMAKING]: matchmakingQueue,
	[QUEUE_NAMES.GAME_EVENT]: gameEventQueue,
	[QUEUE_NAMES.REWARD]: rewardQueue,
	[QUEUE_NAMES.NOTIFICATION]: notificationQueue,
	[QUEUE_NAMES.ANALYTICS]: analyticsQueue,
} as const;

// ============================================================
// Graceful Shutdown
// ============================================================

export const closeAllQueues = async (): Promise<void> => {
	await Promise.all([
		matchmakingQueue.close(),
		gameEventQueue.close(),
		rewardQueue.close(),
		notificationQueue.close(),
		analyticsQueue.close(),
		matchmakingEvents.close(),
		gameEventEvents.close(),
		rewardEvents.close(),
		notificationEvents.close(),
		analyticsEvents.close(),
	]);
};
