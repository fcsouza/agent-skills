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
 */

const MIGRATIONS = [
  { version: "1.0.0", fn: migrateTo_1_0_0 },
];

export async function migrateWorld(currentVersion, targetVersion) {
  for (const { version, fn } of MIGRATIONS) {
    if (foundry.utils.isNewerVersion(version, currentVersion) &&
        !foundry.utils.isNewerVersion(version, targetVersion + ".1")) {
      console.log(`my-system | Running migration to ${version}`);
      try {
        await fn();
      } catch (err) {
        ui.notifications.error(`Migration to ${version} failed: ${err.message}`);
        throw err;
      }
    }
  }
}

async function migrateTo_1_0_0() {
  // Example: rename system.hp → system.health on every Actor.
  const updates = [];
  for (const actor of game.actors) {
    if (actor.system?.hp !== undefined) {
      updates.push({
        _id: actor.id,
        "system.health": actor.system.hp,
        "system.-=hp": null,
      });
    }
  }
  if (updates.length) {
    await Actor.updateDocuments(updates);
  }
}
