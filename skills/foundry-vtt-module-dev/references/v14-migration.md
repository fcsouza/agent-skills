# Migrating from v13 to v14

Reference for moving a module or system from Foundry VTT v13 to v14. Every API named here was checked against the v14.367 source. Deprecations added in v14 log a warning and are removed in v16 unless the table says otherwise.

Related deep dives: `active-effects-v2.md`, `scene-levels.md`, `measured-templates.md`.

---

## 1. Runtime

| Component | v13 | v14 |
|---|---|---|
| Node.js (server) | `>=20.18.0 <23` | `>=24.13.1 <25` (`package.json` `engines.node`) |
| Express | 4 | 5 (`express ^5.2.1`) — server-side module code must follow Express 5 routing and async error semantics |
| Electron (desktop app) | older | 40 |
| animejs | not bundled | `animejs ^4.3.6`, exposed as `globalThis.animejs` |
| PixiJS | 7.4.x | pinned `7.4.3` |
| jQuery | bundled | still bundled (`^3.7.1`), core V2 code avoids it |
| TinyMCE | bundled | removed; ProseMirror only |
| appv1 (`Application`, `FormApplication`, `Dialog`) | deprecated since 13 | still present, deprecated until 16 |

Static `.html` files are served as `text/plain` since 14.361. Handlebars templates still work because the server reads them. A module cannot open its own `.html` page in the browser any more; move that content into an ApplicationV2 or a `.hbs` template.

---

## 2. Removed v12 shims

These warned in v13 and are gone in v14. Code that still uses them throws `ReferenceError` or `TypeError`.

| Removed | Use instead |
|---|---|
| Bare `foundry.utils` globals (`mergeObject`, `getProperty`, `setProperty`, `deepClone`, `randomID`, `duplicate`, ...) | `foundry.utils.<name>` |
| Dice-term globals (`Die`, `DiceTerm`, `NumericTerm`, `OperatorTerm`, `PoolTerm`, `RollTerm`, `Coin`, `FateDie`, ...) | `foundry.dice.terms.<name>` |
| `MersenneTwister`, `twist` | `foundry.dice.MersenneTwister` |
| `AudioHelper`, `Sound` | `foundry.audio.AudioHelper`, `foundry.audio.Sound` |
| `BaseGrid`, `SquareGrid`, `HexagonalGrid`, `GridHex` | `foundry.grid.*` |
| `LightSource`, `DarknessSource`, `VisionSource`, `SoundSource`, `MovementSource`, `GlobalLightSource` | `foundry.canvas.sources.*` |
| `AmbientLightConfig`, `AmbientSoundConfig`, `PermissionConfig`, `UserConfig` | `foundry.applications.sheets.*` / `foundry.applications.apps.*` |
| `WordTree` | `foundry.utils.WordTree` |
| `Game#template`, `System#template` | `System#documentTypes`, `game.model` |
| `CONST.DOCUMENT_TYPES` | `CONST.WORLD_DOCUMENT_TYPES`, `CONST.COMPENDIUM_DOCUMENT_TYPES` |
| `CONST.CHAT_MESSAGE_TYPES` | `CONST.CHAT_MESSAGE_STYLES` |
| `Math.clamped`, `Math.roundDecimals` | `Math.clamp`, `Number#toFixed` / your own rounding |
| `{{select}}`, `{{colorPicker}}` Handlebars helpers | `{{selectOptions}}` inside a `<select>`, `<color-picker>` element |
| `{{selectOptions nameAttr}}` | `valueAttr` |
| `Document._onCreateDocuments/_onUpdateDocuments/_onDeleteDocuments` | `_onCreateOperation/_onUpdateOperation/_onDeleteOperation` |
| `ClientDocument#render({action, data})` | `{renderContext, renderData}` |
| `TokenDocument#toggleActiveEffect`, `Token#toggleEffect` | `Actor#toggleStatusEffect` |
| `Token#toggleCombat`, `TokenLayer#toggleCombat` | `TokenDocument#toggleCombatant`, `TokenDocument.createCombatants/deleteCombatants` |
| `Token#getCenter(x, y)` | `Token#getCenterPoint(point)` |
| `GridLayer#measureDistance`, `getTopLeft`, `getCenter`, `getSnappedPosition`, `isNeighbor` | `canvas.grid.measurePath`, `getTopLeftPoint`, `getCenterPoint`, `getSnappedPoint`, `testAdjacency` |
| `Canvas#colorManager` | `canvas.environment` |
| `StatusEffectConfig#label/#icon` | `name` / `img` |
| `ActiveEffect#icon`, `ChatMessage#user`, `Drawing#z`, `Tile#z` | `img`, `author`, `elevation`, `sort` |
| `core.sourceId` flag | `_stats.compendiumSource` |
| `TextEditor.create({engine: "tinymce"})`, `CONFIG.TinyMCE`, `JournalTextTinyMCESheet` | ProseMirror (`engine: "prosemirror"` is the default) |
| `ApplicationV2#bringToTop` | `bringToFront` |
| `FogExploration.get(object)` | `FogExploration.load` |
| `Wall#roof`, `Wall#vertices`, `Wall#A/B` | `WallDocument#edge` (`Edge#a/b`) |

