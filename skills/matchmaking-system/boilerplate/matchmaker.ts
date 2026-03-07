import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface PlayerQueueEntry {
	playerId: string;
	rating: number;
	deviation: number;
	gameMode: string;
	region: string;
	queuedAt: number;
	searchRadius: number;
}

export interface Match {
	matchId: string;
	players: PlayerQueueEntry[];
	gameMode: string;
	region: string;
	averageRating: number;
	qualityScore: number;
}

export interface MatchmakingConfig {
	initialSearchRadius: number;
	maxSearchRadius: number;
	radiusExpandInterval: number;
	radiusExpandAmount: number;
	minMatchQuality: number;
	newPlayerThreshold: number;
	experiencedPlayerThreshold: number;
	maxWaitBeforeForceMatch: number;
}

const DEFAULT_CONFIG: MatchmakingConfig = {
	initialSearchRadius: 50,
	maxSearchRadius: 500,
	radiusExpandInterval: 10_000,
	radiusExpandAmount: 50,
	minMatchQuality: 0.6,
	newPlayerThreshold: 10,
	experiencedPlayerThreshold: 100,
	maxWaitBeforeForceMatch: 120_000,
};

/**
 * Matchmaking engine backed by Redis sorted sets and BullMQ.
 *
 * Players are stored in per-mode, per-region sorted sets keyed by rating.
 * Finding a match scans the sorted set within the player's search radius.
 */
export class MatchmakingEngine {
	private redis: Redis;
	private config: MatchmakingConfig;

