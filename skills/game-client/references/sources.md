# Sources

Each page was opened on the date shown. Repository files are cited at the release tag the skill was checked against; repositories without a matching release (templates, sample games) are pinned to the commit read. Star counts are from the GitHub API on the same date and mark a widely used example, not an authority.

## Versions

- npm registry, phaser dist-tags - https://registry.npmjs.org/-/package/phaser/dist-tags - supports: latest is 4.2.1 (also `bun pm view phaser version`) - checked 2026-11-14
- npm registry, pixi.js dist-tags - https://registry.npmjs.org/-/package/pixi.js/dist-tags - supports: latest is 8.23.0 - checked 2026-11-14
- npm registry, three dist-tags - https://registry.npmjs.org/-/package/three/dist-tags - supports: latest is 0.187.0 - checked 2026-11-14
- npm registry, @types/three dist-tags - https://registry.npmjs.org/-/package/@types/three/dist-tags - supports: latest is 0.187.0 - checked 2026-11-14
- npm registry, @react-three/fiber dist-tags - https://registry.npmjs.org/-/package/@react-three/fiber/dist-tags - supports: latest is 9.8.2; 10.0.0-alpha.6 is an alpha - checked 2026-11-14
- npm registry, @react-three/fiber 9.8.2 metadata - https://registry.npmjs.org/@react-three/fiber/9.8.2 - supports: peer dependencies `react >=19 <19.4`, `three >=0.156` (read with `bun pm view @react-three/fiber@9.8.2 peerDependencies`) - checked 2026-11-14

## Browser platform (MDN, WHATWG, Khronos, web.dev, Chrome)

- MDN, "Window: requestAnimationFrame()" - https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame - supports: callbacks usually match the display refresh rate; paused in most browsers in background tabs; timestamp is the end time of the previous frame's rendering - checked 2026-11-14
- MDN, "Page Visibility API" - https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API - supports: `visibilitychange` fires when the tab is hidden or shown; most browsers stop sending rAF callbacks to background tabs - checked 2026-11-14
- MDN, "Anatomy of a video game" - https://developer.mozilla.org/en-US/docs/Games/Anatomy - supports: stop the loop with `cancelAnimationFrame`; simulating the gap "can be a problem for long drops" - checked 2026-11-14
- MDN, "KeyboardEvent: code property" - https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code - supports: `code` is the physical key, unaltered by layout; suited to games using keys like a gamepad (WASD, ZQSD on AZERTY); real games track keydown and keyup instead of key repeat - checked 2026-11-14
- MDN, "KeyboardEvent: repeat property" - https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat - supports: `repeat` is true when the key is held down so that it auto-repeats - checked 2026-11-14
- MDN, "Pointer events" - https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events - supports: one model for mouse, pen and touch; `setPointerCapture`; `pointercancel`; `touch-action: none` - checked 2026-11-14
- MDN, "EventTarget: addEventListener()" - https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener - supports: the `signal` option removes the listener when its controller aborts; `passive` defaults to true for wheel, touchstart and touchmove on Window, Document, documentElement and body - checked 2026-11-14
- MDN, "Using the Gamepad API" - https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API - supports: `navigator.getGamepads()` checked in an animation loop such as requestAnimationFrame; `mapping` is "standard" for the standard layout; Firefox exposes gamepads only after the user interacts with one while the page is visible - checked 2026-11-14
- MDN, "Element: requestPointerLock()" - https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock - supports: needs transient activation; a call right after leaving lock with the default unlock gesture fails even with activation - checked 2026-11-14
- WHATWG HTML Standard, "User activation" - https://html.spec.whatwg.org/multipage/interaction.html - supports: activation-triggering events are trusted keydown, mousedown, pointerdown from a mouse, pointerup not from a mouse, and touchend - checked 2026-11-14
- MDN, "Web Audio API best practices" - https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices - supports: create or resume the context from inside a user gesture; test `state` and call `resume()` if suspended - checked 2026-11-14
- Chrome for Developers, "Autoplay policy in Chrome" - https://developer.chrome.com/blog/autoplay - supports: an AudioContext created before a user gesture starts suspended and needs `resume()` after one - checked 2026-11-14
- MDN, "Window: devicePixelRatio property" - https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio - supports: ratio of physical to CSS pixels; scale the canvas buffer and context by it; `matchMedia()` detects a ratio change such as a move to another display - checked 2026-11-14
- MDN, "ResizeObserverEntry: devicePixelContentBoxSize property" - https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize - supports: element size in device pixels, observed with `{ box: "device-pixel-content-box" }` - checked 2026-11-14
- MDN, "WebGL best practices" - https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices - supports: handle `webglcontextlost`, which can fire when the GPU runs out of memory; delete objects eagerly; `getError` and `getParameter` cause synchronous stalls; texture atlasing merges draw calls; consider `WEBGL_lose_context` when done - checked 2026-11-14
- Khronos WebGL Wiki, "HandlingContextLost" - https://wikis.khronos.org/webgl/HandlingContextLost - supports: by default a lost context never comes back; call `event.preventDefault()` in `webglcontextlost` and re-create all WebGL resources on `webglcontextrestored` - checked 2026-11-14 (plain fetch gets a bot challenge; read with the Firecrawl CLI)
- MDN, "WebGPU API" - https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API - supports: successor to WebGL; whole API needs a secure context; adapter from `requestAdapter()`; `GPUDevice.lost` resolves with a `GPUDeviceLostInfo` - checked 2026-11-14
- web.dev, "WebGPU is now supported in major browsers" (2025-11-25) - https://web.dev/blog/webgpu-supported-major-browsers - supports: WebGPU in Chrome, Edge, Firefox and Safari; Linux, Android and Intel Mac support in progress for some browsers - checked 2026-11-14
- MDN, "Window: createImageBitmap()" - https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap - supports: creates a bitmap from a source such as a Blob - checked 2026-11-14
- MDN, "ImageBitmap: close()" - https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close - supports: disposes of all graphical resources of the bitmap - checked 2026-11-14
- MDN, "Optimizing canvas" - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas - supports: pre-render repeated drawing on an offscreen canvas; `alpha: false` when no transparency is needed - checked 2026-11-14