---

## 3. New deprecations in v14

All since 14, until 16 unless noted. Each entry was found as a `logCompatibilityWarning` call in the v14 source.

| Deprecated | Replacement | Removed in |
|---|---|---|
| `MeasuredTemplateDocument`, `MeasuredTemplate`, `TemplateLayer`, `MeasuredTemplateConfig`, `Scene#templates`, `CONFIG.Canvas.layers.templates` | `RegionDocument`, `Region`, `RegionLayer`, `RegionConfig`, `Scene#regions` | 16 |
| `CONST.MEASURED_TEMPLATE_TYPES`, permission `TEMPLATE_CREATE` | none / `REGION_CREATE` | 16 |
| `MeasuredTemplate.getCircleShape/getConeShape/getRectShape/getRayShape` | `foundry.data.CircleShapeData`, `ConeShapeData`, `RectangleShapeData`, `LineShapeData` | 16 |
| Settings `core.gridTemplates`, `core.coneTemplateType` | none | 16 |
| `CONFIG.Dice.rollModes` | `CONFIG.ChatMessage.modes` | 16 |
| Setting `core.rollMode` | `core.messageMode` | 16 |
| `CONST.DICE_ROLL_MODES` | `CONFIG.ChatMessage.modes` keys (`public`, `gm`, `blind`, `self`, `ic`) | 16 |
| `{rollMode}` option on `Roll#toMessage`, `ChatMessage.create`, `RollTable#draw/#drawMany` | `{messageMode}` | 16 |
| `Combat#rollInitiative(ids, {messageOptions: {rollMode}})` | `{messageMode}` top-level option | 16 |
| `ChatMessage#applyRollMode`, `ChatMessage.applyRollMode` | `ChatMessage#applyMode`, `ChatMessage.applyMode(chatData, mode)` | 16 |
| `ChatLog.MESSAGE_PATTERNS`, adding to `ChatLog.MULTILINE_COMMANDS` | `ChatLog.CHAT_COMMANDS` (`{rgx, fn, mode?, isRoll?, isMultiline?}`) | 16 |
| `ContextMenuEntry#name/#condition/#callback` | `label` / `visible` / `onClick` | 16 |
| `ContextMenu.eventListeners`, `TooltipManager#activateEventListeners`, `ProseMirrorMenu.eventListeners` | `activateListeners(document)` | 16 |
| `foundry.prosemirror.defaultPlugins` | `foundry.applications.ux.ProseMirrorEditor.buildDefaultPlugins()` | 16 |
| `ProseMirrorEditor(uuid, view, isDirtyPlugin, collaborate, options)` | `ProseMirrorEditor(uuid, view, options)` | 16 |
| `CONFIG.<Placeable>.layerClass` | `CONFIG.Canvas.layers.<name>.layerClass` | 16 |
| `PlaceablesLayer#getDocuments()` | `PlaceablesLayer#viewedDocuments()` generator | 16 |
| `PlaceableObject#clear()` | none (`_clear()` is protected) | 16 |
| `Scene#background`, `#backgroundColor`, `#foreground`, `#foregroundElevation` | `Level#background`, `Level#background.color`, `Level#foreground.src`, `Level#elevation.top` | 16 |
| `Scene#fog.exploration` (boolean) | `Scene#fog.mode` (`CONST.FOG_EXPLORATION_MODES`) | 16 |
| `Scene#createThumbnail({img})` | clone the Scene with changed Level textures, then `createThumbnail` | 16 |
| `Scenes#preload(sceneId, push)` | `preload(sceneId, {broadcast: true})` | 16 |
| `TileDocument#occlusion.mode` | `occlusion.modes` (Set) | 16 |
| `RegionDocument#regionShapes`, `RegionShape` classes | `RegionDocument#shapes`, `foundry.data.*ShapeData` | 16 |
| `TeleportTokenRegionBehaviorType#destination` | `#destinations` | 16 |
| `Combat#getCombatantByActor`, `#getCombatantByToken` | `getCombatantsByActor`, `getCombatantsByToken` | **15** |
| `Actor#applyActiveEffects()` without a phase | `applyActiveEffects("initial")` / `("final")` | 16 |
| `ClientDocument#getRelativeUUID` | `foundry.utils.buildRelativeUuid(target, origin)` | 16 |
| `CONST.ACTIVE_EFFECT_MODES`, numeric `change.mode` | `CONST.ACTIVE_EFFECT_CHANGE_TYPES`, string `change.type` | 16 |
| `effect.changes` at document root | `effect.system.changes` (getter shim exists) | 16 |
| `duration.seconds/rounds/turns/startTime/startRound/startTurn/combat` | `duration.value` + `duration.units`, `start.time/round/turn/combat` | 16 |
| `ActiveEffectDuration#type`, `#duration` | `#units`, `#seconds` | 16 |
| `ActiveEffect#apply`, `.applyField`, `#_applyLegacy`, `#_applyAdd/_applyMultiply/_applyOverride/_applyUpgrade/_applyCustom`, `.getInitialDuration` | static `ActiveEffect.applyChange`, `.applyChangeField`, `._applyChangeUnguided`, `._applyChangeAdd/...`, `.getEffectStart` | 16 |
| `DataField#migrateSource` | `DataField#_migrate(value, options, _state)` | 16 |
| `migrateData` that returns nothing | must return the data | 16 |
| `cleanData(source, {source})` | pass source through the third `_state` argument | 16 |
| `{"-=key": null}`, `{"==key": value}` | `foundry.data.operators.ForcedDeletion` / `ForcedReplacement` (globals `_del`, `_replace`) | 16 |
| `mergeObject(..., {performDeletions})` | `{applyOperators}` | 16 |
| `foundry.utils.applySpecialKeys`, `foundry.utils.objectsEqual` | `applyDataOperators`, `equals` | 16 |
| `DataModelValidationFailure#isEmpty()`, `#fallback` | `#empty`, `#fallbackValue` | 16 |
| `URL.parseSafe` | native `URL.parse` | 16 |
| `CONST.WALL_SENSE_TYPES`, `CONST.WALL_DIRECTIONS` | `CONST.EDGE_SENSE_TYPES`, `CONST.EDGE_DIRECTIONS` | 16 |
| `PointSourcePolygon.WALL_DIRECTION_MODES`, `ClockwiseSweepPolygon#wallDirectionMode` | `CONST.EDGE_DIRECTION_MODES`, `#edgeDirectionMode` | 16 |
| Polygon `config.edgeTypes.light/darkness`, `config.edgeOptions`, type `"universal"` | `config.edgeTypes.source`, `config.edgeTypes`, `{edgeTypes: {wall: false}}` | 16 |
| `CanvasEdges#initialize`, `#refresh` | `Scene#initializeEdges`, `CanvasEdges#getEdges` | 16 |
| `CanvasOcclusionMask#updateOcclusion` | `canvas.perception.update({refreshOcclusion: true})` | 16 |
| `foundry.canvas.containers.ParticleEffect`, `foundry.canvas.primary.PrimaryParticleEffect` | `foundry.canvas.animation.ParticleGenerator` | 16 |
| `TextureLoader.fetchResource/getCacheBustURL`, `foundry.canvas.srcExists` | `foundry.utils.fetchResource/getCacheBustURL/srcExists` | 16 |
| `Token#findMovementPath(waypoints, {ignoreWalls, ignoreCost, history})` | pass them in `constrainOptions` | 16 |
| `ImageHelper.createThumbnail()` result `.src`/`.texture` | `.src` equals the input path; `.texture` has no replacement | 16 |
| `AmbientLightConfig#preview` | `AmbientLightConfig#_preview` | 16 |
| Hook `renderChatMessage` (jQuery, deprecated since 13) | `renderChatMessageHTML(message, html, context)` | 15 |
| Hook `activateEditorLegacy` | none, goes with appv1 | 16 |

