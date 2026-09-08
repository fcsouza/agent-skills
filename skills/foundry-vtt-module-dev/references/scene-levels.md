# Scene Levels

v14 splits a Scene into one or more stacked `Level` documents. A Level owns the background and foreground textures, an elevation band, and its own set of wall edges. The canvas draws one Level at a time. Every API here was checked against the v14.367 source: `common/documents/level.mjs`, `client/documents/level.mjs`, `common/documents/scene.mjs`, `client/documents/scene.mjs`, `client/canvas/board.mjs`, `client/canvas/scene-manager.mjs`, `client/documents/abstract/canvas-document.mjs`.

Related: `v14-migration.md`, `measured-templates.md`, `regions-and-grid.md`.

---

## 1. Concept

A v13 Scene had one background image, one foreground image, one `foregroundElevation`, and one set of walls. v14 moves all of that onto an embedded `Level`:

- `scene.levels` is an `EmbeddedCollectionField` of `Level` documents.
- Each Level has `elevation.bottom` and `elevation.top`. A Level is the elevation band that the canvas is currently drawing.
- Placeables (walls, tiles, drawings, notes, lights, sounds, regions) carry a `levels` Set naming the Levels they appear in. An empty Set means "every Level".
- Tokens carry a single `level` id — a Token lives in exactly one Level.
- Each Level owns a `CanvasEdges` instance, so walls in one Level do not block sight in another.

Every world Scene gets one Level. Scenes migrated from v13 get a Level with the id `defaultLevel0000` (`BaseScene.metadata.defaultLevelId`), which is also the initial value of `TokenDocument#level`. A single-Level scene behaves like a v13 scene.

```js
await canvas.scene.createEmbeddedDocuments("Level", [
  {name: "Basement",   elevation: {bottom: -10, top: 0},  background: {src: "worlds/w/basement.webp"}},
  {name: "Ground",     elevation: {bottom: 0,   top: 10}, background: {src: "worlds/w/ground.webp"}},
  {name: "Upstairs",   elevation: {bottom: 10,  top: 20}, background: {src: "worlds/w/upstairs.webp"}}
]);
```

---

## 2. `Level` schema

`BaseLevel.defineSchema()` (`common/documents/level.mjs`, schemaVersion `14.364`):

| Field | Type | Notes |
|---|---|---|
| `_id` | DocumentIdField | |
| `name` | StringField | required, non-blank, text-searchable |
| `elevation.bottom` | NumberField, nullable | initial `0`; `null` means `-Infinity` |
| `elevation.top` | NumberField, nullable | initial `20`; `null` means `+Infinity`. Validated: `bottom <= top` |
| `background.color` | ColorField | initial `#999999` — the canvas clear colour |
| `background.src` | FilePathField `TEXTURE` | virtual, initial `null` |
| `background.tint` | ColorField | initial `#ffffff` |
| `background.alphaThreshold` | AlphaField | initial `0.75` |
| `foreground.src` / `.tint` / `.alphaThreshold` | same as background | |
| `fog.src` | FilePathField `TEXTURE` | the fog overlay image |
| `textures` | SchemaField | `anchorX, anchorY, offsetX, offsetY, fit, scaleX, scaleY, rotation` — applies to both textures |
| `visibility.levels` | SceneLevelsSetField | other Levels drawn underneath while this one is viewed |
| `sort` | IntegerSortField | |
| `flags` | DocumentFlagsField | |

`Level#prepareBaseData` replaces the nullable bounds with infinities and adds a derived `elevation.base`: `elevation.bottom` when finite, otherwise `Math.min(elevation.top, 0)`. `elevation.base` is the zero point the Token HUD uses when a user types an elevation.

Client-side additions (`client/documents/level.mjs`):

