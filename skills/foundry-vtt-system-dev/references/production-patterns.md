# Production System Patterns

Patterns extracted from the official **D&D 5e** system source (`foundryvtt/dnd5e`) — the largest, most-maintained, most-played Foundry system. These are the architectural and tooling decisions every shipping system makes that beginner tutorials skip.

Use this as a checklist when scaffolding a new system or refactoring one for long-term maintenance.

---

## 1. Single ESM Entry + Barrel Files

A production system has **one** entry file declared in `system.json` (e.g. `my-system.mjs` at repo root). That file imports namespace bundles from each subdirectory via barrel files (`_module.mjs`):

```
my-system/
├── my-system.mjs            ← single entry
├── system.json
├── module/
│   ├── applications/
│   │   ├── _module.mjs      ← re-exports every Application class
│   │   ├── actor-sheet.mjs
│   │   └── item-sheet.mjs
│   ├── canvas/
│   │   ├── _module.mjs
│   │   └── token.mjs
│   ├── data/
│   │   ├── _module.mjs
│   │   ├── character-data.mjs
│   │   ├── npc-data.mjs
│   │   └── weapon-data.mjs
│   ├── dice/
│   │   ├── _module.mjs
│   │   ├── d20-roll.mjs
│   │   └── damage-roll.mjs
│   ├── documents/
│   │   ├── _module.mjs
│   │   ├── actor.mjs
│   │   ├── item.mjs
│   │   └── combat.mjs
│   ├── config.mjs           ← system constants
│   ├── settings.mjs         ← game.settings.register calls
│   └── migration.mjs        ← world migration logic
├── templates/
├── lang/
├── packs/                   ← compiled LevelDB
├── json/                    ← source JSON for packs
└── styles/
```

A barrel file is just a re-export:

```javascript
// module/data/_module.mjs
export { CharacterData } from "./character-data.mjs";
export { NpcData } from "./npc-data.mjs";
export { WeaponData } from "./weapon-data.mjs";
export { SpellData } from "./spell-data.mjs";
```

The entry imports namespaces, not individual classes:

```javascript
// my-system.mjs
import * as applications from "./module/applications/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as dataModels from "./module/data/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import { MY_SYSTEM } from "./module/config.mjs";
import { registerSystemSettings } from "./module/settings.mjs";
import { migrateWorld } from "./module/migration.mjs";
```

Why this pattern wins:
- One import per directory in the entry — readable
- Each subdirectory's public API is documented in its `_module.mjs`
- Adding a new class is a one-line change in one barrel file
- Tree-shakers (Rollup, Vite) prune unused exports automatically

---

## 2. `globalThis.<systemId>` Namespace Contract

Expose your entire system API on a single global so modules and macros can interact with it:

```javascript
// my-system.mjs (top-level, before hooks)
globalThis.mySystem = {
  applications,
  canvas,
  config: MY_SYSTEM,
  dataModels,
  dice,
  documents,
  migrations: { migrateWorld },
};

Hooks.once("init", () => {
  // Mirror onto game.system once Foundry is ready
  game.mySystem = globalThis.mySystem;
});
```

Modules now write `game.mySystem.dice.D20Roll` instead of monkey-patching internals or duplicating logic. This is the **API contract** — versioning rules apply: don't break it without a deprecation cycle.

---

## 3. `flags.hotReload` for Dev Iteration

Tell Foundry which files to live-reload during development:

```json
{
  "flags": {
    "hotReload": {
      "extensions": ["css", "hbs", "json"],
      "paths": ["styles/my-system.css", "templates", "lang"]
    }
  }
}
```

When you edit any matching file, Foundry pushes the change to the running world without a refresh — Handlebars templates re-render, CSS hot-swaps, language files update on the next localize call. JS still requires F5; that's a Foundry limitation.

This single line cuts iteration time on UI work by 5–10x.

---

## 4. `htmlFields` and `filePathFields` per Document Type

Declare them in `system.json` `documentTypes`:

```json
{
  "documentTypes": {
    "Actor": {
      "character": {
        "htmlFields": ["details.biography.value", "details.notes.public"],
        "filePathFields": {
          "details.portrait": ["IMAGE"],
          "details.token.src": ["IMAGE", "VIDEO"]
        }
      },
      "npc": {
        "htmlFields": ["details.biography"]
      }
    },
    "Item": {
      "weapon": {
        "htmlFields": ["description"],
        "filePathFields": {
          "img": ["IMAGE"],
          "activities.*.img": ["IMAGE"]
        }
      }
    }
  }
}
```

