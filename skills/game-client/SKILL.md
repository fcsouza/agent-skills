---
name: game-client
description: >-
  Builds the browser client of a game in TypeScript under Bun, on plain Canvas/WebGL, Phaser, PixiJS, or Three.js and React Three Fiber: choosing the stack, the frame loop, hidden-tab pause and resync, keyboard, pointer, touch and gamepad input, audio unlock, canvas sizing, context loss, asset cleanup and performance budgets. Use when starting or fixing the part of a web game that runs in the player's browser: picking a rendering stack, wiring input or the render loop, a blurry or stretched canvas, silent audio, a game that jumps or leaks after switching tabs or scenes, or code written for Phaser 3, PixiJS 7 or an older three.js.
---

# Game Client

The client draws the world and collects input. In a multiplayer game the server owns the state (`game-backend-architecture`) and `game-state-sync` owns prediction, reconciliation and interpolation. This skill owns everything between those and the screen.

Checked against `phaser` 4.2.1, `pixi.js` 8.23.0, `three` 0.187.0 and `@react-three/fiber` 9.8.2 (`bun pm view <pkg> version`, 2026-11-14). An agent trained on an older major writes code that no longer runs; each stack's reference file lists those traps.

## Choose the stack

The "what it is" column uses each project's own words. The "fits" and "avoid" columns are this skill's rule.

| Stack | What it is | Fits when | Avoid when |
|---|---|---|---|
| Plain web (Canvas 2D, WebGL2, WebGPU) | Browser APIs; you write the loop, input, loader and batcher | Few sprites, a custom renderer, a tool, a tight bundle | You find yourself writing a sprite batcher or scene graph |
| Phaser 4 | "A fast, free, and fun open source HTML5 game framework" with scenes, a loader, Arcade and Matter physics, input, cameras, tilemaps, tweens | A 2D game where you want the engine to own scenes, input and physics | You need 3D (v4 removed `Mesh` and `Plane`), or only a renderer under your own loop |
| PixiJS 8 | "Just a rendering engine" for 2D; sound, UI and layout are add-ons | A 2D game where you own the structure and want a fast batched renderer | You want scenes, physics and gamepad input built in |
| Three.js | "An easy-to-use, lightweight, cross-browser, general-purpose 3D library" | 3D with many server entities updated every snapshot | A 2D game |
| React Three Fiber | "A React renderer for three.js" | 3D inside an existing React app, mostly long-lived objects | Entities that spawn and despawn every snapshot (mounting compiles materials) |

Load one reference file for the chosen stack and skip the others.

## Set up with Bun and TypeScript

- Plain web: `bun ./index.html` serves and bundles the page with hot reloading; `bun build ./index.html --outdir=dist` builds it. Details in `references/web.md`.
- Phaser and PixiJS: scaffold with `bun create @phaserjs/game@latest` or `bun create pixi.js my-app --template bundler-vite`. Their templates bundle with Vite; keep Vite and use Bun as package manager and runtime. No vendor source covers Bun's own bundler, so this is this skill's rule.
- Three.js: install `three` and `@types/three` at the same version. R3F: add `@react-three/fiber` and match React's major (fiber 9 needs React 19).
- TypeScript: browser code needs `"DOM"` in `lib`. Bun's recommended tsconfig lists only `"ESNext"`. Give the client its own tsconfig so server code does not see DOM globals (this skill's rule).

## Loop and timing