---

## 4. Breaking data changes

- **ActiveEffect**: `changes` moved to `system.changes`; `mode` (number) became `type` (string); `duration` split into `duration {value, units, expiry, expired}` and `start {combat, combatant, initiative, round, turn, time}`; `origin` is a `DocumentUUIDField({relative: true})` and unparseable origins are moved to `flags.core.originText`; new `type`, `system`, `showIcon`, `folder`. `BaseActiveEffect.migrateData` handles stored v13 data. See `active-effects-v2.md`.
- **Scene → Level**: `background`, `foreground`, `foregroundElevation`, `backgroundColor`, `fog.overlay` left the Scene schema and live on the `Level` embedded document (`scene.levels`). `Scene#initialLevel` points at the level drawn first; `defaultLevel0000` is the id of the level created for pre-v14 scenes. New `shiftX`, `shiftY` replace `background.offsetX/offsetY`. See `scene-levels.md`.
- **Tile**: `occlusion.mode` (number) → `occlusion.modes` (Set of numbers). `CONST.OCCLUSION_MODES` is now `NONE 0, FADE 1, SURFACE 2, RADIAL 4, VISION 8`. `TextureData` lost `offsetX/offsetY/rotation` (those moved to `Level#textures`).
- **Token**: `detectionModes` is a `TypedObjectField` keyed by mode id (v13: array of `{id, enabled, range}`). New `depth` (min 0, initial 1) and `level` (DocumentId, initial `defaultLevel0000`). `_movement` waypoints carry the same movement fields.
- **Scene fog**: `fog.exploration` (boolean) → `fog.mode` (`CONST.FOG_EXPLORATION_MODES.DISABLED 0 / INDIVIDUAL 1 / SHARED 2`). `FogExploration` gained a `level` field.
- **Region**: `shapes` is a `ShapesField` over ten shape types (`circle, cone, ellipse, emanation, grid, line, polygon, rectangle, ring, token`); new `attachment.token`, `restriction {enabled, type, priority}`, `levels`, `elevation.topInclusive`, `hidden`, `ownership`, `highlightMode`. `visibility` initial is `LAYER_UNLOCKED (4)`.
- **ChatMessage**: `timestamp` is `nullable, initial: null`; the server stamps it. Do not rely on a client-side default.
- **Combat / Combatant**: `Combat#name` is a new text-searchable field. `Combatant#roundJoined` (integer ≥ 1) records the round a combatant joined.
- **Placeables**: `AmbientLight`, `AmbientSound`, `Drawing`, `Note`, `Tile`, `Wall`, `Region` gained `levels: SceneLevelsSetField`; lights, sounds, notes gained `locked`; tiles, drawings, lights and sounds gained `name`.
- **Manifest**: packs whose `name` fails `BasePackage.validateId` (`[A-Za-z0-9_-]`) now fail validation; duplicate pack names or paths throw.

