import { HeroActorSheet } from './actor-sheet.mjs';
import { HeroDataModel } from './type-data-model.mjs';
import { registerSocketQueries } from './socket-handler.mjs';

const MODULE_ID = 'my-module';

/**
 * Init hook: runs before the world is ready. Register settings, data models,
 * sheets and queries here. game.user is not set yet.
 */
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  CONFIG.debug.myModule = false;

  // Module sub-types are prefixed with the module id: "hero" declared under
  // documentTypes.Actor in module.json is the type "my-module.hero".
  CONFIG.Actor.dataModels[`${MODULE_ID}.hero`] = HeroDataModel;

  HeroActorSheet.registerSheet();
  registerSocketQueries();
  registerSettings();
});

/**
 * Setup hook: every package has run init. Use it for work that depends on
 * other modules.
 */
Hooks.once('setup', () => {
  if (CONFIG.debug.myModule) {
    console.log(`${MODULE_ID} | Debug mode enabled`);
  }
});

/**
 * Ready hook: the world is loaded and game.user is set. Run migrations here.
 */
Hooks.once('ready', async () => {
  console.log(`${MODULE_ID} | Ready`);
  await checkMigration();
});

function registerSettings() {
  game.settings.register(MODULE_ID, 'schemaVersion', {
    name: 'Schema Version',
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
  });

  game.settings.register(MODULE_ID, 'debugMode', {
    name: 'MY_MODULE.settings.debugMode.name',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      CONFIG.debug.myModule = value;
    },
  });
}

const MIGRATIONS = [
  // { version: 1, fn: migrateV1 },
  // { version: 2, fn: migrateV2 },
];

/**
 * Run pending migrations on one GM client. A migration rewrites world data
 * and cannot be undone, so the GM confirms a backup first. Foundry takes a
 * world backup from the Setup screen: right-click the world, Take Backup.
 */
async function checkMigration() {
  if (game.user !== game.users.activeGM) return;
  if (MIGRATIONS.length === 0) return;

  const current = game.settings.get(MODULE_ID, 'schemaVersion');
  const target = MIGRATIONS.at(-1).version;
  if (current >= target) return;

  const backedUp = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'MY_MODULE.migration.title' },
    content: `<p>${game.i18n.localize('MY_MODULE.migration.backup')}</p>`,
    rejectClose: false,
  });
  if (!backedUp) {
    ui.notifications.warn('MY_MODULE.migration.skipped', { localize: true });
    return;
  }

  ui.notifications.info('MY_MODULE.migration.running', { localize: true });
  for (const { version, fn } of MIGRATIONS) {
    if (current < version) {
      await fn();
      // Record each step, so a failure part-way resumes at the failed step.
      await game.settings.set(MODULE_ID, 'schemaVersion', version);
    }
  }
  ui.notifications.info('MY_MODULE.migration.done', { localize: true });
}