- The simulation runs on a fixed step. `ClientGameLoop` in `game-state-sync` owns it: an accumulator over `requestAnimationFrame`, a 250 ms cap per frame, prediction on each tick, and an `alpha` between the last two ticks. Do not write a second fixed-step loop.
- `requestAnimationFrame` follows the display rate, so a 120 Hz screen calls it twice as often as a 60 Hz one. Anything moved per frame moves by elapsed time, never a fixed amount.
- Which loop owns the frame (this skill's rule):
  - Plain web: `ClientGameLoop` does. Set its `onRender(state, alpha)` and draw there.
  - Phaser, PixiJS, Three.js, R3F: the engine runs the only frame loop. Never call `ClientGameLoop.start()` and leave `onRender` unset. In the engine's per-frame hook, before it renders, call `loop.step(now)`: it runs the due fixed ticks and returns the alpha. Then read `loop.getRenderState()` (previous and current state by reference, no copy) and the snapshot bracket from `game-state-sync`, and write transforms onto display objects. Each reference file names the hook.
- The renderer reads state and never writes it. The WebSocket handler writes server state into the loop (`handleServerUpdate`) and never touches display objects.

## Pause and resync when the tab is hidden

Most browsers stop `requestAnimationFrame` in a background tab, while the server keeps simulating. Simulating the whole gap on return "can be a problem for long drops" (MDN). This skill's rule:

1. On `visibilitychange` to hidden: stop the client loop, clear held input, suspend audio.
2. On visible: do not replay the gap. Drop stale interpolation snapshots, request a full snapshot, then restart the loop. When the snapshot carrying the server tick arrives, align the tick with `syncTick`; `handleServerUpdate` already adopts the server's tick when the client is behind. `ClientGameLoop.start()` resets the frame clock and the accumulator, so the first frame back runs no burst of ticks.

`boilerplate/visibility-resync.ts` does this for any loop with `start()` and `stop()`. In engine-driven mode, pass it `{ stop() {}, start: () => loop.resetClock() }`: `resetClock()` makes the next `step()` start fresh, with no catch-up ticks. Engine loops handle their own clocks: Phaser pauses its loop and emits `RESUME`, PixiJS does not pause its ticker itself (the browser throttles its frames), three.js `Timer.connect(document)` avoids the big delta. They do not resync with your server.

## Input

- Keys by `KeyboardEvent.code`, the physical key: WASD stays in place on an AZERTY layout. Use `key` only for text entry such as chat.
- Track held keys from `keydown` and `keyup`, and ignore events with `repeat` set. OS auto-repeat is not a press.
- Clear held keys on window `blur` and on hidden: a key released while the window has no focus sends no `keyup` (this skill's rule).
- Pointer Events cover mouse, pen and touch with one model and a `pointerId` each. Call `setPointerCapture` on `pointerdown` so a drag that leaves the canvas still delivers its `pointerup`. Treat `pointercancel` like `pointerup` (this skill's rule).
- Touch gestures: set `touch-action: none` on the canvas so the browser does not pan or zoom. Window, document and body listeners for `touchstart` and `touchmove` are passive by default and cannot call `preventDefault()`; attach to the canvas. Pinch is the distance between two touch pointers.
- Gamepads: poll `navigator.getGamepads()` once per tick and read pads by index. Re-read the list on every poll rather than keeping a `Gamepad` object (this skill's rule). `mapping === 'standard'` means the standard button layout. Firefox exposes a pad only after the user presses something on it with the page visible.
- Sample input inside `captureInput` once per tick, and turn it into a command with the tick and sequence number (`game-state-sync`). Send intents, never positions.

`boilerplate/input-manager.ts` implements all of this with no framework. It reads keys on window, ignores keys typed into text fields, and blocks arrow and Space defaults only while the canvas has focus (it gives the canvas `tabindex` 0 and focuses it on `pointerdown`), so buttons and page scrolling keep their keys. Phaser has its own keyboard, pointer and gamepad input; use that. With PixiJS, which has pointer events but no keyboard or gamepad input, keep the boilerplate's keyboard and gamepad parts. three.js has no input layer at all; use the whole boilerplate.

## Audio unlock

An `AudioContext` created before a user gesture starts `suspended`; call `resume()` from a gesture and check `state`. Only some events count as activation: `keydown`, `mousedown`, `pointerup` from touch or pen, and `touchend`. A touch `pointerdown` does not count, so a "tap to start" button must listen for `pointerup` or `click`. The same rule applies to fullscreen and pointer lock. `boilerplate/audio-unlock.ts` resumes a context on the first qualifying gesture; it rejects and removes its listeners if the context is closed or its `AbortSignal` aborts. For music and effects themselves, see `elevenlabs-sound-music`.

## Canvas size and devicePixelRatio

- `devicePixelRatio` is the ratio of physical to CSS pixels. A canvas whose buffer matches its CSS size looks blurry on a 2x screen.
- Size the drawing buffer from `ResizeObserver` with `{ box: 'device-pixel-content-box' }`, which gives exact device pixels; fall back to CSS size times `devicePixelRatio`. Cap the ratio: the three.js manual warns against blindly using the device ratio, and R3F clamps its `dpr` to `[1, 2]` by default.
- `boilerplate/canvas-size.ts` does this for plain web and three.js, re-applies on a `devicePixelRatio` change (zoom, another monitor) through a `matchMedia` resolution query, and takes an optional `maxSize` cap. Its callback receives the buffer size in device pixels and must not touch the canvas's CSS size. With three.js: `renderer.setPixelRatio(1)`, then in the callback `renderer.setSize(w, h, false)`, `camera.aspect = w / h`, `camera.updateProjectionMatrix()`. The `false` stops `setSize` from writing the CSS size; without it the CSS box grows, the observer fires again, and on a 2x screen the buffer grows without end.
- Phaser and PixiJS size their own canvas; use their options instead (see the reference files).

## Context loss

- WebGL can lose its context, for example when the GPU runs out of memory. By default a lost context never comes back. In `webglcontextlost`, call `event.preventDefault()` and stop rendering; on `webglcontextrestored`, re-create every texture, buffer, shader and program.
- WebGPU: watch `device.lost`, a promise that resolves when the device is lost, then rebuild.
- Phaser, PixiJS and three.js own their GL objects; check each vendor skill before adding your own handler.

## Assets: load and free

- Load per scene or screen, behind a loading screen with progress. Phaser has `this.load.on('progress')`, PixiJS bundles with `onProgress`, three.js a `LoadingManager`.
- GPU memory is not garbage collected for you. Free what a scene loaded when it ends: three.js `dispose()` on geometries, materials and textures; PixiJS `Assets.unload` and `destroy({ children: true })`; Phaser `this.textures.remove(key)`, since its caches are global; plain web `ImageBitmap.close()` and explicit WebGL deletes.
- Pass one `AbortSignal` to every listener a scene adds, and abort it when the scene ends (this skill's rule; the `signal` option of `addEventListener` removes them all).
- Use texture atlases so sprites batch. Keep textures at or under 4096 px per side unless you query the GPU limit: larger ones fail on some mobile GPUs (PixiJS skill).

## Performance budgets

- Frame budget: one display refresh, 16.7 ms at 60 Hz and 8.3 ms at 120 Hz. Measure on the weakest target device.
- Draw calls: a few hundred at most (Phaser rendering guide; R3F says 1000 is the very maximum). Instance or batch repeated objects.
- Batches: PixiJS batches up to 16 textures, depending on hardware; alternating blend modes split batches, so group children by blend mode (PixiJS skill).
- Text that changes every frame (ping, score, HP) goes in bitmap text; canvas text re-uploads a texture on each change (Phaser, PixiJS).
- No allocation in the frame loop: reuse vectors and arrays (R3F pitfalls). Pool entities that spawn often; R3F's pitfalls page says to re-pool objects to spare the garbage collector.
- Keep `getError` and `getParameter` out of the frame loop: they stall the calling thread.

## Plain web

You own the loop, scenes and batching. Read `references/web.md` for Bun's HTML server, scene cleanup with `AbortController`, pointer lock and fullscreen, image decoding, and WebGPU status.

## Phaser

Use the matching skill in `node_modules/phaser/skills/<topic>/SKILL.md` if it is installed, otherwise https://docs.phaser.io. What differs: `delta` is smoothed and clamped, scene operations are queued, caches are global, and listeners survive scene restarts. The official Bun template phones home through `log.js`. Read `references/phaser.md` for timing, cleanup, the interpolation hook and Phaser 3 traps.

## PixiJS

Use the `pixijs` skill if it is installed (it ships in `node_modules/pixi.js/skills/pixijs`), otherwise https://pixijs.com/8.x/guides. What differs: `await app.init()`, no scene manager, no keyboard or gamepad input, no fixed step, and the ticker does not pause itself in a hidden tab. Read `references/pixijs.md` for ticker priorities, cleanup, the interpolation hook and PixiJS 7 traps.

## Three.js and React Three Fiber

Use the `threejs-fundamentals` skill if it is installed, otherwise https://threejs.org/docs/llms.txt; for R3F the `r3f-fundamentals` skill if it is installed, otherwise https://r3f.docs.pmnd.rs/. What differs: `setAnimationLoop`, `Timer` instead of the deprecated `Clock`, manual `dispose()`, and in R3F no `setState` in `useFrame`. Read `references/three.md` for the plain-or-R3F choice, the interpolation hook and version traps.

## Pitfalls

- Stepping the simulation once per `requestAnimationFrame`: speed then depends on the screen's refresh rate.
- Replaying a hidden tab's gap on return, or resuming without resyncing with the server.
- `KeyboardEvent.key` for movement: it breaks on non-QWERTY layouts.
- Unlocking audio or requesting fullscreen from a touch `pointerdown`.
- A canvas buffer at CSS size on a 2x screen, or an uncapped ratio on a 3x phone.
- No `preventDefault()` in `webglcontextlost`: the context never returns.
- Removing objects from the scene and assuming their GPU memory is freed.
- Phaser `Text`, PixiJS `Text`: updating them every frame re-uploads a texture.
- Code from an older major: Phaser 3, PixiJS 7, `THREE.Clock`, R3F 8 types. Check the version traps in the reference file.

## Files

- `boilerplate/input-manager.ts`: copy when you need keyboard by `code`, pointers with capture, pinch distance and gamepad polling without a framework.
- `boilerplate/visibility-resync.ts`: copy when the client loop must pause in a hidden tab and resync with the server on return.
- `boilerplate/audio-unlock.ts`: copy when a Web Audio context must resume on the first qualifying gesture.
- `boilerplate/canvas-size.ts`: copy when a plain-web or three.js canvas must track its CSS size in device pixels.
- `references/web.md`: read when the stack is plain Canvas, WebGL or WebGPU.
- `references/phaser.md`: read when the stack is Phaser 4.
- `references/pixijs.md`: read when the stack is PixiJS 8.
- `references/three.md`: read when the stack is Three.js or React Three Fiber.
- `references/sources.md`: read when you need the page behind a rule or want to re-check a version.

## Related skills

- `game-state-sync`: the fixed-step `ClientGameLoop`, prediction, reconciliation and snapshot interpolation this client plugs into.
- `game-backend-architecture`: the authoritative server, WebSocket rooms and tick loop the client talks to.
- `ui-ux-game`: HUD, menus, onboarding and accessibility drawn on top of the canvas.
- `elevenlabs-sound-music`: producing the sound effects and music the client plays.
- `level-design`: the levels the client loads and renders.
- `game-save-load`: saving and restoring client and player state.
- `game-localization`: translated text, fonts and layout in the client.