---

## 5. Breaking API changes

### rollMode → messageMode

```js
// v13
await roll.toMessage({speaker}, {rollMode: "gmroll"});
game.settings.get("core", "rollMode");
CONFIG.Dice.rollModes;

// v14
await roll.toMessage({speaker}, {messageMode: "gm"});
game.settings.get("core", "messageMode");     // "public" | "gm" | "blind" | "self" | "ic"
CONFIG.ChatMessage.modes;                     // {public, gm, blind, self, ic} → {label, icon, handler?}
Roll._mapLegacyRollMode("gmroll");            // "gm"; "roll" → current core.messageMode
```

### Data operators

```js
// v13
await actor.update({"flags.my-module.-=old": null, "==system.stats": {...}});

// v14
const {ForcedDeletion, ForcedReplacement} = foundry.data.operators;
await actor.update({
  "flags.my-module.old": new ForcedDeletion(),           // or: _del
  "system.stats": ForcedReplacement.create({...})        // or: _replace({...})
});
foundry.utils.mergeObject(a, b, {applyOperators: true}); // was performDeletions
foundry.utils.equals(a, b);                              // was objectsEqual
```

### DataModel pipeline

```js
// v13
static migrateData(source) { /* mutate */ }              // returned nothing
migrateSource(sourceData, fieldData) { ... }              // on a DataField
// v14
static migrateData(source, options) { ...; return super.migrateData(source, options); }
_migrate(value, options, _state) { ...; return value; }   // on a DataField
static cleanData(data, options, _state)                   // options: {addTypes, copy, fields, expand, migrate, model, partial, prune, persisted, sanitize}
```

