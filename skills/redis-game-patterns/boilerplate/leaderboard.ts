import { redis } from "./redis-client";

const key = (board: string) => `lb:${board}`;

export const leaderboard = {
	async addScore(board: string, playerId: string, score: number) {
		await redis.zadd(key(board), score, playerId);
	},

	async getTopN(
		board: string,
		n: number,
	): Promise<{ playerId: string; score: number; rank: number }[]> {
		const results = await redis.zrevrange(key(board), 0, n - 1, "WITHSCORES");
		const entries: { playerId: string; score: number; rank: number }[] = [];

		for (let i = 0; i < results.length; i += 2) {
			entries.push({
				playerId: results[i],
				score: parseFloat(results[i + 1]),
				rank: i / 2 + 1,
			});
		}

		return entries;
	},

	async getPlayerRank(
		board: string,
		playerId: string,
	): Promise<{ rank: number; score: number } | null> {
		const pipeline = redis.pipeline();
		pipeline.zrevrank(key(board), playerId);
		pipeline.zscore(key(board), playerId);

		const results = await pipeline.exec();
		const rank = results?.[0]?.[1] as number | null;
		const score = results?.[1]?.[1] as string | null;

		if (rank === null || score === null) return null;

		return { rank: rank + 1, score: parseFloat(score) };
	},

	async getAroundPlayer(
		board: string,
		playerId: string,
		range = 5,
	): Promise<{ playerId: string; score: number; rank: number }[]> {
		const rank = await redis.zrevrank(key(board), playerId);
		if (rank === null) return [];

		const start = Math.max(0, rank - range);
		const stop = rank + range;

		const results = await redis.zrevrange(
			key(board),
			start,
			stop,
			"WITHSCORES",
		);
		const entries: { playerId: string; score: number; rank: number }[] = [];

		for (let i = 0; i < results.length; i += 2) {
			entries.push({
				playerId: results[i],
				score: parseFloat(results[i + 1]),
				rank: start + i / 2 + 1,
			});
		}

		return entries;
	},

	async snapshotToPostgres(
		board: string,
		persistFn: (
			entries: { playerId: string; score: number; rank: number }[],
			board: string,
			snapshotAt: Date,
		) => Promise<void>,
	) {
		const total = await redis.zcard(key(board));
		const batchSize = 500;
		const allEntries: { playerId: string; score: number; rank: number }[] = [];

		for (let offset = 0; offset < total; offset += batchSize) {
			const results = await redis.zrevrange(
				key(board),
				offset,
				offset + batchSize - 1,
				"WITHSCORES",
			);

			for (let i = 0; i < results.length; i += 2) {
				allEntries.push({
					playerId: results[i],
					score: parseFloat(results[i + 1]),
					rank: offset + i / 2 + 1,
				});
			}
		}

		await persistFn(allEntries, board, new Date());
	},

	async reset(board: string) {
		await redis.del(key(board));
	},
};
