# Adventure Documents

`Adventure` is Foundry's official document type (since v10) for packaging pre-made content — the entire setup of a published module: scenes, actors, items, journal entries, roll tables, macros, playlists, cards, and the folder structure that organizes them. One Adventure document → one click to import everything into a world.

This is the right tool for shipping campaign modules, one-shot adventures, encounter packs, and bestiaries. Use it instead of asking users to drag 47 individual documents from your compendium.

---

## What an Adventure Contains

An Adventure document holds collections of every embedded document type:

| Field | Holds |
|---|---|
| `actors` | Pre-built characters and NPCs |
| `combats` | Pre-rolled combat encounters (rare) |
| `items` | Equipment, spells, consumables not on actors |
| `scenes` | Maps with levels, walls, lights, sounds, tokens, regions |
| `journal` | JournalEntry documents (lore, handouts, GM notes) |
| `tables` | RollTable documents |
| `macros` | Macro documents |
| `cards` | Cards stacks (decks, hands, piles) |
| `playlists` | Playlist documents (BGM, ambience) |
| `folders` | Folder hierarchy that organizes the above |

Plus metadata:

| Field | Purpose |
|---|---|
| `name` | Display name in the import dialog |
| `img` | Cover image |
| `description` | HTML overview shown to the user before import |
| `caption` | Short HTML subtitle |
| `folder`, `sort` | Placement inside the compendium |
| `flags` | Module-namespaced metadata, including update notes |

There is no `version` field on the schema. Track adventure revisions in `flags.<moduleId>`.

**Changed in v14:** `caption` joined the compendium index (`compendiumIndexFields` is now `_id, name, caption, description, img, sort, folder, flags.core.sheetClass`). The importer can therefore show name, cover, caption and description straight from the index, before the full document loads.

---

## Scene Content in v14

Two v14 changes affect what a Scene carries into an Adventure.

- **Levels.** Scene background, foreground, foreground elevation and background colour moved onto the embedded `Level` document, and the export carries `scene.levels` with everything else. Placeables gained a `levels` set naming the Levels they appear on; an empty set means every level. Tokens also have `level` and `depth`. Author content on the level you mean — an adventure whose lights all sit on the wrong Level looks broken on import. See `foundry-vtt-module-dev/references/scene-levels.md`.
- **No MeasuredTemplates.** `Scene#templates` is deprecated and a Scene no longer embeds template documents. Pre-placed area effects belong in `scene.regions` with a shape (`circle`, `cone`, `emanation`, ...). v13 adventures keep their templates through the shim until v16; new content should ship Regions. See `foundry-vtt-module-dev/references/measured-templates.md`.

---

## Creating an Adventure In-World

The simplest authoring flow uses Foundry's UI:

1. Build your content in a world: scenes, actors, items, etc.
2. Organize it into folders (Foundry expects folders to be the structural skeleton).
3. Right-click a folder → **Create Adventure**, or open the Compendium sidebar and click **Create Adventure**.
4. Drag the source folders into the Adventure dialog. Foundry collects every document inside them.
5. Set the `name`, `img`, `caption` and `description`. Save.

The result is a single `Adventure` document. To ship it, drag it into a compendium pack of `type: "Adventure"` (see below) and export the world.

---

## Shipping in a Compendium Pack

Declare an Adventure pack in `module.json` (or `system.json`):

```json
{
  "packs": [
    {
      "name": "starter-adventure",
      "label": "The Lost Mines",
      "path": "packs/starter-adventure",
      "type": "Adventure",
      "system": "dnd5e",
      "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" }
    }
  ]
}
```

**Changed in v14:** `name` must match `[A-Za-z0-9_-]` — the slugify shim that used to fix loose names is gone, and duplicate pack names or paths now throw at load. Declare `"system"` on any Adventure pack that carries actors or items: an Adventure read from a system-less pack drops its `actors`, `items`, and folders of any type in `CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES` (`ActiveEffect`, `Actor`, `Item`).

Pack files use Foundry's LevelDB format under `packs/<name>/`. Compile from JSON sources via the official CLI:

```bash
fvtt package workon my-module
fvtt package pack --type Module \
  --in source/starter-adventure \
  --out packs/starter-adventure
```

The reverse (`fvtt package extract`) gives you JSON sources you can version-control. Keep the JSON in `source/` and gitignore `packs/`; rebuild on release.

---

## Programmatic Import

