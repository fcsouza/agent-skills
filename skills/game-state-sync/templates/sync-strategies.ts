// ============================================================
// Sync Strategy Configuration Templates
// ============================================================

// ============================================================
// Interpolation — smooth rendering between server snapshots
// ============================================================

export interface InterpolationConfig {
	/** Number of ticks to delay rendering behind the latest server state */
	delayTicks: number;
	/** Maximum interpolation time window in ms before snapping */
	maxInterpolationMs: number;
	/** Snap to target if distance exceeds this threshold (game units) */
	snapThreshold: number;
	/** Easing function type for position interpolation */
	easing: "linear" | "cubic" | "hermite";
	/** Whether to interpolate rotation values via shortest arc */
	shortestArcRotation: boolean;
}

export const DEFAULT_INTERPOLATION: InterpolationConfig = {
	delayTicks: 2,
	maxInterpolationMs: 200,
	snapThreshold: 10,
	easing: "linear",
	shortestArcRotation: true,
};

// ============================================================
// Prediction — client-side input prediction
// ============================================================

export interface PredictionConfig {
	/** Enable client-side prediction */
	enabled: boolean;
	/** Maximum number of unacknowledged inputs before throttling */
	maxPendingInputs: number;
	/** Whether to predict other players' movement (extrapolation) */
	extrapolateRemotePlayers: boolean;
	/** Maximum extrapolation time in ms */
	maxExtrapolationMs: number;
	/** Correction blending speed (0-1): 1 = instant snap, 0.1 = smooth blend */
	correctionBlendRate: number;
	/** Threshold below which corrections are ignored (game units) */
	correctionDeadzone: number;
}

export const DEFAULT_PREDICTION: PredictionConfig = {
	enabled: true,
	maxPendingInputs: 30,
	extrapolateRemotePlayers: true,
	maxExtrapolationMs: 250,
	correctionBlendRate: 0.3,
	correctionDeadzone: 0.01,
};

// ============================================================
// Rollback — rewind and replay for mispredictions
// ============================================================

export interface RollbackConfig {
	/** Enable rollback and replay */
	enabled: boolean;
	/** Number of snapshots to keep in the history buffer */
	bufferSize: number;
	/** Maximum ticks to roll back before giving up and snapping */
	maxRollbackTicks: number;
	/** Whether to store snapshots on every tick or at intervals */
	snapshotInterval: number;
	/** Checksum verification for state integrity */
	checksumEnabled: boolean;
	/** Maximum number of rollbacks per second before degrading to snap */
	rollbackBudgetPerSecond: number;
}

export const DEFAULT_ROLLBACK: RollbackConfig = {
	enabled: true,
	bufferSize: 128,
	maxRollbackTicks: 10,
	snapshotInterval: 1,
	checksumEnabled: false,
	rollbackBudgetPerSecond: 5,
};

// ============================================================
// Bandwidth Budget — limits for network traffic
// ============================================================

export interface BandwidthBudgetConfig {
	/** Target bytes per second per player (downstream) */
	targetBytesPerSecondDown: number;
	/** Target bytes per second per player (upstream) */
	targetBytesPerSecondUp: number;
	/** Maximum packet size in bytes */
	maxPacketSize: number;
	/** Enable delta compression */
	deltaCompression: boolean;
	/** Minimum change threshold before including a field in a delta */
	deltaThreshold: number;
	/** Priority levels for state fields: higher priority fields are always sent */
	priorityLevels: number;
	/** Rate at which low-priority updates are sent (every N ticks) */
	lowPriorityTickInterval: number;
}

export const DEFAULT_BANDWIDTH_BUDGET: BandwidthBudgetConfig = {
	targetBytesPerSecondDown: 10_000,
	targetBytesPerSecondUp: 2_000,
	maxPacketSize: 1_200,
	deltaCompression: true,
	deltaThreshold: 0.001,
	priorityLevels: 3,
	lowPriorityTickInterval: 5,
};

// ============================================================
// Combined Strategy Config
// ============================================================

export interface SyncStrategyConfig {
	/** Server tick rate (ticks per second) */
	tickRate: number;
	/** How often to send full snapshots (every N ticks), 0 = delta only */
	fullSnapshotInterval: number;
	interpolation: InterpolationConfig;
	prediction: PredictionConfig;
	rollback: RollbackConfig;
	bandwidth: BandwidthBudgetConfig;
}

export const DEFAULT_SYNC_STRATEGY: SyncStrategyConfig = {
	tickRate: 20,
	fullSnapshotInterval: 60,
	interpolation: DEFAULT_INTERPOLATION,
	prediction: DEFAULT_PREDICTION,
	rollback: DEFAULT_ROLLBACK,
	bandwidth: DEFAULT_BANDWIDTH_BUDGET,
};

// ============================================================
// Presets — common strategy combinations
// ============================================================

/** Fast-paced action: high tick rate, aggressive prediction */
export const ACTION_PRESET: SyncStrategyConfig = {
	tickRate: 60,
	fullSnapshotInterval: 120,
	interpolation: { ...DEFAULT_INTERPOLATION, delayTicks: 1, easing: "hermite" },
	prediction: {
		...DEFAULT_PREDICTION,
		maxPendingInputs: 60,
		correctionBlendRate: 0.5,
	},
	rollback: { ...DEFAULT_ROLLBACK, bufferSize: 256, maxRollbackTicks: 15 },
	bandwidth: { ...DEFAULT_BANDWIDTH_BUDGET, targetBytesPerSecondDown: 20_000 },
};

/** Turn-based or slow-paced: low tick rate, no prediction needed */
export const TURN_BASED_PRESET: SyncStrategyConfig = {
	tickRate: 4,
	fullSnapshotInterval: 20,
	interpolation: {
		...DEFAULT_INTERPOLATION,
		delayTicks: 0,
		maxInterpolationMs: 500,
	},
	prediction: {
		...DEFAULT_PREDICTION,
		enabled: false,
		extrapolateRemotePlayers: false,
	},
	rollback: { ...DEFAULT_ROLLBACK, enabled: false },
	bandwidth: { ...DEFAULT_BANDWIDTH_BUDGET, targetBytesPerSecondDown: 2_000 },
};

/** MMO / large-world: bandwidth-conscious, area-of-interest filtering */
export const MMO_PRESET: SyncStrategyConfig = {
	tickRate: 10,
	fullSnapshotInterval: 100,
	interpolation: { ...DEFAULT_INTERPOLATION, delayTicks: 3, easing: "cubic" },
	prediction: {
		...DEFAULT_PREDICTION,
		maxExtrapolationMs: 500,
		correctionBlendRate: 0.15,
	},
	rollback: { ...DEFAULT_ROLLBACK, bufferSize: 64, maxRollbackTicks: 5 },
	bandwidth: {
		...DEFAULT_BANDWIDTH_BUDGET,
		targetBytesPerSecondDown: 5_000,
		priorityLevels: 5,
		lowPriorityTickInterval: 10,
	},
};
