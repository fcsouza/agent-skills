// Verified against: ioredis 6.0.0 (2026-11-14)
import type { Redis } from "ioredis";
import type { Match } from "./matchmaker";

export type LobbyState = "WAITING" | "COUNTDOWN" | "IN_PROGRESS" | "COMPLETE";

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
	/** Players the match needs. Below this the lobby dissolves. */
	matchSize: number;
	averageRating: number;
	createdAt: number;
	countdownStartedAt: number | null;
	countdownDurationMs: number;
}

/** Tunables. The defaults are starting points, not measured values. */
export interface LobbyConfig {
	countdownDurationMs: number;
	/** TTL while the lobby forms (WAITING to COUNTDOWN). */
	lobbyTtlSeconds: number;
	/** TTL while the match runs; must outlast the longest match. */
	inProgressTtlSeconds: number;
	/** How long a COMPLETE lobby stays readable for the results screen. */
	completeTtlSeconds: number;
}

const DEFAULT_CONFIG: LobbyConfig = {
	countdownDurationMs: 10_000,
	lobbyTtlSeconds: 300,
	inProgressTtlSeconds: 7_200,
	completeTtlSeconds: 60,
};

/**
 * Writes the new lobby only if the stored JSON still equals the JSON the
 * caller read (compare-and-set). KEYS[1] lobby key; ARGV[1] expected JSON,
 * ARGV[2] new JSON, ARGV[3] TTL in seconds. Returns 1 on write, 0 on conflict.
 */
const CAS_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

/**
 * Deletes a player->lobby mapping only if it still names this lobby, so a
 * late call for an old lobby cannot erase the player's current one.
 * KEYS[1] mapping key; ARGV[1] lobby id.
 */
const DELETE_IF_EQUAL_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/**
 * Deletes the lobby only if it still holds the JSON the caller read.
 * KEYS[1] lobby key; ARGV[1] expected JSON. Returns 1 on delete, 0 on conflict.
 */
