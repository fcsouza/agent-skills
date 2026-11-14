---
name: game-save-load
description: >-
  Saving and loading a browser game's progress: where the save lives (browser storage or the server), a versioned save format with migrations and validation, atomic writes, slots and backups, autosave, cross-device conflicts and corruption checks. Use when a game needs save slots, autosave or cloud saves, when players lose progress or saves break after a patch, or when two devices overwrite each other's progress.
---

# Game save and load

Target stack: browser client, Bun server, Postgres through Drizzle 0.45, Redis. Database setup and migrations come from `postgres-game-schema`; this skill adds only the save table and the save rules.

## Decide where the save lives

| The save holds | Store it | Why |
|---|---|---|
| Currency, items, ranked progress, anything another player or the shop cares about | Normalized server tables (`postgres-game-schema`), written by server logic | The client is under the player's control. The server decides and stores state; the client sends inputs only. |
| Single-player progress the player would be upset to lose | Server save slot (`boilerplate/server-save.ts`) plus a local copy | Browser storage can be deleted without asking (next section). The server copy also roams between devices. |
| Settings, key bindings, a guest session before sign-in | Browser only (`boilerplate/browser-save-store.ts`) | Losing it costs little. |

Rules that follow from the table:

- A server save slot stores state the server does not need to trust. Never accept currency, items or rewards inside an uploaded save; the server computes those itself. Keep them out of the payload, so the slot never becomes one JSON blob for all game state.
- Redis is not the save of record. With RDB snapshots alone Redis can lose the last minutes of writes; with AOF at the default fsync of every second, about one second. Write durable progress to Postgres. Redis holds live session state (`redis-game-patterns`).
- The player id on a server save comes from the session (`betterauth-integration`), never from the request body.
- Client tamper protection (obfuscation, signed saves) does not replace this design. For an offline single-player game, accept that a local save can be edited.

## Browser storage

- Use IndexedDB for saves. Not localStorage: it is synchronous and blocks the main thread, holds strings only, is capped at about 5 MiB per origin, and does not exist in workers.
- Browser storage is best-effort. Under storage pressure the browser evicts the least recently used origins, and it deletes all of an origin's data at once (IndexedDB, Cache API and the rest). A backup slot in the same origin dies with the main slot.
- Safari deletes all script-writable storage of a site after seven days of Safari use with no interaction on that site. A web app added to the home screen keeps its own counter.
- Call `navigator.storage.persist()` when the player first saves, inside the click handler of the save button. Chrome grants or refuses by engagement without a prompt; Firefox shows a permission prompt. A persistent origin is not evicted under pressure.
- Quotas differ: Chromium allows up to 60% of the disk per origin; Firefox best-effort storage, 10% of the disk or 10 GiB per site group; Safari about 60% for browser apps and about 15% for embedded web views. Plan saves in kilobytes, not gigabytes.
- Every write can throw `QuotaExceededError`. Catch it, tell the player, and offer to delete old slots or export the save.
- localStorage access throws `SecurityError` when the player blocks site data (often by blocking cookies) and on `file:` and `data:` origins. Wrap it if you use it for settings.
- In private browsing, localStorage is cleared when the last private tab closes and IndexedDB lives in memory. Tell the player progress will not survive; signing in and saving to the server is the fix.
- IndexedDB store and index changes happen only in `onupgradeneeded`. A tab still on the old version blocks the upgrade until it closes its connection, so handle `onblocked` and close the database in `onversionchange` (as `openSaveDb` does). Store layout versions and save payload versions are separate numbers.
- An export file is optional. `showSaveFilePicker()` needs HTTPS and a click, and MDN marks it experimental and not Baseline: check the compatibility table and fall back to a download link.

## Save format

Copy `boilerplate/save-envelope.ts`. Each save is an envelope: `format`, `version`, `savedAt`, `playedMs`, `sha256`, and the payload as a JSON string. `loadSave` reads an envelope; `migrateAndValidate` runs the same version window, migrations and validation on bare data, such as a server row.

