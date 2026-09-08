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
 * Key removal and replacement use the v14 data operators, exposed as the
 * globals `_del` and `_replace`. The old `"-=key": null` and `"==key": value`
 * syntax is deprecated (until v16):
 *   { "system.stale": _del }               // foundry.data.operators.ForcedDeletion
 *   { "system.health": _replace({...}) }   // foundry.data.operators.ForcedReplacement
 *
 * What a world pass can and cannot see: `_initializeSource` prunes keys absent
 * from the schema, so by the time you read `actor._source.system` a legacy key
 * that no field declares is already gone. Raw legacy keys are visible only in
 * TypeDataModel.migrateData (data/*), which runs before cleaning. That runs in
 * memory on every load; a world pass is what writes the fixed shape back to
 * the database so the rename or backfill stops being recomputed forever.
 * So: rename and reshape in migrateData, persist here.
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
  // Persist the school normalization that SpellData.migrateData applies in
  // memory (data/spell-data.mjs). Note there is nothing to detect here: cleanData
  // fills every missing schema key from its `initial` before _source is readable,
  // and migrateData has already rewritten legacy values, so a `_source.x ===
  // undefined` test can never be true for a key the schema declares. A world
  // pass writes the already-corrected value back so it stops being recomputed
  // on every load; write unconditionally and read from the live model.
  const updates = [];
  for (const item of game.items) {
    if (item.type !== "spell") continue;
    updates.push({ _id: item.id, "system.school": item.system.school });
  }
  if (updates.length) {
    await Item.updateDocuments(updates);
  }
}