## Bun

- Bun docs, "HTML & static sites" - https://bun.com/docs/bundler/html-static - supports: `bun ./index.html` dev server; `bun build ./index.html --outdir=dist`; assets copied and hashed, paths rewritten - checked 2026-11-14
- Bun docs, "Fullstack dev server" - https://bun.com/docs/bundler/fullstack - supports: import HTML and pass it as a route to `Bun.serve()`; development mode with hot reloading; `console: true` echoes browser logs - checked 2026-11-14
- Bun docs, "Loaders" - https://bun.com/docs/bundler/loaders - supports: the file loader resolves an import to a path and copies the file into outdir - checked 2026-11-14
- Bun docs, "TypeScript" - https://bun.com/docs/typescript - supports: recommended `lib` is `["ESNext"]` with `moduleResolution: "bundler"` - checked 2026-11-14

## Phaser (tag v4.2.1)

- Phaser README - https://github.com/phaserjs/phaser/blob/v4.2.1/README.md - supports: "fast, free, and fun open source HTML5 game framework"; scenes, loader, Arcade and Matter physics, input, cameras, tilemaps; `bun create @phaserjs/game@latest`; agent skills in `skills/`; `phaser.min.js` 345 KB gzip - checked 2026-11-14
- Phaser, v4 Migration Guide - https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md - supports: `roundPixels` defaults to false; `setTintFill` removed; `BitmapMask` removed; `setLighting(true)`; `Math.TAU` changed; `Mesh` and `Plane` removed; Canvas renderer deprecated; compressed textures need Y flipped - checked 2026-11-14
- Phaser source, `src/core/TimeStep.js` - https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/TimeStep.js - supports: delta is "a clamped and smoothed average value"; `fps.smoothStep` default true; `fps.panicMax` default 120; `forceSetTimeOut` set in config only - checked 2026-11-14
- Phaser source, `src/core/Game.js` - https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Game.js - supports: on hidden calls `loop.pause()`; on visible emits RESUME with `pauseDuration` - checked 2026-11-14
- Phaser source, `src/physics/arcade/World.js` - https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js - supports: `fixedStep` defaults to true; catch-up steps in a while loop - checked 2026-11-14
- GitHub contents API, Phaser `skills/` at v4.2.1 - https://github.com/phaserjs/phaser/tree/v4.2.1/skills - supports: 28 agent skill folders (phaserjs/phaser: 40,713 stars) - checked 2026-11-14
- jsDelivr file listing, phaser@4.2.1 - https://data.jsdelivr.com/v1/packages/npm/phaser@4.2.1 - supports: the npm package contains `skills/` - checked 2026-11-14
- Phaser agent skill, scenes - https://github.com/phaserjs/phaser/blob/v4.2.1/skills/scenes/SKILL.md - supports: operations are queued; `pause()` still renders, `sleep()` stops both; scenes update in reverse order and render in forward order - checked 2026-11-14
- Phaser agent skill, events-system - https://github.com/phaserjs/phaser/blob/v4.2.1/skills/events-system/SKILL.md - supports: remove listeners on shutdown to prevent leaks on restart - checked 2026-11-14
- Phaser agent skill, loading-assets - https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md - supports: global caches; duplicate keys silently ignored; `this.textures.remove`; `this.load.start()` outside preload; `this.load.on('progress')` - checked 2026-11-14
- Phaser agent skill, input-keyboard-mouse-touch - https://github.com/phaserjs/phaser/blob/v4.2.1/skills/input-keyboard-mouse-touch/SKILL.md - supports: `isDown` and `JustDown` polling - checked 2026-11-14
- Phaser agent skill reference, input - https://github.com/phaserjs/phaser/blob/v4.2.1/skills/input-keyboard-mouse-touch/references/REFERENCE.md - supports: the Gamepad API needs HTTPS and may need a button press first - checked 2026-11-14
- Phaser, "Phaser 4 Rendering Concepts" - https://github.com/phaserjs/phaser/blob/v4.2.1/docs/Phaser%204%20Rendering%20Concepts/Phaser%204%20Rendering%20Concepts.md - supports: no more than a few hundred draw calls; filters and RenderTextures cost draw calls; `Text` uploads a new texture on update - checked 2026-11-14
- Phaser docs, "Installing" - https://docs.phaser.io/phaser/getting-started/installation - supports: the create-game app is the easiest way to start - checked 2026-11-14
- phaserjs/template-bun, `package.json` - https://github.com/phaserjs/template-bun/blob/0513b5447c0d31e2ac35426e3559d825e4a5f791/package.json - supports: scripts run `bunx --bun vite`; `dev` and `build` run `log.js` first, `-nolog` variants do not; pins phaser 4.0.0 - checked 2026-11-14
- phaserjs/template-bun, `log.js` - https://github.com/phaserjs/template-bun/blob/0513b5447c0d31e2ac35426e3559d825e4a5f791/log.js - supports: sends an HTTPS GET request - checked 2026-11-14

