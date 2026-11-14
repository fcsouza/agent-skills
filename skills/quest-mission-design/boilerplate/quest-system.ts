// ============================================================
// Quest System — Types and State Machine
// ============================================================

// ============================================================
// Enums
// ============================================================

// Same list as the quest type table in SKILL.md and the registry Type column.
export const QuestType = {
	MAIN: "main",
	FACTION: "faction",
	SIDE: "side",
	CHAIN: "chain",
	REPEATABLE: "repeatable",
	DISCOVERY: "discovery",
	SOCIAL: "social",
	TIMED: "timed",
	COLLECTION: "collection",
	ESCORT: "escort",
} as const;

export type QuestType = (typeof QuestType)[keyof typeof QuestType];

/** What the player does in one objective. Not the quest type. */
export const ObjectiveType = {
	FETCH: "fetch",
	KILL: "kill",
	ESCORT: "escort",
	EXPLORE: "explore",
	CRAFT: "craft",
	SOCIAL: "social",
	PUZZLE: "puzzle",
	CHOICE: "choice",
} as const;

export type ObjectiveType = (typeof ObjectiveType)[keyof typeof ObjectiveType];

export const QuestState = {
	AVAILABLE: "available",
	ACTIVE: "active",
	COMPLETED: "completed",
	FAILED: "failed",
} as const;

export type QuestState = (typeof QuestState)[keyof typeof QuestState];

// ============================================================
// Objective Tree
// ============================================================

export interface QuestObjective {
	id: string;
	description: string;
	type: ObjectiveType;
	/** Current progress toward the target */
	progress: number;
	/** Target value to complete this objective */
	target: number;
	/** Whether this objective is optional (bonus) */
	optional: boolean;
	/** Child objectives that must be completed first */
	children: QuestObjective[];
	/** Completion logic for children: all must complete, or just one */
	childRequirement: "all" | "any";
}

// ============================================================
// Quest Definition
// ============================================================

export interface QuestReward {
	type: string;
	id: string;
	quantity: number;
}

export interface QuestPrerequisite {
	type:
		| "quest_completed"
		| "level_min"
		| "item_held"
		| "flag_set"
		| "reputation_min";
	value: string | number;
}

export interface QuestDefinition {
	id: string;
	name: string;
	description: string;
	type: QuestType;
	/** Root of the objective tree */
	objectives: QuestObjective;
	prerequisites: QuestPrerequisite[];
	rewards: QuestReward[];
	/** Time limit in seconds, 0 = no limit */
	timeLimit: number;
	/** Whether the quest can be retried after failure */
	retriable: boolean;
}

// ============================================================
// Quest Instance (runtime state)
// ============================================================

export interface QuestInstance {
	questId: string;
	playerId: string;
	state: QuestState;
	objectives: QuestObjective;
	startedAt: number | null;
	completedAt: number | null;
	failedAt: number | null;
}

// ============================================================
// State Machine — Valid Transitions
// ============================================================

type TransitionMap = Record<QuestState, QuestState[]>;

const VALID_TRANSITIONS: TransitionMap = {
	[QuestState.AVAILABLE]: [QuestState.ACTIVE],
	[QuestState.ACTIVE]: [QuestState.COMPLETED, QuestState.FAILED],
	// Only a repeatable quest may leave COMPLETED. See canTransition.
	[QuestState.COMPLETED]: [QuestState.AVAILABLE],
	[QuestState.FAILED]: [QuestState.AVAILABLE],
};

export class QuestStateMachine {
	private instance: QuestInstance;
	private definition: QuestDefinition;

	constructor(instance: QuestInstance, definition: QuestDefinition) {
		this.instance = instance;
		this.definition = definition;
	}

	getState(): QuestState {
		return this.instance.state;
	}

	getInstance(): Readonly<QuestInstance> {
		return this.instance;
	}

	canTransition(to: QuestState): boolean {
		if (!VALID_TRANSITIONS[this.instance.state].includes(to)) {
			return false;
		}
		if (this.instance.state === QuestState.COMPLETED) {
			return this.definition.type === QuestType.REPEATABLE;
		}
		if (this.instance.state === QuestState.FAILED) {
			return this.definition.retriable;
		}
		return true;
	}

	transition(to: QuestState): boolean {
		if (!this.canTransition(to)) {
			return false;
		}

		this.instance.state = to;

		switch (to) {
			case QuestState.ACTIVE:
				this.instance.startedAt = Date.now();
				break;
			case QuestState.COMPLETED:
				this.instance.completedAt = Date.now();
				break;
			case QuestState.FAILED:
				this.instance.failedAt = Date.now();
				break;
			case QuestState.AVAILABLE:
				this.instance.startedAt = null;
				this.instance.completedAt = null;
				this.instance.failedAt = null;
				this.instance.objectives = structuredClone(this.definition.objectives);
				break;
		}

		return true;
	}

	accept(): boolean {
		return this.transition(QuestState.ACTIVE);
	}

	complete(): boolean {
		return this.transition(QuestState.COMPLETED);
	}

	fail(): boolean {
		return this.transition(QuestState.FAILED);
	}

	/** FAILED to AVAILABLE. Needs `retriable`. Resets the objectives. */
	retry(): boolean {
		return this.instance.state === QuestState.FAILED
			? this.transition(QuestState.AVAILABLE)
			: false;
	}

	/** COMPLETED to AVAILABLE. Needs a repeatable quest. Resets the objectives. */
	repeat(): boolean {
		return this.instance.state === QuestState.COMPLETED
			? this.transition(QuestState.AVAILABLE)
			: false;
	}
}

// ============================================================
// Objective Evaluation
// ============================================================

const ratio = (progress: number, target: number): number =>
	target <= 0 ? 1 : Math.min(1, progress / target);

/** Optional children are bonuses. They never block completion. */
export const isObjectiveComplete = (objective: QuestObjective): boolean => {
	const selfDone = objective.progress >= objective.target;
	const required = objective.children.filter((child) => !child.optional);
	if (required.length === 0) {
		return selfDone;
	}

	const childCheck =
		objective.childRequirement === "all"
			? required.every(isObjectiveComplete)
			: required.some(isObjectiveComplete);

	return childCheck && selfDone;
};

/** Progress from 0 to 1. Optional children do not count. */
export const getObjectiveProgress = (objective: QuestObjective): number => {
	const selfProgress = ratio(objective.progress, objective.target);
	const required = objective.children.filter((child) => !child.optional);
	if (required.length === 0) {
		return selfProgress;
	}

	const childAvg =
		required.map(getObjectiveProgress).reduce((a, b) => a + b, 0) /
		required.length;

	return (selfProgress + childAvg) / 2;
};

// ============================================================
// Factory
// ============================================================

export const createQuestInstance = (
	definition: QuestDefinition,
	playerId: string,
): QuestInstance => ({
	questId: definition.id,
	playerId,
	state: QuestState.AVAILABLE,
	objectives: structuredClone(definition.objectives),
	startedAt: null,
	completedAt: null,
	failedAt: null,
});