| Member | Meaning |
|---|---|
| `index` | integer position, assigned during Scene data preparation |
| `isView` | this Level is the one the canvas is drawing |
| `isVisible` | viewed, or listed in the viewed Level's `visibility.levels` |
| `edges` | lazily-built `CanvasEdges` for this Level |
| `clampElevation(elevation, depth=0)` | clamp a token's elevation into the band, keeping the feet inside |
| `updateRegionShapeConstraints(types)` | recompute Region shape constraints for `CONST.EDGE_RESTRICTION_TYPES` |

`Level#_preCreate` copies `background.color` from `scene.firstLevel` when you do not supply one, so new Levels match the scene.

---

## 3. Scene-side API

| Member | Notes |
|---|---|
| `scene.levels` | the embedded collection; `scene.levels.sorted` / `.reverseSorted` order by `sort` |
| `scene.initialLevel` | getter → the `Level` named by the `initialLevel` schema field, falling back to `firstLevel` |
| `scene.firstLevel` | first created Level. Not the lowest by sort — do not use it as "the ground floor" |
| `scene.shiftX`, `scene.shiftY` | integer canvas offset; replaces `background.offsetX/offsetY` |
| `scene._view` | id of the Level this client is viewing (`null` when the scene is not viewed) |
| `scene.isView` | `!!scene._view` |
| `scene.availableLevels` | `Set<Level>` the current user may view |
| `scene._getAvailableLevels({manager})` | the computation behind it |
| `scene.cycleLevel(direction)` | move one Level up (`1`) or down (`-1`) in `availableLevels`, then `view()` |
| `scene.view({level})` | `SceneViewOptions.level` picks the Level to draw |
| `scene.initializeEdges()` | build the boundary and wall edges; fires the `initializeEdges(scene)` hook |
| `scene.getSurfaces(filter)` | see §7 |
| `scene.testSurfaceCollision(origin, destination, config)` | see §7 |

`_getAvailableLevels`: GMs, and any scene with `tokenVision` off, get every Level. Otherwise the user gets the Levels their OBSERVER-owned tokens stand in. The result is cached in `scene._availableLevels` and cleared on data preparation.

```js
// Which Levels can this user see, lowest first?
[...canvas.scene.availableLevels].map(l => `${l.name} (${l.elevation.bottom}–${l.elevation.top})`);

// Jump to a named Level
const upstairs = canvas.scene.levels.find(l => l.name === "Upstairs");
await canvas.scene.view({level: upstairs.id});
```

### Deprecation shims

`Scene#background`, `#backgroundColor`, `#foreground` and `#foregroundElevation` are getters that read `scene.firstLevel` and log a warning (since 14, until 16). `Scene#fog.exploration` is a data-field shim for `fog.mode`. There are no setters — write to the Level.

```js
// v13
await scene.update({"background.src": path, foregroundElevation: 30});
// v14
await scene.updateEmbeddedDocuments("Level", [
  {_id: level.id, "background.src": path, "elevation.top": 30}
]);
```

`BaseScene._LEVELS_PROPERTY_MAP` is the exact old-key → new-key mapping the shims use. `Scene#_preCreate` reads legacy `background`, `backgroundColor`, `foreground`, `foregroundElevation` and `fog.overlay` out of creation data and folds them into the auto-created default Level, so old creation payloads still work.

---

## 4. `canvas.level`

| Member | Notes |
|---|---|
| `canvas.level` | the `Level` currently drawn, or `null` |
| `canvas.edges` | `canvas.level?.edges ?? null` — a `CanvasEdges`, no longer scene-wide |
| `canvas.inferLevelFromElevation(elevation, {levels})` | best visible Level for an elevation |
| `Canvas._determineInitialLevel(scene, manager)` | which Level id to draw when a Scene is opened |

`inferLevelFromElevation` only returns visible Levels, prefers a Level whose interior contains the elevation over one that merely touches it at a boundary, and falls back to the viewed Level. `AmbientLight` and `AmbientSound` use it to decide which Level a placeable belongs to at a given elevation.

`Canvas._determineInitialLevel` resolves in this order:

1. The `SceneManager#_determineInitialLevel()` override.
2. The last Level the user viewed on that Scene (`scene._viewPosition.level`), if it is still available.
3. `scene.initialLevel`, for a GM.
4. For a player without access to the initial Level, the available Level whose `index` is closest to it.

```js
class TowerManager extends foundry.canvas.SceneManager {
  _determineInitialLevel() {
    return this.scene.levels.find(l => l.name === "Ground")?.id;
  }
  _getAvailableLevels(defaultLevels) {
    if ( game.user.isGM ) return;                  // return nothing to keep default behavior
    return new Set([...defaultLevels].filter(l => l.name !== "Secret Vault"));
  }
}
Hooks.once("init", () => { CONFIG.Canvas.managedScenes[sceneId] = TowerManager; });
```

`_getAvailableLevels` must return a Set sorted in ascending order, or nothing.

---

## 5. Level-aware placeables

`AmbientLight`, `AmbientSound`, `Drawing`, `Note`, `Region`, `Tile` and `Wall` each gained `levels: new fields.SceneLevelsSetField()` — a Set of Level ids, initial `[]`.

`ClientDocumentMixin` (in `client/documents/abstract/canvas-document.mjs`) adds:

| Member | Meaning |
|---|---|
| `doc.viewed` | the parent Scene is viewed and `doc.includedInLevel(scene._view)` |
| `doc.includedInLevel(level)` | `true` when the document has no `levels` field, or an empty `levels`, or the Set holds that id |
| `doc.locatedInLevel(level)` | same as `includedInLevel` by default |

`TokenDocument` overrides both. A Token is *located* only in its own `level`, but it is *included* in any Level whose `visibility.levels` lists the Token's Level — that is how tokens on a lower floor stay visible while you view the floor above.

`PlaceablesLayer#viewedDocuments()` is a generator over `documentCollection` filtered by `doc.viewed`. It replaces `getDocuments()` (deprecated since 14, until 16, returns `Array.from(this.viewedDocuments())`).

```js
// v13
for ( const doc of canvas.tokens.getDocuments() ) { ... }
// v14
for ( const doc of canvas.tokens.viewedDocuments() ) { ... }

// Every wall in the scene, regardless of Level
for ( const wall of canvas.scene.walls ) { ... }

// Put a wall on two Levels only
await canvas.scene.updateEmbeddedDocuments("Wall", [{_id: wall.id, levels: [groundId, upstairsId]}]);
```

`_onUpdate` calls `_refreshViewedState()` whenever `levels` changes, so a placeable appears or disappears without a redraw.

---

## 6. Tokens: `level` and `depth`

Token movement fields (`common/documents/token.mjs`, `#defineMovementFields`) now include:

| Field | Type | Notes |
|---|---|---|
| `level` | DocumentIdField | required, non-nullable, initial `defaultLevel0000` |
| `depth` | NumberField | required, non-nullable, `min: 0`, initial `1` — the token's height in grid units |
| `elevation` | NumberField | unchanged |

`depth` gives the token a head as well as feet. `Level#clampElevation(elevation, depth)` keeps the feet inside the band and the head inside where it fits. `Token#_testSurfaceCollision` tests the head and the feet separately (§7).

The same fields appear on `_movement` waypoints, so a movement plan can change Level mid-path. Moving a token to another Level is a destination change:

```js
// One waypoint, through the movement pipeline
await token.document.move({level: upstairs.id, elevation: 12});
// Several tokens at once
await scene.moveTokens({[token.id]: {destination: {level: upstairs.id}}});
```

The Token HUD has a level control: `TokenHUD#_getLevelChoices()` builds a menu from `scene.levels.reverseSorted`, shown when more than one Level exists. Choosing an entry issues `{destination: {level}}` for each controlled token. The HUD's elevation input is relative to `canvas.level.elevation.base`.

The `ascend` and `descend` keybindings (`core.ascend` / `core.descend`, default `E` and `Q`) move controlled tokens along the elevation axis through `ClientKeybindings.MOVEMENT_DIRECTIONS.ASCEND` / `DESCEND`.

