// ---------------------------------------------------------------------------
// Client → Server Messages
// ---------------------------------------------------------------------------

export type ClientMessage =
	| { type: "auth"; token: string }
	| { type: "join_room"; roomId: string }
	| { type: "leave_room"; roomId: string }
	| {
			type: "action";
			roomId: string;
			action: { type: string; payload: Record<string, unknown> };
	  }
	| { type: "room_message"; roomId: string; content: string }
	| { type: "ping" };

// ---------------------------------------------------------------------------
// Server → Client Messages
// ---------------------------------------------------------------------------

export type ServerMessage =
	// Connection
	| { type: "connected"; serverTime: number; message: string }
	| { type: "auth_success"; playerId: string; serverTime: number }

	// Room lifecycle
	| {
			type: "room_joined";
			roomId: string;
			playerCount: number;
			gameState: Record<string, unknown>;
			tick: number;
			serverTime: number;
	  }
	| { type: "room_left"; roomId: string }
	| {
			type: "room_closing";
			roomId: string;
			reason: string;
			serverTime: number;
	  }

	// Player presence in rooms
	| {
			type: "player_joined";
			roomId: string;
			playerId: string;
			playerCount: number;
			serverTime: number;
	  }
	| {
			type: "player_left";
			roomId: string;
			playerId: string;
			playerCount: number;
			serverTime: number;
	  }

	// Game state
	| {
			type: "state_update";
			roomId: string;
			state: Record<string, unknown>;
			tick: number;
			serverTime: number;
	  }
	| {
			type: "action_result";
			action: string;
			success: boolean;
			data: Record<string, unknown>;
	  }
	| {
			type: "game_event";
			event: string;
			data: Record<string, unknown>;
			tick: number;
	  }

	// Room messages
	| {
			type: "room_message";
			roomId: string;
			playerId: string;
			content: string;
			serverTime: number;
	  }

	// Heartbeat
	| { type: "pong"; serverTime: number }

	// Errors
	| { type: "error"; code: string; message: string };

// ---------------------------------------------------------------------------
// Utility: Extract a specific message type
// ---------------------------------------------------------------------------

export type ExtractMessage<
	T extends ClientMessage | ServerMessage,
	K extends T["type"],
> = Extract<T, { type: K }>;

// ---------------------------------------------------------------------------
// Action type helpers (genre-agnostic)
// ---------------------------------------------------------------------------

export interface GameAction {
	type: string;
	payload: Record<string, unknown>;
}

export interface ActionResult {
	success: boolean;
	events?: Array<{ type: string; data: Record<string, unknown> }>;
	error?: string;
}
