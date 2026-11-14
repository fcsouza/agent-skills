// Game server health signals and alert rules. No package imports: translate
// the rules into whatever alert engine the project uses.
//
// No threshold here has a default. Each one comes from the game's own numbers:
// the tick rate, a load test, or a baseline measured under normal play.

// ------------------------------------------------------------------ signals

export type Instrument = "histogram" | "counter" | "updown";

export interface Signal {
	name: string;
	instrument: Instrument;
	/** OpenTelemetry style: durations in seconds, counts as {thing}. */
	unit: string;
	/** Low-cardinality labels only: never playerId, roomId or sessionId. */
	labels: readonly string[];
}

export const GAME_SIGNALS = {
	tickDuration: {
		name: "game.tick.duration",
		instrument: "histogram",
		unit: "s",
		labels: ["mode"],
	},
	tickOverruns: {
		name: "game.tick.overruns",
		instrument: "counter",
		unit: "{tick}",
		labels: ["mode"],
	},
	activeRooms: {
		name: "game.rooms.active",
		instrument: "updown",
		unit: "{room}",
		labels: ["mode"],
	},
	wsConnections: {
		name: "game.ws.connections",
		instrument: "updown",
		unit: "{connection}",
		labels: [],
	},
	wsCloses: {
		name: "game.ws.closes",
		instrument: "counter",
		unit: "{close}",
		labels: ["code"],
	},
	messageErrors: {
		name: "game.messages.errors",
		instrument: "counter",
		unit: "{error}",
		labels: ["mode", "messageType"],
	},
	matchmakingWait: {
		name: "game.matchmaking.wait",
		instrument: "histogram",
		unit: "s",
		labels: ["mode"],
	},
	jobsFailed: {
		name: "game.jobs.failed",
		instrument: "counter",
		unit: "{job}",
		labels: ["queue"],
	},
	currencyMinted: {
		name: "game.currency.minted",
		instrument: "counter",
		unit: "{coin}",
		labels: ["currency", "source"],
	},
	currencySpent: {
		name: "game.currency.spent",
		instrument: "counter",
		unit: "{coin}",
		labels: ["currency", "sink"],
	},
} as const satisfies Record<string, Signal>;

// ------------------------------------------------------------------- rules

/** A page wakes someone; a ticket waits for working hours. */
export type AlertRoute = "page" | "ticket";

export interface AlertRule {
	name: string;
	/** Metric name plus the statistic, e.g. "game.tick.duration p99". */
	query: string;
	operator: "gt" | "lt";
	threshold: number;
	/** The condition must hold this long before the alert fires. */
	forSeconds: number;
	route: AlertRoute;
	/** What the responder does first. A rule with no action is a dashboard. */
	runbook: string;
}

/**
 * Tick overrun: the tick takes longer than the budget the tick rate allows.
 * `headroom` is the fraction of the interval the tick may use (0 < h <= 1).
 * Set it from the profile of a full room; the interval itself is not a safe
 * limit, because a tick that uses all of it falls behind under any spike.
 */
export const tickOverrunRule = (opts: {
	tickRateHz: number;
	headroom: number;
	forSeconds: number;
	route: AlertRoute;
	runbook: string;
}): AlertRule => {
	if (opts.tickRateHz <= 0 || opts.headroom <= 0 || opts.headroom > 1) {
		throw new RangeError("tickRateHz > 0 and 0 < headroom <= 1");
	}
	const intervalSeconds = 1 / opts.tickRateHz;
	return {
		name: "tick_overrun",
		query: `${GAME_SIGNALS.tickDuration.name} p99`,
		operator: "gt",
		threshold: intervalSeconds * opts.headroom,
		forSeconds: opts.forSeconds,
		route: opts.route,
		runbook: opts.runbook,
	};
};

/**
 * Capacity: a gauge-like signal (rooms, connections) nears the limit a load
 * test measured for one server. `fraction` is how close to the limit to fire.
 */
export const capacityRule = (opts: {
	name: string;
	signal: Signal;
	measuredLimit: number;
	fraction: number;
	forSeconds: number;
	route: AlertRoute;
	runbook: string;
}): AlertRule => ({
	name: opts.name,
	query: opts.signal.name,
	operator: "gt",
	threshold: opts.measuredLimit * opts.fraction,
	forSeconds: opts.forSeconds,
	route: opts.route,
	runbook: opts.runbook,
});

/**
 * Baseline: a signal moves away from its normal value. `baseline` is the
 * value measured over a recent period of normal play; `factor` > 1 with "gt"
 * catches a rise, `factor` < 1 with "lt" catches a drop.
 */
export const baselineRule = (opts: {
	name: string;
	query: string;
	baseline: number;
	factor: number;
	operator: "gt" | "lt";
	forSeconds: number;
	route: AlertRoute;
	runbook: string;
}): AlertRule => ({
	name: opts.name,
	query: opts.query,
	operator: opts.operator,
	threshold: opts.baseline * opts.factor,
	forSeconds: opts.forSeconds,
	route: opts.route,
	runbook: opts.runbook,
});
