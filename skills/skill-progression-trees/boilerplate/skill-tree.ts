// Verified against: drizzle-orm 0.45.4 (2026-11-14)
import { and, eq, type TablesRelationalConfig } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  type PgDatabase,
  type PgQueryResultHKT,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// The caller passes its own Drizzle database (any Postgres driver, with or
// without a relational schema) or a transaction. PgTransaction extends
// PgDatabase, so both fit. The functions stay generic over the schema because
// a database built with `{ schema }` is not assignable to the schema-less type.
export type Db<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> = PgDatabase<PgQueryResultHKT, TFullSchema, TSchema>;

// ─── Types ──────────────────────────────────────────────────────────────────

export type SkillEffect = {
  stat: string;
  modifier: string; // e.g. "+10%", "+5", "*1.2"
};

export type UnlockResult = {
  canUnlock: boolean;
  reason?: string;
};

// Currency type for skill points in your wallet table (see the commented
// currency code below).
export const SKILL_CURRENCY = 'skill_points';

// ─── Skill Nodes (Tree Definition) ──────────────────────────────────────────

export const skillNodes = pgTable(
  'skill_nodes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    // 'active' | 'passive' | 'unlock' | 'prestige'
    category: text('category').notNull(),
    tier: integer('tier').notNull().default(1),
    prerequisites: jsonb('prerequisites')
      .$type<string[]>()
      .notNull()
      .default([]),
    cost: integer('cost').notNull().default(1),
    effects: jsonb('effects').$type<SkillEffect[]>().notNull().default([]),
    isVisible: boolean('is_visible').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('skill_nodes_category_idx').on(table.category),
    index('skill_nodes_tier_idx').on(table.tier),
  ],
);

// ─── Player Skills (Unlock State) ───────────────────────────────────────────

export const playerSkills = pgTable(
  'player_skills',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    playerId: text('player_id').notNull(),
    nodeId: text('node_id')
      .notNull()
      .references(() => skillNodes.id),
    unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    uniqueIndex('player_skills_player_node_idx').on(
      table.playerId,
      table.nodeId,
    ),
    index('player_skills_player_id_idx').on(table.playerId),
  ],
);

// ─── Check Unlock Eligibility ───────────────────────────────────────────────

export async function canUnlock<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: Db<TFullSchema, TSchema>,
  playerId: string,
  nodeId: string,
): Promise<UnlockResult> {
  const [node] = await db
    .select()
    .from(skillNodes)
    .where(eq(skillNodes.id, nodeId));

  if (!node) {
    return { canUnlock: false, reason: 'Node does not exist' };
  }

  const unlocked = await db
    .select({ nodeId: playerSkills.nodeId })
    .from(playerSkills)
    .where(eq(playerSkills.playerId, playerId));
  const unlockedIds = new Set(unlocked.map((row) => row.nodeId));

  if (unlockedIds.has(nodeId)) {
    return { canUnlock: false, reason: 'Node already unlocked' };
  }

  const missing = node.prerequisites.filter((id) => !unlockedIds.has(id));
  if (missing.length > 0) {
    return {
      canUnlock: false,
      reason: `Missing prerequisites: ${missing.join(', ')}`,
    };
  }

  // Check skill points. Replace `currencies` with your wallet table.
  // const [wallet] = await db
  //   .select()
  //   .from(currencies)
  //   .where(
  //     and(
  //       eq(currencies.playerId, playerId),
  //       eq(currencies.currencyType, SKILL_CURRENCY),
  //     ),
  //   );
  //
  // if (!wallet || wallet.amount < node.cost) {
  //   return {
  //     canUnlock: false,
  //     reason: `Not enough skill points (need ${node.cost})`,
  //   };
  // }

  return { canUnlock: true };
}

// ─── Unlock a Node ──────────────────────────────────────────────────────────