What this enables:
- **Sanitization** of HTML fields against XSS
- **ProseMirror** enrichment auto-applied
- **Asset migration** — Foundry's pack-extract / pack-pack tooling rewrites file paths inside these fields when relocating assets
- **Search indexing** picks up HTML field text
- **Wildcard support** — `activities.*.img` matches any sub-key

Without these declarations, the data still saves and loads, but tooling can't reason about it. Every shipping system declares them.

---

## 5. `flags.compendiumArtMappings` (System-Wide Asset Overrides)

Lets a module ship "icon packs" or "token art" that automatically replace the default art for compendium documents:

```json
{
  "flags": {
    "compendiumArtMappings": {
      "my-system": {
        "mapping": "systems/my-system/json/fallback-art.json",
        "credit": "Default art © My Studio"
      }
    }
  }
}
```

`fallback-art.json` is a flat object: `{ "Compendium.my-system.monsters.<docId>": { "actor": "icons/...", "token": "tokens/..." } }`. Modules can register their own mapping and Foundry picks the highest-priority one. End users can also override per-actor via the Compendium Art configuration UI.

---

## 6. `CONFIG.compatibility.excludePatterns` (Suppress Known Deprecation Spam)

Foundry logs deprecation warnings for any legacy API still in use. While you migrate, suppress known-noisy patterns so console errors stay actionable:

```javascript
Hooks.once("init", () => {
  CONFIG.compatibility.excludePatterns.push(
    /SomeLibraryUsingLegacyAPI/, // Third-party library you don't control
    /^my-system\.legacy/,         // Your own intentional shim
  );
});
```

Use this **only** to silence patterns you've already triaged. Don't blanket-suppress.

---

## 7. Single Frozen `config.mjs` for System Constants

All static system data — ability list, skill list, damage types, spell schools, weapon properties — lives in one file:

```javascript
// module/config.mjs
export const MY_SYSTEM = {};

MY_SYSTEM.abilities = {
  str: { label: "MY_SYSTEM.AbilityStr", abbr: "STR" },
  dex: { label: "MY_SYSTEM.AbilityDex", abbr: "DEX" },
  con: { label: "MY_SYSTEM.AbilityCon", abbr: "CON" },
  int: { label: "MY_SYSTEM.AbilityInt", abbr: "INT" },
  wis: { label: "MY_SYSTEM.AbilityWis", abbr: "WIS" },
  cha: { label: "MY_SYSTEM.AbilityCha", abbr: "CHA" },
};

MY_SYSTEM.damageTypes = {
  acid: "MY_SYSTEM.DamageAcid",
  cold: "MY_SYSTEM.DamageCold",
  fire: "MY_SYSTEM.DamageFire",
  // ...
};
```

Assigned to `CONFIG` in `init`:

```javascript
Hooks.once("init", () => {
  CONFIG.MY_SYSTEM = MY_SYSTEM;
});
```

Now `CONFIG.MY_SYSTEM.abilities` is the **one** source of truth, accessible from any sheet, dialog, or external module. Don't `Object.freeze` it — modules legitimately mutate it (adding homebrew damage types, etc.).

---

## 8. Migration Versioning via System Flags

Two flags, both in `system.json`:

```json
{
  "flags": {
    "my-system": {
      "needsMigrationVersion": "2.4.0",
      "compatibleMigrationVersion": "1.0"
    }
  }
}
```

- `needsMigrationVersion` — the latest schema version. Worlds older than this get prompted to migrate.
- `compatibleMigrationVersion` — the oldest version your migration script handles. Worlds older than this fail with a clear error rather than corrupting data.

Read them in `ready`:

```javascript
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const target = game.system.flags["my-system"]?.needsMigrationVersion;
  const compatible = game.system.flags["my-system"]?.compatibleMigrationVersion;
  const current = game.settings.get("my-system", "schemaVersion") ?? "0";

  if (foundry.utils.isNewerVersion(compatible, current)) {
    ui.notifications.error(
      `World too old. Update to v${compatible} first.`,
      { permanent: true }
    );
    return;
  }
  if (foundry.utils.isNewerVersion(target, current)) {
    await migrateWorld(current, target);
    await game.settings.set("my-system", "schemaVersion", target);
  }
});
```

This is the dnd5e pattern verbatim — battle-tested across hundreds of releases.

---

