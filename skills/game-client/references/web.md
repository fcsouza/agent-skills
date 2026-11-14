# Plain web client (Canvas 2D, WebGL2, WebGPU)

You own everything below the game logic: loop, scenes, input, assets, batching. Each rule names its source; full citations are in `sources.md`. "This skill's rule" marks a choice no source states.

## Setup under Bun

- `bun ./index.html` starts a dev server that bundles the `<script>` and `<link>` tags and reloads on change. `bun build ./index.html --outdir=dist` builds for production; images referenced from HTML and CSS are copied with a content hash and their paths rewritten (Bun, "HTML & static sites").
- To serve the page and the game's WebSocket from one process, import the `.html` file and pass it as a route to `Bun.serve()`; `development` mode adds hot reloading, and `console: true` inside it echoes browser logs to the terminal (Bun, "Fullstack dev server"). The WebSocket handler belongs to `game-backend-architecture`.
- An asset imported from code (`import url from './ship.png'`) goes through the file loader: the import resolves to a path, and the bundler copies the file into `outdir` (Bun, "Loaders").
- Bun's recommended tsconfig has `"lib": ["ESNext"]` only (Bun, "TypeScript"). Browser code needs `"DOM"` added. This skill's rule: give the client its own tsconfig so server code does not see DOM globals.

## Loop and timing

- `requestAnimationFrame` fires about once per display refresh, so a 120 Hz screen calls it twice as often as a 60 Hz one; it is one-shot, so request the next frame inside the callback (MDN, requestAnimationFrame). Never step the simulation once per rAF; use the fixed step in `ClientGameLoop` (`game-state-sync`).
- Stop with `cancelAnimationFrame(id)`. Simulating a long gap to catch up "can be a problem for long drops" (MDN, Anatomy of a video game). This skill's rule: reset the clock on return instead (`boilerplate/visibility-resync.ts`).
- Most browsers stop rAF in background tabs (MDN, Page Visibility API).

## Scenes and cleanup

No browser source specifies a scene structure. This skill's rule: a small state machine where each scene has `enter`, `update`, `render`, `exit` and its own `AbortController`. Pass the controller's `signal` to every `addEventListener` call; `abort()` on exit removes them all (MDN, addEventListener: the listener is removed when the owning controller aborts).

- Free GPU resources yourself: delete WebGL objects explicitly rather than waiting for garbage collection (MDN, WebGL best practices).
- `ImageBitmap.close()` disposes the bitmap's graphical resources; call it when an asset is unloaded (MDN, ImageBitmap.close).

## Input

The stack-neutral rules are in SKILL.md and `boilerplate/input-manager.ts`. Plain-web specifics:

- Pointer lock: `requestPointerLock()` needs transient activation, and a call right after the user left lock with the default unlock gesture (Escape) fails even with activation (MDN, requestPointerLock). Show a "click to resume" overlay after Escape.
- Fullscreen and pointer lock both need a user gesture; on touch, request them from `pointerup` or `click`, since a touch `pointerdown` does not grant activation (WHATWG HTML, user activation).

## Assets

- Load images with `fetch(url)` then `createImageBitmap(blob)`; the result draws with `drawImage` or uploads with `texImage2D` (MDN, createImageBitmap).
- Canvas 2D: pre-render repeated drawing onto an offscreen canvas and draw that image each frame (MDN, Optimizing canvas).
- WebGL: pack sprites into a texture atlas so draws merge into fewer, bigger batches (MDN, WebGL best practices).

## Performance

- Canvas 2D: `getContext('2d', { alpha: false })` when the canvas needs no transparency (MDN, Optimizing canvas).
- WebGL: `getError` and `getParameter` stall the calling thread; keep them out of the frame loop (MDN, WebGL best practices).
- WebGL: draw many sprites in one `drawArrays`/`drawElements` call; with raw WebGL you write that batcher yourself (MDN, WebGL best practices). This skill's rule: when you start writing a sprite batcher, switch to PixiJS or Phaser.

## WebGPU

- MDN calls WebGPU the successor to WebGL. The whole API needs a secure context, and you get a device through `navigator.gpu.requestAdapter()`; `GPUDevice.lost` resolves when the device is lost (MDN, WebGPU API).
- On 2025-11-25 web.dev reported WebGPU in Chrome, Edge, Firefox and Safari, with Linux, Android and Intel Macs still in progress for some browsers (web.dev, "WebGPU is now supported in major browsers"). This skill's rule: treat WebGPU as an upgrade with a WebGL2 fallback, and handle a null adapter.

## Where server-state interpolation hooks in

`ClientGameLoop` owns the frame. Set its `onRender(state, alpha)` to draw: read positions from the state (local player) and from the snapshot bracket (`RollbackBuffer.getBracket` in `game-state-sync`) for remote entities, and draw. The renderer never writes simulation state. This placement is this skill's rule.


## Version traps

Browser APIs have no package version to pin; their trap is support. WebGPU is not everywhere yet (see WebGPU above), and the Gamepad API needs the user to press a button first in Firefox (SKILL.md, Input).