const CAS_DELETE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`;

const MAX_CAS_RETRIES = 10;

/** The lobby changed between the read and the write; read it again and retry. */
export class LobbyChangedError extends Error {}

/**
 * Lobby state machine: WAITING -> COUNTDOWN -> IN_PROGRESS -> COMPLETE.
 * The last ready-up moves WAITING to COUNTDOWN. A leave or a failed presence
 * check before IN_PROGRESS leaves the lobby short of `matchSize`, so it
 * dissolves: the lobby is deleted, every player is unmapped, and the
 * remaining ids go back to the caller to requeue.
 * A lobby is one JSON value in Redis. Every transition reads it, applies a pure
 * change, and writes it back with a compare-and-set script, so two players
 * readying up at once cannot overwrite each other. Events go out on the
 * `lobby:<id>` pub/sub channel for the WebSocket layer.
 */
export class LobbyManager {
	private readonly redis: Redis;
	private readonly config: LobbyConfig;

	constructor(redis: Redis, config: Partial<LobbyConfig> = {}) {
		this.redis = redis;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async createLobby(match: Match): Promise<Lobby> {
		const now = Date.now();
		const lobby: Lobby = {
			lobbyId: `lobby_${now}_${Math.random().toString(36).slice(2, 8)}`,
			matchId: match.matchId,
			state: "WAITING",
			gameMode: match.gameMode,
			region: match.region,
			players: match.players.map((p) => ({ playerId: p.playerId, ready: false, joinedAt: now })),
			matchSize: match.players.length,
			averageRating: match.averageRating,
			createdAt: now,
			countdownStartedAt: null,
			countdownDurationMs: this.config.countdownDurationMs,
		};

		const multi = this.redis
			.multi()
			.set(this.lobbyKey(lobby.lobbyId), JSON.stringify(lobby), "EX", this.config.lobbyTtlSeconds);
		for (const p of lobby.players) {
			multi.set(this.playerLobbyKey(p.playerId), lobby.lobbyId, "EX", this.config.lobbyTtlSeconds);
		}
		await multi.exec();

		await this.emit(lobby.lobbyId, "lobby:created", { lobby });
		return lobby;
	}

	/**
	 * Marks a player ready. When everyone is ready the lobby moves to
	 * COUNTDOWN in the same write; the caller schedules `startMatch` after
	 * `countdownDurationMs` (for example with a delayed BullMQ job).
	 */
	async readyUp(lobbyId: string, playerId: string): Promise<Lobby> {
		const lobby = await this.transitionTo(lobbyId, (l) => {
			if (l.state !== "WAITING") throw new Error(`Cannot ready up in state ${l.state}`);
			const players = l.players.map((p) => (p.playerId === playerId ? { ...p, ready: true } : p));
			if (!players.some((p) => p.playerId === playerId)) {
				throw new Error(`Player ${playerId} not in lobby`);
			}
			const allReady = players.every((p) => p.ready);
			return {
				...l,
				players,
				state: allReady ? "COUNTDOWN" : "WAITING",
				countdownStartedAt: allReady ? Date.now() : null,
			};
		});
		await this.emit(lobbyId, "lobby:player-ready", { playerId });
		if (lobby.state === "COUNTDOWN") {
			await this.emit(lobbyId, "lobby:countdown-started", { durationMs: lobby.countdownDurationMs });
		}
		return lobby;
	}

	/**
	 * Removes a player before the match starts. The lobby is then short of
	 * `matchSize`, so it dissolves in the same write. Returns the ids of the
	 * players who were left in it, already unmapped, so the caller can requeue
	 * them with their original `queuedAt` (their bracket stays wide).
	 */
	async leaveLobby(lobbyId: string, playerId: string): Promise<string[]> {
		const remaining: string[] = [];
		await this.transition(lobbyId, (l) => {
			if (l.state === "IN_PROGRESS" || l.state === "COMPLETE") {
				throw new Error(`Cannot leave lobby in state ${l.state}; record it as an abandon`);
			}
			if (!l.players.some((p) => p.playerId === playerId)) {
				throw new Error(`Player ${playerId} not in lobby`);
			}
			remaining.splice(0, remaining.length, ...this.idsWithout(l, [playerId]));
			return null;
		});
		await this.unmapPlayers(lobbyId, [playerId, ...remaining]);
		await this.emit(lobbyId, "lobby:player-left", { playerId });
		await this.emit(lobbyId, "lobby:dissolved", { requeue: remaining });
		return remaining;
	}

	/**
	 * COUNTDOWN -> IN_PROGRESS after checking every player is still connected.
	 * `findDisconnected` returns the ids that failed the presence check. If any
	 * did, the lobby dissolves: `requeue` lists the players still connected,
	 * already unmapped, for the caller to put back in the queue.
	 * The write only goes through if the lobby is still the one that was
	 * checked: same countdown, countdown elapsed, same players. Otherwise it
	 * throws `LobbyChangedError`; call `startMatch` again when the new
	 * countdown ends.
	 */
	async startMatch(
		lobbyId: string,
		findDisconnected: (playerIds: string[]) => Promise<string[]>,
	): Promise<{ started: boolean; disconnected: string[]; requeue: string[] }> {
		const current = await this.getLobby(lobbyId);
		if (!current) throw new Error(`Lobby ${lobbyId} not found`);
		const disconnected = await findDisconnected(current.players.map((p) => p.playerId));

		const checkedIds = current.players.map((p) => p.playerId).sort();
		const remaining: string[] = [];
		const lobby = await this.transition(lobbyId, (l) => {
			if (l.state !== "COUNTDOWN") throw new Error(`Cannot start match in state ${l.state}`);
			const ids = l.players.map((p) => p.playerId).sort();
			if (
				l.countdownStartedAt === null ||
				l.countdownStartedAt !== current.countdownStartedAt ||
				ids.length !== checkedIds.length ||
				ids.some((id, i) => id !== checkedIds[i])
			) {
				throw new LobbyChangedError(`Lobby ${lobbyId} changed since the presence check`);
			}
			if (Date.now() < l.countdownStartedAt + l.countdownDurationMs) {
				throw new LobbyChangedError(`Lobby ${lobbyId}: countdown has not ended`);
			}
			if (disconnected.length === 0) return { ...l, state: "IN_PROGRESS" };
			remaining.splice(0, remaining.length, ...this.idsWithout(l, disconnected));
			return null;
		});

		if (!lobby) {
			await this.unmapPlayers(lobbyId, [...disconnected, ...remaining]);
			await this.emit(lobbyId, "lobby:dissolved", { disconnected, requeue: remaining });
			return { started: false, disconnected, requeue: remaining };
		}
		const multi = this.redis.multi();
		for (const p of lobby.players) {
			multi.expire(this.playerLobbyKey(p.playerId), this.config.inProgressTtlSeconds);
		}
		await multi.exec();
		await this.emit(lobbyId, "lobby:match-started", { lobbyId });
		return { started: true, disconnected: [], requeue: [] };
	}

	async completeLobby(lobbyId: string): Promise<void> {
		const lobby = await this.transitionTo(lobbyId, (l) => {
			if (l.state !== "IN_PROGRESS") throw new Error(`Cannot complete lobby in state ${l.state}`);
			return { ...l, state: "COMPLETE" };
		});
		await this.unmapPlayers(
			lobbyId,
			lobby.players.map((p) => p.playerId),
		);
		await this.emit(lobbyId, "lobby:complete", { lobbyId });
	}

	async getLobby(lobbyId: string): Promise<Lobby | null> {
		const raw = await this.redis.get(this.lobbyKey(lobbyId));
		return raw ? (JSON.parse(raw) as Lobby) : null;
	}

	async getPlayerLobby(playerId: string): Promise<Lobby | null> {
		const lobbyId = await this.redis.get(this.playerLobbyKey(playerId));
		return lobbyId ? this.getLobby(lobbyId) : null;
	}

	// --- Internal helpers ---

	private async unmapPlayers(lobbyId: string, playerIds: readonly string[]): Promise<void> {
		for (const id of playerIds) {
			await this.redis.eval(DELETE_IF_EQUAL_SCRIPT, 1, this.playerLobbyKey(id), lobbyId);
		}
	}

	private idsWithout(lobby: Lobby, removeIds: readonly string[]): string[] {
		return lobby.players.map((p) => p.playerId).filter((id) => !removeIds.includes(id));
	}

	/** `transition` for changes that always keep the lobby. */
	private async transitionTo(lobbyId: string, change: (lobby: Lobby) => Lobby): Promise<Lobby> {
		const next = await this.transition(lobbyId, change);
		if (!next) throw new Error(`Lobby ${lobbyId}: unexpected delete`);
		return next;
	}

	/**
	 * Read, apply `change`, compare-and-set; retry on conflict. `change` may
	 * throw to refuse, or return null to delete the lobby (dissolve). It can
	 * run once per retry, each time on a fresh read; a value it captures for
	 * the caller must be overwritten on every run, not appended to.
	 */
	private async transition(
		lobbyId: string,
		change: (lobby: Lobby) => Lobby | null,
	): Promise<Lobby | null> {
		const key = this.lobbyKey(lobbyId);
		for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
			const raw = await this.redis.get(key);
			if (!raw) throw new Error(`Lobby ${lobbyId} not found`);
			const next = change(JSON.parse(raw) as Lobby);
			const written =
				next === null
					? await this.redis.eval(CAS_DELETE_SCRIPT, 1, key, raw)
					: await this.redis.eval(
							CAS_SCRIPT,
							1,
							key,
							raw,
							JSON.stringify(next),
							this.ttlFor(next.state),
						);
			if (written === 1) return next;
		}
		throw new Error(`Lobby ${lobbyId}: too many concurrent updates`);
	}

	private ttlFor(state: LobbyState): number {
		if (state === "IN_PROGRESS") return this.config.inProgressTtlSeconds;
		if (state === "COMPLETE") return this.config.completeTtlSeconds;
		return this.config.lobbyTtlSeconds;
	}

	private async emit(lobbyId: string, event: string, data: Record<string, unknown>): Promise<void> {
		await this.redis.publish(
			`lobby:${lobbyId}`,
			JSON.stringify({ event, data, timestamp: Date.now() }),
		);
	}

	private lobbyKey(lobbyId: string): string {
		return `lobby:data:${lobbyId}`;
	}

	private playerLobbyKey(playerId: string): string {
		return `lobby:player:${playerId}`;
	}
}