---

## 7. Surfaces

A surface is a horizontal plane at a Region's `elevation.bottom` or `elevation.top` that blocks something. Surfaces come from the `defineSurface` Region behavior (`CONFIG.RegionBehavior.dataModels.defineSurface`):

```js
await RegionDocument.create({
  name: "Ceiling",
  shapes: [{type: "rectangle", x: 0, y: 0, width: 2000, height: 1500}],
  elevation: {bottom: 0, top: 10},
  behaviors: [{type: "defineSurface", system: {
    placement: "top",       // "bottom" | "top" | "both"
    light: true, move: true, sight: true, sound: true,
    occlusion: true, exposure: false, culling: false
  }}]
}, {parent: canvas.scene});
```

`Scene#getSurfaces({type, level, occlusion, exposure, culling})` returns frozen `RegionSurface` records `{key, region, elevation, light, move, sight, sound, occlusion, exposure, culling}` sorted by elevation, cached until `Scene#_invalidateSurfaces()` runs. `type` is an `EdgeRestrictionType` (`CONST.EDGE_RESTRICTION_TYPES = ["light", "darkness", "sight", "sound", "move"]`). A flat Region (`bottom === top`) produces one surface regardless of `placement`.

`Scene#testSurfaceCollision(origin, destination, {type="move", mode="any", side="below", tMin=0, tMax=1, level})` tests a vertical ray:

- `mode: "any"` → boolean; `"all"` → sorted `ElevatedPoint[]`; `"closest"` → `ElevatedPoint | null`.
- `side` decides which way a surface is solid for a ray that starts on it: `"below"` blocks downward, `"above"` blocks upward.
- Both points need an `elevation`. Equal elevations return no collision.

Core uses it for movement (`Token#_testSurfaceCollision`), sound audibility, vision (`DetectionMode`), and occlusion masking.

The `changeLevel` Region behavior (`CONFIG.RegionBehavior.dataModels.changeLevel`, icon `fa-solid fa-stairs`) is the user-facing stair. Its only field is `movementActions`, a Set of `CONFIG.Token.movement.actions` keys (`displace` excluded). When a token moves into a Region that spans more than one Level with a matching action, movement pauses and the owner is prompted to pick a destination Level.

---

## 8. Edges per Level

`Level#edges` is a `CanvasEdges` built with the Level as its owner (`new CanvasEdges(level)`), exposing `edges.level`. `canvas.edges` returns the viewed Level's instance.

`Scene#initializeEdges()` builds inner and outer boundary edges into **every** Level's collection, then calls `wall.initializeEdge()` for each wall, then fires `Hooks.callAll("initializeEdges", scene)`. `Scene#_resetEdges()` clears each Level's edges and re-initializes when the scene is viewed; it runs whenever an embedded collection changes and when Levels are created or deleted.

`CanvasEdges#getEdges(rect, {includeInnerBounds, includeOuterBounds, collisionTest, collisionTestBounds})` is the query API; it computes intersections on demand. `CanvasEdges#initialize` and `#refresh` are deprecated (since 14, until 16) in favour of `Scene#initializeEdges` and `getEdges`.

```js
// v13
canvas.edges.refresh();
// v14 — nothing to do; getEdges recomputes intersections when it needs to
const nearby = canvas.edges.getEdges(bounds, {includeInnerBounds: true});

// Walk every Level's edges
for ( const level of canvas.scene.levels ) {
  for ( const edge of level.edges.values() ) { ... }
}
```

---

## 9. Fog

`Scene#fog` is now `{mode, reset, colors: {explored, unexplored}}`. `fog.mode` takes `CONST.FOG_EXPLORATION_MODES`: `DISABLED 0`, `INDIVIDUAL 1` (default, per-user fog), `SHARED 2` (one exploration shared by everyone). The old boolean `fog.exploration` is a shim.

`FogExploration` gained a `level` field (DocumentIdField, `readonly: false`, initial `null`), so exploration is stored per Level as well as per user and Scene. The fog overlay image moved from `scene.fog.overlay` to `Level#fog.src`.

