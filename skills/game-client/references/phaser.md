# Phaser 4 client

Checked against `phaser` 4.2.1. Phaser's own agent skills cover the API; this file keeps only what a networked game client needs on top. Each rule names its source; full citations are in `sources.md`. "This skill's rule" marks a choice no source states.

## Vendor skills first

The Phaser repository ships 28 agent skills under `skills/` (scenes, loading-assets, input-keyboard-mouse-touch, time-and-timers, v3-to-v4-migration and more), and the npm package includes that folder (GitHub contents API at tag v4.2.1; jsDelivr file listing for `phaser@4.2.1`). Use the matching skill under `node_modules/phaser/skills/<topic>/SKILL.md` if it is installed, otherwise https://docs.phaser.io.

## Setup under Bun

- `bun create @phaserjs/game@latest` scaffolds a project from the official templates (Phaser README). The docs call this app the easiest way to start (docs.phaser.io, Installing).
- The official `template-bun` runs Vite under Bun: its scripts call `bunx --bun vite`, so Bun is the package manager and runtime, not the bundler. It pins `phaser` 4.0.0 (template-bun `package.json`). Bump it to 4.2.1.
- Its default `dev` and `build` scripts first run `log.js`, which sends an HTTPS GET to an outside host; `dev-nolog` and `build-nolog` skip it (template-bun `package.json`, `log.js`). Use the `-nolog` scripts or delete `log.js`.
- This skill's rule: keep the Vite template. No Phaser source covers Bun's own bundler, and the template's static `public/` folder has no documented Bun equivalent.

## Loop and timing

- The `delta` Phaser passes to `update(time, delta)` is "a clamped and smoothed average value", in milliseconds. Smoothing is on by default (`fps.smoothStep`) (`src/core/TimeStep.js`). Never measure wall-clock time or align with the server from `delta`; use `time` or `performance.now()`. This last point is this skill's rule.
- There is no fixed step in the core loop. Arcade Physics has one: `fixedStep` defaults to true, and `World.update` runs extra steps in a `while` loop to catch up (`src/physics/arcade/World.js`).
- Hidden tab: `Game` listens for the hidden event, calls `loop.pause()`, and on return emits `RESUME` with the pause duration (`src/core/Game.js`). That pauses Phaser's loop, which also stops `step()` calls. It does not resync with the server: still use `watchVisibility` from `boilerplate/visibility-resync.ts`, with `start` calling `loop.resetClock()`.
- `fps.forceSetTimeOut` swaps rAF for `setTimeout` and can only be set in the game config (`src/core/TimeStep.js`).

## Scenes and cleanup

- Scene operations are queued to the next SceneManager update, not run at once (scenes skill, Gotcha 1).
- `pause()` stops update but still renders; `sleep()` stops both (scenes skill, Gotcha 4).
- Scenes update in reverse order and render in forward order (scenes skill, Gotcha 16).
- A scene's listeners survive a restart. Remove each one in `this.events.once('shutdown', ...)`, or every restart adds a duplicate (events-system skill, "Memory Leaks from Unremoved Listeners").
- Loaded assets live in global caches shared by every scene. A second load with a key that exists is silently ignored; remove the old asset first with `this.textures.remove(key)`. Loads queued outside `preload()` wait for `this.load.start()` (loading-assets skill).
- This skill's rule: own the WebSocket and the `ClientGameLoop` outside any scene, and let scenes subscribe on `create` and unsubscribe on `shutdown`.

## Input

- Poll keys with `isDown` and `JustDown` (input skill). This polling fits a fixed tick: build the command inside `captureInput` from the key state. Phaser's `Keyboard` replaces the DOM half of `boilerplate/input-manager.ts`; keep only the parts Phaser lacks.
- The Gamepad API needs HTTPS in modern browsers, and the browser may want a button press before it exposes a pad (input skill, `references/REFERENCE.md`, Gotcha 8).

## Assets

- Queue loads in `preload()`; a loading bar listens to `this.load.on('progress', ...)` (loading-assets skill).
- Caches are global (see Scenes and cleanup). Remove what a level loaded when it ends.

## Performance

- Keep draw calls to a few hundred at most. Filters and RenderTextures each cost draw calls (Phaser 4 Rendering Concepts, cheat sheet).
- `Text` uploads a new texture on every change; use `BitmapText` for numbers that change each frame, such as ping or HP (Rendering Concepts).
- The minified full build is 345 KB with gzip (Phaser README).

## Where server-state interpolation hooks in

Phaser owns the frame through its own rAF loop. This skill's rule: never call `ClientGameLoop.start()`. In the game scene's `update(time, delta)`, call `loop.step(time)`, read `loop.getRenderState()`, and write `x`, `y`, `rotation` on each sprite once. Remote entities read the snapshot bracket from `game-state-sync`. Pick render time from `time`, never from summed `delta`.

## Version traps (Phaser 3 code from training data)

Use the `v3-to-v4-migration` skill (`node_modules/phaser/skills/v3-to-v4-migration/SKILL.md`) if it is installed, otherwise the v4 migration guide (https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md). The traps that matter most for a networked client, from that guide:
- `roundPixels` now defaults to `false`, and only rounds axis-aligned, unscaled objects; interpolated positions render at sub-pixel values, so v3 pixel art may look soft.
- `Math.TAU` changed from PI/2 to 2*PI, and `Math.PI2` is removed: angle code shared with the server silently changes meaning.
- `Mesh` and `Plane` are removed; proper 3D is planned for the future. For 3D use the Three.js option.
- Compressed textures must be re-exported with Y flipped, because v4 uses GL orientation.