1. Write the current version on every save. Upgrades are one-way: once a save is migrated and written, the old build cannot read it.
2. Keep a bounded window. `minLoadable` is the oldest version this build migrates; older saves get a clear "too old" message, not a guess. Raise it when old migrations cost more than they are worth.
3. Migrations go from version n to n + 1, one function each. A save at version 2 in a build at version 5 runs steps 2, 3 and 4 in order. Never edit a shipped step; add a new one.
4. Validate after migrating, against the current shape only. `loadSave` takes a `validate` function shaped like a Zod `.safeParse()`, which returns a result instead of throwing; a hand-written type guard works too. For Zod itself, see https://zod.dev/basics. Validate before writing as well: `createSave` refuses data that would fail to load.
5. Treat key names like protobuf field numbers. A removed key is never reused for a new meaning. A new key gets a default when an old save lacks it, in the migration step that adds it.
6. Store plain data only. JSON carries no engine types (vectors, colours) and, in TypeScript, no `Map`, `Set`, `Date`, `BigInt` or class instances; convert them to numbers, arrays and strings. Plain data also matches what `game-state-sync` already requires of live state.
7. Store the seed plus the player's changes, not generated content. `procedural-gen` has the rule (store what the player changed, regenerate what the player only observes) and the table shapes; store the generator version beside the seed.
8. Save and load must round-trip: saving, quitting and loading must not change anything the player can observe. Test it as `load(save(state))` equals `state` for states from real play.

## Write atomically

- Browser: one IndexedDB `readwrite` transaction per save. It commits all its requests or, on abort, rolls all of them back. `writeSlot` moves the current save to `<slot>:backup` and writes the new one in the same transaction. Firefox can fire `complete` before the data reaches the disk, which is one more reason to keep the backup.
- Tabs: two tabs of the game can save at once. `writeSlot` takes a Web Lock named after the slot, so writes queue across tabs of the origin.
- Server: one Postgres transaction per save. Use a driver with interactive transactions (postgres-js, node-postgres); Drizzle 0.45's neon-http driver throws on `db.transaction`. A committed transaction is written to permanent storage before the commit is reported. `saveToSlot` locks the row with `SELECT ... FOR UPDATE`, copies the old version into `save_slot_history`, updates the slot and prunes old history, all in one transaction.
- Files (Bun tools, a desktop wrapper): never overwrite the live save in place. Write a temporary file, close it, then rename it over the old one. POSIX `rename` keeps the target name pointing at either the old or the new file throughout. Bun's file I/O docs do not say that `Bun.write` is atomic, so do not assume it.
- One save at a time per player and slot. Serialize from a consistent snapshot of game state, not from objects the game loop is still changing. On the client, take the snapshot first, then write.

## Slots and backups

- Give the player named slots plus one autosave slot. Autosave never writes over a manual slot.
- Keep the previous version of every slot: the `:backup` key in the browser, the last five rows of `save_slot_history` on the server (`KEEP_HISTORY`). On load, if the current save fails `loadSave`, try the backup and tell the player which save was restored.
- Keep the pre-migration copy until the migrated save has loaded and validated.
- Back up the database itself as your Postgres host describes. Slot history protects against bad saves, not against losing the database.

## When to save

- Autosave on `visibilitychange` when `document.visibilityState` becomes `hidden`. It is the last event a page can rely on. `unload` does not fire on mobile when the player closes the tab from the tab switcher or closes the browser. `autosaveOnHide` wires this.
- Add a `beforeunload` listener only while there are unsaved changes, and remove it after saving. Attached all the time, it hurts performance and the back/forward cache.
- On load, check `document.wasDiscarded`: the browser may have discarded the page to save memory, and the game should restore from the last save.
- Save at checkpoints and on a timer as well. Load the latest save when the game starts or resumes, and save at a steady rate: that cuts cross-device conflicts.

## Cross-device conflicts

Last write wins erases progress. Use a revision check instead:

1. The client loads a slot and keeps its `revision`.
2. On save it sends the revision it loaded (as HTTP does with `If-Match` and an ETag). `saveToSlot` updates only if the stored revision still matches and returns `conflict` with the server save's metadata otherwise. Answer the client with 409 or 412.
3. On conflict, show both saves side by side with save time and played time, and let the player choose. Never pick for them silently. Keep this device's save: send it again with `expectedRevision` set to the `server.revision` from the conflict result. Keep the server's save: call `loadSlot` and drop the local one.
4. When a guest who played locally signs in to an account that already has server progress, do not overwrite either one automatically. Show both and let the player choose.

## Corruption

- `loadSave` checks a SHA-256 digest of the exact payload string before parsing (`crypto.subtle.digest`, secure contexts only). A mismatch means damage in storage or transfer; fall back to the backup.
- The digest is for accidents. The player can recompute it, so it is not tamper protection.
- The server row needs no digest: Postgres handles its own durability, and the payload sits in `jsonb`, whose stored form differs from the client's string.

