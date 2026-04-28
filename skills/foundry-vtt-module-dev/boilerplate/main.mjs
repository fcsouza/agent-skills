import { HeroDataModel } from './type-data-model.mjs';
import { HeroActorSheet } from './actor-sheet.mjs';
import { initSocketListeners } from './socket-handler.mjs';

const MODULE_ID = 'my-module';

/**
 * Init hook — runs before the world is ready. Use for:
 * - Registering settings
 * - Registering document classes and sheets
 * - Registering custom data models
 */
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  CONFIG.debug.myModule = false;

  // Register custom data model for the "hero" Actor type
  CONFIG.Actor.dataModels.hero = HeroDataModel;

  // Register the custom sheet
  HeroActorSheet.registerSheet();

  registerSettings();
});

/**
 * Setup hook — runs after init, before ready. Foundry systems and modules are all
 * initialized. Use for anything that depends on other modules being present.
 */
Hooks.once('setup', () => {
  console.log(`${MODULE_ID} | Setup complete`);

  if (CONFIG.debug.myModule) {
    console.log(`${MODULE_ID} | Debug mode enabled`);
  }
});

/**
 * Ready hook — the world is fully loaded and the current user is authenticated.
 * Use for: migration checks, socket listeners, initial data population.
 */
Hooks.once('ready', async () => {
  console.log(`${MODULE_ID} | Ready`);

  await checkMigration();

  if (game.settings.get(MODULE_ID, 'enableSocket')) {
    initSocketListeners();
  }
});

function registerSettings() {
  game.settings.register(MODULE_ID, 'schemaVersion', {
    name: 'Schema Version',
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
  });

  game.settings.register(MODULE_ID, 'enableSocket', {
    name: `${MODULE_ID}.settings.enableSocket.name`,
    hint: `${MODULE_ID}.settings.enableSocket.hint`,
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  game.settings.register(MODULE_ID, 'debugMode', {
    name: `${MODULE_ID}.settings.debugMode.name`,
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

async function checkMigration() {
  if (!game.user.isGM) return;
  if (MIGRATIONS.length === 0) return;

  const current = game.settings.get(MODULE_ID, 'schemaVersion');
  const target = MIGRATIONS[MIGRATIONS.length - 1].version;
  if (current >= target) return;

  ui.notifications.warn(`${MODULE_ID} | Running data migration...`);
  for (const { version, fn } of MIGRATIONS) {
    if (current < version) await fn();
  }
  await game.settings.set(MODULE_ID, 'schemaVersion', target);
  ui.notifications.info(`${MODULE_ID} | Migration complete.`);
}
