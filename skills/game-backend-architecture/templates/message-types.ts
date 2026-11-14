// Verified against: elysia 1.4.32 (2026-11-14)
import { type Static, t } from "elysia";

// ---------------------------------------------------------------------------
// Client → Server Messages
// The player id never travels in a message: the server takes it from the
// session it checked on the WebSocket upgrade.
// One TypeBox schema: the server validates every message with it, and the
// TypeScript type comes from it, so the two cannot drift apart.
// Browser code: `import type { ClientMessage, ServerMessage }` from this file,
// so the client bundle does not pull in elysia.
// ---------------------------------------------------------------------------

export const clientMessage = t.Union([
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
]);

export type ClientMessage = Static<typeof clientMessage>;

// ---------------------------------------------------------------------------
// Server → Client Messages
// ---------------------------------------------------------------------------

export type ServerMessage =
	// Connection
	| { type: "connected"; playerId: string; serverTime: number }

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