Once a user enables your module, they double-click the Adventure in the compendium browser to launch `AdventureImporterV2`, the sheet registered for `Adventure`. Foundry's UI handles the full flow.

**Changed in v14:** the importer opens from the compendium *index* and loads the full Adventure in the background. The first frame shows name, cover, caption and description with a spinning submit button; the content list and the enabled button appear once the document arrives. If you subclass `AdventureImporterV2`, `this.adventure` is the loaded document when available and the index-backed stub before that — read it, not `this.document`.

For programmatic imports (your own UI, automated post-install setup):

```javascript
const pack = game.packs.get("my-module.starter-adventure");
const adventure = await pack.getDocument("adventureDocId");

// Default — imports everything, with the overwrite-warning dialog
await adventure.import();

// Selective: importFields names the schema fields to import, "all" means everything
await adventure.import({
  importFields: ["actors", "items", "journal", "folders"],  // scenes and the rest skipped
  dialog: false,                                            // no confirmation prompt
  postImport: [async function (result, options) { /* awaited after the writes land */ }],
});

// Preview before import
const data = await adventure.prepareImport({ importFields: [] });
// data.toCreate / data.toUpdate are keyed by DOCUMENT NAME, not by adventure field
console.log(`Will create ${data.toCreate.Actor?.length ?? 0} actors`);
console.log(`${data.documentCount} documents in total`);
```

`importFields` accepts the Adventure's own field names (`actors`, `combats`, `items`, `journal`, `scenes`, `tables`, `macros`, `cards`, `playlists`, `folders`). Empty or `["all"]` means everything. When you filter, `folders` is trimmed to the types you kept.

`prepareImport()` is critical for any custom UI — it lets you show the user what will happen before they commit. Note the key shape: `toCreate.Actor`, `toCreate.JournalEntry`, `toCreate.RollTable`, not `toCreate.actors`. `importContent(data)` runs the writes and returns `{ created, updated, importedTime }`, likewise grouped by document name.

---

## Quickstart Modules

**New in v14:** a module can offer its adventures on Foundry's world-creation screen. The GM picks the module, Foundry creates the world and imports the adventure in one step.

```json
{
  "id": "my-module",
  "quickstart": {
    "adventures": {
      "dnd5e": { "uuid": "Compendium.my-module.starter-adventure.Adventure.abc123def456" },
      "pf2e":  { "uuid": "Compendium.my-module.pf2e-adventure.Adventure.def456abc123" }
    },
    "postImport": true,
    "world": {
      "background": "modules/my-module/art/world-bg.webp",
      "cover": "modules/my-module/art/world-cover.webp",
      "description": "<p>A starter adventure for levels 1-3.</p>"
    }
  }
}
```

- Keys under `adventures` are **system ids** — one adventure per system your module supports. Each entry carries the adventure's full compendium `uuid`. Foundry offers the entry matching the system the GM picked.
- Omit `adventures` entirely and Foundry derives the supported systems from your `"type": "Adventure"` packs that declare a `system`.
- `postImport: true` marks the adventure as needing post-import work. Non-GM players cannot join the world until that work finishes.
- Every `world` key is optional. Background and cover fall back to the first adventure's image, description to its description.

The world records each import in the `core.adventureImports` setting, keyed by adventure UUID: `{ coreVersion, systemVersion, moduleVersion, importedTime, options, quickstart }`. Read it to tell a fresh quickstart world from one the GM imported into by hand, and to see which version of your module produced the content.

Since 14.359 a world created through quickstart records the module as a required relationship with `compatibility.minimum` set to the module version at creation time. Version quickstart content the way you version any shipped data.

---

## Versioning & Updates

Adventures support **re-import** on new releases. The flow:

1. Record the release in `flags.<moduleId>.version` and put change notes in `flags.<moduleId>.updateNotes`. The Adventure schema has no `version` field.
2. User imports the updated adventure → `prepareImport` partitions each collection by whether the world already holds that `_id` → existing documents land in `toUpdate`, new ones in `toCreate`. With `dialog: true` (the default) the importer warns before overwriting.

Best practice: stable IDs for everything in the adventure. Use `keepId: true` when authoring or rebuild from JSON sources where IDs are deterministic.

To see what a re-import would touch, without loading the whole document:

```javascript
const pack = game.packs.get("my-module.starter-adventure");
const stub = Adventure.fromIndex(advId, pack);     // index-backed, cheap: name, img, caption
const adventure = await pack.getDocument(advId);   // full document, needed for prepareImport

const { toCreate, toUpdate, documentCount } = await adventure.prepareImport({ importFields: [] });
console.log(`${Object.values(toUpdate).flat().length} of ${documentCount} documents already exist`);
```

