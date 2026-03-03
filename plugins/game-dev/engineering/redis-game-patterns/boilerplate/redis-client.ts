import Redis from "ioredis";

export const createRedisClient = (
	url: string,
	options?: { name?: string; maxRetries?: number },
) => {
	const client = new Redis(url, {
		maxRetriesPerRequest: options?.maxRetries ?? 3,
		retryStrategy(times) {
			const delay = Math.min(times * 200, 5000);
			console.log(
				`[redis:${options?.name ?? "default"}] Reconnecting in ${delay}ms (attempt ${times})`,
			);
			return delay;
		},
		reconnectOnError(err) {
			const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
			return targetErrors.some((e) => err.message.includes(e));
		},
		enableReadyCheck: true,
		lazyConnect: false,
	});

	client.on("connect", () => {
		console.log(`[redis:${options?.name ?? "default"}] Connected`);
	});

	client.on("error", (err) => {
		console.error(`[redis:${options?.name ?? "default"}] Error:`, err.message);
	});

	client.on("close", () => {
		console.log(`[redis:${options?.name ?? "default"}] Connection closed`);
	});

	return client;
};

export const redis = createRedisClient(process.env.REDIS_URL!, {
	name: "main",
});

export const createDedicatedConnection = (name: string) =>
	createRedisClient(process.env.REDIS_URL!, { name });

export const gracefulShutdown = async (...clients: Redis[]) => {
	await Promise.all(
		clients.map(async (client) => {
			try {
				await client.quit();
			} catch {
				client.disconnect();
			}
		}),
	);
};
