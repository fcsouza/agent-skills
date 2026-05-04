/**
 * my-system — entry point.
 *
 * Production pattern: import each subdirectory as a namespace via barrel
 * (_module.mjs) files, expose the system API on `globalThis.mySystem`, and
 * stage initialization across init / i18nInit / setup / ready hooks.
 *
 * See references/production-patterns.md for the full rationale.
 */

import * as dataModels from "./data/_module.mjs";
import * as documents from "./documents/_module.mjs";
import * as sheets from "./sheets/_module.mjs";
import { MY_SYSTEM } from "./config.mjs";
import { registerSystemSettings } from "./settings.mjs";
import { migrateWorld } from "./migration.mjs";

const SYSTEM_ID = "my-system";

// --- Public API surface (read by macros and dependent modules) ---
globalThis.mySystem = {
  config: MY_SYSTEM,
  dataModels,
  documents,
  sheets,
  migrations: { migrateWorld },
};

// --- init: CONFIG mutations, sheet registration, settings ---
Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | init`);

  CONFIG.MY_SYSTEM = MY_SYSTEM;

  // Data Models — preserve other registered keys
  Object.assign(CONFIG.Actor.dataModels, {
    character: dataModels.CharacterData,
    npc: dataModels.NpcData,
  });
  Object.assign(CONFIG.Item.dataModels, {
    weapon: dataModels.WeaponData,
    spell: dataModels.SpellData,
  });

  // Document Classes
  CONFIG.Actor.documentClass = documents.MySystemActor;
  CONFIG.Item.documentClass = documents.MySystemItem;

  // Combat
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 0,
  };

  // v13: legacy effect transferral off — use allApplicableEffects()
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Sheet Registration (v13 namespaced collections)
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);

  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, sheets.CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MY_SYSTEM.SheetLabels.character",
  });

  registerSystemSettings(SYSTEM_ID);

  return preloadHandlebarsTemplates();
});

// --- i18nInit: translate static CONFIG strings before any sheet renders ---
Hooks.once("i18nInit", () => {
  for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities ?? {})) {
    ability.label = game.i18n.localize(ability.label);
  }
  for (const [key, value] of Object.entries(CONFIG.MY_SYSTEM.damageTypes ?? {})) {
    CONFIG.MY_SYSTEM.damageTypes[key] = game.i18n.localize(value);
  }
});

// --- setup: enrichers, macros, packs ---
Hooks.once("setup", () => {
  console.log(`${SYSTEM_ID} | setup`);
  // Custom enrichers, hotbarDrop handlers, etc. go here.
});

// --- ready: migrations, socket listeners, GM-only side effects ---
Hooks.once("ready", async () => {
  console.log(`${SYSTEM_ID} | ready`);
  game.mySystem = globalThis.mySystem;

  if (!game.user.isGM) return;

  const target = game.system.flags?.[SYSTEM_ID]?.needsMigrationVersion;
  const compatible = game.system.flags?.[SYSTEM_ID]?.compatibleMigrationVersion;
  const current = game.settings.get(SYSTEM_ID, "schemaVersion") ?? "0";

  if (compatible && foundry.utils.isNewerVersion(compatible, current)) {
    ui.notifications.error(
      game.i18n.format("MY_SYSTEM.Migration.WorldTooOld", { version: compatible }),
      { permanent: true }
    );
    return;
  }

  if (target && foundry.utils.isNewerVersion(target, current)) {
    ui.notifications.info("MY_SYSTEM.Migration.Started", { localize: true });
    await migrateWorld(current, target);
    await game.settings.set(SYSTEM_ID, "schemaVersion", target);
    ui.notifications.info("MY_SYSTEM.Migration.Complete", { localize: true });
  }
});

async function preloadHandlebarsTemplates() {
  const paths = [
    "systems/my-system/templates/actor/character-sheet.hbs",
  ];
  return foundry.applications.handlebars.loadTemplates(paths);
}
