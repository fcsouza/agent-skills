# Permissions & Ownership

Foundry's permission system has **two independent dimensions**: a user's **role** (what they're allowed to do across the world) and a document's **ownership** (who can see and edit that specific document). A user can edit a document only if both checks pass.

Most "non-GM can't update document" bugs come from misreading one of these dimensions. This reference covers the model end-to-end.

---

## The Two-Dimension Model

```
                        Allowed?
                           │
              ┌────────────┴────────────┐
              │                         │
        Role check                Ownership check
        (game-wide)               (per-document)
              │                         │
   USER_ROLES.PLAYER         OWNERSHIP_LEVELS.OWNER
   USER_ROLES.GAMEMASTER     OWNERSHIP_LEVELS.OBSERVER
   ...                       ...
```

A GM (`USER_ROLES.GAMEMASTER`) bypasses ownership checks for most documents — they can edit anything by virtue of role. A player needs **both** the right role and explicit ownership on the document.

---

## User Roles

Five roles, increasing in power. Stored on `User.role` as an integer.

```javascript
CONST.USER_ROLES = {
  NONE: 0,         // Banned / no access
  PLAYER: 1,       // Default for new users
  TRUSTED: 2,      // Can use restricted features (e.g., create their own actors if enabled)
  ASSISTANT: 3,    // Junior GM — can do most GM actions
  GAMEMASTER: 4,   // Full control
};
```

Check a role:

```javascript
// Exact match
if (user.role === CONST.USER_ROLES.GAMEMASTER) { /* ... */ }

// "At least this role" — most common
if (user.hasRole("ASSISTANT")) { /* ... */ }
if (user.hasRole(CONST.USER_ROLES.TRUSTED)) { /* ... */ }

// Strict equality variant
user.hasRole("PLAYER", { exact: true });  // PLAYER but not TRUSTED+
```

`user.isGM` is **not** `role === GAMEMASTER`. It is `hasRole(ASSISTANT)` — true for assistants and full GMs alike. That is usually what you want, because assistants are meant to run most GM features. When you need a full GM and nothing less, compare the role directly:

```javascript
if (user.role === CONST.USER_ROLES.GAMEMASTER) { /* full GM only */ }
```

---

## Ownership Levels

Five levels, applied per document. Stored on `Document.ownership` as a record `{ default: level, [userId]: level }`.

```javascript
CONST.DOCUMENT_OWNERSHIP_LEVELS = {
  INHERIT: -1,     // Embedded docs only: defer to the parent's ownership
  NONE: 0,         // Cannot see the document
  LIMITED: 1,      // Can see name + image only (limited sheet)
  OBSERVER: 2,     // Can read but not edit
  OWNER: 3,        // Full read + edit
};
```

The `default` level applies to every user not explicitly listed. Per-user overrides (`{ [userId]: 3 }`) raise or lower a specific user's access.

```javascript
// Anyone can see the name; player abc has full edit access
actor.ownership = {
  default: 1,            // LIMITED for everyone else
  "abc123userId": 3,     // OWNER for this player
};
```

---

## `testUserPermission`

The single most important method for permission checks:

```javascript
document.testUserPermission(user, level, { exact = false } = {})
```

- `level` — `OWNERSHIP_LEVELS` value (or string name `"OWNER"`)
- `exact` — if `true`, requires that exact level; if `false` (default), requires AT LEAST that level

```javascript
// Can this user edit?
if (actor.testUserPermission(game.user, "OWNER")) { /* show edit UI */ }

// Can this user even see the sheet?
if (actor.testUserPermission(game.user, "OBSERVER")) { /* show sheet */ }

// Strict OBSERVER (no OWNERs allowed) — rare, usually you want >= OBSERVER
actor.testUserPermission(game.user, "OBSERVER", { exact: true });
```

GM users always pass non-`exact` checks regardless of the document's ownership map.

---

## `canUserModify`

Higher-level permission check that combines role + ownership for **mutations**:

```javascript
document.canUserModify(user, action, data?)
```

- `action` — `"create"` | `"update"` | `"delete"`
- `data` — optional changes object; some Documents (e.g. Item, ActiveEffect) have field-level permission rules that depend on what's being changed

```javascript
if (actor.canUserModify(game.user, "update", { name: "New Name" })) {
  await actor.update({ name: "New Name" });
}
```

`canUserModify` reads `DocumentClass.metadata.permissions[action]` and dispatches on what it finds:

1. A function — a class-specific test, called with `(user, doc, data)`. Region and ActiveEffect use these; see below.
2. A `USER_PERMISSIONS` id (e.g. `"NOTE_CREATE"`) — delegates to `user.hasPermission`.
3. A `USER_ROLES` name — delegates to `user.hasRole`.
4. A `DOCUMENT_OWNERSHIP_LEVELS` name (e.g. `"OWNER"`) — delegates to `testUserPermission`.

Anything else denies. Use this in UI code to gate buttons before letting the user attempt an operation that will fail.

---

## Granular User Permissions (`USER_PERMISSIONS`)

Beyond roles, Foundry has a per-permission system for finer control. A GM assigns each permission to a set of roles in **Configure Permissions**.

The v14 permission ids:

```javascript
ACTOR_CREATE      BROADCAST_AUDIO   BROADCAST_VIDEO   CARDS_CREATE
DRAWING_CREATE    FILES_BROWSE      FILES_UPLOAD      ITEM_CREATE
JOURNAL_CREATE    MACRO_SCRIPT      MANUAL_ROLLS      MESSAGE_WHISPER
NOTE_CREATE       PING_CANVAS       PLAYLIST_CREATE   QUERY_USER
REGION_CREATE     SETTINGS_MODIFY   SHOW_CURSOR       SHOW_RULER
TOKEN_CONFIGURE   TOKEN_CREATE      TOKEN_DELETE      WALL_DOORS
```

**Changed in v14:** `TEMPLATE_CREATE` is gone, replaced by `REGION_CREATE` — MeasuredTemplate was folded into Region. `user.can("TEMPLATE_CREATE")` and `user.hasPermission("TEMPLATE_CREATE")` still work: both rewrite the id to `REGION_CREATE` and log a deprecation (since 14, until 16).

**Changed in v14:** each entry's `disableGM` boolean became `requiredRoles`, a list of roles that always hold the permission and cannot have it revoked:

```javascript
CONST.USER_PERMISSIONS.ACTOR_CREATE = {
  label: "PERMISSION.ActorCreate",
  hint: "PERMISSION.ActorCreateHint",
  requiredRoles: [CONST.USER_ROLES.ASSISTANT, CONST.USER_ROLES.GAMEMASTER],
  defaultRole: CONST.USER_ROLES.ASSISTANT,
};
```

`v13 disableGM: false` maps to `requiredRoles: [ASSISTANT, GAMEMASTER]`; `disableGM: true` maps to `requiredRoles: []` (the GM can turn it off for everyone, including themselves — `SHOW_CURSOR`, `PING_CANVAS`, `MANUAL_ROLLS`, the broadcast permissions). `defaultRole` is the lowest role that gets the permission before a GM configures anything.

`hasPermission` resolves in this order:

1. A banned user (`role === NONE`) is always false.
2. If `requiredRoles` includes the user's role, true.
3. If that User document's own `permissions` object holds the permission, use its value. This is the per-user override.
4. Otherwise read the world's `core.permissions` map for that permission, falling back to `defaultRole`.

Check granular permissions:

```javascript
if (game.user.hasPermission("ACTOR_CREATE")) { /* show "New Actor" button */ }
if (game.user.hasPermission("REGION_CREATE")) { /* offer template placement */ }
```

`user.can(action)` takes either a permission id or a role name and dispatches accordingly.

Use this for module UIs that should adapt to GM-configured permissions, not just the user's role. Example: a module-defined actor type might need `ACTOR_CREATE` plus `OWNER` ownership on a parent folder.

The saved configuration lives in the `core.permissions` world setting as `Record<permissionId, USER_ROLES[]>`. Read it if you build your own permission UI; for a yes/no answer always use `hasPermission`.

---

## Setting Ownership

```javascript
// Grant a specific player OWNER access
await actor.update({
  [`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
});