## PixiJS (tag v8.23.0)

- PixiJS v8.23.0 release notes - https://github.com/pixijs/pixijs/releases/tag/v8.23.0 - supports: one `pixijs` agent skill ships in `node_modules/pixi.js/skills/`; old `pixijs-*` skills replaced; `globalpointermove` on ancestors fires once per move (pixijs/pixijs: 48,714 stars) - checked 2026-11-14
- jsDelivr file listing, pixi.js@8.23.0 - https://data.jsdelivr.com/v1/packages/npm/pixi.js@8.23.0 - supports: the npm package contains `skills/` - checked 2026-11-14
- PixiJS guide, "Introduction" - https://pixijs.com/8.x/guides/getting-started/intro - supports: "an advanced, open-source 2D rendering engine" - checked 2026-11-14
- PixiJS guide, "Ecosystem" - https://pixijs.com/8.x/guides/getting-started/ecosystem - supports: "PixiJS itself is just a rendering engine" - checked 2026-11-14
- PixiJS guide, "v8 Migration Guide" - https://pixijs.com/8.x/guides/migrations/v8 - supports: async `app.init`; `Texture.from` no longer loads URLs; ticker callbacks receive the Ticker - checked 2026-11-14
- PixiJS guide, "Assets" - https://pixijs.com/8.x/guides/components/assets - supports: bundles, background loading, `unload`, `onProgress` - checked 2026-11-14
- PixiJS guide, "Performance Tips" - https://pixijs.com/8.x/guides/concepts/performance-tips - supports: up to 16 textures per batch depending on hardware; culling disabled by default, helps when GPU-bound - checked 2026-11-14
- PixiJS API index for agents - https://pixijs.download/release/docs/llms.txt - supports: API index; the only keyboard entry is the AccessibilitySystem's keyboard navigation, and the word gamepad does not appear - checked 2026-11-14
- PixiJS source, `src/ticker/const.ts` - https://github.com/pixijs/pixijs/blob/v8.23.0/src/ticker/const.ts - supports: INTERACTION 50, HIGH 25, NORMAL 0, LOW -25 (Application render), UTILITY -50 - checked 2026-11-14
- PixiJS source, `src/app/TickerPlugin.ts` - https://github.com/pixijs/pixijs/blob/v8.23.0/src/app/TickerPlugin.ts - supports: `sharedTicker ? Ticker.shared : new Ticker()` - checked 2026-11-14
- PixiJS agent skill, `SKILL.md` - https://github.com/pixijs/pixijs/blob/v8.23.0/skills/pixijs/SKILL.md - supports: construct then `await app.init`; `eventMode = 'static'`; `destroy({ children: true })` vs `destroy(true)`; `Assets.init` first; extension-less URLs need a parser; audio resolves null; `BitmapText` for per-frame strings; `AnimatedSprite` on `Ticker.shared` - checked 2026-11-14
- PixiJS agent skill, `references/ticker.md` - https://github.com/pixijs/pixijs/blob/v8.23.0/skills/pixijs/references/ticker.md - supports: no pause on blur or visibilitychange; `deltaMS` vs `deltaTime`; `speed` scales both - checked 2026-11-14
- PixiJS agent skill, `references/application.md` - https://github.com/pixijs/pixijs/blob/v8.23.0/skills/pixijs/references/application.md - supports: `resolution: window.devicePixelRatio` with `autoDensity`; `renderer.resize`; `releaseGlobalResources` - checked 2026-11-14
- PixiJS agent skill, `references/performance.md` - https://github.com/pixijs/pixijs/blob/v8.23.0/skills/pixijs/references/performance.md - supports: alternating blend modes split batches, group by blend mode; textures over 4096 px fail on some mobile GPUs; `cullable` needs `CullerPlugin` or `Culler.shared.cull` - checked 2026-11-14
- PixiJS agent skill, `references/scene-container.md` - https://github.com/pixijs/pixijs/blob/v8.23.0/skills/pixijs/references/scene-container.md - supports: only a Container holds children - checked 2026-11-14
- pixijs/create-pixi README - https://github.com/pixijs/create-pixi/blob/1c874f743e245d0d2cc796be524e731e781b4eae/README.md - supports: `bun create pixi.js my-app --template bundler-vite`; multiplayer starter templates; Node.js 22.12 or newer - checked 2026-11-14
- pixijs/open-games, `navigation.ts` - https://github.com/pixijs/open-games/blob/83b46762a5572430a94c01091353d0fa3d9909a4/puzzling-potions/src/utils/navigation.ts - supports: screens declare `assetBundles`; `update` added to and removed from `app.ticker` - checked 2026-11-14

