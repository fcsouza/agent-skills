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
| `scenes` | Maps with walls, lights, sounds, tokens, regions |
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
| `caption` | Short subtitle |
| `version` | Adventure-internal version (independent of module version) |
| `flags` | Module-namespaced metadata, including update notes |

---

## Creating an Adventure In-World

The simplest authoring flow uses Foundry's UI:

1. Build your content in a world: scenes, actors, items, etc.
2. Organize it into folders (Foundry expects folders to be the structural skeleton).
3. Right-click a folder → **Create Adventure**, or open the Compendium sidebar and click **Create Adventure**.
4. Drag the source folders into the Adventure dialog. Foundry collects every document inside them.
5. Set the `name`, `img`, `description`, and `version`. Save.

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
      "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" }
    }
  ]
}
```

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

Once a user enables your module, they double-click the Adventure in the compendium browser to launch the import dialog. Foundry's UI handles the full flow.

For programmatic imports (your own UI, automated post-install setup):

```javascript
const pack = game.packs.get("my-module.starter-adventure");
const adventure = await pack.getDocument("adventureDocId");

// Default — imports everything
await adventure.import();

// Selective — import only some collections
await adventure.import({
  actors: true,
  items: true,
  scenes: false,    // skip scenes
  journal: true,
  tables: false,
  macros: false,
  cards: false,
  playlists: false,
  folders: true,
});

// Preview before import
const data = await adventure.prepareImport();
// data.toCreate is what would be created (grouped by collection)
// data.toUpdate is what would be updated (existing matches by ID)
console.log(`Will create ${data.toCreate.actors?.length ?? 0} actors`);
```

`prepareImport()` is critical for any custom UI — it lets you show the user what will happen before they commit.

---

## Versioning & Updates

Adventures support **re-import** on new releases. The flow:

1. Bump `version` on the Adventure document for the new release.
2. Add HTML to `flags.<moduleId>.updateNotes` describing what changed.
3. User imports the updated adventure → Foundry detects existing documents (by `_id`) → prompts to update vs skip vs create-new per-document.

Best practice: stable IDs for everything in the adventure. Use `keepId: true` when authoring or rebuild from JSON sources where IDs are deterministic.

To detect previously-imported content:

```javascript
const previous = await Adventure.fromUuidSync(`Compendium.${pack.collection}.${adv.id}`);
if (previous) {
  const existingScenes = previous.scenes.filter(s => game.scenes.has(s._id));
  // Inform the user before re-importing
}
```

---

## Embedded Document Mutation Before Import

Sometimes you want to transform Adventure content for the importing world (apply translations, swap art packs, scale encounters). Hook `preImportAdventure`:

```javascript
Hooks.on("preImportAdventure", (adventure, formData, toCreate, toUpdate) => {
  // toCreate.actors is an array of Actor data objects ready to be inserted
  for (const actor of toCreate.actors ?? []) {
    actor.name = game.i18n.localize(`MY_MODULE.NPC.${actor.flags["my-module"]?.key}`) ?? actor.name;
    // Swap art if a Token Art module is present
    if (game.modules.get("my-art-pack")?.active) {
      actor.img = actor.img.replace("/default/", "/highres/");
    }
  }
});
```

Mutate the `toCreate` / `toUpdate` data objects in place — Foundry imports the modified versions. Don't `await` from this hook (it's synchronous); pre-resolve any async data in `ready`.

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
2. **Scene thumbnails** — scenes embed thumbnail data URLs. Re-generating these is expensive and bloats the pack. Pre-bake during authoring with `scene.createThumbnail()`.
3. **Compendium-internal references** — actor sheets that reference compendium items via UUID survive import; those that reference world-only documents break. Audit references before shipping.
4. **Macro source code** — macros are stored as plain JS strings. They run with the importing user's permissions, not yours. Avoid macros that assume your module's API exists; check `game.modules.get("my-module")?.active` first.
5. **Playlist file paths** — playlists reference audio files by path. If your module ships the audio, paths must be relative to the module (`modules/my-module/audio/...`). External paths break for users without those files.
6. **Forgetting `prepareImport`** — the user expects a preview screen. Custom import flows that skip it feel hostile.
7. **Adventure modifying world settings** — Adventures only import documents. They can't change `game.settings`, register sheets, or run code at import time. Side effects belong in your module's `ready` hook with a "first-run" flag.
8. **Permission inheritance** — documents inside an Adventure inherit the Adventure's compendium ownership at import time, then become world documents with their own ownership. Set sensible defaults at authoring time.
9. **Updating without backups** — re-importing overwrites user edits. The Foundry UI warns; custom import flows must too. Show what's about to change.