```js
await scene.update({"fog.mode": CONST.FOG_EXPLORATION_MODES.SHARED});
const fog = await FogExploration.load({scene: scene.id, user: game.user});  // Level comes from scene._view
```

---

## 10. UI

- `LevelConfig` (`foundry.applications.sheets.LevelConfig`, a `DocumentSheetV2`) is the Level sheet; it is registered as the `Level` entry in the default sheet map. `CONFIG.Level` holds only `{documentClass}`.
- `SceneConfig` edits Levels inline; a scene with no Level gets one whose `_id` is `defaultLevelId`.
- Scene navigation shows a level pip strip when `scene.availableLevels` has two or more entries, highest Level at the top, with a pip per connected user viewing that Level (`u.viewedScene`, `u.viewedLevel`). The `cycleLevel` action on the nav calls `scene.cycleLevel(±1)`.
- The Placeables sidebar tab filters entries by Level with `entry.locatedInLevel(level)` and offers `scene.availableLevels` as choices. `PlaceableConfig` offers the same list for the `levels` field.

---

## 11. Hooks

| Hook | Change |
|---|---|
| `canvasTearDown(canvas, options)` | `options` is `{nextScene, nextLevel}` — both `Level|Scene|null` |
| `initializeEdges(scene)` | the argument is the Scene, not the `CanvasEdges` |
| `drawLayer` / `tearDownLayer` / `drawGroup` / `tearDownGroup` | gained an `options` argument |

`canvas.draw()` runs when the Scene changes **or** the Level changes, so `canvasReady`, `canvasTearDown` and the layer hooks now fire on a level switch too. Anything cached in `canvasReady` that depends on the drawn Level must be rebuilt on every fire, not once per Scene.

---

## 12. What this means for a module

- Never assume one Level. Read `canvas.level` for what is drawn and `scene.levels` for the rest.
- Iterate `layer.viewedDocuments()` for what the user sees, and the Scene's embedded collection for everything. `layer.placeables` only holds objects on the viewed Level.
- Store your own Level references as ids, and check `scene.levels.has(id)` before use — a Level can be deleted, in which case the client navigates to `scene.initialLevel`.
- Anything that measured or drew against `scene.background` or `scene.foregroundElevation` reads a Level now. Pick deliberately between `canvas.level` (what is drawn) and `scene.firstLevel` (what the shim returns).
- Sight, sound and movement blocking are split across `Level#edges` (vertical walls) and Region surfaces (horizontal planes). A collision test that only walks edges misses floors and ceilings.
- Place your canvas objects with a `levels` Set if they belong to specific floors; leave it empty for scene-wide overlays.

---

## Pitfalls

- `scene.firstLevel` is creation order, not sort order. In a multi-Level scene it is rarely the one you want; the deprecation shims use it anyway.
- `elevation.bottom` and `elevation.top` are `null` in source data and `±Infinity` after preparation. Compare against the prepared document, not `_source`.
- An empty `levels` Set means "all Levels", not "no Levels". `includedInLevel` returns `true` for it.
- `Token#includedInLevel` and `#locatedInLevel` differ. Filtering tokens by `includedInLevel` picks up tokens from Levels listed in `visibility.levels`.
- `canvas.edges` changes identity on every level switch. Do not hold a reference across `canvasTearDown`.
- `testSurfaceCollision` needs `origin.elevation !== destination.elevation`. A purely horizontal move never hits a surface — that is what edges are for.
- `scene.availableLevels` is cached per user in `_availableLevels` and reset during data preparation. It is not the same for the GM and a player.
- `TokenDocument#level` is `readonly: false` but changing it through `update` skips the movement pipeline. Use `token.move({destination: {level}})` when you want the region and movement events to fire.
- `Scene#createThumbnail({img})` is deprecated. To render a thumbnail of a different texture, clone the Scene with changed Level textures and call `createThumbnail` on the clone.
