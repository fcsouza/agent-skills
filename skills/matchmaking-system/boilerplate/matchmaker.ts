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
	/**
	 * Seconds a cancel blocks a requeue. Must outlast the `onMatch` attempt
	 * whose failure triggers the requeue.
	 */
	cancelMarkerSeconds: number;
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
	cancelMarkerSeconds: 60,
};

/**
 * Adds or refreshes players in one pool. A player is in at most one pool at a
 * time: a global marker key holds the pool id while they are queued.
 * For player i (1-based), KEYS[4i-3] marker, KEYS[4i-2] pool sorted set,
 * KEYS[4i-1] player hash, KEYS[4i] cancelled marker. ARGV[1] pool id, ARGV[2]
 * TTL seconds, ARGV[3] mode, then per player ARGV[4 + 7(i-1) ...] = playerId,
 * rating, deviation, gamesPlayed, gameMode, region, queuedAt.
 * Mode "enqueue" (the player asked to search) clears the cancelled marker.
 * Mode "requeue" (putting a claimed player back) skips a player whose
 * cancelled marker is set: they cancelled while the match was being set up.
 * Returns one flag per player: 1 written, 0 refused (marker points to another
 * pool, or cancelled during a requeue). All checks and writes run inside one
 * script, so Redis applies them atomically.
 */
const ENQUEUE_SCRIPT = `
local pool, ttl, mode = ARGV[1], tonumber(ARGV[2]), ARGV[3]
local n = #KEYS / 4
local written = {}
for i = 1, n do
  local marker, queue, hash, cancelled = KEYS[4*i-3], KEYS[4*i-2], KEYS[4*i-1], KEYS[4*i]
  local current = redis.call('GET', marker)
  if (current and current ~= pool) or (mode == 'requeue' and redis.call('EXISTS', cancelled) == 1) then
    written[i] = 0
  else
    local a = 4 + 7*(i-1)
    if mode == 'enqueue' then redis.call('DEL', cancelled) end
    redis.call('SET', marker, pool, 'EX', ttl)
    redis.call('ZADD', queue, ARGV[a+1], ARGV[a])
    redis.call('HSET', hash, 'playerId', ARGV[a], 'rating', ARGV[a+1],
      'deviation', ARGV[a+2], 'gamesPlayed', ARGV[a+3], 'gameMode', ARGV[a+4],
      'region', ARGV[a+5], 'queuedAt', ARGV[a+6])
    redis.call('EXPIRE', hash, ttl)
    written[i] = 1
  end
end
return written
`;

/**
 * Removes two players from the queue in one step, or neither.
 * KEYS[1] pool sorted set, KEYS[2] and KEYS[3] the two player hashes,
 * KEYS[4] and KEYS[5] their markers. ARGV[1] and ARGV[2] the player ids,
 * ARGV[3] the pool id. Returns 1 when both were still queued and are now
 * removed, else 0. Redis runs a script atomically, so two workers can never
 * claim the same player.
 */
const CLAIM_PAIR_SCRIPT = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) == false then return 0 end
if redis.call('ZSCORE', KEYS[1], ARGV[2]) == false then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
redis.call('DEL', KEYS[2], KEYS[3])
for i = 4, 5 do
  if redis.call('GET', KEYS[i]) == ARGV[3] then redis.call('DEL', KEYS[i]) end
end
return 1
`;

/**
 * Removes one player from one pool. KEYS[1] pool sorted set, KEYS[2] player
 * hash, KEYS[3] marker; ARGV[1] player id, ARGV[2] pool id. The marker is
 * deleted only if it still names this pool.
 */
const REMOVE_SCRIPT = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
if redis.call('GET', KEYS[3]) == ARGV[2] then redis.call('DEL', KEYS[3]) end
return 1
`;

/**
 * REMOVE_SCRIPT plus a short-lived cancelled marker, so a requeue after a
 * failed match setup does not put the player back. KEYS[1..3] as in
 * REMOVE_SCRIPT, KEYS[4] cancelled marker; ARGV[1] player id, ARGV[2] pool
 * id, ARGV[3] marker TTL seconds.
 */
