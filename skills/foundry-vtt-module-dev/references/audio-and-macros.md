# Audio & Macros

Deep reference for Foundry VTT v13's AudioHelper, Playlists, and Macro/Hotbar APIs.

---

## 1. AudioHelper

`game.audio` is the singleton `AudioHelper` instance for all audio playback.

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
AudioHelper.play({
  src: "modules/my-module/sounds/boom.wav",
  volume: 0.8,
  loop: false,
  autoplay: true,
  channel: "interface"    // "interface", "environment", or "music"
}, true);                 // true = broadcast to all clients

// Play on specific clients
AudioHelper.play({ src: "sounds/alert.wav", volume: 1.0 }, {
  recipients: [userId1, userId2]
});
```

### Preload

```js
// Preload a sound for faster playback later
const sound = await AudioHelper.preloadSound("modules/my-module/sounds/ambient.mp3");
```

### Create a Sound instance

```js
// Create without playing
const sound = game.audio.create({ src: "modules/my-module/music/theme.mp3" });
// Later: sound.play(), sound.pause(), sound.stop()
```

### Volume helpers

```js
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

// Play next (sequential mode)
await playlist.playNext(playlist.sounds.first());

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

---

## 3. Macros

Macros are documents that store executable commands. They can be dragged to the hotbar for quick access.

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
```

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
