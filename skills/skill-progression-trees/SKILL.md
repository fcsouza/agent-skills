---
name: skill-progression-trees
description: >-
  Covers the design and server-side build of game skill trees as prerequisite graphs: node types, cost curves, respec, prestige, and unlock validation in Postgres with Drizzle. Use when a game needs a skill tree, talent tree, ability unlock graph, passive bonus web or prestige layer, or when building its unlock and respec endpoints.
---

# Skill and Progression Trees

## Related skills

- `game-design-fundamentals`: core loop and progression pacing.
- `game-economy-design`: skill point income, costs and currency sinks.
- `postgres-game-schema`: player and wallet tables, and `spendCurrency` for the guarded deduction.
- `redis-game-patterns`: caching each player's unlocked node set.

## Core rules

1. **Model a DAG, not a tree.** A node can have several prerequisites. Cycles break validation, so reject any admin write that creates one.
2. **Validate unlocks on the server.** Never trust a client unlock request. Check prerequisites and currency on the server, and write the deduction and the unlock row in one transaction.
3. **Snapshot the node at unlock time.** Store its prerequisites, cost, effects and tier on the unlock row. After a balance patch you can still audit what the player bought.
4. **Scale cost by tier.** Flat costs make late nodes cheap as income grows. Use `cost = baseCost * tier^exponent` and tune the exponent against player income per tier.
5. **Always offer a respec.** Free with a cooldown, or paid in soft currency.
6. **Store effects as data.** Keep effects in JSONB (`{ "stat": "attack", "modifier": "+10%" }`) and apply them on the server. A balance change then needs a data update, not a deploy.
7. **Reveal nodes progressively.** Show a node once its prerequisites are met, so new players are not faced with the whole tree.

## Procedure

1. **Classify every node:** active (player-triggered ability), passive (always-on bonus), unlock (gate to content or a mechanic), prestige (bonus that survives a reset).
2. **Fill in the design doc.** Copy `templates/skill-tree-template.md` when starting a new tree; it holds the cost table, respec policy, prestige rules and the balance checklist.
3. **Create the tables.** Copy `boilerplate/skill-tree.ts` when building the backend. It defines `skill_nodes` (tree definition, prerequisites as a JSONB array of node IDs) and `player_skills` (one row per unlock, unique on player and node, with the snapshot).
4. **Build the unlock endpoint.** `POST /skills/unlock/:nodeId` calls `unlockNode(db, playerId, nodeId, spend)`, which runs the eligibility check, the deduction and the insert in one transaction. `spend` is required, so the deduction cannot be left out: pass `(tx, playerId, cost) => spendCurrency(tx, playerId, SKILL_CURRENCY, cost)` with the guarded `spendCurrency` from `postgres-game-schema`. It returns false when the player cannot pay, and `unlockNode` rolls back. Add the foreign key from `player_skills.player_id` to your players table with `onDelete: 'cascade'` (the file marks the spot).
5. **Cache the unlocked set.** If tree reads load the database, cache each player's unlocked node IDs and delete the cache entry after an unlock or respec commits.
6. **Build the respec endpoint.** `POST /skills/respec`: charge the fee or check the cooldown, delete the player's `player_skills` rows except prestige nodes (they survive a reset by definition), refund the points spent on the deleted nodes, and invalidate the cache, all in one transaction except the cache delete.
7. **Run the health checks on every admin write.** `detectCycles` returns each prerequisite cycle; `findMissingPrerequisites` returns prerequisites that point at deleted nodes. Reject the write if either is non-empty.

## Endpoints

| Endpoint | Method | Does |
|----------|--------|------|
| `/skills/tree` | GET | Full tree with the player's unlock status per node (`getPlayerTree`) |
| `/skills/unlock/:nodeId` | POST | Validates prerequisites and cost, deducts, inserts, in one transaction |
| `/skills/respec` | POST | Charges the fee, deletes the player's unlocks, refunds points |

## Pitfalls

- **Unlock state on the client.** Trivial to edit and it drifts from the server.
- **Trusting the eligibility check alone under concurrency.** Two parallel requests can both pass it. The unique index on (player, node) rejects a duplicate unlock, and the failed insert rolls back that transaction's deduction. Requests for different nodes are not covered: the `spend` you pass must guard the wallet update itself, as `spendCurrency` in `postgres-game-schema` does with `WHERE amount >= cost` and a check that it updated one row.
- **Chaining `.where()` in Drizzle.** A plain select allows one `.where()`; a second call is a type error, and the builder stores only the last condition. Combine conditions with `and(...)`.
- **A driver without transactions.** Drizzle's `neon-http` driver throws `No transactions support in neon-http driver` from `transaction()`. Use a driver with interactive transactions for `unlockNode` and respec.
- **No respec.** A bad early choice locks the build for good.
- **Flat costs.** Late nodes become trivially cheap as income grows.
- **No cycle check.** One circular prerequisite makes every node in the loop unreachable.
- **Effects in code.** Every balance change needs a deploy.
- **Whole tree visible at once.** Overwhelms new players.

## Files

- `boilerplate/skill-tree.ts`: copy when building the backend. Drizzle tables, `canUnlock`, `unlockNode`, `hasUnlocked`, `getPlayerTree`, `detectCycles`, `findMissingPrerequisites`. The caller passes its own Drizzle database; the file imports no driver.
- `templates/skill-tree-template.md`: copy when designing a new tree.
- `references/sources.md`: read when you need the sources behind this skill.
