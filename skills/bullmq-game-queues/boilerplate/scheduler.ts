// Verified against: bullmq 6.7.6 (2026-11-14)
// ============================================================
// Scheduled & Delayed Jobs — Cron-based and one-off timers
// ============================================================

import { Queue } from "bullmq";
import {
	ANALYTICS_JOBS,
	type AnalyticsJobData,
	BROADCAST_PLAYER_ID,
	GAME_EVENT_JOBS,
	type GameEventJobData,
	QUEUE_NAMES,
	REWARD_JOBS,
	type RewardJobData,
} from "../templates/job-types";
import { createQueueOptions } from "../templates/queue-config";

// ============================================================
// Scheduler Queues — Dedicated instances for repeatable jobs
//
// Template data is fixed when upsertJobScheduler runs and every produced job
// inherits it. Never put per-run values (today's date, Date.now()) in it:
// workers derive them from the produced job (see rewardWorker in workers.ts).
// A scheduler adds the next job only when the previous one starts, so a busy
// queue fires less often than the cron says.
// ============================================================

const schedulerRewardQueue = new Queue<RewardJobData>(
	QUEUE_NAMES.REWARD,
	createQueueOptions(),
);

const schedulerEventQueue = new Queue<GameEventJobData>(
	QUEUE_NAMES.GAME_EVENT,
	createQueueOptions(),
);

const schedulerAnalyticsQueue = new Queue<AnalyticsJobData>(
	QUEUE_NAMES.ANALYTICS,
	createQueueOptions(),
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
			tz: "UTC",
		},
		{
			name: REWARD_JOBS.DAILY_LOGIN,
			data: {
				playerId: BROADCAST_PLAYER_ID, // rewardWorker fans out to eligible players
				rewardType: "daily-login",
				payload: {
					currency: 100,
					items: [],
				},
				reason: "daily-login-reward",
				// Base key only. rewardWorker appends the produced job's id, which
				// is unique per run and stable across retries of that run.
				idempotencyKey: "daily-login",
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
			// Same id twice is ignored while the job exists, so restarts that
			// re-schedule the season do not double the payout. No colons in ids.
			jobId: `season-end-${seasonId}`,
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
			tz: "UTC",
		},
		{
			name: GAME_EVENT_JOBS.PROCESS_EVENT,
			data: {
				eventType: "session-cleanup",
				sessionId: "__system__",
				participants: [],
				outcome: { action: "cleanup-expired-sessions" },
				timestamp: 0, // fixed in the template; set the run time in the worker
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
			tz: "UTC",
		},
		{
			name: ANALYTICS_JOBS.AGGREGATE,
			data: {
				eventName: "leaderboard-snapshot",
				properties: { action: "snapshot-rankings" },
				timestamp: 0, // fixed in the template; set the run time in the worker
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
