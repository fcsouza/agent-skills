import type { ServerMessage } from "../templates/message-types";
import { GameLoop } from "./game-loop";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoomStatus = "created" | "active" | "closing" | "closed";

export interface RoomConfig {
	maxPlayers: number;
	tickRate: number;
	metadata?: Record<string, unknown>;
}

export interface QueuedAction {
	playerId: string;
	action: { type: string; payload: Record<string, unknown> };
	timestamp: number;
}

// What the room manager needs from a socket. Elysia's `ws` satisfies it;
// `id` is unique per connection, so a reconnect gets a new one.
export interface PlayerSocket {
	readonly id: string;
	send(data: string): unknown;
}

export interface Room {
	id: string;
	status: RoomStatus;
	players: Map<string, PlayerSocket>;
	maxPlayers: number;
	gameState: Record<string, unknown>;
	previousState: Record<string, unknown>;
	actionQueue: QueuedAction[];
	gameLoop: GameLoop;
	tick: number;
	createdAt: number;
	metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Room Manager
// ---------------------------------------------------------------------------

export class RoomManager {
	private rooms = new Map<string, Room>();
	private playerRooms = new Map<string, Set<string>>();

	createRoom(config: RoomConfig): Room {
		const id = crypto.randomUUID();
		const initialState: Record<string, unknown> = {};

		const room: Room = {
			id,
			status: "created",
			players: new Map(),
			maxPlayers: config.maxPlayers,
			gameState: initialState,
			previousState: structuredClone(initialState),
			actionQueue: [],
			// A throw in this room's tick or actions closes this room only.
			gameLoop: new GameLoop(
				config.tickRate,
				(dt) => this.tickRoom(id, dt),
				(error) => {
					console.error(`room ${id}: tick failed, closing the room`, error);
					this.beginCloseRoom(id);
				},
			),
			tick: 0,
			createdAt: Date.now(),
			metadata: config.metadata ?? {},
		};

		this.rooms.set(id, room);
		return room;
	}

	getRoom(roomId: string): Room | undefined {
		return this.rooms.get(roomId);
	}

	listRooms(): Room[] {
		return Array.from(this.rooms.values()).filter((r) => r.status !== "closed");
	}

	joinRoom(roomId: string, playerId: string, ws: PlayerSocket): ServerMessage {
		const room = this.rooms.get(roomId);

		if (!room) {
			return {
				type: "error",
				code: "ROOM_NOT_FOUND",
				message: `Room ${roomId} does not exist.`,
			};
		}

		if (room.status === "closing" || room.status === "closed") {
			return {
				type: "error",
				code: "ROOM_CLOSED",
				message: `Room ${roomId} is no longer accepting players.`,
			};
		}

		if (room.players.size >= room.maxPlayers && !room.players.has(playerId)) {
			return {
				type: "error",
				code: "ROOM_FULL",
				message: `Room ${roomId} is full (${room.maxPlayers} max).`,
			};
		}

		// Add player to room
		room.players.set(playerId, ws);

		// Track which rooms this player is in
		if (!this.playerRooms.has(playerId)) {
			this.playerRooms.set(playerId, new Set());
		}
		this.playerRooms.get(playerId)?.add(roomId);

		// Start the game loop if this is the first player and room was just created
		if (room.status === "created") {
			room.status = "active";
			room.gameLoop.start();
		}

		// Notify existing room members
		this.broadcastToRoom(roomId, {
			type: "player_joined",
			roomId,
			playerId,
			playerCount: room.players.size,
			serverTime: Date.now(),
		});

		return {
			type: "room_joined",
			roomId,
			playerCount: room.players.size,
			gameState: room.gameState,
			tick: room.tick,
			serverTime: Date.now(),
		};
	}

	leaveRoom(roomId: string, playerId: string) {
		const room = this.rooms.get(roomId);
		if (!room?.players.has(playerId)) return;

		room.players.delete(playerId);

		// Update player-room tracking
		this.playerRooms.get(playerId)?.delete(roomId);
		if (this.playerRooms.get(playerId)?.size === 0) {
			this.playerRooms.delete(playerId);
		}

		// Notify remaining members
		this.broadcastToRoom(roomId, {
			type: "player_left",
			roomId,
			playerId,
			playerCount: room.players.size,
			serverTime: Date.now(),
		});

		// If room is empty, begin closing
		if (room.players.size === 0 && room.status === "active") {
			this.beginCloseRoom(roomId);
		}
	}

