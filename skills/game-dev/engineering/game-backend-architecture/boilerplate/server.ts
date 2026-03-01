import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import type { ClientMessage, ServerMessage } from "../templates/message-types";
import { GameLoop } from "./game-loop";
import { RoomManager } from "./room-manager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerConnection {
	ws: GameWebSocket;
	playerId: string;
	connectedAt: number;
}

type GameWebSocket = {
	send: (data: string | ServerMessage) => void;
	subscribe: (channel: string) => void;
	unsubscribe: (channel: string) => void;
	data: { playerId: string; token: string };
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const connections = new Map<string, PlayerConnection>();
const roomManager = new RoomManager();

// ---------------------------------------------------------------------------
// REST Routes
// ---------------------------------------------------------------------------

const restRoutes = new Elysia({ prefix: "/api" })
	// Players
	.get("/players/:id", async ({ params }) => {
		// Fetch player profile from database
		return { id: params.id, status: "ok" };
	})
	.patch(
		"/players/:id",
		async ({ params, body }) => {
			// Update player profile
			return { id: params.id, updated: true };
		},
		{
			body: t.Object({
				displayName: t.Optional(t.String()),
				settings: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)

	// Sessions
	.post(
		"/sessions",
		async ({ body }) => {
			// Create a new game session / room
			const room = roomManager.createRoom({
				maxPlayers: body.maxPlayers ?? 10,
				tickRate: body.tickRate ?? 20,
				metadata: body.metadata ?? {},
			});
			return { roomId: room.id, status: room.status };
		},
		{
			body: t.Object({
				maxPlayers: t.Optional(t.Number()),
				tickRate: t.Optional(t.Number()),
				metadata: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)
	.get("/sessions", () => {
		return roomManager.listRooms().map((r) => ({
			id: r.id,
			status: r.status,
			playerCount: r.players.size,
			maxPlayers: r.maxPlayers,
		}));
	})
	.get("/sessions/:id", ({ params }) => {
		const room = roomManager.getRoom(params.id);
		if (!room) return { error: "Room not found" };
		return {
			id: room.id,
			status: room.status,
			playerCount: room.players.size,
			maxPlayers: room.maxPlayers,
			tick: room.tick,
		};
	})
	.delete("/sessions/:id", ({ params }) => {
		roomManager.closeRoom(params.id);
		return { closed: true };
	})

	// Inventory (example CRUD)
	.get("/players/:id/inventory", async ({ params }) => {
		// Fetch inventory from database
		return { playerId: params.id, items: [] };
	})
	.post(
		"/players/:id/inventory",
		async ({ params, body }) => {
			// Add item to inventory
			return { playerId: params.id, item: body, added: true };
		},
		{
			body: t.Object({
				itemId: t.String(),
				quantity: t.Number({ minimum: 1 }),
			}),
		},
	);

// ---------------------------------------------------------------------------
// WebSocket Endpoint
// ---------------------------------------------------------------------------

const wsRoute = new Elysia()
	.use(
		jwt({
			name: "jwt",
			secret: process.env.JWT_SECRET ?? "development-secret-change-me",
		}),
	)
	.ws("/ws", {
		body: t.Union([
			t.Object({ type: t.Literal("auth"), token: t.String() }),
			t.Object({ type: t.Literal("join_room"), roomId: t.String() }),
			t.Object({ type: t.Literal("leave_room"), roomId: t.String() }),
			t.Object({
				type: t.Literal("action"),
				roomId: t.String(),
				action: t.Object({
					type: t.String(),
					payload: t.Record(t.String(), t.Unknown()),
				}),
			}),
			t.Object({
				type: t.Literal("room_message"),
				roomId: t.String(),
				content: t.String(),
			}),
			t.Object({ type: t.Literal("ping") }),
		]),

		async open(ws) {
			// Auth happens via the first message (type: 'auth')
			// Connection is unauthenticated until then
			ws.send(
				JSON.stringify({
					type: "connected",
					serverTime: Date.now(),
					message: "Send auth message with JWT token to authenticate.",
				} satisfies ServerMessage),
			);
		},

		async message(ws, data: ClientMessage) {
			// ---------- Auth ----------
			if (data.type === "auth") {
				const jwtPlugin = (
					ws as unknown as {
						data: {
							jwt: { verify: (t: string) => Promise<{ sub?: string } | false> };
						};
					}
				).data.jwt;
				const payload = await jwtPlugin.verify(data.token);
				if (!payload || !payload.sub) {
					ws.send(
						JSON.stringify({
							type: "error",
							code: "AUTH_FAILED",
							message: "Invalid or expired token.",
						} satisfies ServerMessage),
					);
					return;
				}

				const playerId = payload.sub;
				(ws.data as Record<string, unknown>).playerId = playerId;

				connections.set(playerId, {
					ws: ws as unknown as GameWebSocket,
					playerId,
					connectedAt: Date.now(),
				});

				ws.send(
					JSON.stringify({
						type: "auth_success",
						playerId,
						serverTime: Date.now(),
					} satisfies ServerMessage),
				);
				return;
			}

			// ---------- Guard: must be authenticated ----------
			const playerId = (ws.data as Record<string, unknown>).playerId as
				| string
				| undefined;
			if (!playerId) {
				ws.send(
					JSON.stringify({
						type: "error",
						code: "NOT_AUTHENTICATED",
						message: "Send auth message before other actions.",
					} satisfies ServerMessage),
				);
				return;
			}

			// ---------- Message Routing ----------
			switch (data.type) {
				case "join_room": {
					const result = roomManager.joinRoom(
						data.roomId,
						playerId,
						ws as unknown as GameWebSocket,
					);
					ws.send(JSON.stringify(result));
					break;
				}

				case "leave_room": {
					roomManager.leaveRoom(data.roomId, playerId);
					ws.send(
						JSON.stringify({
							type: "room_left",
							roomId: data.roomId,
						} satisfies ServerMessage),
					);
					break;
				}

				case "action": {
					roomManager.queueAction(data.roomId, playerId, data.action);
					break;
				}

				case "room_message": {
					roomManager.broadcastToRoom(data.roomId, {
						type: "room_message",
						roomId: data.roomId,
						playerId,
						content: data.content,
						serverTime: Date.now(),
					});
					break;
				}

				case "ping": {
					ws.send(
						JSON.stringify({
							type: "pong",
							serverTime: Date.now(),
						} satisfies ServerMessage),
					);
					break;
				}
			}
		},

		close(ws) {
			const playerId = (ws.data as Record<string, unknown>).playerId as
				| string
				| undefined;
			if (playerId) {
				// Remove from all rooms
				roomManager.removePlayerFromAllRooms(playerId);
				connections.delete(playerId);
			}
		},
	});

// ---------------------------------------------------------------------------
// Server Assembly
// ---------------------------------------------------------------------------

const app = new Elysia()
	.use(cors())
	.use(restRoutes)
	.use(wsRoute)
	.get("/health", () => ({
		status: "ok",
		uptime: process.uptime(),
		rooms: roomManager.listRooms().length,
		connections: connections.size,
	}))
	.listen(Number(process.env.PORT ?? 3000));

console.log(
	`Game server running on ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
export { app, connections, roomManager };