### ContextMenuEntry (also header controls)

```js
// v13: {name, icon, condition, callback}
// v14:
{ label: "MYMOD.Rename", icon: "fa-solid fa-pen", visible: target => game.user.isGM, onClick: (event, target) => {...} }
```

### layerClass

```js
// v13
CONFIG.Token.layerClass = MyTokenLayer;
// v14
CONFIG.Canvas.layers.tokens.layerClass = MyTokenLayer;
```

### statusEffects proxy

`CONFIG.statusEffects` is a Proxy over an array that also indexes by `id`. Modules add or replace by id; systems may still assign a whole array (the setter in `client.mjs` copies it in).

```js
CONFIG.statusEffects.frightened = {id: "frightened", name: "MYMOD.Frightened", img: "modules/my-module/icons/fear.svg"};
delete CONFIG.statusEffects.frightened;
CONFIG.statusEffects.dead;              // lookup by id, no more .find()
```

### Walls → Edges constants

`CONST.WALL_SENSE_TYPES` → `CONST.EDGE_SENSE_TYPES`, `CONST.WALL_DIRECTIONS` → `CONST.EDGE_DIRECTIONS`, new `CONST.EDGE_DIRECTION_MODES` and `CONST.EDGE_RESTRICTION_TYPES` (`["light", "darkness", "sight", "sound", "move"]`). `canvas.edges` is the `CanvasEdges` of the viewed Level (`Level#edges`). Sweep polygons take `edgeTypes.source` instead of `edgeTypes.light`/`darkness`.

### ParticleEffect → ParticleGenerator

Weather effects in `CONFIG.weatherEffects` use a declarative `particles: [{textures, count, lifetime, velocity, rotation, alpha, scale, fade}]` config instead of `effectClass`. Custom particle code extends `foundry.canvas.animation.ParticleGenerator`.

### MeasuredTemplate

The document is gone. `RegionDocument.create({shapes: [{type: "cone", ...}]})`, `canvas.regions.placeRegion(data, options)`, `RegionDocument.createTokenEmanation(token, range, regionData, options)`. See `measured-templates.md`.

---

## 6. Manifest changes

