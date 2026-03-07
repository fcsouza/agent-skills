// ============================================================
// Scheduled & Delayed Jobs — Cron-based and one-off timers
// ============================================================

import { Queue } from "bullmq";
import {
	ANALYTICS_JOBS,
	type AnalyticsJobData,
	GAME_EVENT_JOBS,
	type GameEventJobData,
	QUEUE_NAMES,
	REWARD_JOBS,
	type RewardJobData,
} from "../templates/job-types";
import { createQueueOptions } from "../templates/queue-config";

// ============================================================
// Scheduler Queues — Dedicated instances for repeatable jobs
// ============================================================

const schedulerRewardQueue = new Queue<RewardJobData>(
	QUEUE_NAMES.REWARD,
	createQueueOptions(QUEUE_NAMES.REWARD),
);

const schedulerEventQueue = new Queue<GameEventJobData>(
	QUEUE_NAMES.GAME_EVENT,
	createQueueOptions(QUEUE_NAMES.GAME_EVENT),
);

const schedulerAnalyticsQueue = new Queue<AnalyticsJobData>(
	QUEUE_NAMES.ANALYTICS,
	createQueueOptions(QUEUE_NAMES.ANALYTICS),
);

// ============================================================
// Daily Reward Distribution
// Runs every day at midnight UTC
// ============================================================

export const scheduleDailyRewards = async () => {
	await schedulerRewardQueue.upsertJobScheduler(
		"daily-reward-scheduler",
		{
			pattern: "0 0 * * *", // Midnight UTC daily
			utc: true,
		},
		{
			name: REWARD_JOBS.DAILY_LOGIN,
			data: {
				playerId: "__broadcast__", // Worker should expand to all eligible players
				rewardType: "daily-login",
				payload: {
					currency: 100,
					items: [],
				},
				reason: "daily-login-reward",
				idempotencyKey: `daily-login-${new Date().toISOString().split("T")[0]}`,
			},
		},
	);
};

// ============================================================
// Season/Event Timer
// Schedule a delayed job for when a season or event ends
// ============================================================

export const scheduleSeasonEnd = async (seasonId: string, endsAt: Date) => {
	const delay = endsAt.getTime() - Date.now();
	if (delay <= 0) return;

	await schedulerEventQueue.add(
		GAME_EVENT_JOBS.SESSION_COMPLETE,
		{
			eventType: "season-end",
			sessionId: seasonId,
			participants: [],
			outcome: { seasonId, reason: "scheduled-end" },
			timestamp: endsAt.getTime(),
		},
		{
			delay,
			jobId: `season-end-${seasonId}`, // Prevent duplicates
			removeOnComplete: true,
		},
	);
};

// ============================================================
// Scheduled Event Start
// Schedule a game event to begin at a specific time
// ============================================================

export const scheduleEventStart = async (
	eventId: string,
	startsAt: Date,
	metadata: Record<string, unknown> = {},
) => {
	const delay = startsAt.getTime() - Date.now();
	if (delay <= 0) return;

	await schedulerEventQueue.add(
		GAME_EVENT_JOBS.PROCESS_EVENT,
		{
			eventType: "scheduled-event-start",
			sessionId: eventId,
			participants: [],
			outcome: { eventId, ...metadata },
			timestamp: startsAt.getTime(),
		},
		{
			delay,
			jobId: `event-start-${eventId}`,
			removeOnComplete: true,
		},
	);
};

// ============================================================
// Cleanup Old Sessions
// Runs every hour — remove expired/abandoned sessions
// ============================================================

export const scheduleSessionCleanup = async () => {
	await schedulerEventQueue.upsertJobScheduler(
		"session-cleanup-scheduler",
		{
			pattern: "0 * * * *", // Every hour
			utc: true,
		},
		{
			name: GAME_EVENT_JOBS.PROCESS_EVENT,
			data: {
				eventType: "session-cleanup",
				sessionId: "__system__",
				participants: [],
				outcome: { action: "cleanup-expired-sessions" },
				timestamp: Date.now(),
			},
		},
	);
};

// ============================================================
// Leaderboard Snapshot
// Runs every 6 hours — snapshot current rankings
// ============================================================

export const scheduleLeaderboardSnapshot = async () => {
	await schedulerAnalyticsQueue.upsertJobScheduler(
		"leaderboard-snapshot-scheduler",
		{
			pattern: "0 */6 * * *", // Every 6 hours
			utc: true,
		},
		{
			name: ANALYTICS_JOBS.AGGREGATE,
			data: {
				eventName: "leaderboard-snapshot",
				properties: { action: "snapshot-rankings" },
				timestamp: Date.now(),
			},
		},
	);
};

// ============================================================
// Initialize All Scheduled Jobs
// Call once on server startup
// ============================================================

export const initializeScheduledJobs = async () => {
	await Promise.all([
		scheduleDailyRewards(),
		scheduleSessionCleanup(),
		scheduleLeaderboardSnapshot(),
	]);
	console.log("[Scheduler] All recurring jobs initialized");
};

// ============================================================
// Cancel Scheduled Jobs
// ============================================================

export const cancelScheduledJob = async (
	queue: Queue,
	schedulerName: string,
) => {
	await queue.removeJobScheduler(schedulerName);
};

// ============================================================
// Graceful Shutdown
// ============================================================

export const closeScheduler = async (): Promise<void> => {
	await Promise.all([
		schedulerRewardQueue.close(),
		schedulerEventQueue.close(),
		schedulerAnalyticsQueue.close(),
	]);
};