	constructor(redis: Redis, config: Partial<MatchmakingConfig> = {}) {
		this.redis = redis;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Add a player to the matchmaking queue.
	 * Stores the player in a Redis sorted set (score = rating)
	 * and their full data in a hash.
	 */
	async enqueue(player: PlayerQueueEntry): Promise<void> {
		const queueKey = this.getQueueKey(player.gameMode, player.region);
		const dataKey = this.getPlayerDataKey(player.playerId);

		const multi = this.redis.multi();

		// Sorted set: score = rating, member = playerId
		multi.zadd(queueKey, player.rating, player.playerId);

		// Hash: full player data for match evaluation
		multi.hset(dataKey, {
			playerId: player.playerId,
			rating: player.rating.toString(),
			deviation: player.deviation.toString(),
			gameMode: player.gameMode,
			region: player.region,
			queuedAt: player.queuedAt.toString(),
			searchRadius: player.searchRadius.toString(),
		});

		// TTL on player data to auto-cleanup abandoned entries
		multi.expire(dataKey, 300);

		await multi.exec();
	}

	/**
	 * Remove a player from the matchmaking queue.
	 */
	async dequeue(playerId: string): Promise<void> {
		const data = await this.getPlayerData(playerId);
		if (!data) return;

		const queueKey = this.getQueueKey(data.gameMode, data.region);

		const multi = this.redis.multi();
		multi.zrem(queueKey, playerId);
		multi.del(this.getPlayerDataKey(playerId));
		await multi.exec();
	}

	/**
	 * Attempt to find a match for the given player.
	 * Scans the sorted set within the player's current search radius.
	 * Returns the best match or null if none found.
	 */
	async findMatch(player: PlayerQueueEntry): Promise<Match | null> {
		const queueKey = this.getQueueKey(player.gameMode, player.region);
		const minRating = player.rating - player.searchRadius;
		const maxRating = player.rating + player.searchRadius;

		// Find candidates within rating range
		const candidateIds = await this.redis.zrangebyscore(
			queueKey,
			minRating,
			maxRating,
		);

		// Filter out the searching player
		const otherIds = candidateIds.filter((id) => id !== player.playerId);
		if (otherIds.length === 0) return null;

		// Load candidate data
		const candidates: PlayerQueueEntry[] = [];
		for (const id of otherIds) {
			const data = await this.getPlayerData(id);
			if (data) {
				// Enforce new player protection
				if (this.isProtectedMismatch(player, data)) continue;
				candidates.push(data);
			}
		}

		if (candidates.length === 0) return null;

		// Score each candidate and pick the best
		let bestCandidate: PlayerQueueEntry | null = null;
		let bestQuality = -1;

		for (const candidate of candidates) {
			const quality = this.calculateMatchQuality(player, [candidate]);
			if (quality > bestQuality) {
				bestQuality = quality;
				bestCandidate = candidate;
			}
		}

		if (!bestCandidate || bestQuality < this.config.minMatchQuality) {
			// Check if player has waited long enough to force a match
			const waitTime = Date.now() - player.queuedAt;
			if (waitTime < this.config.maxWaitBeforeForceMatch) return null;
			if (!bestCandidate) return null;
		}

		// Build match
		const matchPlayers = [player, bestCandidate];
		const match: Match = {
			matchId: generateMatchId(),
			players: matchPlayers,
			gameMode: player.gameMode,
			region: player.region,
			averageRating:
				matchPlayers.reduce((sum, p) => sum + p.rating, 0) /
				matchPlayers.length,
			qualityScore: bestQuality,
		};

		// Remove matched players from queue
		for (const p of matchPlayers) {
			await this.dequeue(p.playerId);
		}

		return match;
	}

	/**
	 * Calculate match quality between a player and a group of opponents.
	 * Lower score = worse match. Range: 0.0 to 1.0.
	 *
	 * Factors:
	 * - Rating difference (primary)
	 * - Deviation overlap (confidence)
	 * - Wait time bonus (longer wait = more lenient)
	 */
	calculateMatchQuality(
		player: PlayerQueueEntry,
		opponents: PlayerQueueEntry[],
	): number {
		if (opponents.length === 0) return 0;

		let totalPenalty = 0;

		for (const opponent of opponents) {
			const ratingDelta = Math.abs(player.rating - opponent.rating);
			const maxDelta = player.searchRadius;

			// Rating difference penalty (0 = perfect, 1 = at radius edge)
			const ratingPenalty = Math.min(ratingDelta / maxDelta, 1);

			// Deviation bonus: if both players have low deviation, match is more reliable
			const avgDeviation = (player.deviation + opponent.deviation) / 2;
			const deviationFactor = Math.min(avgDeviation / 350, 1); // 350 = max RD

			// Wait time bonus: longer wait = accept wider range
			const waitMs = Date.now() - player.queuedAt;
			const waitBonus = Math.min(waitMs / 60_000, 0.3); // Max 0.3 bonus after 1 min

			totalPenalty += ratingPenalty * (0.7 + 0.3 * deviationFactor) - waitBonus;
		}

		const avgPenalty = totalPenalty / opponents.length;
		return Math.max(0, Math.min(1, 1 - avgPenalty));
	}

	/**
	 * Widen the search radius for a player who has been waiting too long.
	 * Called by a BullMQ delayed job.
	 */
	async widenSearchRadius(playerId: string): Promise<void> {
		const dataKey = this.getPlayerDataKey(playerId);
		const currentRadius = await this.redis.hget(dataKey, "searchRadius");
		if (!currentRadius) return;

		const newRadius = Math.min(
			Number.parseInt(currentRadius) + this.config.radiusExpandAmount,
			this.config.maxSearchRadius,
		);

		await this.redis.hset(dataKey, "searchRadius", newRadius.toString());
	}

	/**
	 * Get queue size for a given mode and region.
	 */
	async getQueueSize(gameMode: string, region: string): Promise<number> {
		return this.redis.zcard(this.getQueueKey(gameMode, region));
	}

	/**
	 * Get estimated wait time based on current queue depth and match rate.
	 */
	async getEstimatedWaitTime(
		gameMode: string,
		region: string,
	): Promise<number> {
		const queueSize = await this.getQueueSize(gameMode, region);
		// Rough estimate: 2 players per match, 1 match per second processing
		return Math.max(1, Math.ceil(queueSize / 2)) * 1000;
	}

	// --- Internal helpers ---

	private async getPlayerData(
		playerId: string,
	): Promise<PlayerQueueEntry | null> {
		const data = await this.redis.hgetall(this.getPlayerDataKey(playerId));
		if (!data || !data.playerId) return null;

		return {
			playerId: data.playerId,
			rating: Number.parseInt(data.rating),
			deviation: Number.parseInt(data.deviation),
			gameMode: data.gameMode,
			region: data.region,
			queuedAt: Number.parseInt(data.queuedAt),
			searchRadius: Number.parseInt(data.searchRadius),
		};
	}

	private isProtectedMismatch(
		a: PlayerQueueEntry,
		b: PlayerQueueEntry,
	): boolean {
		const aGames = this.getGamesPlayed(a);
		const bGames = this.getGamesPlayed(b);

		// New player (< 10 games) should not face experienced (> 100 games)
		if (
			aGames < this.config.newPlayerThreshold &&
			bGames > this.config.experiencedPlayerThreshold
		)
			return true;
		if (
			bGames < this.config.newPlayerThreshold &&
			aGames > this.config.experiencedPlayerThreshold
		)
			return true;

		return false;
	}

	private getGamesPlayed(_player: PlayerQueueEntry): number {
		// In production, fetch from Redis cache or player data.
		// The player entry would include gamesPlayed.
		// Placeholder: derive from deviation (low deviation = many games).
		return Math.max(0, Math.floor((350 - _player.deviation) / 3));
	}

	private getQueueKey(gameMode: string, region: string): string {
		return `matchmaking:queue:${gameMode}:${region}`;
	}

	private getPlayerDataKey(playerId: string): string {
		return `matchmaking:player:${playerId}`;
	}
}

function generateMatchId(): string {
	return `match_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
