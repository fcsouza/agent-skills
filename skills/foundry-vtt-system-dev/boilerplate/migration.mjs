/**
 * World migration. Run once per version bump from the ready hook (GM only).
 *
 * The flow:
 *   1. Compare game-stored "schemaVersion" to system.json's needsMigrationVersion.
 *   2. If older than compatibleMigrationVersion → fail with a clear message.
 *   3. Otherwise iterate through MIGRATIONS in order, awaiting each step.
 *
 * Each migration returns a Promise. Inside, use Document.updateDocuments()
 * for batch updates rather than per-document update() calls.
 *
 * Key removal and replacement use the v14 data operators. The old
 * `"-=key": null` and `"==key": value` syntax is deprecated (until v16):
 *   { "system.hp": _del }                  // foundry.data.operators.ForcedDeletion
 *   { "system.health": _replace({...}) }   // foundry.data.operators.ForcedReplacement
 *
 * Per-field data shape fixes belong in TypeDataModel.migrateData (data/*),
 * which must return the migrated data. This file is for world-wide passes.
 */

const MIGRATIONS = [
  { version: "1.0.0", fn: migrateTo_1_0_0 },
];

export async function migrateWorld(currentVersion, targetVersion) {
  for (const { version, fn } of MIGRATIONS) {
    const isNewer = foundry.utils.isNewerVersion(version, currentVersion);
    const isWithinTarget = !foundry.utils.isNewerVersion(version, targetVersion);
    if (!isNewer || !isWithinTarget) continue;
    console.log(`my-system | Running migration to ${version}`);
    try {
      await fn();
    } catch (err) {
      ui.notifications.error(`Migration to ${version} failed: ${err.message}`);
      throw err;
    }
  }
}

async function migrateTo_1_0_0() {
  // Example: fold a flat system.hp into the system.health SchemaField. A plain
  // {"system.health": {...}} update would merge into the stored object; _replace
  // swaps it wholesale. Every key written must exist in the type's schema or
  // cleanData drops it.
  const updates = [];
  for (const actor of game.actors) {
    const source = actor._source.system ?? {};
    if (source.hp === undefined) continue;
    updates.push({
      _id: actor.id,
      "system.health": _replace({ value: source.hp, max: source.hp }),
      "system.hp": _del,
    });
  }
  if (updates.length) {
    await Actor.updateDocuments(updates);
  }
}
