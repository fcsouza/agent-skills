// Verified against: ioredis 6.0.0 (2026-11-14)
import type { Redis } from "ioredis";

// Pass a client built with the default `replyMapping: "legacy"`. Under that
// mapping WITHSCORES replies are flat [member, score, member, score, ...]
// string arrays, which is what toEntries() parses.
// ZRANGE ... REV needs Redis 6.2 or newer (it replaces the deprecated ZREVRANGE).

export interface LeaderboardEntry {
	playerId: string;
	score: number;
	rank: number;
}

const toEntries = (flat: string[], firstRank: number): LeaderboardEntry[] => {
	const entries: LeaderboardEntry[] = [];
	for (let i = 0; i < flat.length; i += 2) {
		entries.push({
			playerId: flat[i],
			score: Number.parseFloat(flat[i + 1]),
			rank: firstRank + i / 2,
		});
	}
	return entries;
};

export const createLeaderboard = (redis: Redis) => {
	const key = (board: string) => `lb:${board}`;

	// Highest score first. ioredis types `stop` as string | Buffer for ZRANGE.
	const rangeDesc = (board: string, start: number, stop: number) =>
		redis.zrange(key(board), start, String(stop), "REV", "WITHSCORES");

	return {
		async addScore(board: string, playerId: string, score: number) {
			await redis.zadd(key(board), score, playerId);
		},

		async getTopN(board: string, n: number): Promise<LeaderboardEntry[]> {
			return toEntries(await rangeDesc(board, 0, n - 1), 1);
		},

		async getPlayerRank(
			board: string,
			playerId: string,
		): Promise<{ rank: number; score: number } | null> {
			// MULTI so rank and score come from the same moment.
			const results = await redis
				.multi()
				.zrevrank(key(board), playerId)
				.zscore(key(board), playerId)
				.exec();
			if (!results) return null;
			const [[rankErr, rank], [scoreErr, score]] = results;
			if (rankErr) throw rankErr;
			if (scoreErr) throw scoreErr;
			if (typeof rank !== "number" || typeof score !== "string") return null;
			return { rank: rank + 1, score: Number.parseFloat(score) };
		},

		async getAroundPlayer(
			board: string,
			playerId: string,
			range = 5,
		): Promise<LeaderboardEntry[]> {
			const rank = await redis.zrevrank(key(board), playerId);
			if (rank === null) return [];
			const start = Math.max(0, rank - range);
			return toEntries(await rangeDesc(board, start, rank + range), start + 1);
		},

		// Copy the board to durable storage (for example at season end).
		// `persist` is yours: write the rows to Postgres or wherever results live.
		async snapshot(
			board: string,
			persist: (
				entries: LeaderboardEntry[],
				board: string,
				snapshotAt: Date,
			) => Promise<void>,
			batchSize = 500,
		) {
			const total = await redis.zcard(key(board));
			const all: LeaderboardEntry[] = [];
			for (let offset = 0; offset < total; offset += batchSize) {
				const flat = await rangeDesc(board, offset, offset + batchSize - 1);
				all.push(...toEntries(flat, offset + 1));
			}
			await persist(all, board, new Date());
		},

		async reset(board: string) {
			await redis.del(key(board));
		},
	};
};