## 9. Build Pipeline (Rollup + LESS/Sass + foundryvtt-cli)

Production systems compile, even if the source is plain ESM:

```json
{
  "scripts": {
    "build": "bun run build:js && bun run build:css && bun run build:db",
    "build:js": "rollup -c",
    "build:css": "lessc styles/main.less dist/my-system.css",
    "build:db": "fvtt package pack --type System",
    "watch": "rollup -c -w"
  }
}
```

- **Rollup** bundles the entry into a single `my-system-compiled.mjs`. Cuts initial-load network requests; supports `import.meta.glob`-style patterns; gives you a tree-shaken output.
- **LESS** (or Sass) compiles `styles/main.less` into the file referenced from `system.json`. Gives you variables, nesting, mixins.
- **foundryvtt-cli** packs source JSON in `json/` into the LevelDB format Foundry expects in `packs/`. Lets you keep compendium content in version-controllable text files.

Symlink the `dist/` directory into `Data/systems/my-system` for local development; `bun run watch` keeps it fresh.

---

## 10. Pack Folders for Sidebar Organization

Group your compendiums hierarchically in the user's sidebar:

```json
{
  "packs": [
    { "name": "fighters", "path": "packs/fighters", "type": "Actor" },
    { "name": "monsters", "path": "packs/monsters", "type": "Actor" },
    { "name": "weapons", "path": "packs/weapons", "type": "Item" },
    { "name": "spells", "path": "packs/spells", "type": "Item" }
  ],
  "packFolders": [
    {
      "name": "Characters",
      "color": "#4a7",
      "packs": ["fighters", "monsters"]
    },
    {
      "name": "Equipment",
      "color": "#a47",
      "packs": ["weapons"],
      "folders": [
        {
          "name": "Magic",
          "packs": ["spells"]
        }
      ]
    }
  ]
}
```

Without `packFolders`, all packs land flat in the sidebar — fine for 5 packs, painful for 50.

---

## 11. Staged Initialization Hooks

dnd5e splits work across four hooks, each with a single responsibility:

```javascript
Hooks.once("init", () => {
  // CONFIG mutations: documentClass, dataModels, statusEffects
  // Sheet registration
  // Settings registration
  // Keybinding registration
});

Hooks.once("i18nInit", () => {
  // Translate config strings (CONFIG.MY_SYSTEM.abilities labels)
  // Localize sheet types
  // Sort dropdown lists by translated label
});

Hooks.once("setup", () => {
  // Custom enrichers (CONFIG.TextEditor.enrichers)
  // Macro registry
  // Compendium art mapping setup
});

Hooks.once("ready", () => {
  // Migrations (game.user.isGM gated)
  // Welcome dialog on first run
  // Socket listeners
});
```

The **`i18nInit`** hook is critical: between `init` (translations not loaded) and `setup` (translations available). Use it to translate any static strings on `CONFIG` so sheets see localized labels from first render.

---

## 12. Hot-Loadable Lang Files

Pair `flags.hotReload.extensions: ["json"]` with structured language keys:

```json
{
  "MY_SYSTEM": {
    "AbilityStr": "Strength",
    "AbilityStrAbbr": "STR",
    "Sheet": {
      "Identity": "Identity",
      "Abilities": "Abilities"
    }
  },
  "TYPES": {
    "Actor": {
      "character": "Character",
      "npc": "NPC"
    },
    "Item": {
      "weapon": "Weapon",
      "spell": "Spell"
    }
  }
}
```

Foundry's `TYPES.<DocClass>.<typeKey>` keys auto-populate the "Create Actor/Item" dropdown. Hot reload picks up edits without a refresh.

---

## Quick Adoption Checklist

For an existing system, adopt these in order of impact:

1. ✅ `flags.hotReload` — 10x dev speed, one-line change
2. ✅ `htmlFields` / `filePathFields` per documentType — required for proper migration tooling
3. ✅ Single `config.mjs` exporting `MY_SYSTEM` — refactor scattered constants
4. ✅ Barrel-file imports (`_module.mjs` per directory) — gradual refactor
5. ✅ `globalThis.<systemId>` API surface — version it
6. ✅ Migration version flags + ready-hook gate — required before v2.0
7. ✅ Pack folders if you have >5 packs
8. ✅ Build pipeline (Rollup + LESS) once size > 10 source files
9. ✅ `i18nInit` hook for translated CONFIG labels
10. ✅ `compendiumArtMappings` if you ship token art
