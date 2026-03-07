import type { Redis } from "ioredis";
import type { Match } from "./matchmaker";

export type LobbyState =
	| "WAITING"
	| "ALL_READY"
	| "COUNTDOWN"
	| "IN_PROGRESS"
	| "COMPLETE";

export interface LobbyPlayer {
	playerId: string;
	ready: boolean;
	joinedAt: number;
}

export interface Lobby {
	lobbyId: string;
	matchId: string;
	state: LobbyState;
	gameMode: string;
	region: string;
	players: LobbyPlayer[];
	averageRating: number;
	createdAt: number;
	countdownStartedAt: number | null;
	countdownDuration: number;
}

export interface LobbyConfig {
	countdownDuration: number;
	lobbyTtl: number;
	readyTimeout: number;
}

const DEFAULT_CONFIG: LobbyConfig = {
	countdownDuration: 10_000,
	lobbyTtl: 300,
	readyTimeout: 30_000,
};

/**
 * Lobby lifecycle manager backed by Redis.
 *
 * State machine: WAITING -> ALL_READY -> COUNTDOWN -> IN_PROGRESS -> COMPLETE
 *
 * Lobby state is stored as a Redis hash with TTL.
 * State transitions emit events via Redis pub/sub for WebSocket delivery.
 */
export class LobbyManager {
	private redis: Redis;
	private config: LobbyConfig;

	constructor(redis: Redis, config: Partial<LobbyConfig> = {}) {
		this.redis = redis;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Create a lobby from a completed match.
	 * All matched players are added in WAITING state (not yet ready).
	 */
	async createLobby(match: Match): Promise<Lobby> {
		const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

		const lobby: Lobby = {
			lobbyId,
			matchId: match.matchId,
			state: "WAITING",
			gameMode: match.gameMode,
			region: match.region,
			players: match.players.map((p) => ({
				playerId: p.playerId,
				ready: false,
				joinedAt: Date.now(),
			})),
			averageRating: match.averageRating,
			createdAt: Date.now(),
			countdownStartedAt: null,
			countdownDuration: this.config.countdownDuration,
		};

		await this.saveLobby(lobby);

		// Map each player to this lobby for quick lookup
		for (const player of lobby.players) {
			await this.redis.set(
				this.getPlayerLobbyKey(player.playerId),
				lobbyId,
				"EX",
				this.config.lobbyTtl,
			);
		}

		await this.emitEvent(lobbyId, "lobby:created", { lobby });

		return lobby;
	}

	/**
	 * Add a player to an existing lobby (e.g., reconnect or late join).
	 */
	async joinLobby(lobbyId: string, playerId: string): Promise<void> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
		if (lobby.state !== "WAITING") {
			throw new Error(`Cannot join lobby in state ${lobby.state}`);
		}

		const existing = lobby.players.find((p) => p.playerId === playerId);
		if (existing) return; // Already in lobby

		lobby.players.push({
			playerId,
			ready: false,
			joinedAt: Date.now(),
		});

		await this.saveLobby(lobby);
		await this.redis.set(
			this.getPlayerLobbyKey(playerId),
			lobbyId,
			"EX",
			this.config.lobbyTtl,
		);
		await this.emitEvent(lobbyId, "lobby:player-joined", { playerId });
	}

