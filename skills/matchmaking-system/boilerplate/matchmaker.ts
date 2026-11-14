// Verified against: ioredis 6.0.0, bullmq 6.7.6 (2026-11-14)
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";

export interface PlayerQueueEntry {
	playerId: string;
	rating: number;
	/** Rating deviation (Glicko-2 RD) or sigma (TrueSkill). */
	deviation: number;
	gamesPlayed: number;
	gameMode: string;
	region: string;
	queuedAt: number;
}

export interface Match {
	matchId: string;
	players: [PlayerQueueEntry, PlayerQueueEntry];
	gameMode: string;
	region: string;
	averageRating: number;
	ratingGap: number;
}

/** Tunables. The defaults are starting points, not measured values. */
export interface MatchmakingConfig {
	initialBracket: number;
	bracketStep: number;
	bracketStepIntervalMs: number;
	maxBracket: number;
	/** Players with fewer games than this are "new". */
	newPlayerGames: number;
	/** New players never meet players with more games than this. */
	veteranGames: number;
	/** Claim attempts per search, closest ratings first. */
	candidateLimit: number;
	/** Seconds a queue entry lives without being refreshed. */
	entryTtlSeconds: number;
}

const DEFAULT_CONFIG: MatchmakingConfig = {
	initialBracket: 50,
	bracketStep: 50,
	bracketStepIntervalMs: 10_000,
	maxBracket: 500,
	newPlayerGames: 10,
	veteranGames: 100,
	candidateLimit: 50,
	entryTtlSeconds: 300,
};

/**
 * Removes two players from the queue in one step, or neither.
 * KEYS[1] queue sorted set, KEYS[2] and KEYS[3] the two player hashes.
 * ARGV[1] and ARGV[2] the two player ids.
 * Returns 1 when both were still queued and are now removed, else 0.
 * Redis runs a script atomically, so two workers can never claim the same player.
 */