```json
{
  "id": "my-module",
  "type": "module",
  "compatibility": {"minimum": "14", "verified": "14"},
  "documentTypes": {"ActiveEffect": {"curse": {}}},
  "packs": [{"name": "my_pack", "label": "My Pack", "path": "packs/my_pack", "type": "Item"}],
  "quickstart": {
    "adventures": {"Compendium.my-module.adventures.Adventure.abc123": {}},
    "postImport": true,
    "world": {"background": "...", "cover": "...", "description": "..."}
  }
}
```

- `type` is now an explicit field on module (`"module"`), system (`"system"`) and world (`"world"`) manifests.
- `quickstart` (modules only): adventures offered on the Setup "create world" view, `postImport`, and world presentation data.
- Pack `name` and `languages[].system/module`, `packs[].system` are validated with `BasePackage.validateId`. Duplicates throw.
- `template.json` still loads but is deprecated (since 14, until 16). Declare subtypes with `documentTypes` and register a `TypeDataModel` per type in `CONFIG.<Doc>.dataModels`.
- Unknown manifest keys are collected in `BasePackage#_unknownKeys`; legacy keys (`name`, `author`, `minimumCoreVersion`, ...) are mapped for you.

---

## 7. Hooks added or changed

| Hook | Change |
|---|---|
| `preRender<ClassName>(application, context, options)` | new, fires for each class in the chain before render |
| `openDetachedWindow(id, win)`, `closeDetachedWindow(id, win)` | new, multi-window apps |
| `dropItemSheetData(item, sheet, data)` | new, `Hooks.call`, return `false` to cancel |
| `getPlaceableContextOptions(application, menuItems)` / `get<DocumentName>ContextOptions` | new, Placeables sidebar tab |
| `planToken(document)` | new, fires when token movement is planned |
| `canvasTearDown(canvas, options)` | now receives `{nextScene, nextLevel}` |
| `drawGroup/tearDownGroup(group, options)`, `drawLayer/tearDownLayer(layer, options)` | options argument added |
| `initializeEdges(scene)` | argument is the Scene |
| `renderChatInput(app, elements, context, options)` | chat input is a ProseMirror editor |
| `renderChatMessage` | still fires (jQuery), removed in 15 → use `renderChatMessageHTML` |

No hook names present in v13 were removed.

---

## 8. Migration checklist (top 12, before → after)

1. **AE change modes**
   `{key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "2"}` → `{key, type: "add", value: 2, phase: "initial"}` under `system.changes`.
2. **AE application overrides**
   `_applyAdd(actor, change, current, delta, changes)` instance method → `static _applyChangeAdd(targetDoc, change, current, delta, changes)`.
3. **AE data prep**
   `this.applyActiveEffects()` → `this.applyActiveEffects("initial")` in `prepareEmbeddedDocuments`, `"final"` after `prepareDerivedData` (core already does both).
4. **Roll modes**
   `{rollMode}` → `{messageMode: Roll._mapLegacyRollMode(rollMode)}`; iterate `CONFIG.ChatMessage.modes`.
5. **Deletion keys**
   `{"-=key": null}` → `{key: _del}`; `{"==key": v}` → `{key: _replace(v)}`; `mergeObject(..., {applyOperators: true})`.
6. **Scene textures**
   `scene.background.src` → `canvas.level.background.src` (the shim reads `scene.firstLevel`); `scene.foregroundElevation` → `level.elevation.top`.
7. **Placeable iteration**
   `canvas.tokens.getDocuments()` → `[...canvas.tokens.viewedDocuments()]`; filter with `doc.includedInLevel(canvas.level)`.
8. **Layer overrides**
   `CONFIG.Wall.layerClass = X` → `CONFIG.Canvas.layers.walls.layerClass = X`.
9. **Templates**
   `MeasuredTemplateDocument.create({t: "cone", ...})` → `RegionDocument.create({shapes: [{type: "cone", x, y, radius, angle, rotation}]}, {parent: scene})`.