// Make the actor observable by all players
await actor.update({
  "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
});

// Revert to default visibility
await actor.update({
  [`ownership.${player.id}`]: _del,      // remove the per-user entry
});
```

**Changed in v14:** `_del` (a `foundry.data.operators.ForcedDeletion`) replaces the old `-=key: null` syntax, which is deprecated until v16. To replace the whole map instead of merging into it, use `_replace(value)`.

For multiple users at once:

```javascript
const ownership = { default: 0 };
for (const player of players) ownership[player.id] = 3;
await actor.update({ ownership });
```

---

## Default Ownership on Creation

`DocumentOwnershipField` initialises to `{ default: NONE }`, so a new document is invisible to players until you say otherwise. Documents imported from a compendium go through `WorldCollection#fromCompendium`, which grants the importing user `OWNER` and drops per-user entries for users the world doesn't have.

There is no world setting for "default ownership of new documents" — `core.permissions` is the granular permission map described above, not an ownership default. If you create documents on behalf of a player, set ownership explicitly in the create call:

```javascript
await Actor.create({
  name: "Player Hero",
  type: "character",
  ownership: { default: 0, [game.userId]: 3 },
});
```

---

## Embedded Document Inheritance (`INHERIT = -1`)

Embedded documents (Items on Actors, ActiveEffects on Items, etc.) default to `ownership: { default: -1 }` — meaning "inherit from parent." A user with OWNER on an Actor automatically has OWNER on the Actor's Items.

