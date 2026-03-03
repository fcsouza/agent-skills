// ============================================================
// Quest System — Types and State Machine
// ============================================================

// ============================================================
// Enums
// ============================================================

export const QuestType = {
	FETCH: "fetch",
	KILL: "kill",
	ESCORT: "escort",
	EXPLORE: "explore",
	CRAFT: "craft",
	SOCIAL: "social",
	PUZZLE: "puzzle",
	CHAIN: "chain",
} as const;

export type QuestType = (typeof QuestType)[keyof typeof QuestType];

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
	type: QuestType;
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

export interface ObjectiveTree {
	root: QuestObjective;
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
	objectives: ObjectiveTree;
	prerequisites: QuestPrerequisite[];
	rewards: QuestReward[];
	/** Time limit in seconds, 0 = no limit */
	timeLimit: number;
	/** Whether the quest can be retried after failure */
	retriable: boolean;
	/** Chains to another quest on completion */
	nextQuestId: string | null;
}

// ============================================================
// Quest Instance (runtime state)
// ============================================================

export interface QuestInstance {
	questId: string;
	playerId: string;
	state: QuestState;
	objectives: ObjectiveTree;
	startedAt: number | null;
	completedAt: number | null;
	failedAt: number | null;
	/** Remaining time in seconds, null if no time limit */
	timeRemaining: number | null;
}

// ============================================================
// State Machine — Valid Transitions
// ============================================================

type TransitionMap = Record<QuestState, QuestState[]>;

const VALID_TRANSITIONS: TransitionMap = {
	[QuestState.AVAILABLE]: [QuestState.ACTIVE],
	[QuestState.ACTIVE]: [QuestState.COMPLETED, QuestState.FAILED],
	[QuestState.COMPLETED]: [],
	[QuestState.FAILED]: [QuestState.AVAILABLE],
};

export class QuestStateMachine {
	private instance: QuestInstance;

	constructor(instance: QuestInstance) {
		this.instance = instance;
	}

	getState(): QuestState {
		return this.instance.state;
	}

	getInstance(): Readonly<QuestInstance> {
		return this.instance;
	}

	canTransition(to: QuestState): boolean {
		return VALID_TRANSITIONS[this.instance.state].includes(to);
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

	retry(): boolean {
		return this.transition(QuestState.AVAILABLE);
	}
}

// ============================================================
// Objective Evaluation
// ============================================================

export const isObjectiveComplete = (objective: QuestObjective): boolean => {
	if (objective.children.length === 0) {
		return objective.progress >= objective.target;
	}

	const childCheck =
		objective.childRequirement === "all"
			? objective.children.every(isObjectiveComplete)
			: objective.children.some(isObjectiveComplete);

	return childCheck && objective.progress >= objective.target;
};

export const isQuestComplete = (tree: ObjectiveTree): boolean => {
	return isObjectiveComplete(tree.root);
};

export const getObjectiveProgress = (objective: QuestObjective): number => {
	if (objective.children.length === 0) {
		return Math.min(1, objective.progress / objective.target);
	}

	const childProgresses = objective.children.map(getObjectiveProgress);
	const childAvg =
		childProgresses.reduce((a, b) => a + b, 0) / childProgresses.length;
	const selfProgress = Math.min(1, objective.progress / objective.target);

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
	timeRemaining: definition.timeLimit > 0 ? definition.timeLimit : null,
});