const CLAIM_PAIR_SCRIPT = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) == false then return 0 end
if redis.call('ZSCORE', KEYS[1], ARGV[2]) == false then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
redis.call('DEL', KEYS[2], KEYS[3])
return 1
`;

/**
 * Two-player matchmaking on a Redis sorted set (score = rating), one set per
 * mode and region. Every key of a pool carries the same {mode:region} hash
 * tag, so the claim script also runs on Redis Cluster.
 */
export class MatchmakingEngine {
	private readonly redis: Redis;
	private readonly config: MatchmakingConfig;

	constructor(redis: Redis, config: Partial<MatchmakingConfig> = {}) {
		this.redis = redis;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async enqueue(player: PlayerQueueEntry): Promise<void> {
		await this.writeEntries([player]);
	}

	/**
	 * Puts claimed players back after the match could not be set up. Each entry
	 * keeps its rating and original `queuedAt`, so the player keeps their place
	 * and their widened bracket. All writes go in one MULTI/EXEC, which Redis
	 * runs without interleaving other clients' commands.
	 */
	async requeue(players: readonly PlayerQueueEntry[]): Promise<void> {
		await this.writeEntries(players);
	}

	/** Player cancelled the search. */
	async cancel(gameMode: string, region: string, playerId: string): Promise<void> {
		await this.redis
			.multi()
			.zrem(this.queueKey(gameMode, region), playerId)
			.del(this.playerKey(gameMode, region, playerId))
			.exec();
	}

	/** Bracket half-width after waiting `waitMs`. It only grows. */
	bracketFor(waitMs: number): number {
		const steps = Math.floor(Math.max(0, waitMs) / this.config.bracketStepIntervalMs);
		return Math.min(
			this.config.initialBracket + steps * this.config.bracketStep,
			this.config.maxBracket,
		);
	}

	/**
	 * Finds the closest acceptable opponent and claims both players atomically.
	 * Returns null when the player is no longer queued or no opponent fits yet.
	 */
	async findMatch(gameMode: string, region: string, playerId: string): Promise<Match | null> {
		const player = await this.readEntry(gameMode, region, playerId);
		if (!player) return null;

		const now = Date.now();
		const bracket = this.bracketFor(now - player.queuedAt);
		// Read up to the widest bracket: the opponent may have waited longer.
		const searchWidth = this.config.maxBracket;
		const ids = await this.redis.zrange(
			this.queueKey(gameMode, region),
			String(player.rating - searchWidth),
			String(player.rating + searchWidth),
			"BYSCORE",
		);

		const candidates: PlayerQueueEntry[] = [];
		for (const id of ids) {
			if (id === playerId) continue;
			const entry = await this.readEntry(gameMode, region, id);
			if (!entry || this.isProtectedMismatch(player, entry)) continue;
			// A pair fits when the gap is inside the wider of the two brackets,
			// so the player who waited longer decides.
			const gap = Math.abs(player.rating - entry.rating);
			const allowed = Math.max(bracket, this.bracketFor(now - entry.queuedAt));
			if (gap <= allowed) candidates.push(entry);
		}
		candidates.sort(
			(a, b) => Math.abs(player.rating - a.rating) - Math.abs(player.rating - b.rating),
		);

		for (const opponent of candidates.slice(0, this.config.candidateLimit)) {
			const claimed = await this.redis.eval(
				CLAIM_PAIR_SCRIPT,
				3,
				this.queueKey(gameMode, region),
				this.playerKey(gameMode, region, player.playerId),
				this.playerKey(gameMode, region, opponent.playerId),
				player.playerId,
				opponent.playerId,
			);
			if (claimed !== 1) continue; // Another worker took one of the two; try the next.
			return {
				matchId: `match_${now}_${Math.random().toString(36).slice(2, 10)}`,
				players: [player, opponent],
				gameMode,
				region,
				averageRating: (player.rating + opponent.rating) / 2,
				ratingGap: Math.abs(player.rating - opponent.rating),
			};
		}
		return null;
	}

	async isQueued(gameMode: string, region: string, playerId: string): Promise<boolean> {
		return (await this.redis.zscore(this.queueKey(gameMode, region), playerId)) !== null;
	}

	async queueSize(gameMode: string, region: string): Promise<number> {
		return this.redis.zcard(this.queueKey(gameMode, region));
	}

	private async writeEntries(players: readonly PlayerQueueEntry[]): Promise<void> {
		const multi = this.redis.multi();
		for (const player of players) {
			const dataKey = this.playerKey(player.gameMode, player.region, player.playerId);
			multi
				.zadd(this.queueKey(player.gameMode, player.region), player.rating, player.playerId)
				.hset(dataKey, {
					playerId: player.playerId,
					rating: String(player.rating),
					deviation: String(player.deviation),
					gamesPlayed: String(player.gamesPlayed),
					gameMode: player.gameMode,
					region: player.region,
					queuedAt: String(player.queuedAt),
				})
				.expire(dataKey, this.config.entryTtlSeconds);
		}
		const results = await multi.exec();
		const failed = results?.find(([err]) => err !== null);
		if (!results || failed) {
			throw failed?.[0] ?? new Error("Queue write aborted");
		}
	}

	private isProtectedMismatch(a: PlayerQueueEntry, b: PlayerQueueEntry): boolean {
		const { newPlayerGames, veteranGames } = this.config;
		return (
			(a.gamesPlayed < newPlayerGames && b.gamesPlayed > veteranGames) ||
			(b.gamesPlayed < newPlayerGames && a.gamesPlayed > veteranGames)
		);
	}

	private async readEntry(
		gameMode: string,
		region: string,
		playerId: string,
	): Promise<PlayerQueueEntry | null> {
		const data = await this.redis.hgetall(this.playerKey(gameMode, region, playerId));
		if (!data.playerId) {
			// The hash expired but the sorted-set member may remain; drop it.
			await this.redis.zrem(this.queueKey(gameMode, region), playerId);
			return null;
		}
		return {
			playerId: data.playerId,
			rating: Number(data.rating),
			deviation: Number(data.deviation),
			gamesPlayed: Number(data.gamesPlayed),
			gameMode,
			region,
			queuedAt: Number(data.queuedAt),
		};
	}

	private queueKey(gameMode: string, region: string): string {
		return `mm:{${gameMode}:${region}}:queue`;
	}

	private playerKey(gameMode: string, region: string, playerId: string): string {
		return `mm:{${gameMode}:${region}}:player:${playerId}`;
	}
}

export interface SearchJob {
	gameMode: string;
	region: string;
	playerId: string;
}

/**
 * One BullMQ job per searching player. When no opponent fits, the job adds a
 * delayed copy of itself, so the search re-runs with a wider bracket.
 * `connection` must be created with `maxRetriesPerRequest: null` (BullMQ
 * throws otherwise when the client is passed to a Worker).
 */
export function startMatchmaking(
	connection: Redis,
	engine: MatchmakingEngine,
	onMatch: (match: Match) => Promise<void>,
	retryDelayMs = 2_000,
): { queue: Queue<SearchJob>; worker: Worker<SearchJob> } {
	const queue = new Queue<SearchJob>("matchmaking", { connection });
	const worker = new Worker<SearchJob>(
		"matchmaking",
		async (job) => {
			const { gameMode, region, playerId } = job.data;
			const match = await engine.findMatch(gameMode, region, playerId);
			if (match) {
				try {
					await onMatch(match);
				} catch (error) {
					// Both players are out of the queue now. Put them back with their
					// original entries and restart both searches, then report the failure.
					await engine.requeue(match.players);
					for (const p of match.players) {
						await queue.add(
							"search",
							{ gameMode, region, playerId: p.playerId },
							{ delay: retryDelayMs, removeOnComplete: true },
						);
					}
					throw error;
				}
				return;
			}
			// Still queued (not cancelled, not claimed by another search): look again later.
			if (await engine.isQueued(gameMode, region, playerId)) {
				await queue.add("search", job.data, { delay: retryDelayMs, removeOnComplete: true });
			}
		},
		{ connection },
	);
	return { queue, worker };
}
