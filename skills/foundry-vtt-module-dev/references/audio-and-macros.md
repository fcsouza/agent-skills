# Audio & Macros

Deep reference for Foundry VTT v14's AudioHelper, Playlists, and Macro/Hotbar APIs.

---

## 1. AudioHelper

`game.audio` is the singleton `AudioHelper` instance for all audio playback. The class lives at `foundry.audio.AudioHelper`; the bare `AudioHelper` global was a v12 shim and is gone in v14, so import or alias it:

```js
const { AudioHelper, Sound } = foundry.audio;
```

**Changed in v14:** `client/audio` is otherwise stable. The removed v12 shims are `AudioHelper#getCache/setCache/updateCache` (use `game.audio.buffers`, an `AudioBufferCache`), `Sound#on/off/emit` (use `addEventListener/removeEventListener/dispatchEvent`), `Sound#container/node/loadState` (`sourceNode`, `Sound.STATES`), `AudioContainer.LOAD_STATES`, and positional arguments to `Sound#play` (pass an options object). Positional sounds now default their elevation to `canvas.level.elevation.base` instead of `0`.

### Play locally (current user only)

```js
// Play a sound effect for the current user only
const sound = await game.audio.play("modules/my-module/sounds/boom.wav", {
  context: game.audio.interface   // or game.audio.music, game.audio.environment
});
```

### Play across all clients (static method)

```js
// Play on ALL connected clients
foundry.audio.AudioHelper.play({
  src: "modules/my-module/sounds/boom.wav",
  volume: 0.8,
  loop: false,
  channel: "interface"    // "interface", "environment", or "music"
}, true);                 // true = broadcast to all clients

// Play on specific clients
foundry.audio.AudioHelper.play({ src: "sounds/alert.wav", volume: 1.0 }, {
  recipients: [userId1, userId2]
});
```

`AudioHelper.play` returns the local `Sound`, or nothing when you pass `autoplay: false` (the sound is still broadcast).

### Preload

```js
// Preload a sound for faster playback later
const sound = await foundry.audio.AudioHelper.preloadSound("modules/my-module/sounds/ambient.mp3");
```

### Create a Sound instance

```js
// Create without playing
const sound = game.audio.create({ src: "modules/my-module/music/theme.mp3" });
await sound.load();
await sound.play({ fade: 500, loop: true, offset: 0 });   // SoundPlaybackOptions object
await sound.fade(0, { duration: 1000 });
await sound.stop();

// Lifecycle events (EventEmitterMixin) — states in Sound.STATES
sound.addEventListener("end", () => console.log("finished"));
```

### Volume helpers

```js
const { AudioHelper } = foundry.audio;

// Convert slider value (0-1) to perceptual volume
const volume = AudioHelper.inputToVolume(sliderValue, 1.5);

// Convert volume back to slider value
const slider = AudioHelper.volumeToInput(volume, 1.5);

// Format as percentage string
const label = AudioHelper.volumeToPercentage(0.75, { decimalPlaces: 0 });
// "75%"
```

### Audio channels

```js
// Three independent channels with separate volume controls
game.audio.interface;     // UI sounds, dice rolls
game.audio.environment;   // Ambient environmental sounds
game.audio.music;         // Background music
```

### Positional sound

```js
const { Sound } = foundry.audio;
const sound = new Sound("modules/my-module/sounds/thunder.ogg", { context: game.audio.environment });
await sound.load();
await sound.playAtPosition({ x: 3200, y: 2400 }, 30, { volume: 0.8 });
```

`Sound#playAtPosition(origin, radius, options)` attenuates by distance and walls; `radius` is in scene distance units, not pixels. `origin` takes `{x, y, elevation}`; when you omit `elevation` it falls back to `canvas.level.elevation.base`, the bottom elevation of the active Scene Level (see `foundry-vtt-module-dev/references/scene-levels.md`).

The VFX framework wraps the same call in a serializable component, `VFXPositionalSoundComponent` (`type: "positionalSound"`), with `angle`, `rotation`, `gmAlways`, `baseEffect`, `muffledEffect`, `fade`, `duration` and `channel` fields. VFX is experimental and off by default (`CONFIG.Canvas.vfx.enabled`).

### Unlock requirement

Audio playback requires a user gesture. Queue sounds if locked:

```js
if (game.audio.locked) {
  game.audio.pending.push(() => game.audio.play("sounds/click.wav"));
} else {
  await game.audio.play("sounds/click.wav");
}
```

---

## 2. Playlists

`Playlist` and `PlaylistSound` are Foundry documents for managing music and ambient audio.

### Create a playlist programmatically