## Platform rules

Only where the game ships there:

- Steam: Auto-Cloud syncs listed folders at launch and exit with no code; set a per-user byte and file-count quota. Keep machine-specific settings (video) out of the cloud, and keep fast-changing and static data in separate files. Players can turn Steam Cloud off, so saving must work without it.
- Xbox (XR-052): saves belong to the signed-in user, must not depend on add-on content or local storage, must roam, and the title must not cause unintentional data loss. A listed failure: cloud saves not recognised on first launch, then overwritten on the second device. The same rules make a sound browser policy.

## Procedure

1. Sort every piece of state into the table in "Decide where the save lives". Remove valued state from the save payload.
2. Copy `boilerplate/save-envelope.ts`. Define the save type, its validator, `current = 1`, `minLoadable = 1`.
3. Browser: copy `boilerplate/browser-save-store.ts`. Call `requestPersistence` on the first manual save; wire `autosaveOnHide`; catch `QuotaExceededError`.
4. Server: copy `boilerplate/server-save.ts`. Add `save_slots` and `save_slot_history` to the schema module with a foreign key from `player_id` to `players.id`, and generate the migration with drizzle-kit. Save route: player id from the session, `loadSave` on the uploaded envelope, `saveToSlot` with the migrated data and `formatVersion = spec.current`, 409 on conflict. Load route: `loadSlot`, then `migrateAndValidate(spec, row.formatVersion, row.payload)`.
5. Build the conflict screen before shipping cross-device saves.
6. Add a round-trip test, and a test that loads one saved fixture of every version from `minLoadable` up.
7. For every change to the save type: bump `current`, add the migration step, add a fixture.

## Pitfalls

- **Browser-only save lost to eviction.** A full disk, or a week away from the game in Safari, wipes the whole origin. Request persistence and keep a server copy or an export. Sources: MDN storage quotas page, WebKit blog.
- **Uncaught `QuotaExceededError`.** The save silently fails. Catch every write. Source: web.dev storage article.
- **Overwriting in place.** A crash mid-write leaves neither the old save nor the new one. Use one transaction, or temp file plus rename. Source: Microsoft GDK save walkthrough.
- **Saving while another operation is in progress.** In Rust, a workbench bug stopped servers from saving when a player used a workbench during an autosave window of about five seconds; affected servers were wiped. Snapshot state before serializing, and test saving while the game is busy. Source: Facepunch devblog 185. Separately, never run two saves of the same slot at once (the Web Lock and the row lock do this).
- **Patch breaks old saves.** Mimimi found that renamed compiler-generated classes broke saves in Shadow Gambit, and ran a tool that warned each programmer when save-load had not been tested for a few minutes. Keep version fixtures in CI. Source: Game Developer deep dive.
- **Downgrade expected.** A migrated save cannot go back to the old build (Factorio says so of its 2.1 saves). Keep the pre-migration copy. Source: Factorio FFF-444.
- **Silent overwrite across devices.** XR-052 lists it as a certification failure; Google warns against overwriting cloud progress when a guest account links. Use the revision check and let the player choose. Sources: XR-052, Play Games saved games.
- **Saving on `unload`.** It does not fire on mobile. Save on `visibilitychange`. Source: Chrome Page Lifecycle article.
- **Redis as the only copy.** Covered in `redis-game-patterns`.

## Files

- `boilerplate/save-envelope.ts`: copy when defining the save format. Envelope type, `createSave`, `loadSave` (digest check, then `migrateAndValidate`: version window, migration chain, validation) and an example spec with one migration.
- `boilerplate/browser-save-store.ts`: copy when the game saves in the browser. IndexedDB open with upgrade handling, `readSlot`, `writeSlot` (one transaction with backup, under a Web Lock), `requestPersistence`, `autosaveOnHide`.
- `boilerplate/server-save.ts`: copy when saves live on the server. `save_slots` and `save_slot_history` tables, `saveToSlot` with the revision check and history, `loadSlot`, `listSlotHistory`. Takes the database first (`GameDb`), like `postgres-game-schema`.
- `references/sources.md`: read when checking where a claim comes from.

## Related skills

- `postgres-game-schema`: table conventions, valued state, drizzle-kit migrations.
- `game-state-sync`: live replication between server and clients; this skill covers storage only.
- `redis-game-patterns`: live state, and why Redis is not the record.
- `procedural-gen`: seed plus changes, generator versions.
- `betterauth-integration`: the session that supplies the player id.