	// Called when `socket` closes. Leaves only the rooms where the player is
	// still on that socket: after a reconnect, the old socket's close must not
	// remove the player from rooms the new socket joined.
	removePlayerFromAllRooms(playerId: string, socket: PlayerSocket) {
		const roomIds = this.playerRooms.get(playerId);
		if (!roomIds) return;

		for (const roomId of [...roomIds]) {
			if (this.rooms.get(roomId)?.players.get(playerId)?.id === socket.id) {
				this.leaveRoom(roomId, playerId);
			}
		}
	}

	queueAction(
		roomId: string,
		playerId: string,
		action: { type: string; payload: Record<string, unknown> },
	) {
		const room = this.rooms.get(roomId);
		if (!room || room.status !== "active") return;

		if (!room.players.has(playerId)) return;

		room.actionQueue.push({
			playerId,
			action,
			timestamp: Date.now(),
		});
	}

	broadcastToRoom(roomId: string, message: ServerMessage) {
		const room = this.rooms.get(roomId);
		if (!room) return;

		const serialized = JSON.stringify(message);
		for (const ws of room.players.values()) {
			ws.send(serialized);
		}
	}

	sendToPlayer(roomId: string, playerId: string, message: ServerMessage) {
		const room = this.rooms.get(roomId);
		if (!room) return;

		const ws = room.players.get(playerId);
		if (ws) {
			ws.send(JSON.stringify(message));
		}
	}

	closeRoom(roomId: string) {
		this.beginCloseRoom(roomId);
	}

	// ---------------------------------------------------------------------------
	// Private
	// ---------------------------------------------------------------------------

	private tickRoom(roomId: string, _dt: number) {
		const room = this.rooms.get(roomId);
		if (!room || room.status !== "active") return;

		// Process queued actions
		for (const queued of room.actionQueue.splice(0)) {
			this.processAction(room, queued);
		}

		// Update game state (override this with actual game logic)
		// room.gameState = updateState(room.gameState, dt);

		// Compute and broadcast delta
		const delta = this.computeDelta(room.previousState, room.gameState);
		if (delta) {
			this.broadcastToRoom(roomId, {
				type: "state_update",
				roomId,
				state: delta,
				tick: room.tick,
				serverTime: Date.now(),
			});
		}

		room.previousState = structuredClone(room.gameState);
		room.tick++;
	}

	private processAction(room: Room, queued: QueuedAction) {
		// Validate and apply action to room.gameState
		// This is where genre-specific game logic hooks in
		//
		// Example:
		// const result = validateAction(room.gameState, queued.playerId, queued.action);
		// if (!result.valid) {
		//   this.sendToPlayer(room.id, queued.playerId, {
		//     type: 'action_result',
		//     action: queued.action.type,
		//     success: false,
		//     data: { reason: result.reason },
		//   });
		//   return;
		// }
		// applyAction(room.gameState, queued.playerId, queued.action);

		this.sendToPlayer(room.id, queued.playerId, {
			type: "action_result",
			action: queued.action.type,
			success: true,
			data: {},
		});
	}

	private computeDelta(
		previous: Record<string, unknown>,
		current: Record<string, unknown>,
	): Record<string, unknown> | null {
		const delta: Record<string, unknown> = {};
		let hasChanges = false;

		for (const key of Object.keys(current)) {
			if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
				delta[key] = current[key];
				hasChanges = true;
			}
		}

		// Check for removed keys
		for (const key of Object.keys(previous)) {
			if (!(key in current)) {
				delta[key] = null;
				hasChanges = true;
			}
		}

		return hasChanges ? delta : null;
	}

	private beginCloseRoom(roomId: string) {
		const room = this.rooms.get(roomId);
		if (!room || room.status === "closing" || room.status === "closed") return;

		room.status = "closing";
		room.gameLoop.stop();

		// Notify all remaining players
		this.broadcastToRoom(roomId, {
			type: "room_closing",
			roomId,
			reason: "Room is shutting down.",
			serverTime: Date.now(),
		});

		// Persist final state (hook for database writes)
		// await persistRoomState(room);

		// Remove all players
		for (const playerId of room.players.keys()) {
			this.playerRooms.get(playerId)?.delete(roomId);
			if (this.playerRooms.get(playerId)?.size === 0) {
				this.playerRooms.delete(playerId);
			}
		}
		room.players.clear();

		room.status = "closed";

		// Clean up after a grace period
		setTimeout(() => {
			this.rooms.delete(roomId);
		}, 5000);
	}
}
