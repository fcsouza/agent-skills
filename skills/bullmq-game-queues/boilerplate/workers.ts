// Verified against: bullmq 6.7.6 (2026-11-14)
// ============================================================
// Worker Implementations — BullMQ Workers for Game Systems
// ============================================================

import { type Job, Worker } from "bullmq";
import {
	type AnalyticsJobData,
	type AnalyticsJobResult,
	BROADCAST_PLAYER_ID,
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
import { getWorkerOptions } from "../templates/queue-config";

// ============================================================
// Base Worker Pattern — Error handling + logging
// ============================================================

const handleWorkerError = (queueName: string, error: Error, jobId?: string) => {
	console.error(
		`[${queueName}] Job ${jobId ?? "unknown"} failed:`,
		error.message,
	);
	// TODO: integrate with your monitoring/alerting system
};

const handleWorkerCompleted = (
	queueName: string,
	jobId: string,
	result: unknown,
) => {
	console.log(`[${queueName}] Job ${jobId} completed:`, JSON.stringify(result));
};

// ============================================================
// Matchmaking Worker
// Find compatible players, create game session
// ============================================================

export const matchmakingWorker = new Worker<
	MatchmakingJobData,
	MatchmakingJobResult
>(
	QUEUE_NAMES.MATCHMAKING,
	async (job: Job<MatchmakingJobData>): Promise<MatchmakingJobResult> => {
		const { playerId, skillRating, region, preferences } = job.data;

		// Step 1: Find compatible players in the matchmaking pool
		// Replace with your matchmaking logic (ELO range, region, mode)
		const compatiblePlayers = await findCompatiblePlayers({
			playerId,
			skillRating,
			region,
			mode: preferences.mode,
			teamSize: preferences.teamSize,
		});

		if (compatiblePlayers.length < preferences.teamSize) {
			// Not enough players: throw so BullMQ retries after backoff. To widen
			// the search over time, derive the skill range from job.data.queuedAt.
			await job.updateProgress(50);
			throw new Error("Not enough players in pool — will retry with backoff");
		}

		// Step 2: Create a game session
		const sessionId = await createGameSession({
			players: compatiblePlayers,
			region,
			mode: preferences.mode,
		});

		// Step 3: Notify matched players
		await notifyPlayers(compatiblePlayers, sessionId);

		return {
			sessionId,
			players: compatiblePlayers,
			region,
			mode: preferences.mode,
			matchedAt: Date.now(),
		};
	},
	getWorkerOptions(QUEUE_NAMES.MATCHMAKING),
);

// ============================================================
// Game Event Worker
// Process game event, update DB, emit results
// ============================================================

export const gameEventWorker = new Worker<GameEventJobData, GameEventJobResult>(
	QUEUE_NAMES.GAME_EVENT,
	async (job: Job<GameEventJobData>): Promise<GameEventJobResult> => {
		const { eventType, sessionId, participants, outcome } = job.data;

		// Step 1: Validate event is still relevant (session active, etc.)
		const isValid = await validateGameEvent(sessionId, eventType);
		if (!isValid) {
			return { processed: false, updatedEntities: [], sideEffects: [] };
		}

		// Step 2: Process the event — update game state in DB
		const updatedEntities = await processGameEvent({
			eventType,
			sessionId,
			participants,
			outcome,
		});

		// Step 3: Spawn follow-up jobs if needed (rewards, notifications)
		const sideEffects = await spawnSideEffects(
			eventType,
			outcome,
			participants,
		);

		return {
			processed: true,
			updatedEntities,
			sideEffects,
		};
	},
	getWorkerOptions(QUEUE_NAMES.GAME_EVENT),
);

// ============================================================
// Reward Worker
// Calculate reward, credit to player, log event
// ============================================================

export const rewardWorker = new Worker<RewardJobData, RewardJobResult>(
	QUEUE_NAMES.REWARD,
	async (job: Job<RewardJobData>): Promise<RewardJobResult> => {
		const { playerId, rewardType, payload } = job.data;

		// Jobs from a Job Scheduler share one template, so the base key repeats
		// every run. Their job id is unique per run and stays the same across
		// retries of that run, so it makes the key per-run.
		const idempotencyKey = job.repeatJobKey
			? `${job.data.idempotencyKey}:${job.id}`
			: job.data.idempotencyKey;

		// Broadcast trigger: enqueue one reward job per eligible player, each
		// with idempotencyKey `${idempotencyKey}:${playerId}`. Grant nothing here.
		if (playerId === BROADCAST_PLAYER_ID) {
			await fanOutReward(job.data, idempotencyKey);
			return { credited: false, playerId, rewardType, appliedAt: Date.now() };
		}

		// Check, credit and mark in one database transaction: applyRewardOnce
		// skips the callback when the key was already recorded.
		const credited = await applyRewardOnce(idempotencyKey, async (tx) => {
			if (payload.currency) {
				await tx.creditCurrency(playerId, payload.currency);
			}
			if (payload.items?.length) {
				await tx.creditItems(playerId, payload.items);
			}
			if (payload.experience) {
				await tx.creditExperience(playerId, payload.experience);
			}
		});
		if (!credited) {
			return { credited: false, playerId, rewardType, appliedAt: Date.now() };
		}

		// Log the reward event for analytics, after the commit
		await logRewardEvent(playerId, rewardType, payload);

		return {
			credited: true,
			playerId,
			rewardType,
			appliedAt: Date.now(),
		};
	},
	getWorkerOptions(QUEUE_NAMES.REWARD),
);

// ============================================================
// Notification Worker
// Deliver notifications via appropriate channel
// ============================================================

export const notificationWorker = new Worker<
	NotificationJobData,
	NotificationJobResult
>(
	QUEUE_NAMES.NOTIFICATION,
	async (job: Job<NotificationJobData>): Promise<NotificationJobResult> => {
		const { playerId, channel, title, body, data, expiresAt } = job.data;

		// Check if notification has expired
		if (expiresAt && Date.now() > expiresAt) {
			return { delivered: false, channel, deliveredAt: Date.now() };
		}

		// Deliver via appropriate channel
		switch (channel) {
			case "push":
				await sendPushNotification(playerId, title, body, data);
				break;
			case "in-game":
				await sendInGameMail(playerId, title, body, data);
				break;
			case "email":
				await sendEmail(playerId, title, body, data);
				break;
		}

		return {
			delivered: true,
			channel,
			deliveredAt: Date.now(),
		};
	},
	getWorkerOptions(QUEUE_NAMES.NOTIFICATION),
);

// ============================================================
// Analytics Worker
// Low-priority event tracking and aggregation
// ============================================================

export const analyticsWorker = new Worker<AnalyticsJobData, AnalyticsJobResult>(
	QUEUE_NAMES.ANALYTICS,
	async (job: Job<AnalyticsJobData>): Promise<AnalyticsJobResult> => {
		const { eventName, playerId, sessionId, properties, timestamp } = job.data;

		// Ingest event into analytics pipeline
		await ingestAnalyticsEvent({
			eventName,
			playerId,
			sessionId,
			properties,
			// Scheduler templates carry timestamp 0; use the job's processing time.
			timestamp: timestamp || (job.processedOn ?? Date.now()),
		});

		return {
			ingested: true,
			eventName,
		};
	},
	getWorkerOptions(QUEUE_NAMES.ANALYTICS),
);

// ============================================================
// Worker Event Handlers — Attach to all workers
// ============================================================

const workers = [
	{ worker: matchmakingWorker, name: QUEUE_NAMES.MATCHMAKING },
	{ worker: gameEventWorker, name: QUEUE_NAMES.GAME_EVENT },
	{ worker: rewardWorker, name: QUEUE_NAMES.REWARD },
	{ worker: notificationWorker, name: QUEUE_NAMES.NOTIFICATION },
	{ worker: analyticsWorker, name: QUEUE_NAMES.ANALYTICS },
];

for (const { worker, name } of workers) {
	worker.on("completed", (job) => {
		handleWorkerCompleted(name, job.id ?? "unknown", job.returnvalue);
	});
	worker.on("failed", (job, error) => {
		handleWorkerError(name, error, job?.id);
	});
	worker.on("stalled", (jobId) => {
		console.warn(`[${name}] Job ${jobId} stalled`);
	});
}

// ============================================================
// Graceful Shutdown
// ============================================================

export const closeAllWorkers = async (): Promise<void> => {
	await Promise.all(workers.map(({ worker }) => worker.close()));
};

// ============================================================
// Placeholder functions — Replace with your implementations
// ============================================================

/* eslint-disable @typescript-eslint/no-unused-vars */
async function findCompatiblePlayers(
	_criteria: Record<string, unknown>,
): Promise<string[]> {
	throw new Error("Implement findCompatiblePlayers");
}
async function createGameSession(
	_params: Record<string, unknown>,
): Promise<string> {
	throw new Error("Implement createGameSession");
}
async function notifyPlayers(
	_playerIds: string[],
	_sessionId: string,
): Promise<void> {
	throw new Error("Implement notifyPlayers");
}
async function validateGameEvent(
	_sessionId: string,
	_eventType: string,
): Promise<boolean> {
	throw new Error("Implement validateGameEvent");
}
async function processGameEvent(
	_params: Record<string, unknown>,
): Promise<string[]> {
	throw new Error("Implement processGameEvent");
}
async function spawnSideEffects(
	_eventType: string,
	_outcome: Record<string, unknown>,
	_participants: string[],
): Promise<string[]> {
	throw new Error("Implement spawnSideEffects");
}
async function fanOutReward(
	_template: RewardJobData,
	_runKey: string,
): Promise<void> {
	throw new Error("Implement fanOutReward");
}
/** The writes a reward makes, all inside one database transaction. */
interface RewardTx {
	creditCurrency(playerId: string, amount: number): Promise<void>;
	creditItems(playerId: string, items: string[]): Promise<void>;
	creditExperience(playerId: string, xp: number): Promise<void>;
}
/**
 * In one transaction: insert `key` into the `processed_events` table from
 * the `postgres-game-schema` skill (kind 'reward'), then run `apply`. If the
 * insert conflicts, skip `apply` and return false. If `apply` throws, roll
 * back everything, key included, so the job's retry can credit it. Same
 * shape as `PaymentStore.processOnce` in `stripe-game-payments`.
 */
async function applyRewardOnce(
	_key: string,
	_apply: (tx: RewardTx) => Promise<void>,
): Promise<boolean> {
	throw new Error("Implement applyRewardOnce");
}
async function logRewardEvent(
	_playerId: string,
	_rewardType: string,
	_payload: Record<string, unknown>,
): Promise<void> {
	throw new Error("Implement logRewardEvent");
}
async function sendPushNotification(
	_playerId: string,
	_title: string,
	_body: string,
	_data?: Record<string, unknown>,
): Promise<void> {
	throw new Error("Implement sendPushNotification");
}
async function sendInGameMail(
	_playerId: string,
	_title: string,
	_body: string,
	_data?: Record<string, unknown>,
): Promise<void> {
	throw new Error("Implement sendInGameMail");
}
async function sendEmail(
	_playerId: string,
	_title: string,
	_body: string,
	_data?: Record<string, unknown>,
): Promise<void> {
	throw new Error("Implement sendEmail");
}
async function ingestAnalyticsEvent(
	_event: Record<string, unknown>,
): Promise<void> {
	throw new Error("Implement ingestAnalyticsEvent");
}
/* eslint-enable @typescript-eslint/no-unused-vars */
