# Production System Patterns

Patterns shared by the large, long-lived Foundry systems (the D&D 5e system's public layout is the best-known example). They are the architectural and tooling decisions every shipping system makes that beginner tutorials skip. Nothing here depends on a specific dnd5e release; treat each item as "the pattern", not as a description of one codebase.

Targets Foundry v14+. Use this as a checklist when scaffolding a new system or refactoring one for long-term maintenance.

---

## 1. Single ESM Entry + Barrel Files

A production system has **one** entry file declared in `system.json` (e.g. `my-system.mjs` at repo root). That file imports namespace bundles from each subdirectory via barrel files (`_module.mjs`):

```
my-system/
├── my-system.mjs            ← single entry
├── system.json              ← documentTypes live here; no template.json
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
│   │   ├── weapon-data.mjs
│   │   └── condition-effect-data.mjs   ← ActiveEffect subtype model (v14)
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

Changed in v14: `template.json` is deprecated (until v16). Declare types in `system.json` `documentTypes` and give each one a `TypeDataModel` (see `system-manifest.md` §5). New systems ship without a `template.json`.

A barrel file is just a re-export:

```javascript
// module/data/_module.mjs
export { CharacterData } from "./character-data.mjs";
export { NpcData } from "./npc-data.mjs";
export { WeaponData } from "./weapon-data.mjs";
export { SpellData } from "./spell-data.mjs";
export { ConditionEffectData } from "./condition-effect-data.mjs";
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

Tell Foundry which files to live-reload during development. The shape is `{extensions: string[], paths: string[]}` (`PackageFlagsData.hotReload`):

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

When you edit a matching file, the server emits a `hotReload` socket event. The client calls `Hooks.call("hotReload", data)` (return `false` to veto), then, by extension: `css` swaps the stylesheet, `hbs` recompiles the template and re-renders open apps with `renderContext: "hotReload"`, `json` reloads the language file and re-renders. JS still requires F5; that's a Foundry limitation.

This single block cuts iteration time on UI work by 5–10x.

---

## 4. `htmlFields`, `filePathFields`, `gmOnlyFields` per Document Type

Declare them in `system.json` `documentTypes` (`ServerSanitizationFields`; paths are relative to `system`):

```json
{
  "documentTypes": {
    "Actor": {
      "character": {
        "htmlFields": ["details.biography.value", "details.notes.public"],
        "filePathFields": {
          "details.portrait": ["IMAGE"],
          "details.token.src": ["IMAGE", "VIDEO"]
        },
        "gmOnlyFields": ["details.secretNotes"]
      },
      "npc": {
        "htmlFields": ["details.biography"]
      }
    },
    "Item": {
      "weapon": {
        "htmlFields": ["description"],
        "filePathFields": {
          "activities.*.img": ["IMAGE"]
        }
      }
    }
  }
}
```

What this enables:
- **Sanitization** of HTML fields against XSS on the server
- **File path validation** against `CONST.FILE_CATEGORIES`
- **GM-only fields** rejected when a non-GM user tries to update them
- **Asset migration** — pack tooling can rewrite file paths inside declared fields when relocating assets
- **Wildcard support** — `activities.*.img` matches any sub-key

The server prefixes every declared path with `system.`, so only fields your `TypeDataModel` defines can be declared here; a document-level field like `img` cannot.

Without these declarations, the data still saves and loads, but the server cannot reason about it. Every shipping system declares them.

---

## 5. ActiveEffect Subtypes

Changed in v14: `ActiveEffect` has `type` and `system`, and `changes` lives at `effect.system.changes`. `CONFIG.ActiveEffect.dataModels.base` is `foundry.data.ActiveEffectTypeDataModel`. A production system uses subtypes to attach rules data (severity, source, stacking) to effects instead of stuffing it into flags.

```json
{
  "documentTypes": {
    "ActiveEffect": {
      "condition": {},
      "buff": {}
    }
  },
  "packs": [
    { "name": "conditions", "label": "Conditions", "type": "ActiveEffect", "system": "my-system" }
  ]
}
```

```javascript
// module/data/condition-effect-data.mjs
export class ConditionEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),   // keeps `changes`; setup throws without it
      severity: new fields.NumberField({ integer: true, min: 1, initial: 1 })
    };
  }
}

Hooks.once("init", () => {
  Object.assign(CONFIG.ActiveEffect.dataModels, { condition: ConditionEffectData });
});
```

Rules:
- Keep a `changes` `ArrayField` whose element schema has string `type`, string `phase`, numeric `priority`. Setup throws otherwise.
- `ActiveEffect` packs must declare `system` (it is in `CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES`), and ActiveEffects can sit in folders.
- Change objects are `{key, type: "add"|"multiply"|"override"|"upgrade"|"downgrade"|"subtract"|"custom", value, phase, priority}`. Register custom types in `CONFIG.ActiveEffect.changeTypes`. The full model is in `foundry-vtt-module-dev/references/active-effects-v2.md`.

---

## 6. `flags.compendiumArtMappings` (System-Wide Asset Overrides)

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

## 7. `CONFIG.compatibility.excludePatterns` (Suppress Known Deprecation Spam)

Foundry logs deprecation warnings for any legacy API still in use. While you migrate, suppress known-noisy patterns so console errors stay actionable:

```javascript
Hooks.once("init", () => {
  CONFIG.compatibility.excludePatterns.push(
    /SomeLibraryUsingLegacyAPI/, // Third-party library you don't control
    /^my-system\.legacy/,         // Your own intentional shim
  );
});
```

Use this **only** to silence patterns you've already triaged. Don't blanket-suppress. v14 added many `since: 14, until: 16` warnings (roll modes, AE modes, `-=` keys, MeasuredTemplate); fix them rather than hiding them.

---

## 8. Single Frozen `config.mjs` for System Constants

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

## 9. Migration Versioning via System Flags

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

This is the pattern the big systems use — battle-tested across hundreds of releases. Migration mechanics are in `data-migration.md`.

---

## 10. Bulk Writes with `foundry.documents.modifyBatch`

Changed in v14: `foundry.documents.modifyBatch(operations)` sends several document operations in one request. They run in sequence with no network gap, and a cancellation (a `_preUpdate` returning `false`) or a thrown error cancels the whole batch. One operation cannot read the result of an earlier one in the same batch.

Use it for migrations and for rules that touch an Actor and its tokens together:

```javascript
await foundry.documents.modifyBatch([
  {
    action: "update",
    documentName: "Actor",
    updates: [{ _id: actor.id, "system.size": "large" }]
  },
  {
    action: "update",
    documentName: "Token",
    parent: canvas.scene,
    updates: actor.getDependentTokens({ scenes: [canvas.scene], concreteOnly: true })
      .map(t => ({ _id: t.id, width: 2, height: 2 }))
  }
]);
```

Each entry is a `DatabaseWriteOperation`: `action` (`"create"|"update"|"delete"`), `documentName`, `parent`/`pack` where needed, plus `data`, `updates`, or `ids`. `concreteOnly: true` keeps ephemeral tokens out of the batch; it becomes the `getDependentTokens` default in v15.

---

## 11. Build Pipeline (Rollup + LESS/Sass + foundryvtt-cli)

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

- **Rollup** bundles the entry into a single `my-system-compiled.mjs`. Cuts initial-load network requests; gives you a tree-shaken output.
- **LESS** (or Sass) compiles `styles/main.less` into the file referenced from `system.json`. Gives you variables, nesting, mixins.
- **foundryvtt-cli** packs source JSON in `json/` into the LevelDB format Foundry expects in `packs/`. Lets you keep compendium content in version-controllable text files.

Changed in v14: the server requires Node `>=24.13.1 <25` (`package.json` `engines`). Run your build tooling and the CLI on the same Node 24 so the LevelDB bindings match the server's. Per the 14.361 release notes, static `.html` files are served as `text/plain`; keep templates as `.hbs` rendered through Foundry, never link an `.html` file directly.

Symlink the `dist/` directory into `Data/systems/my-system` for local development; `bun run watch` keeps it fresh.

---

## 12. Pack Folders for Sidebar Organization

Group your compendiums hierarchically in the user's sidebar:

```json
{
  "packs": [
    { "name": "fighters", "label": "Fighters", "path": "packs/fighters", "type": "Actor", "system": "my-system" },
    { "name": "monsters", "label": "Monsters", "path": "packs/monsters", "type": "Actor", "system": "my-system" },
    { "name": "weapons", "label": "Weapons", "path": "packs/weapons", "type": "Item", "system": "my-system" },
    { "name": "spells", "label": "Spells", "path": "packs/spells", "type": "Item", "system": "my-system" }
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

Without `packFolders`, all packs land flat in the sidebar — fine for 5 packs, painful for 50. Changed in v14: pack names must match `[A-Za-z0-9_-]` and duplicate names or paths throw at load.

---

## 13. Staged Initialization Hooks

Split work across four hooks, each with a single responsibility:

```javascript
Hooks.once("init", () => {
  // CONFIG mutations: documentClass, dataModels, statusEffects
  // Sheet registration
  // Settings registration
  // Keybinding registration
});

Hooks.once("i18nInit", () => {
  // Translate config strings (CONFIG.MY_SYSTEM.abilities labels)
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

The **`i18nInit`** hook is critical: between `init` (translations not loaded) and `setup` (translations available). Use it to translate any static strings on `CONFIG` so sheets see localized labels from first render. `Localization` fills `CONFIG.<Doc>.typeLabels` and `typeHints` just before it fires.

Changed in v14: `_loc` is a global alias of `game.i18n.localize`, and `localize(stringId, data)` formats when `data` is passed. Use it inside `i18nInit` and later:

```javascript
Hooks.once("i18nInit", () => {
  for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
    ability.label = _loc(ability.label);
  }
});
```

---

## 14. Hot-Loadable Lang Files

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
    },
    "ActiveEffect": {
      "condition": "Condition"
    },
    "HINTS": {
      "Actor": {
        "character": "A player-controlled hero."
      }
    }
  }
}
```

`TYPES.<DocClass>.<typeKey>` keys populate the "Create Actor/Item" dropdown. `TYPES.HINTS.<DocClass>.<typeKey>` adds a hint line under the type select. Hot reload picks up edits without a refresh.

---

## Quick Adoption Checklist

For an existing system, adopt these in order of impact:

1. `flags.hotReload` — 10x dev speed, one block in the manifest
2. `htmlFields` / `filePathFields` / `gmOnlyFields` per documentType — required for server sanitization
3. Drop `template.json`; every type gets a `TypeDataModel` — required before v16
4. Single `config.mjs` exporting `MY_SYSTEM` — refactor scattered constants
5. Barrel-file imports (`_module.mjs` per directory) — gradual refactor
6. `globalThis.<systemId>` API surface — version it
7. Migration version flags + ready-hook gate — required before v2.0
8. ActiveEffect subtypes for rules data on effects
9. `modifyBatch` for multi-document writes
10. Pack folders if you have >5 packs
11. Build pipeline (Rollup + LESS) on Node 24 once size > 10 source files
12. `i18nInit` hook for translated CONFIG labels
13. `compendiumArtMappings` if you ship token art
