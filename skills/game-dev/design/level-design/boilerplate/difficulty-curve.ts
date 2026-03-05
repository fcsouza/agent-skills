// ============================================================
// Difficulty Curve Functions — Genre-Agnostic
// ============================================================

export type CurveType =
	| "linear"
	| "logarithmic"
	| "sigmoid"
	| "step"
	| "exponential";

export interface DifficultyParams {
	/** Base difficulty at level 1 */
	baseDifficulty: number;
	/** Maximum difficulty cap */
	maxDifficulty: number;
	/** Scaling factor (controls steepness) */
	scaleFactor: number;
	/** For step curves: number of steps/tiers */
	stepCount?: number;
}

const DEFAULT_PARAMS: DifficultyParams = {
	baseDifficulty: 1,
	maxDifficulty: 100,
	scaleFactor: 1,
	stepCount: 10,
};

// ============================================================
// Core Curve Functions
// ============================================================

const linearCurve = (level: number, params: DifficultyParams): number => {
	const range = params.maxDifficulty - params.baseDifficulty;
	return params.baseDifficulty + range * (level / 100) * params.scaleFactor;
};

const logarithmicCurve = (level: number, params: DifficultyParams): number => {
	const range = params.maxDifficulty - params.baseDifficulty;
	return (
		params.baseDifficulty +
		(range * Math.log(1 + level * params.scaleFactor)) /
			Math.log(1 + 100 * params.scaleFactor)
	);
};

const sigmoidCurve = (level: number, params: DifficultyParams): number => {
	const range = params.maxDifficulty - params.baseDifficulty;
	const midpoint = 50;
	const steepness = 0.1 * params.scaleFactor;
	const sigmoid = 1 / (1 + Math.exp(-steepness * (level - midpoint)));
	return params.baseDifficulty + range * sigmoid;
};

const stepCurve = (level: number, params: DifficultyParams): number => {
	const steps = params.stepCount ?? 10;
	const range = params.maxDifficulty - params.baseDifficulty;
	const stepSize = 100 / steps;
	const currentStep = Math.floor(level / stepSize);
	const clampedStep = Math.min(currentStep, steps - 1);
	return params.baseDifficulty + range * (clampedStep / (steps - 1));
};

const exponentialCurve = (level: number, params: DifficultyParams): number => {
	const range = params.maxDifficulty - params.baseDifficulty;
	const normalized = level / 100;
	return params.baseDifficulty + range * normalized ** (params.scaleFactor + 1);
};

const CURVE_MAP: Record<
	CurveType,
	(level: number, params: DifficultyParams) => number
> = {
	linear: linearCurve,
	logarithmic: logarithmicCurve,
	sigmoid: sigmoidCurve,
	step: stepCurve,
	exponential: exponentialCurve,
};

// ============================================================
// Public API
// ============================================================

/**
 * Calculate difficulty for a given level using the specified curve type.
 * Level is expected to be in the range [1, 100].
 * Result is clamped between baseDifficulty and maxDifficulty.
 */
export const calculateDifficulty = (
	level: number,
	curve: CurveType,
	params: Partial<DifficultyParams> = {},
): number => {
	const merged = { ...DEFAULT_PARAMS, ...params };
	const clampedLevel = Math.max(1, Math.min(100, level));
	const raw = CURVE_MAP[curve](clampedLevel, merged);
	return Math.max(merged.baseDifficulty, Math.min(merged.maxDifficulty, raw));
};

/**
 * Generate encounter difficulty based on player level vs area level.
 * Returns a multiplier: < 1 = easier, 1 = balanced, > 1 = harder.
 */
export const generateEncounterDifficulty = (
	playerLevel: number,
	areaLevel: number,
	options: {
		levelGapWeight?: number;
		minMultiplier?: number;
		maxMultiplier?: number;
	} = {},
): number => {
	const {
		levelGapWeight = 0.1,
		minMultiplier = 0.5,
		maxMultiplier = 3.0,
	} = options;
	const gap = areaLevel - playerLevel;
	const raw = 1 + gap * levelGapWeight;
	return Math.max(minMultiplier, Math.min(maxMultiplier, raw));
};

/**
 * Generate a full difficulty curve as an array of [level, difficulty] pairs.
 * Useful for visualization and design review.
 */
export const generateDifficultyCurve = (
	curve: CurveType,
	params: Partial<DifficultyParams> = {},
	steps = 100,
): Array<{ level: number; difficulty: number }> => {
	const result: Array<{ level: number; difficulty: number }> = [];
	for (let i = 1; i <= steps; i++) {
		result.push({
			level: i,
			difficulty: calculateDifficulty(i, curve, params),
		});
	}
	return result;
};

/**
 * Blend two curves together using a weight (0 = first curve only, 1 = second curve only).
 */
export const blendCurves = (
	level: number,
	curveA: CurveType,
	curveB: CurveType,
	weight: number,
	params: Partial<DifficultyParams> = {},
): number => {
	const a = calculateDifficulty(level, curveA, params);
	const b = calculateDifficulty(level, curveB, params);
	const clampedWeight = Math.max(0, Math.min(1, weight));
	return a * (1 - clampedWeight) + b * clampedWeight;
};
