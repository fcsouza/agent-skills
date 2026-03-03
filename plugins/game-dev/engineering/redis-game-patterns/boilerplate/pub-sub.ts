import { createDedicatedConnection } from "./redis-client";

type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

interface GameEvent {
	type: string;
	timestamp: number;
	serverId?: string;
	[key: string]: unknown;
}

const pubClient = createDedicatedConnection("pub");
const subClient = createDedicatedConnection("sub");

const handlers = new Map<string, Set<EventHandler>>();

subClient.on("message", async (channel: string, message: string) => {
	const channelHandlers = handlers.get(channel);
	if (!channelHandlers) return;

	let parsed: GameEvent;
	try {
		parsed = JSON.parse(message) as GameEvent;
	} catch {
		console.error(`[pub-sub] Failed to parse message on ${channel}:`, message);
		return;
	}

	const promises = [...channelHandlers].map(async (handler) => {
		try {
			await handler(parsed);
		} catch (err) {
			console.error(`[pub-sub] Handler error on ${channel}:`, err);
		}
	});

	await Promise.allSettled(promises);
});

export const publisher = {
	async publish<T extends GameEvent>(channel: string, data: T) {
		const message = JSON.stringify({
			...data,
			timestamp: data.timestamp ?? Date.now(),
		});
		await pubClient.publish(channel, message);
	},
};

export const subscriber = {
	on<T extends GameEvent>(channel: string, handler: EventHandler<T>) {
		if (!handlers.has(channel)) {
			handlers.set(channel, new Set());
			subClient.subscribe(channel);
		}
		handlers.get(channel)?.add(handler as EventHandler);

		return () => {
			handlers.get(channel)?.delete(handler as EventHandler);
			if (handlers.get(channel)?.size === 0) {
				handlers.delete(channel);
				subClient.unsubscribe(channel);
			}
		};
	},

	async unsubscribeAll() {
		for (const channel of handlers.keys()) {
			await subClient.unsubscribe(channel);
		}
		handlers.clear();
	},
};

export const shutdown = async () => {
	await subscriber.unsubscribeAll();
	await Promise.all([pubClient.quit(), subClient.quit()]);
};