10. **DataField migrations**
    `migrateSource(source, value)` → `_migrate(value, options, _state) { ...; return value; }`; `migrateData` returns `source`.
11. **Context menus and header controls**
    `{name, condition, callback}` → `{label, visible, onClick}`.
12. **Status effects**
    `CONFIG.statusEffects.push({id, name, img})` → `CONFIG.statusEffects[id] = {id, name, img}`; find with `CONFIG.statusEffects[id]`.

Also: `Combat#getCombatantByToken(t)` → `getCombatantsByToken(t)[0]` (removed in 15), `objectsEqual` → `equals`, `ParticleEffect` → `ParticleGenerator`, `CONST.WALL_*` → `CONST.EDGE_*`, `tile.occlusion.mode` → `tile.occlusion.modes.has(...)`, `token.detectionModes.find(m => m.id === id)` → `token.detectionModes[id]`.

---

## 9. How to find deprecations in your code

Turn warnings into thrown errors while testing:

```js
Hooks.once("init", () => {
  CONFIG.compatibility.mode = CONST.COMPATIBILITY_MODES.FAILURE;   // SILENT 0, WARNING 1, ERROR 2, FAILURE 3
  CONFIG.compatibility.includePatterns = [/my-module/];             // only stack traces that touch your package
});
```

`CONFIG.compatibility` has `mode`, `includePatterns`, `excludePatterns`. `foundry.utils.logCompatibilityWarning(message, {since, until, mode, once})` uses it.

Grep patterns that catch most v13 leftovers:

```bash
grep -rnE 'rollMode|DICE_ROLL_MODES|CONFIG\.Dice\.rollModes' src/
grep -rnE 'ACTIVE_EFFECT_MODES|\.mode\s*[:=]|changes\.(push|map|filter)|duration\.(seconds|rounds|turns|startTime)' src/
grep -rnE '"-=|"==|performDeletions|objectsEqual|applySpecialKeys' src/
grep -rnE 'MeasuredTemplate|TemplateLayer|scene\.templates|canvas\.templates' src/
grep -rnE 'scene\.(background|foreground|foregroundElevation|backgroundColor)|fog\.exploration' src/
grep -rnE '\.layerClass|getDocuments\(\)|WALL_SENSE_TYPES|WALL_DIRECTIONS|ParticleEffect' src/
grep -rnE 'migrateSource|getCombatantBy(Token|Actor)\(|getRelativeUUID|Math\.clamped' src/
grep -rnE 'condition:|callback:|name:' src/**/context*.mjs
grep -rnE '\{\{(select|colorPicker) ' templates/
```

Then load a world with the module active, open the console, and search for `Deprecated since Version 14`. Each warning names the replacement.

---

## Pitfalls

- `effect.changes` still works through a non-enumerable getter, so `effect.toObject().changes` is `undefined`. Read and write `system.changes`.
- `change.value` is deserialized: `"2"` stored by v13 becomes the number `2` after migration. Code that did `parseInt(change.value)` still works; code that did `change.value.startsWith(...)` breaks on numbers.
- `Actor#applyActiveEffects` with no argument still runs but logs a warning and guesses the phase from what already ran. Pass the phase.
- `CONFIG.statusEffects.find(...)` still works (it is an array underneath), but `CONFIG.statusEffects = [...]` replaces the whole list, including entries other modules added earlier in `init`.
- `mergeObject` ignores `ForcedDeletion` unless `applyOperators: true`. Document updates apply operators on their own.
- `canvas.tokens.placeables` only holds objects on the viewed Level. Iterate `scene.tokens` for every token in the Scene.
- `ChatMessage` `timestamp` is `null` until the server stamps it; `_preCreate` code that reads `this.timestamp` gets `null`.
- Express moved from 4 to 5. Server-side module code (custom routes, middleware) needs a pass against the Express 5 migration guide; the Foundry source does not shim it.
- `template.json` is still read in v14, so a system that relies on it works, but the `strictDataCleaning` merge path is marked deprecated until 16. Move each type to a `TypeDataModel` now.