To deviate, set explicit non-inherit ownership on the embedded:

```javascript
// This item is GM-only, even on a player-owned actor
await item.update({ ownership: { default: 0 } });
```

This is the right tool for "secret notes the GM keeps on a player character" — the player owns the actor but not certain items.

---

## Document-Specific Rules Added in v14

Each Document class declares `metadata.permissions` per action. Two of them changed in v14 in ways modules hit.

### Region

`RegionDocument` gained an `ownership` field, so a region is no longer GM-only furniture — a player can own the region they placed. Nothing grants it for you: pass ownership in the create data.

```javascript
await canvas.regions.placeRegion({
  name: "Aura",
  shapes: [{ type: "circle", x: 0, y: 0, radius: 10 * canvas.dimensions.distancePixels, gridBased: true }],
  levels: [canvas.level.id],
  ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
});
```

- **create** — needs `REGION_CREATE`. A region created *with behaviors* additionally needs `isGM`, and an `executeScript` behavior needs `MACRO_SCRIPT` on top.
- **update** — needs `OWNER` on the region. Touching `behaviors` again needs `isGM` (plus `MACRO_SCRIPT` for `executeScript`).
- **delete** — needs `OWNER`.

`Region#getUserLevel` reads its own `ownership` map and treats `INHERIT` as `NONE` — regions do not inherit from the Scene.

This is the permission path for template-like effects now that MeasuredTemplate is deprecated. A player placing a 20-foot cone goes through `REGION_CREATE`, not `TEMPLATE_CREATE`.

### ActiveEffect

Creation used to require plain `OWNER`. In v14 it splits:

```javascript
// Embedded on an Actor or Item → OWNER on the parent
// Free-standing (world or compendium) → user.isGM (ASSISTANT or GAMEMASTER)
```

A player who owns their character can still create effects on it. Only assistants and GMs create world-level or compendium ActiveEffects — a consequence of ActiveEffect becoming a top-level, folderable, indexable document in v14.

---

## The GM-Authoritative Pattern (Revisited)

Players cannot modify documents they don't own. For player-initiated changes to world-level documents (e.g., player rolls damage and updates an enemy's HP), use sockets:

```javascript
// Module init
const SOCKET = "module.my-module";
Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (msg) => {
    if (!game.user.isGM) return;
    if (msg.action === "applyDamage") {
      const target = await fromUuid(msg.targetUuid);
      // GM has implicit OWNER on everything — this update succeeds
      await target.update({ "system.health": target.system.health - msg.amount });
    }
  });
});

// Called from any client
async function requestApplyDamage(targetUuid, amount) {
  if (game.user.isGM) {
    const target = await fromUuid(targetUuid);
    return target.update({ "system.health": target.system.health - amount });
  }
  game.socket.emit(SOCKET, { action: "applyDamage", targetUuid, amount });
}
```

The pattern: every player calls `requestApplyDamage`. GM clients run the actual update; player clients emit a socket event that GM receives and acts on. Players can't bypass — they don't have ownership.