const CANCEL_SCRIPT = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
if redis.call('GET', KEYS[3]) == ARGV[2] then redis.call('DEL', KEYS[3]) end
redis.call('SET', KEYS[4], '1', 'EX', ARGV[3])
return 1
`;

/** Game modes and regions become part of Redis keys; allow only these characters. */
const KEY_PART = /^[A-Za-z0-9_-]{1,64}$/;

function assertKeyPart(name: string, value: string): void {
	if (!KEY_PART.test(value)) {
		throw new Error(`Invalid ${name} "${value}": use letters, digits, "_" or "-"`);
	}
}

/**
 * Two-player matchmaking on Redis sorted sets (score = rating), one set per
 * mode and region. A player can be queued in only one pool at a time.
 * Every key carries the `{mm}` hash tag: the scripts touch a pool and the
 * global per-player markers together, so on Redis Cluster all matchmaking
 * keys sit in one slot. Run one Redis per region if that slot gets too hot.
 */
export class MatchmakingEngine {
	private readonly redis: Redis;
	private readonly config: MatchmakingConfig;

	constructor(redis: Redis, config: Partial<MatchmakingConfig> = {}) {
		this.redis = redis;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Adds or refreshes a player in one pool. Throws if the player is already
	 * queued in another pool; cancel that search first.
	 */
	async enqueue(player: PlayerQueueEntry): Promise<void> {
		const [written] = await this.writeEntries([player], "enqueue");
		if (!written) {
			throw new Error(`Player ${player.playerId} is already queued in another mode or region`);
		}
	}

	/**
	 * Puts claimed players back after the match could not be set up. Each entry
	 * keeps its rating and original `queuedAt`, so the player keeps their place
	 * and their widened bracket. One script writes all of them atomically. A
	 * player who queued elsewhere in the meantime is left there, and a player
	 * who cancelled in the last `cancelMarkerSeconds` stays out. Returns the
	 * ids that were put back.
	 */
	async requeue(players: readonly PlayerQueueEntry[]): Promise<string[]> {
		const written = await this.writeEntries(players, "requeue");
		return players.filter((_, i) => written[i]).map((p) => p.playerId);
	}

	/**
	 * Player cancelled the search. Also blocks a requeue for
	 * `cancelMarkerSeconds`, in case a worker claimed the player a moment ago
	 * and its match setup fails.
	 */
	async cancel(gameMode: string, region: string, playerId: string): Promise<void> {
		await this.redis.eval(
			CANCEL_SCRIPT,
			4,
			this.queueKey(gameMode, region),
			this.playerKey(gameMode, region, playerId),
			this.markerKey(playerId),
			this.cancelledKey(playerId),
			playerId,
			this.poolId(gameMode, region),
			this.config.cancelMarkerSeconds,
		);
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
				5,
				this.queueKey(gameMode, region),
				this.playerKey(gameMode, region, player.playerId),
				this.playerKey(gameMode, region, opponent.playerId),
				this.markerKey(player.playerId),
				this.markerKey(opponent.playerId),
				player.playerId,
				opponent.playerId,
				this.poolId(gameMode, region),
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

	/** Runs ENQUEUE_SCRIPT for players of one pool; returns a written flag per player. */
	private async writeEntries(
		players: readonly PlayerQueueEntry[],
		mode: "enqueue" | "requeue",
	): Promise<boolean[]> {
		const first = players[0];
		if (!first) return [];
		const { gameMode, region } = first;
		if (players.some((p) => p.gameMode !== gameMode || p.region !== region)) {
			throw new Error("writeEntries: all players must share one pool");
		}
		const keys: string[] = [];
		const args: string[] = [
			this.poolId(gameMode, region),
			String(this.config.entryTtlSeconds),
			mode,
		];
		for (const p of players) {
			keys.push(
				this.markerKey(p.playerId),
				this.queueKey(gameMode, region),
				this.playerKey(gameMode, region, p.playerId),
				this.cancelledKey(p.playerId),
			);
			args.push(
				p.playerId,
				String(p.rating),
				String(p.deviation),
				String(p.gamesPlayed),
				gameMode,
				region,
				String(p.queuedAt),
			);
		}
		const result = await this.redis.eval(ENQUEUE_SCRIPT, keys.length, ...keys, ...args);
		if (!Array.isArray(result)) throw new Error("Unexpected enqueue script reply");
		return result.map((flag) => flag === 1);
	}

	private async remove(gameMode: string, region: string, playerId: string): Promise<void> {
		await this.redis.eval(
			REMOVE_SCRIPT,
			3,
			this.queueKey(gameMode, region),
			this.playerKey(gameMode, region, playerId),
			this.markerKey(playerId),
			playerId,
			this.poolId(gameMode, region),
		);
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
			await this.remove(gameMode, region, playerId);
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

	private poolId(gameMode: string, region: string): string {
		assertKeyPart("gameMode", gameMode);
		assertKeyPart("region", region);
		return `${gameMode}:${region}`;
	}

	private queueKey(gameMode: string, region: string): string {
		return `mm:{mm}:queue:${this.poolId(gameMode, region)}`;
	}

	private playerKey(gameMode: string, region: string, playerId: string): string {
		return `mm:{mm}:player:${this.poolId(gameMode, region)}:${playerId}`;
	}

	/** Global: names the one pool a player is queued in. */
	private markerKey(playerId: string): string {
		return `mm:{mm}:queued:${playerId}`;
	}

	/** Global: set for a short time after the player cancels. */
	private cancelledKey(playerId: string): string {
		return `mm:{mm}:cancelled:${playerId}`;
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
					const requeued = await engine.requeue(match.players);
					for (const id of requeued) {
						await queue.add(
							"search",
							{ gameMode, region, playerId: id },
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
