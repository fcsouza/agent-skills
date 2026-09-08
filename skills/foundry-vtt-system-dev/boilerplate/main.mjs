/**
 * my-system — entry point (Foundry VTT v14).
 *
 * Production pattern: import each subdirectory as a namespace via barrel
 * (_module.mjs) files, expose the system API on `globalThis.mySystem`, and
 * stage initialization across init / i18nInit / setup / ready hooks.
 *
 * Type declarations: `documentTypes` in system.json plus the TypeDataModel
 * classes in data/ are the source of truth. template.json is deprecated since
 * v14 and removed in v16, so this boilerplate ships without it. Shipping one
 * costs you data: the server resets `documentTypes[Doc][subtype]` for every
 * type the file lists and refills it from template.json's document-level block
 * alone, wiping the per-subtype htmlFields and filePathFields declared in
 * system.json. Keep those declarations in system.json and add no template.json.
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

  // Status effects: v14 indexes CONFIG.statusEffects by id. Assign by key to
  // add or replace one entry; `delete CONFIG.statusEffects.dead` removes one.
  // Assigning a whole array still works but is deprecated since v14.
  CONFIG.statusEffects.exhausted = {
    id: "exhausted",
    name: "MY_SYSTEM.StatusExhausted",
    img: "icons/svg/downgrade.svg",
  };

  // Sheet Registration. Core registers no default Actor or Item sheet in v14,
  // so there is nothing to unregister; register one for every declared type.
  // DocumentSheetConfig keys each entry on `${namespace}.${class.name}`, so a
  // class registers once, listing every type it serves. A sheet shared across
  // types may only read `systemFields` entries common to all of them.
  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, sheets.CharacterSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "MY_SYSTEM.SheetLabels.actor",
  });
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, sheets.ItemSheet, {
    types: ["weapon", "spell"],
    makeDefault: true,
    label: "MY_SYSTEM.SheetLabels.item",
  });

  registerSystemSettings(SYSTEM_ID);

  return preloadHandlebarsTemplates();
});

// --- i18nInit: translate static CONFIG strings before any sheet renders ---
// `_loc` is the v14 global alias for game.i18n.localize.
Hooks.once("i18nInit", () => {
  for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities ?? {})) {
    ability.label = _loc(ability.label);
  }
  for (const [key, value] of Object.entries(CONFIG.MY_SYSTEM.damageTypes ?? {})) {
    CONFIG.MY_SYSTEM.damageTypes[key] = _loc(value);
  }
});

// --- setup: enrichers, macros, packs ---
Hooks.once("setup", () => {
  console.log(`${SYSTEM_ID} | setup`);
});

// --- hotbarDrop: create a roll macro when an owned Item is dropped on the hotbar ---
// Registered from ready, so game.macros and game.user are populated. Hooks.call
// is synchronous: returning a Promise is not `false`, so core would go on to
// build its own sheet-toggle macro and you would get two. Decide synchronously
// from the parsed uuid, then fire the async work off and report failures.
function registerHotbarDrop() {
  Hooks.on("hotbarDrop", (hotbar, data, slot) => {
    if (data.type !== "Item") return true;
    // parseUuid returns null for a missing or relative uuid; a non-empty
    // `embedded` array means the Item is owned by an Actor.
    const parsed = foundry.utils.parseUuid(data.uuid);
    if (!parsed?.embedded.length) return true; // world Item: let core handle it
    createItemMacro(data, slot).catch((err) => {
      ui.notifications.error(`Could not create item macro: ${err.message}`);
      console.error(err);
    });
    return false; // handled
  });
}

async function createItemMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if (!item?.isEmbedded) return;
  const command = `const item = await fromUuid("${item.uuid}");\nif (item) await item.roll();`;
  let macro = game.macros.find((m) => m.name === item.name && m.command === command);
  macro ??= await Macro.create({
    name: item.name,
    type: "script",
    img: item.img,
    command,
    flags: { [SYSTEM_ID]: { itemMacro: true } },
  });
  await game.user.assignHotbarMacro(macro, slot);
}

// --- ready: migrations, socket listeners, GM-only side effects ---
Hooks.once("ready", async () => {
  console.log(`${SYSTEM_ID} | ready`);
  game.mySystem = globalThis.mySystem;

  registerHotbarDrop();

  if (!game.user.isGM) return;

  const target = game.system.flags?.[SYSTEM_ID]?.needsMigrationVersion;
  const compatible = game.system.flags?.[SYSTEM_ID]?.compatibleMigrationVersion;
  const current = game.settings.get(SYSTEM_ID, "schemaVersion") ?? "0";

  // First run: the setting still holds its "0" default, so there is nothing to
  // migrate. Stamp the baseline and return. Without this every new world fails
  // the check below, because isNewerVersion("0.5.0", "0") is true.
  if (!current || current === "0") {
    await game.settings.set(SYSTEM_ID, "schemaVersion", target ?? game.system.version);
    return;
  }

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
    "systems/my-system/templates/item/item-sheet.hbs",
  ];
  return foundry.applications.handlebars.loadTemplates(paths);
}
