---
name: foundry-vtt-dev
description: >-
  Builds, extends and migrates Foundry VTT v14 packages, both modules and game
  systems: manifests, documentTypes with TypeDataModel, ApplicationV2 sheets,
  hooks and settings, GM-checked queries and sockets, dice and message modes,
  Active Effects V2, status effects, Regions as templates, Scene Levels,
  compendium packs, world migrations and the Vite build. Use when writing or
  fixing a Foundry module or system, porting one from v13 to v14, or shipping
  a release to the Foundry package list.
---

# Foundry VTT development (v14)

A package is either a module (extends any world) or a system (defines the rules: Actor and Item types, dice, combat, sheets). Both share the same document model, application framework, hooks and v14 changes. This file holds the decisions; `references/` holds the detail.

The current stable build is 14.370 (Version 14 Stable 12, November 2026). Check names against the v14 API docs, https://foundryvtt.com/api/v14/, before you rely on them. Foundry publishes no llms.txt or agent skill. Coming from v13? Read `references/v14-migration.md` first.

## Building a module

1. Copy `boilerplate/module/`. It builds with Vite: `src/` holds code, `static/` holds `module.json`, templates and lang files, and `bun run build` writes a complete `dist/`.
2. Set `id` in `static/module.json`. It must match the folder name under `Data/modules/`.
3. The entry point is `scripts/main.mjs` in `dist/` (from `src/main.mjs`). Keep `esmodules` and the Vite `fileName` in step.
4. Declare sub-types under `documentTypes` without a prefix. Foundry prefixes them with the module id, so `hero` becomes `my-module.hero`: register `CONFIG.Actor.dataModels["my-module.hero"]` and sheets with `types: ["my-module.hero"]`. Read `references/module-subtypes.md`.
5. Symlink `dist/` into `Data/modules/<id>/`, run `bun run dev`, enable the module in a world. `bun run format` and `bun run lint` work as shipped: `biome.jsonc` is what `bunx ultracite init` writes, plus the Foundry globals.
6. Load CSS through the manifest with `"layer": "modules"`. Read `references/module-styling.md`.
7. After every build, check that each path in `dist/module.json` exists. A missing `module.json`, stylesheet or lang file fails silently in Foundry.

## Building a system

1. Copy `boilerplate/system/`. The entry point is `scripts/main.mjs`, declared in `system.json` `esmodules`. Run `bun install` and `bun run build:css` to compile `styles/my-system.css`, the stylesheet `system.json` lists.
2. Declare every type in `system.json` `documentTypes` (with `htmlFields` and `filePathFields` per sub-type), and give each a `TypeDataModel` in `CONFIG.<Doc>.dataModels`. System types carry no prefix.
3. Ship no `template.json`. Release 14.352 put it into its deprecation period. Read `references/system-manifest.md` before you move an old system off it.
4. Set `CONFIG.Actor.documentClass` and `CONFIG.Item.documentClass` in `init`, and implement `getRollData()` so `@abilities.str.mod` resolves.
5. Keep static rules data in one `config.mjs` assigned to `CONFIG.MY_SYSTEM`, and stage work across `init`, `i18nInit`, `setup` and `ready`. Read `references/production-patterns.md`.
6. Dice, combat and character creation each have a reference: `references/dice-system.md`, `references/combat-initiative.md`, `references/character-creation.md`.
7. Systems carry most CSS in a world. Read `references/styling-and-themes.md`.

## Lifecycle

| Hook | Ready to use | Do here |
|---|---|---|
| `init` | `CONFIG`, `game.settings.register` | data models, document classes, sheets, settings, `CONFIG.queries`, status effects, change types |
| `setup` | every package has run `init` | work that depends on other packages, enrichers |
| `ready` | `game.user`, `game.actors`, canvas | migrations, GM-only side effects |

`game.user` is not set in `init`. Read `references/hooks-and-settings.md`.

## Data model

- `TypeDataModel.defineSchema()` gives fields, defaults (`initial`), validation and inheritance. Shared fields go in a base class.
- `prepareDerivedData()` computes in memory. Never write to the database there.
- `static migrateData(source, options)` renames and reshapes raw data on every load and must return it: end with `return super.migrateData(source, options)`.
- Flags store module data on any document: `actor.setFlag("my-module", "key", value)`.
- Delete or replace keys with the operator globals, not `"-=key"` or `"==key"`: `_del` deletes a key and `_replace(value)` assigns without merging. Release 14.365 calls them operators; the v14 API documents the classes in `foundry.data.operators` (`ForcedDeletion`, `ForcedReplacement`).

Read `references/document-model.md` and `references/actor-item-classes.md`.

## Applications