	/**
	 * Remove a player from a lobby.
	 * If lobby is in COUNTDOWN, revert to WAITING.
	 * If lobby becomes empty, delete it.
	 */
	async leaveLobby(lobbyId: string, playerId: string): Promise<void> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) return;

		lobby.players = lobby.players.filter((p) => p.playerId !== playerId);
		await this.redis.del(this.getPlayerLobbyKey(playerId));

		if (lobby.players.length === 0) {
			await this.deleteLobby(lobbyId);
			await this.emitEvent(lobbyId, "lobby:dissolved", {});
			return;
		}

		// Revert countdown if someone left
		if (lobby.state === "COUNTDOWN" || lobby.state === "ALL_READY") {
			lobby.state = "WAITING";
			lobby.countdownStartedAt = null;
			// Reset all ready states
			for (const player of lobby.players) {
				player.ready = false;
			}
		}

		await this.saveLobby(lobby);
		await this.emitEvent(lobbyId, "lobby:player-left", { playerId });
	}

	/**
	 * Mark a player as ready. If all players are ready, transition to ALL_READY
	 * and start countdown.
	 */
	async readyUp(lobbyId: string, playerId: string): Promise<void> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
		if (lobby.state !== "WAITING" && lobby.state !== "ALL_READY") {
			throw new Error(`Cannot ready up in state ${lobby.state}`);
		}

		const player = lobby.players.find((p) => p.playerId === playerId);
		if (!player) throw new Error(`Player ${playerId} not in lobby`);

		player.ready = true;
		await this.emitEvent(lobbyId, "lobby:player-ready", { playerId });

		// Check if all players are ready
		const allReady = lobby.players.every((p) => p.ready);
		if (allReady) {
			lobby.state = "ALL_READY";
			await this.saveLobby(lobby);
			await this.emitEvent(lobbyId, "lobby:all-ready", {});

			// Auto-start countdown
			await this.startCountdown(lobbyId);
		} else {
			await this.saveLobby(lobby);
		}
	}

	/**
	 * Start the pre-match countdown. Transition from ALL_READY to COUNTDOWN.
	 * After countdownDuration, transition to IN_PROGRESS (handled externally
	 * via a delayed BullMQ job or setTimeout).
	 */
	async startCountdown(lobbyId: string): Promise<void> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
		if (lobby.state !== "ALL_READY") {
			throw new Error(`Cannot start countdown in state ${lobby.state}`);
		}

		lobby.state = "COUNTDOWN";
		lobby.countdownStartedAt = Date.now();
		await this.saveLobby(lobby);

		await this.emitEvent(lobbyId, "lobby:countdown-started", {
			duration: lobby.countdownDuration,
		});
	}

	/**
	 * Transition lobby to IN_PROGRESS. Called after countdown completes.
	 * Validates all players are still connected before starting.
	 */
	async startMatch(
		lobbyId: string,
		validatePresence: (playerIds: string[]) => Promise<string[]>,
	): Promise<{ started: boolean; disconnected: string[] }> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
		if (lobby.state !== "COUNTDOWN") {
			throw new Error(`Cannot start match in state ${lobby.state}`);
		}

		// Pre-match validation: check all players are still connected
		const playerIds = lobby.players.map((p) => p.playerId);
		const disconnected = await validatePresence(playerIds);

		if (disconnected.length > 0) {
			// Remove disconnected players and revert to WAITING
			for (const pid of disconnected) {
				lobby.players = lobby.players.filter((p) => p.playerId !== pid);
				await this.redis.del(this.getPlayerLobbyKey(pid));
			}

			if (lobby.players.length === 0) {
				await this.deleteLobby(lobbyId);
				return { started: false, disconnected };
			}

			lobby.state = "WAITING";
			lobby.countdownStartedAt = null;
			for (const player of lobby.players) {
				player.ready = false;
			}
			await this.saveLobby(lobby);

			await this.emitEvent(lobbyId, "lobby:countdown-cancelled", {
				disconnected,
			});

			return { started: false, disconnected };
		}

		lobby.state = "IN_PROGRESS";
		await this.saveLobby(lobby);
		await this.emitEvent(lobbyId, "lobby:match-started", { lobbyId });

		return { started: true, disconnected: [] };
	}

	/**
	 * Mark lobby as complete. Called when the match ends.
	 */
	async completeLobby(lobbyId: string): Promise<void> {
		const lobby = await this.getLobby(lobbyId);
		if (!lobby) return;

		lobby.state = "COMPLETE";
		await this.saveLobby(lobby);

		// Cleanup player->lobby mappings
		for (const player of lobby.players) {
			await this.redis.del(this.getPlayerLobbyKey(player.playerId));
		}

		await this.emitEvent(lobbyId, "lobby:complete", { lobbyId });

		// Schedule lobby data cleanup (keep for a bit for post-match screens)
		await this.redis.expire(this.getLobbyKey(lobbyId), 60);
	}

	/**
	 * Get lobby by ID.
	 */
	async getLobby(lobbyId: string): Promise<Lobby | null> {
		const data = await this.redis.get(this.getLobbyKey(lobbyId));
		if (!data) return null;
		return JSON.parse(data) as Lobby;
	}

	/**
	 * Get the lobby a player is currently in.
	 */
	async getPlayerLobby(playerId: string): Promise<Lobby | null> {
		const lobbyId = await this.redis.get(this.getPlayerLobbyKey(playerId));
		if (!lobbyId) return null;
		return this.getLobby(lobbyId);
	}

	// --- Internal helpers ---

	private async saveLobby(lobby: Lobby): Promise<void> {
		await this.redis.set(
			this.getLobbyKey(lobby.lobbyId),
			JSON.stringify(lobby),
			"EX",
			this.config.lobbyTtl,
		);
	}

	private async deleteLobby(lobbyId: string): Promise<void> {
		await this.redis.del(this.getLobbyKey(lobbyId));
	}

	private async emitEvent(
		lobbyId: string,
		event: string,
		data: Record<string, unknown>,
	): Promise<void> {
		await this.redis.publish(
			`lobby:${lobbyId}`,
			JSON.stringify({ event, data, timestamp: Date.now() }),
		);
	}

	private getLobbyKey(lobbyId: string): string {
		return `lobby:data:${lobbyId}`;
	}

	private getPlayerLobbyKey(playerId: string): string {
		return `lobby:player:${playerId}`;
	}
}