`core.adventureImports` also records the last import per adventure UUID, including the module version that produced it — enough to decide whether an update is worth prompting for.

---

## Embedded Document Mutation Before Import

Sometimes you want to transform Adventure content for the importing world (apply translations, swap art packs, scale encounters). Hook `preImportAdventure`:

```javascript
Hooks.on("preImportAdventure", (adventure, options, toCreate, toUpdate) => {
  // Keys are document names: Actor, Item, Scene, JournalEntry, RollTable, Macro, ...
  for (const actor of toCreate.Actor ?? []) {
    actor.name = game.i18n.localize(`MY_MODULE.NPC.${actor.flags["my-module"]?.key}`) ?? actor.name;
    // Swap art if a Token Art module is present
    if (game.modules.get("my-art-pack")?.active) {
      actor.img = actor.img.replace("/default/", "/highres/");
    }
  }
  // Returning false cancels the import entirely
});
```

Mutate the `toCreate` / `toUpdate` data objects in place — Foundry imports the modified versions. The hook is synchronous, so don't `await` inside it; pre-resolve any async data in `ready`. `importAdventure` fires afterwards with `(adventure, options, created, updated)`, the created and updated documents grouped the same way.

The second argument is the `AdventureImportOptions` object, not form data — the JSDoc name `formData` is historical. It carries `dialog`, `importFields`, `preImport` and `postImport`. For awaited work, push a callback onto `options.postImport` from this hook: each is called as `fn.call(adventure, result, options)` after the writes land. `options.preImport` callbacks run the same way with `(importData, options)`, after the hook and before the overwrite warning.

---

## Folder Structure

Adventures rely on folders to organize content for the user. Include a complete folder tree:

```javascript
// Inside the adventure document
folders: [
  { _id: "f001", name: "NPCs", type: "Actor", color: "#7a4" },
  { _id: "f002", name: "Items", type: "Item", color: "#a47" },
  { _id: "f003", name: "Maps", type: "Scene" },
  { _id: "f004", name: "Handouts", type: "JournalEntry", folder: null },
]
```

Each document references its folder via `folder: "f001"`. Without folders, everything imports into the root sidebar — workable but ugly for large adventures.

---

## Pitfalls

1. **Duplicate IDs across re-import** — without stable IDs, every import creates duplicates. Use `keepId: true` when authoring or maintain JSON sources with explicit `_id` fields.
2. **Scene thumbnails** — scenes embed thumbnail data URLs. Re-generating these is expensive and bloats the pack. Pre-bake during authoring with `scene.createThumbnail()`. **Changed in v14:** it takes `{ level, width, height, format, quality }` and renders the Level you name (the initial Level by default). Passing `img` is deprecated — clone the Scene and change the Level's textures instead.
3. **Compendium-internal references** — actor sheets that reference compendium items via UUID survive import; those that reference world-only documents break. Audit references before shipping.
4. **Macro source code** — macros are stored as plain JS strings. They run with the importing user's permissions, not yours. Avoid macros that assume your module's API exists; check `game.modules.get("my-module")?.active` first.
5. **Playlist file paths** — playlists reference audio files by path. If your module ships the audio, paths must be relative to the module (`modules/my-module/audio/...`). External paths break for users without those files.
6. **Forgetting `prepareImport`** — the user expects a preview screen. Custom import flows that skip it feel hostile.
7. **Adventure modifying world settings** — Adventures only import documents. They can't change `game.settings`, register sheets, or run code at import time. Side effects belong in your module's `ready` hook with a "first-run" flag.
8. **Permission inheritance** — documents inside an Adventure inherit the Adventure's compendium ownership at import time, then become world documents with their own ownership. Set sensible defaults at authoring time.
9. **Updating without backups** — re-importing overwrites user edits. The Foundry UI warns; custom import flows must too. Show what's about to change.
10. **Reading `toCreate.actors`** — the key is the document name (`toCreate.Actor`). The adventure *field* is `actors`; the prepared data is keyed by class.
11. **Passing collection booleans to `import()`** — `import({ actors: true })` does nothing. Use `importFields: ["actors"]`.
12. **Shipping MeasuredTemplates** — deprecated in v14 and gone in v16. Author area effects as Regions so the adventure survives the removal.