export async function unlockNode<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: Db<TFullSchema, TSchema>,
  playerId: string,
  nodeId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // The unique index on (player_id, node_id) rejects a duplicate unlock, and
    // the failed insert rolls back this transaction's deduction. Parallel
    // unlocks of different nodes can both pass this check: guard the wallet
    // update itself (see the deduction below).
    const result = await canUnlock(tx, playerId, nodeId);
    if (!result.canUnlock) {
      throw new Error(`Cannot unlock node: ${result.reason}`);
    }

    const [node] = await tx
      .select()
      .from(skillNodes)
      .where(eq(skillNodes.id, nodeId));
    if (!node) {
      throw new Error('Cannot unlock node: Node does not exist');
    }

    // Deduct skill points. Replace `currencies` with your wallet table. The
    // `amount >= cost` condition stops an overdraft when unlocks run in
    // parallel; throw if `.returning()` comes back empty.
    // const spent = await tx
    //   .update(currencies)
    //   .set({ amount: sql`${currencies.amount} - ${node.cost}` })
    //   .where(
    //     and(
    //       eq(currencies.playerId, playerId),
    //       eq(currencies.currencyType, SKILL_CURRENCY),
    //       gte(currencies.amount, node.cost),
    //     ),
    //   )
    //   .returning({ id: currencies.id });
    // if (spent.length === 0) {
    //   throw new Error('Cannot unlock node: Not enough skill points');
    // }

    // Store the node as it was at unlock time, for audit after a balance patch.
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

  // Invalidate the player's cached unlock set here, after the commit.
}

// ─── Check One Unlock Row ───────────────────────────────────────────────────

export async function hasUnlocked<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: Db<TFullSchema, TSchema>,
  playerId: string,
  nodeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: playerSkills.id })
    .from(playerSkills)
    .where(
      and(eq(playerSkills.playerId, playerId), eq(playerSkills.nodeId, nodeId)),
    );
  return row !== undefined;
}

// ─── Get Player Tree ────────────────────────────────────────────────────────

export async function getPlayerTree<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: Db<TFullSchema, TSchema>, playerId: string) {
  const allNodes = await db.select().from(skillNodes);
  const unlocked = await db
    .select({ nodeId: playerSkills.nodeId })
    .from(playerSkills)
    .where(eq(playerSkills.playerId, playerId));

  const unlockedIds = new Set(unlocked.map((row) => row.nodeId));

  return allNodes.map((node) => ({
    ...node,
    unlocked: unlockedIds.has(node.id),
  }));
}

// ─── Tree Health Checks (Admin Utilities) ───────────────────────────────────

type GraphNode = { id: string; prerequisites: string[] };

// Returns every cycle found in the prerequisite graph. Run before saving an
// admin edit; reject the edit if the result is not empty.
export function detectCycles(nodes: GraphNode[]): string[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const done = new Set<string>();
  const onPath = new Set<string>();
  const cycles: string[][] = [];

  function visit(nodeId: string, path: string[]): void {
    onPath.add(nodeId);
    for (const prereq of nodeMap.get(nodeId)?.prerequisites ?? []) {
      if (onPath.has(prereq)) {
        cycles.push([...path.slice(path.indexOf(prereq)), prereq]);
      } else if (!done.has(prereq) && nodeMap.has(prereq)) {
        visit(prereq, [...path, prereq]);
      }
    }
    onPath.delete(nodeId);
    done.add(nodeId);
  }

  for (const node of nodes) {
    if (!done.has(node.id)) {
      visit(node.id, [node.id]);
    }
  }
  return cycles;
}

// Returns prerequisite IDs that point at nodes that no longer exist.
export function findMissingPrerequisites(
  nodes: GraphNode[],
): { nodeId: string; missing: string[] }[] {
  const ids = new Set(nodes.map((n) => n.id));
  return nodes
    .map((n) => ({
      nodeId: n.id,
      missing: n.prerequisites.filter((p) => !ids.has(p)),
    }))
    .filter((r) => r.missing.length > 0);
}
