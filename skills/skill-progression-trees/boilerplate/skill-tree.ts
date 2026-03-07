import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { eq, inArray } from "drizzle-orm";

// TODO: import db from your drizzle connection
// TODO: import { players, currencies } from your schema
// TODO: import Redis client for cache invalidation

// ─── Types ──────────────────────────────────────────────────────────────────

type SkillEffect = {
	stat: string;
	modifier: string; // e.g. "+10%", "+5", "*1.2"
};

type UnlockResult = {
	canUnlock: boolean;
	reason?: string;
};

// ─── Enums ──────────────────────────────────────────────────────────────────

const SKILL_CURRENCY = "skill_points";

// ─── Skill Nodes (Tree Definition) ──────────────────────────────────────────

export const skillNodes = pgTable(
	"skill_nodes",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		description: text("description"),
		category: text("category").notNull(), // 'active' | 'passive' | 'unlock' | 'prestige'
		tier: integer("tier").notNull().default(1),
		prerequisites: jsonb("prerequisites").$type<string[]>().default([]),
		cost: integer("cost").notNull().default(1),
		effects: jsonb("effects").$type<SkillEffect[]>().default([]),
		isVisible: boolean("is_visible").notNull().default(true),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("skill_nodes_category_idx").on(table.category),
		index("skill_nodes_tier_idx").on(table.tier),
	],
);

// ─── Player Skills (Unlock State) ───────────────────────────────────────────

export const playerSkills = pgTable(
	"player_skills",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: text("player_id").notNull(),
		nodeId: text("node_id")
			.notNull()
			.references(() => skillNodes.id),
		unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
		snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default({}),
	},
	(table) => [
		uniqueIndex("player_skills_player_node_idx").on(
			table.playerId,
			table.nodeId,
		),
		index("player_skills_player_id_idx").on(table.playerId),
	],
);

// ─── Check Unlock Eligibility ───────────────────────────────────────────────

export async function canUnlock(
	db: Parameters<typeof db.select>[0] extends never ? never : typeof db,
	playerId: string,
	nodeId: string,
): Promise<UnlockResult> {
	// Fetch the target node
	const [node] = await db
		.select()
		.from(skillNodes)
		.where(eq(skillNodes.id, nodeId));

	if (!node) {
		return { canUnlock: false, reason: "Node does not exist" };
	}

	// Check if already unlocked
	const [existing] = await db
		.select()
		.from(playerSkills)
		.where(eq(playerSkills.playerId, playerId))
		.where(eq(playerSkills.nodeId, nodeId));

	if (existing) {
		return { canUnlock: false, reason: "Node already unlocked" };
	}

	// Check prerequisites
	if (node.prerequisites && node.prerequisites.length > 0) {
		const unlockedNodes = await db
			.select({ nodeId: playerSkills.nodeId })
			.from(playerSkills)
			.where(eq(playerSkills.playerId, playerId));

		const unlockedIds = new Set(unlockedNodes.map((n) => n.nodeId));
		const missingPrereqs = node.prerequisites.filter(
			(prereq) => !unlockedIds.has(prereq),
		);

		if (missingPrereqs.length > 0) {
			return {
				canUnlock: false,
				reason: `Missing prerequisites: ${missingPrereqs.join(", ")}`,
			};
		}
	}

	// Check currency (skill points)
	// TODO: Replace with your currency table reference
	// const [wallet] = await db
	//   .select()
	//   .from(currencies)
	//   .where(eq(currencies.playerId, playerId))
	//   .where(eq(currencies.currencyType, SKILL_CURRENCY));
	//
	// if (!wallet || wallet.amount < node.cost) {
	//   return { canUnlock: false, reason: `Not enough skill points (need ${node.cost})` };
	// }

	return { canUnlock: true };
}

// ─── Unlock a Node ──────────────────────────────────────────────────────────

export async function unlockNode(
	db: Parameters<typeof db.transaction>[0] extends never ? never : typeof db,
	playerId: string,
	nodeId: string,
): Promise<void> {
	const result = await canUnlock(db, playerId, nodeId);
	if (!result.canUnlock) {
		throw new Error(`Cannot unlock node: ${result.reason}`);
	}

	const [node] = await db
		.select()
		.from(skillNodes)
		.where(eq(skillNodes.id, nodeId));

	await db.transaction(async (tx) => {
		// Deduct skill points
		// TODO: Replace with your currency table reference
		// await tx
		//   .update(currencies)
		//   .set({ amount: sql`amount - ${node.cost}` })
		//   .where(eq(currencies.playerId, playerId))
		//   .where(eq(currencies.currencyType, SKILL_CURRENCY));

		// Insert player skill with prerequisite snapshot
		await tx.insert(playerSkills).values({
			playerId,
			nodeId,
			snapshot: {
				prerequisites: node.prerequisites,
				cost: node.cost,
				effects: node.effects,
				tier: node.tier,
			},
		});
	});

	// TODO: Invalidate Redis cache
	// await redis.del(`player:${playerId}:skills`);
}

// ─── Get Player Tree ────────────────────────────────────────────────────────

export async function getPlayerTree(
	db: Parameters<typeof db.select>[0] extends never ? never : typeof db,
	playerId: string,
) {
	const allNodes = await db.select().from(skillNodes);
	const unlockedNodes = await db
		.select({ nodeId: playerSkills.nodeId })
		.from(playerSkills)
		.where(eq(playerSkills.playerId, playerId));

	const unlockedIds = new Set(unlockedNodes.map((n) => n.nodeId));

	return allNodes.map((node) => ({
		...node,
		unlocked: unlockedIds.has(node.id),
	}));
}

// ─── Cycle Detection (Admin Utility) ────────────────────────────────────────

export function detectCycles(
	nodes: { id: string; prerequisites: string[] }[],
): string[][] {
	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const cycles: string[][] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	function dfs(nodeId: string, path: string[]): boolean {
		visited.add(nodeId);
		recursionStack.add(nodeId);

		const node = nodeMap.get(nodeId);
		if (!node) return false;

		for (const prereq of node.prerequisites) {
			if (!visited.has(prereq)) {
				if (dfs(prereq, [...path, prereq])) return true;
			} else if (recursionStack.has(prereq)) {
				const cycleStart = path.indexOf(prereq);
				cycles.push(path.slice(cycleStart));
				return true;
			}
		}

		recursionStack.delete(nodeId);
		return false;
	}

	for (const node of nodes) {
		if (!visited.has(node.id)) {
			dfs(node.id, [node.id]);
		}
	}

	return cycles;
}