## Three.js (tag r187) and React Three Fiber (tag v9.8.2)

- three.js README - https://github.com/mrdoob/three.js/blob/r187/README.md - supports: "easy-to-use, lightweight, cross-browser, general-purpose 3D library" (mrdoob/three.js: 118,416 stars) - checked 2026-11-14
- three.js LLM guidance - https://threejs.org/docs/llms.txt - supports: import maps over old CDN script tags; WebGLRenderer as the mature default; WebGPURenderer for TSL - checked 2026-11-14
- three.js wiki, "Migration Guide" - https://github.com/mrdoob/three.js/wiki/Migration-Guide - supports: `Timer` in core (r179); `RGBELoader` renamed `HDRLoader` (r180); async WebGPURenderer methods deprecated (r181); `Clock` deprecated (r183); `matrixWorldNeedsUpdate` honoured (r185); `Object3D.dispose()` and `super.dispose()` (r186) - checked 2026-11-14
- three.js docs, Timer - https://github.com/mrdoob/three.js/blob/r187/docs/pages/Timer.html.md - supports: `update()` then stable `getDelta()`; `connect(document)` uses the Page Visibility API to avoid large deltas - checked 2026-11-14
- three.js docs, WebGLRenderer - https://github.com/mrdoob/three.js/blob/r187/docs/pages/WebGLRenderer.html.md - supports: always define the animation loop with `setAnimationLoop` - checked 2026-11-14
- three.js manual, WebGPURenderer - https://github.com/mrdoob/three.js/blob/r187/manual/pages/webgpurenderer.html - supports: asynchronous init; `setAnimationLoop` ensures it; still experimental; `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` unsupported - checked 2026-11-14
- three.js manual, "How to dispose of objects" - https://github.com/mrdoob/three.js/blob/r187/manual/pages/how-to-dispose-of-objects.html - supports: resources not released automatically; `ImageBitmap.close()`; `renderer.info` - checked 2026-11-14
- three.js manual, "Responsive Design" - https://github.com/mrdoob/three.js/blob/r187/manual/pages/responsive.html - supports: `setPixelRatio(devicePixelRatio)` strongly not recommended; size from client width and height - checked 2026-11-14
- three.js manual, "Installation" - https://github.com/mrdoob/three.js/blob/r187/manual/pages/installation.html - supports: npm plus a build tool recommended; import everything from one three.js version and CDN - checked 2026-11-14
- three.js manual, "Loading 3D models" - https://github.com/mrdoob/three.js/blob/r187/manual/pages/loading-3d-models.html - supports: glTF recommended where possible - checked 2026-11-14
- three.js docs, InstancedMesh - https://github.com/mrdoob/three.js/blob/r187/docs/pages/InstancedMesh.html.md - supports: reduces draw calls for shared geometry and material - checked 2026-11-14
- three.js docs, LoadingManager - https://github.com/mrdoob/three.js/blob/r187/docs/pages/LoadingManager.html.md - supports: `onProgress` callback - checked 2026-11-14
- three.js docs, PointerLockControls - https://github.com/mrdoob/three.js/blob/r187/docs/pages/PointerLockControls.html.md - supports: "a perfect choice for first person 3D games" - checked 2026-11-14
- R3F docs, Introduction - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/getting-started/introduction.mdx - supports: a React renderer for three.js; fiber 8 pairs with React 18, fiber 9 with React 19 (pmndrs/react-three-fiber: 33,730 stars) - checked 2026-11-14
- R3F docs, Hooks - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/API/hooks.mdx - supports: `useFrame` delta in seconds; ascending priority order; positive `renderPriority` disables automatic rendering; negative indices do not take over - checked 2026-11-14
- R3F docs, Pitfalls - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/advanced/pitfalls.mdx - supports: mounting is expensive; re-pool objects to spare the garbage collector; no setState in loops; `getState()` in `useFrame`; use frame deltas - checked 2026-11-14
- R3F docs, Objects - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/API/objects.mdx - supports: `dispose={null}`; primitives are not disposed; never add the same object twice - checked 2026-11-14
- R3F docs, Canvas - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/API/canvas.mdx - supports: `dpr` default `[1, 2]`; `frameloop` default `always` - checked 2026-11-14
- R3F docs, Scaling performance - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/advanced/scaling-performance.mdx - supports: each mesh is a draw call; 1000 as the very maximum, a few hundred or less optimal - checked 2026-11-14
- R3F docs, v9 migration guide - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/tutorials/v9-migration-guide.mdx - supports: `Props` renamed `CanvasProps`; `MeshProps` removed, use `ThreeElements['mesh']` - checked 2026-11-14
- R3F source, `store.ts` - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/packages/fiber/src/core/store.ts - supports: the store creates `clock: new THREE.Clock()` - checked 2026-11-14
- three.js source, `src/core/Clock.js` - https://github.com/mrdoob/three.js/blob/r187/src/core/Clock.js - supports: the constructor warns "Clock: This module has been deprecated. Please use THREE.Timer instead." - checked 2026-11-14
- three.js docs, WebGLRenderer `setSize` - https://github.com/mrdoob/three.js/blob/r187/docs/pages/WebGLRenderer.html.md - supports: `setSize(width, height, updateStyle)` applies the device pixel ratio; `updateStyle` false prevents style changes to the canvas - checked 2026-11-14
- R3F source, `loop.ts` - https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/packages/fiber/src/core/loop.ts - supports: delta from `state.clock.getDelta()`; no visibility handling in the file - checked 2026-11-14
- drei docs, useGLTF (tag v10.7.9) - https://github.com/pmndrs/drei/blob/v10.7.9/docs/loaders/gltf-use-gltf.mdx - supports: Draco decoders load from the gstatic CDN by default - checked 2026-11-14
- cloudai-x/threejs-skills - https://github.com/cloudai-x/threejs-skills - supports: agent skills including `threejs-fundamentals` and `threejs-performance` (4,192 stars, MIT) - checked 2026-11-14
- EnzeD/r3f-skills - https://github.com/EnzeD/r3f-skills - supports: agent skills including `r3f-fundamentals` (138 stars, no licence shown) - checked 2026-11-14