```js
const [playlist] = await Playlist.create([{
  name: "Combat Music",
  mode: CONST.PLAYLIST_MODES.SIMULTANEOUS,   // SEQUENTIAL, SHUFFLE, SIMULTANEOUS
  playing: false,
  sounds: [
    { name: "Battle Theme 1", path: "modules/my-module/music/battle1.mp3", volume: 0.6, loop: true },
    { name: "Battle Theme 2", path: "modules/my-module/music/battle2.mp3", volume: 0.5, loop: true }
  ]
}]);
```

### Playback control

```js
// Play all sounds in the playlist
await playlist.playAll();

// Stop all
await playlist.stopAll();

// Play next (sequential or shuffle mode) — finds the playing sound itself
await playlist.playNext();
await playlist.playNext(soundId, { direction: -1 });   // step backwards

// Update playing state
await playlist.update({ playing: true });
```

### PlaylistSound embedded documents

```js
// Add a sound to an existing playlist
await playlist.createEmbeddedDocuments("PlaylistSound", [{
  name: "Thunder",
  path: "modules/my-module/sounds/thunder.mp3",
  volume: 0.8,
  repeat: false,
  fade: 1000    // fade in/out duration in ms
}]);
```

### Hooks

```js
// React to playlist state changes
Hooks.on("updatePlaylist", (playlist, changes, options, userId) => {
  if (changes.playing !== undefined) {
    console.log(`${playlist.name} ${changes.playing ? "started" : "stopped"}`);
  }
});

Hooks.on("updatePlaylistSound", (sound, changes, options, userId) => {
  if (changes.playing !== undefined) {
    console.log(`${sound.name} playback changed`);
  }
});
```

The Playlist and PlaylistSound APIs did not change in v14.

---

## 3. Macros

Macros are documents that store executable commands. They can be dragged to the hotbar for quick access.

**Changed in v14:** `Macro#author` is nullable. A macro whose author was deleted keeps `author: null` instead of a dangling user id, and `Macro#_preCreate` only stamps the author when a user is in context. Guard reads of `macro.author`:

```js
const authorName = macro.author?.name ?? "Unknown";
```

### Create a macro

```js
// Script macro (executes JavaScript)
const macro = await Macro.create({
  name: "Quick Attack",
  type: "script",
  img: "icons/svg/sword.svg",
  command: `
    const actor = game.user.character;
    if (!actor) return ui.notifications.warn("No character assigned.");
    const item = actor.items.find(i => i.type === "weapon" && i.system.equipped);
    if (item) await item.use();
  `,
  flags: { "my-module": { category: "combat" } }
});

// Chat macro (posts a chat message)
const chatMacro = await Macro.create({
  name: "OOC Announcement",
  type: "chat",
  img: "icons/svg/microphone.svg",
  command: "/ooc The dragon roars!",
  flags: {}
});
```

### Execute a macro programmatically

```js
// Execute by ID
const macro = game.macros.get(macroId);
if (macro) await macro.execute();

// Execute by name
const macro = game.macros.getName("Quick Attack");
if (macro) await macro.execute();

// Script macros receive a scope object, exposed as named variables inside the command
await macro.execute({ actor, token, speaker: ChatMessage.getSpeaker({ actor }), event });
```

`Macro#execute` returns nothing when `canExecute` is false (it warns instead of throwing). For script macros the scope must be a plain object; `speaker`, `actor`, `token` and `event` are the documented keys.

### Assign to hotbar

```js
// Assign a macro to hotbar slot 1-50
await game.user.assignHotbarMacro(macro, 1);
```

### hotbarDrop hook

Allow users to drag module elements onto the hotbar to auto-create macros:

```js
Hooks.once("ready", () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    // data.type — e.g. "Item", "Actor", "Macro"
    // data.uuid — UUID of the dropped document
    // slot — hotbar slot number (1-50)

    if (data.type === "Item") {
      createItemMacro(data, slot);
      return false;   // prevent default handling
    }
  });
});

async function createItemMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if (!item) return;

  const macro = await Macro.create({
    name: item.name,
    type: "script",
    img: item.img,
    command: `game.modules.get("my-module").api.useItem("${item.name}")`
  });

  await game.user.assignHotbarMacro(macro, slot);
}
```

The `hotbarDrop` hook should be registered in `ready` so other modules can register earlier if needed.

### Rolling items from macros

Common pattern for item macros created via drag-drop:

```js
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor?.items.find(i => i.name === itemName);
  if (!item) {
    return ui.notifications.warn(`No item named "${itemName}" on the active actor.`);
  }
  return item.use();
}
```