Build every window on `HandlebarsApplicationMixin(ApplicationV2)`, and sheets on `ActorSheetV2` / `ItemSheetV2` from `foundry.applications.sheets`. The AppV1 classes under `foundry.appv1` are deprecated. Rich text is ProseMirror only. Read `references/application-v2.md`, `references/handlebars-and-templates.md` and `references/accessibility.md`. Old global names (`Actors`, `DocumentSheetConfig`) redirect until Version 15; read `references/namespaces.md` for the namespaced paths.

## Player actions the GM must perform

A player can update documents they own. For anything else (damage to a monster, an item moved between players), ask the active GM and let the GM check the request:

The code is in `references/sockets-rolls-packs.md` ("GM-Authoritative Pattern"), and `boilerplate/module/src/socket-handler.mjs` is the full version. Both are v14 only.

Why it is written this way:

- The handler runs on the GM client with full rights. Without a check on the asking user, any player can edit any document by sending a crafted request.
- A raw `game.socket` listener receives only what the sender emitted, so a user id in the payload can be forged. In v14 a query handler gets the asking `User` in its second argument (core's `dialog` query takes the same `{ user }`). In v13 that argument holds only timeout information, so every handler refuses when `user` is not a `foundry.documents.User`.
- This skill relies on core setting `user` on the server side. No public page states that a client cannot forge it.
- Check that user with `canUserModify(user, action, data)`, `testUserPermission`, or a game rule the GM can verify. Bound every number and allow-list the fields you write.
- `game.users.activeGM` picks one GM, so two online GMs do not apply the change twice.
- The GM performs the write, so document hooks (`createItem`, `updateActor`) see the GM as the author, not the player.
- Sending a query needs the `QUERY_USER` permission. Players have it by default, but a GM can revoke it.

Raw sockets need `"socket": true` in the manifest and the event name `module.<id>` or `system.<id>`; queries need neither.

## Dice and chat

Always `await roll.evaluate()`. Visibility is a message mode: pass `{ messageMode }` (`public`, `gm`, `blind`, `self`, `ic`, the keys of `CONFIG.ChatMessage.modes`) to `Roll#toMessage`, or pass nothing to use the user's `core.messageMode` setting. `rollMode` keeps working until V16 (release 14.355); convert old values with `Roll._mapLegacyRollMode`. Read `references/dice-system.md` and `references/chat-and-ui.md`.

## Active Effects and status effects

v14 Active Effects are typed documents. Changes live in `system.changes` as `{ key, type, value, phase, priority }` with a string `type` (`add`, `subtract`, `multiply`, `override`, `upgrade`, `downgrade`, `custom`). Effects on items apply through `actor.allApplicableEffects()`. Register sub-types and change types in `init`. Read `references/active-effects-v2.md`.

`CONFIG.statusEffects` is an object keyed by status id (release 14.352; the v14 API types it `{[id]: StatusEffectConfig}`). The notes keep array use backward compatible, but write the keyed form, which adds or removes one entry and leaves other packages' entries alone:

```javascript
CONFIG.statusEffects["my-module.burning"] = {
  id: "my-module.burning",
  name: "MY_MODULE.Effect.burning",
  img: "modules/my-module/icons/burning.svg",
  system: { changes: [{ key: "system.abilities.dex", type: "subtract", value: 2 }] },
};
delete CONFIG.statusEffects.dead; // a system replacing a core condition
```

## Regions, templates and levels

The v14 release notes say Measured Templates are gone; Template Regions replace them. Place an area effect with `canvas.regions.placeRegion(data, { create })`, attach an aura with `RegionDocument.createTokenEmanation(token, range, regionData)`, and do not rely on any MeasuredTemplate API. Since 14.370 a system configures Measured Template Mode through `CONFIG.Region.templateModeConfig` (`shapeTypes`, `gridBased`, `coneAngle`, `coneCurvature`, `ringAlignment`, `highlightMode`, ...), and the Region layer has a Grid Space tool that adds or removes single grid spaces. Read `references/measured-templates.md` and `references/regions-and-grid.md`.

A Scene holds `Level` documents; backgrounds, foregrounds and fog live on the Level. Read `references/scene-levels.md` before touching scene visuals or iterating placeables.

## Compendium packs and adventures

Declare packs in the manifest. Keep pack contents in git as files with the official CLI: `fvtt package unpack` and `fvtt package pack` (there is no `extract` verb). Read `references/tooling-and-publishing.md` and `references/adventure-documents.md`.

## Migrations

A migration rewrites world data and cannot be undone.

1. Run it on one client: `if (game.user !== game.users.activeGM) return;` in `ready`.
2. Before the first write, ask the GM to back up the world (Setup screen, right-click the world, Take Backup) and stop if they decline. Both boilerplates do this with `DialogV2.confirm`.
3. Record the schema version after each step, so a failure resumes at the failed step.
4. Rename and reshape in `migrateData`; persist in the world pass.

Read `references/data-migration.md` (systems), `references/migration-guide.md` (older version jumps) and `references/v14-migration.md`.

## Pitfalls

1. **A GM-side handler that trusts the request.** It lets any player edit any document. Check the asking user from the query context and allow-list fields.
2. **Copying statics in Vite `buildStart`.** `emptyOutDir` wipes them, and `dist/` ships without `module.json`. Copy in `writeBundle`.
3. **`package.json` scripts that call missing files.** A `prebuild` entry runs before every build; if its file is missing, the build fails.
4. **Unprefixed module sub-types.** A module registering `CONFIG.Actor.dataModels.hero` registers nothing Foundry uses; the type is `my-module.hero`.
5. **Migrating without a backup**, or on every GM client at once.
6. **`fvtt package extract`.** The verb is `unpack`.
7. **Passing `rollMode`.** Pass `messageMode`, or nothing.
8. **Root-level `changes` with numeric modes.** Write `system.changes` with a string `type`.
9. **`"-=key"` and `"==key"` update keys.** Use `_del` and `_replace`.
10. **Building templates as MeasuredTemplates.** Place a Region.
11. **Reading `scene.background`.** Read the viewed Level.
12. **`CONFIG.<Doc>.layerClass`.** Deprecated (14.352); set `CONFIG.Canvas.layers.<name>.layerClass`.
13. **Opening a bundled `.html` file in a browser.** Since 14.361 it is served as `text/plain`; Handlebars templates still render.
14. **A missing `getRollData()`.** `@` references in formulas resolve to nothing.
15. **`update()` inside `_preCreate`.** Use `this.updateSource()`.
16. **Side effects in `_onCreate` / `_onUpdate` on every client.** Guard with `if (game.userId !== userId) return;`.
17. **Patching core without libWrapper.** Two modules patching the same method break each other.
18. **`compatibility.maximum` set without a known break.** It blocks users on newer builds.
19. **Hardcoded English.** Use `game.i18n.localize` and a lang file.

## Files

References (read when the task touches the topic):

- `references/v14-migration.md` - read when porting a v13 package to v14.
- `references/namespaces.md` - read when replacing a legacy global with its `foundry.*` path.
- `references/document-model.md` - read when defining fields, lifecycle methods, flags or embedded documents.
- `references/module-subtypes.md` - read when a module adds Actor, Item or page sub-types.
- `references/system-manifest.md` - read when writing `system.json` or retiring `template.json`.
- `references/actor-item-classes.md` - read when subclassing Actor or Item.
- `references/production-patterns.md` - read when laying out a system past a few files.
- `references/application-v2.md` - read when building a window, sheet or dialog.
- `references/handlebars-and-templates.md` - read when writing templates or form helpers.
- `references/accessibility.md` - read when building any sheet or dialog.
- `references/hooks-and-settings.md` - read when registering hooks, settings or keybindings.
- `references/sockets-rolls-packs.md` - read when using sockets, queries, rolls, packs or localization.
- `references/permissions-and-ownership.md` - read when checking roles, ownership or GM-only paths.
- `references/chat-and-ui.md` - read when changing chat, context menus, enrichers or the editor.
- `references/dice-system.md` - read when writing custom dice terms or roll classes.
- `references/combat-initiative.md` - read when changing initiative or the combat flow.
- `references/combat-and-tokens.md` - read when changing the tracker, the Token HUD or token defaults.
- `references/character-creation.md` - read when adding starter items or prototype tokens.
- `references/advanced-system-features.md` - read when adding conditions, macros, enrichers, token bars or journal page types.
- `references/active-effects-v2.md` - read when creating effects, change types, phases or expiry.
- `references/measured-templates.md` - read when replacing templates with Regions.
- `references/regions-and-grid.md` - read when using Regions, behaviors or grid math.
- `references/scene-levels.md` - read when touching Levels, scene visuals or placeable iteration.
- `references/canvas-and-pixi.md` - read when adding canvas layers or PIXI drawing.
- `references/vision-and-lighting.md` - read when changing vision, detection or lighting.
- `references/audio-and-macros.md` - read when playing sounds or creating macros.
- `references/adventure-documents.md` - read when shipping an adventure or quickstart content.
- `references/data-migration.md` - read when migrating a system's world data.
- `references/migration-guide.md` - read when jumping from v11, v12 or v13.
- `references/build-pipeline.md` - read when changing the Vite build or the dev loop.
- `references/tooling-and-publishing.md` - read when using the CLI, types, or the release workflow.
- `references/module-styling.md` - read when styling a module.
- `references/styling-and-themes.md` - read when styling a system.
- `references/testing-with-quench.md` - read when writing in-game tests.
- `references/sources.md` - read when checking where a claim comes from.

Checklists (copy when preparing a release):

- `templates/module-checklist.md` - copy when releasing a module.
- `templates/system-checklist.md` - copy when releasing a system.

Module boilerplate (copy when starting a module; built and checked with Vite 8.3.8):

- `boilerplate/module/package.json` - copy when starting a module: scripts and pinned dev dependencies.
- `boilerplate/module/biome.jsonc` - copy when starting a module: the ultracite config with Foundry globals.
- `boilerplate/module/.gitignore` - copy when starting a module: Biome reads it; ignores node_modules and dist.
- `boilerplate/module/vite.config.mjs` - copy when starting a module: fixed-name output, static copy after write, dev proxy.
- `boilerplate/module/src/main.mjs` - copy when starting a module: hooks, settings, backup-gated migrations.
- `boilerplate/module/src/type-data-model.mjs` - copy when adding an Actor sub-type.
- `boilerplate/module/src/actor-sheet.mjs` - copy when building an ActorSheetV2.
- `boilerplate/module/src/socket-handler.mjs` - copy when players need GM-performed writes.
- `boilerplate/module/static/module.json` - copy when starting a module: v14 manifest.
- `boilerplate/module/static/templates/sheet.hbs` - copy when building the sheet template.
- `boilerplate/module/static/lang/en.json` - copy when starting a module: every string the boilerplate uses.
- `boilerplate/module/static/styles/my-module.css` - copy when starting a module: scoped starter CSS.

System boilerplate (copy when starting a system):

- `boilerplate/system/system.json` - copy when starting a system: v14 manifest with documentTypes and migration flags.
- `boilerplate/system/package.json` - copy when starting a system: the `build:css` step (less 4.9.1).
- `boilerplate/system/lang/en.json` - copy when starting a system: every string the boilerplate uses, including the migration dialog.
- `boilerplate/system/scripts/main.mjs` - copy when starting a system: entry, staged hooks, backup-gated migrations.
- `boilerplate/system/scripts/config.mjs` - copy when starting a system: static rules data.
- `boilerplate/system/scripts/settings.mjs` - copy when starting a system: settings in one place.
- `boilerplate/system/scripts/migration.mjs` - copy when starting a system: version-gated world migration.
- `boilerplate/system/scripts/actor.mjs` - copy when starting a system: Actor class with getRollData.
- `boilerplate/system/scripts/item.mjs` - copy when starting a system: Item class with roll().
- `boilerplate/system/scripts/data/_module.mjs` - copy when starting a system: data model barrel.
- `boilerplate/system/scripts/data/character-data.mjs` - copy when defining a character type.
- `boilerplate/system/scripts/data/npc-data.mjs` - copy when defining an NPC type.
- `boilerplate/system/scripts/data/weapon-data.mjs` - copy when defining a weapon type.
- `boilerplate/system/scripts/data/spell-data.mjs` - copy when defining a spell type.
- `boilerplate/system/scripts/documents/_module.mjs` - copy when starting a system: document class barrel.
- `boilerplate/system/scripts/sheets/_module.mjs` - copy when starting a system: sheet barrel.
- `boilerplate/system/scripts/sheets/character-sheet.mjs` - copy when building the actor sheet.
- `boilerplate/system/scripts/sheets/item-sheet.mjs` - copy when building the item sheet.
- `boilerplate/system/templates/actor/character-sheet.hbs` - copy when building the actor sheet template.
- `boilerplate/system/templates/item/item-sheet.hbs` - copy when building the item sheet template.
- `boilerplate/system/styles/my-system.less` - copy when starting system CSS: the entry file.
- `boilerplate/system/styles/variables/base.less` - copy when starting system CSS: theme-neutral tokens.
- `boilerplate/system/styles/variables/light.less` - copy when starting system CSS: light theme.
- `boilerplate/system/styles/variables/dark.less` - copy when starting system CSS: dark theme.
- `boilerplate/system/styles/v2/sheets.less` - copy when styling shared sheet chrome.
- `boilerplate/system/styles/v2/typography.less` - copy when styling type.
- `boilerplate/system/styles/v2/character.less` - copy when styling the character sheet.
- `boilerplate/system/styles/v2/items.less` - copy when styling item sheets.
- `boilerplate/system/styles/v2/apps.less` - copy when styling dialogs and popouts.
- `boilerplate/system/styles/v2/chat.less` - copy when styling chat cards.

## Related skills

- `ci-cd-game` for CI pipelines beyond the release workflow.
- `game-localization` for string tables and translation workflow.
