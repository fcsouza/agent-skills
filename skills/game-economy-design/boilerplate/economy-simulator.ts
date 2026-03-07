// ============================================================
// Economy Simulator — Sink/Faucet Balance Tracking
// ============================================================

// ============================================================
// Types
// ============================================================

export interface CurrencyFlowEntry {
	timestamp: number;
	currencyId: string;
	amount: number;
	/** Positive = faucet (currency entering), negative = sink (currency leaving) */
	direction: "faucet" | "sink";
	source: string;
	playerId?: string;
}

export interface FlowSummary {
	currencyId: string;
	totalFaucet: number;
	totalSink: number;
	netFlow: number;
	/** Net flow / total faucet — closer to 0 = balanced */
	balanceRatio: number;
	entryCount: number;
}

export interface InflationAlert {
	currencyId: string;
	severity: "low" | "medium" | "high" | "critical";
	inflationRate: number;
	windowMs: number;
	message: string;
}

export interface InflationThresholds {
	low: number;
	medium: number;
	high: number;
	critical: number;
}

// ============================================================
// Flow Tracker
// ============================================================

const flows: CurrencyFlowEntry[] = [];

export const trackFlow = (
	entry: Omit<CurrencyFlowEntry, "timestamp">,
): CurrencyFlowEntry => {
	const record: CurrencyFlowEntry = {
		...entry,
		timestamp: Date.now(),
	};
	flows.push(record);
	return record;
};

export const trackFaucet = (
	currencyId: string,
	amount: number,
	source: string,
	playerId?: string,
): CurrencyFlowEntry => {
	return trackFlow({
		currencyId,
		amount: Math.abs(amount),
		direction: "faucet",
		source,
		playerId,
	});
};

export const trackSink = (
	currencyId: string,
	amount: number,
	source: string,
	playerId?: string,
): CurrencyFlowEntry => {
	return trackFlow({
		currencyId,
		amount: Math.abs(amount),
		direction: "sink",
		source,
		playerId,
	});
};

export const getFlows = (filter?: {
	currencyId?: string;
	since?: number;
	playerId?: string;
}): CurrencyFlowEntry[] => {
	let result = flows;
	if (filter?.currencyId) {
		result = result.filter((f) => f.currencyId === filter.currencyId);
	}
	if (filter?.since) {
		result = result.filter((f) => f.timestamp >= filter.since!);
	}
	if (filter?.playerId) {
		result = result.filter((f) => f.playerId === filter.playerId);
	}
	return result;
};

export const clearFlows = (): void => {
	flows.length = 0;
};

// ============================================================
// Balance Calculator
// ============================================================

export const calculateBalance = (
	currencyId: string,
	windowMs?: number,
): FlowSummary => {
	const since = windowMs ? Date.now() - windowMs : 0;
	const relevant = flows.filter(
		(f) => f.currencyId === currencyId && f.timestamp >= since,
	);

	let totalFaucet = 0;
	let totalSink = 0;

	for (const entry of relevant) {
		if (entry.direction === "faucet") {
			totalFaucet += entry.amount;
		} else {
			totalSink += entry.amount;
		}
	}

	const netFlow = totalFaucet - totalSink;
	const balanceRatio = totalFaucet === 0 ? 0 : netFlow / totalFaucet;

	return {
		currencyId,
		totalFaucet,
		totalSink,
		netFlow,
		balanceRatio,
		entryCount: relevant.length,
	};
};

export const calculateAllBalances = (windowMs?: number): FlowSummary[] => {
	const currencyIds = new Set(flows.map((f) => f.currencyId));
	return Array.from(currencyIds).map((id) => calculateBalance(id, windowMs));
};

// ============================================================
// Inflation Monitor
// ============================================================

const DEFAULT_THRESHOLDS: InflationThresholds = {
	low: 0.05,
	medium: 0.15,
	high: 0.3,
	critical: 0.5,
};

export const detectInflation = (
	currencyId: string,
	windowMs: number,
	thresholds: InflationThresholds = DEFAULT_THRESHOLDS,
): InflationAlert | null => {
	const balance = calculateBalance(currencyId, windowMs);

	if (balance.entryCount === 0 || balance.balanceRatio <= 0) {
		return null;
	}

	const rate = balance.balanceRatio;

	let severity: InflationAlert["severity"];
	if (rate >= thresholds.critical) {
		severity = "critical";
	} else if (rate >= thresholds.high) {
		severity = "high";
	} else if (rate >= thresholds.medium) {
		severity = "medium";
	} else if (rate >= thresholds.low) {
		severity = "low";
	} else {
		return null;
	}

	return {
		currencyId,
		severity,
		inflationRate: rate,
		windowMs,
		message: `${currencyId}: ${(rate * 100).toFixed(1)}% net inflow over ${windowMs / 1000}s window (${severity})`,
	};
};

export const detectAllInflation = (
	windowMs: number,
	thresholds?: InflationThresholds,
): InflationAlert[] => {
	const currencyIds = new Set(flows.map((f) => f.currencyId));
	const alerts: InflationAlert[] = [];
	for (const id of currencyIds) {
		const alert = detectInflation(id, windowMs, thresholds);
		if (alert) {
			alerts.push(alert);
		}
	}
	return alerts;
};

// ============================================================
// Per-Player Balance
// ============================================================

export const calculatePlayerBalance = (
	playerId: string,
	currencyId: string,
	windowMs?: number,
): FlowSummary => {
	const since = windowMs ? Date.now() - windowMs : 0;
	const relevant = flows.filter(
		(f) =>
			f.playerId === playerId &&
			f.currencyId === currencyId &&
			f.timestamp >= since,
	);

	let totalFaucet = 0;
	let totalSink = 0;

	for (const entry of relevant) {
		if (entry.direction === "faucet") {
			totalFaucet += entry.amount;
		} else {
			totalSink += entry.amount;
		}
	}

	const netFlow = totalFaucet - totalSink;
	const balanceRatio = totalFaucet === 0 ? 0 : netFlow / totalFaucet;

	return {
		currencyId,
		totalFaucet,
		totalSink,
		netFlow,
		balanceRatio,
		entryCount: relevant.length,
	};
};

// ============================================================
// Top Sources — identify biggest faucets/sinks
// ============================================================

export const getTopSources = (
	currencyId: string,
	direction: "faucet" | "sink",
	limit = 10,
	windowMs?: number,
): Array<{ source: string; total: number; count: number }> => {
	const since = windowMs ? Date.now() - windowMs : 0;
	const relevant = flows.filter(
		(f) =>
			f.currencyId === currencyId &&
			f.direction === direction &&
			f.timestamp >= since,
	);

	const bySource = new Map<string, { total: number; count: number }>();
	for (const entry of relevant) {
		const existing = bySource.get(entry.source) ?? { total: 0, count: 0 };
		existing.total += entry.amount;
		existing.count++;
		bySource.set(entry.source, existing);
	}

	return Array.from(bySource.entries())
		.map(([source, data]) => ({ source, ...data }))
		.sort((a, b) => b.total - a.total)
		.slice(0, limit);
};
