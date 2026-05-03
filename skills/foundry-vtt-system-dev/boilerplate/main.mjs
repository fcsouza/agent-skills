import { CharacterData } from "./data/character-data.mjs";
import { NpcData } from "./data/npc-data.mjs";
import { WeaponData } from "./data/weapon-data.mjs";
import { SpellData } from "./data/spell-data.mjs";
import { MySystemActor } from "./actor.mjs";
import { MySystemItem } from "./item.mjs";
import { CharacterSheet } from "./sheets/character-sheet.mjs";

// --- Constants ---
const SYSTEM_ID = "my-system";

// --- Initialization Hook ---
Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing system`);

  // --- Data Models (use Object.assign to preserve static properties) ---
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData,
  });

  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    spell: SpellData,
  });

  // --- Document Classes ---
  CONFIG.Actor.documentClass = MySystemActor;
  CONFIG.Item.documentClass = MySystemItem;

  // --- Combat ---
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 0,
  };

  // --- Active Effects ---
  CONFIG.ActiveEffect.legacyTransferral = false;

  // --- Unregister Core Sheets ---
  Actors.unregisterSheet("core", ActorSheet);
  Items.unregisterSheet("core", ItemSheet);

  // --- Register System Sheets ---
  Actors.registerSheet(SYSTEM_ID, CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MY_SYSTEM.SheetLabels.character",
  });

  // --- Register Settings ---
  game.settings.register(SYSTEM_ID, "systemSchemaVersion", {
    name: "System Schema Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });

  // --- Preload Handlebars Templates ---
  return preloadHandlebarsTemplates();
});

// --- Ready Hook ---
Hooks.once("ready", () => {
  // --- Migration Check ---
  const currentVersion = game.settings.get(SYSTEM_ID, "systemSchemaVersion");
  if (currentVersion < 1) {
    ui.notifications.info("MY_SYSTEM.Migration.Started", { localize: true });
    // Run migrations here
    game.settings.set(SYSTEM_ID, "systemSchemaVersion", 1);
  }
});

// --- Handlebars Preloading ---
async function preloadHandlebarsTemplates() {
  const paths = [
    "systems/my-system/templates/actor/character-sheet.hbs",
  ];
  return loadTemplates(paths);
}