For request-response (player needs the result of the GM-side computation), use `socketlib`. It wraps `game.socket` with awaitable RPC.

---

## UX Checks vs Server Enforcement

Permission checks on the **client** are for UI only. The server enforces independently — a player who skips your client check still hits a server-side rejection. So:

```javascript
// In a sheet's render
if (this.document.canUserModify(game.user, "update")) {
  // show "Edit" button
} else {
  // show read-only view
}

// In an action handler
async _onClickSave(event) {
  // Don't bother re-checking — the server will reject if it shouldn't be allowed.
  // Just attempt the update and handle the rejection cleanly.
  try {
    await this.document.update(this._getSubmitData());
  } catch (err) {
    ui.notifications.error(err.message);
  }
}
```

Don't write your own permission enforcement — Foundry already does it. Your job is to gate the UI so users don't see actions they can't perform, and to handle the rejection gracefully when permissions change mid-session.

---

## Compendium Pack Ownership

Packs declare default ownership in `module.json`:

```json
{
  "packs": [{
    "name": "monsters",
    "type": "Actor",
    "path": "packs/monsters",
    "ownership": {
      "PLAYER": "NONE",
      "ASSISTANT": "OWNER"
    }
  }]
}
```

Keys are `USER_ROLES` names, values are `DOCUMENT_OWNERSHIP_LEVELS` names. A string instead of an object (`"ownership": "OBSERVER"`) is read as `{ PLAYER: "OBSERVER" }`.

Declaring `ownership` **replaces** the default `{ PLAYER: "OBSERVER", ASSISTANT: "OWNER" }` wholesale — the fallback applies only when the key is absent. `"ownership": { "PLAYER": "NONE" }` alone leaves assistants at `NONE`, not `OWNER`. Name every role you mean to grant, as the example above does.

Pack ownership controls who can browse and import documents from the pack. `CompendiumCollection#getUserLevel` walks the map and takes the highest level whose role the user has.

**Fixed in 14.366:** a full GM now always resolves to `OWNER` on a pack, even when the manifest's `ownership` map names no GM or assistant role. Before the fix such a pack was read-only for the GM. If you shipped a workaround that injected `"GAMEMASTER": "OWNER"` into your pack declaration, you can drop it.

Per-document ownership inside the pack is preserved on import — set sensible defaults at pack-build time.

Packs of `Actor`, `Item`, or `ActiveEffect` type (`CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES`) must declare `"system"` in the manifest or validation throws. ActiveEffect joined that list in v14.

---

## Pitfalls

1. **Silent update failure** — non-GM updating a doc they don't own returns successfully without persisting. Foundry doesn't throw. Detect by reading back: `actor.system.health` won't have changed. Always log on the GM side.
2. **Confusing role with ownership** — a TRUSTED player with no per-document ownership has the role to create their own actors but cannot edit the GM's NPCs.
3. **`testUserPermission` with bare integer vs string** — both work, but mixing them in the codebase makes intent unclear. Pick one (recommend string names) and stick to it.
4. **Forgetting embedded inheritance** — setting `ownership: { default: 0 }` on an Item makes it GM-only. The player loses access even though they own the parent Actor. Use `default: -1` for inherit unless you mean to override.
5. **Setting permissions in a non-`update` call** — `actor.permission = ...` (deprecated property) doesn't persist. Always use `actor.update({ ownership })`.
6. **Reading `user.isGM` as "full GM"** — it is `hasRole(ASSISTANT)`, so assistants pass. For a true GM-only gate compare `user.role === CONST.USER_ROLES.GAMEMASTER`.
7. **Hardcoded role thresholds** — `CONST.USER_PERMISSIONS` role assignments are GM-configurable. Don't gate on role; gate on `user.hasPermission(...)`.
8. **Leaking sensitive data via `LIMITED`** — LIMITED still shows the document NAME and IMAGE. Don't put secrets in actor names ("Hidden Big Boss with 500 HP"). Anything truly hidden needs `NONE`.
9. **Adventure imports overriding ownership** — re-importing an Adventure resets ownership on existing documents to whatever the pack declares. Warn users; offer a "preserve ownership" option in custom flows.
10. **Still checking `TEMPLATE_CREATE`** — it resolves to `REGION_CREATE` with a deprecation warning until v16. Update the string.
