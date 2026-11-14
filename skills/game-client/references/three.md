# Three.js and React Three Fiber client

Checked against `three` 0.187.0 (r187), `@types/three` 0.187.0 and `@react-three/fiber` 9.8.2. Each rule names its source; full citations are in `sources.md`. "This skill's rule" marks a choice no source states.

## Vendor skills first

- three.js publishes agent guidance at https://threejs.org/docs/llms.txt. Use the `threejs-fundamentals` and `threejs-performance` skills (cloudai-x/threejs-skills) if they are installed, otherwise https://threejs.org/docs/llms.txt and https://threejs.org/manual/.
- For R3F, use the `r3f-fundamentals` skill (EnzeD/r3f-skills) if it is installed, otherwise https://r3f.docs.pmnd.rs/.

## Plain three.js or R3F

No official page compares them. This skill's rule:
- R3F when the client is already a React app (menus, lobby, HUD in React) and the scene is mostly long-lived objects. R3F must match the React major: fiber 9 pairs with React 19 (R3F introduction), and fiber 9.8.2 declares `react >=19 <19.4` (npm peer dependencies).
- Plain three.js when the hot path is many server entities spawned, moved and despawned every snapshot. R3F's own advice for that path is to mutate refs in `useFrame` and avoid mounting, so React adds little there.

## Setup under Bun

- Install `three` from npm and use a build tool; the manual calls this the recommended approach. Addons import from `three/addons/...` inside the same package. Import every three.js file from one version: mixed sources can duplicate code or break the app (three.js manual, Installation).
- `llms.txt` tells agents to load three.js through an import map, never the old script tag. That is the no-bundler path; with Bun or Vite, use the npm package.
- Types: `bun add -d @types/three@0.187.0`, matching `three`.
- This skill's rule: for plain three.js, Bun's HTML dev server (`bun ./index.html`, see `references/web.md`) is the lighter path; no three.js page covers Bun, so confirm with one `bun build` before you rely on it. For R3F, a React app, keep the Vite setup the React app already uses.

## Loop and timing

- Drive frames with `renderer.setAnimationLoop(callback)`; the docs advise it over a hand-written `requestAnimationFrame` (WebGLRenderer docs). With `WebGPURenderer` it also makes sure the asynchronous init has finished before the first frame; with your own loop, `await renderer.init()` first (manual, WebGPURenderer).
- Use `THREE.Timer`, not `Clock`: `Clock` is deprecated since r183, and `Timer` moved into core in r179 (Migration Guide). Call `timer.update(timestamp)` once per frame, then `getDelta()` returns the same value however often you call it. `timer.connect(document)` uses the Page Visibility API to avoid a huge delta after a hidden tab (Timer docs).
- Under R3F 9 with three r183 or later, the console shows "Clock: This module has been deprecated" once: R3F 9.8.2's store creates `new THREE.Clock()` (`packages/fiber/src/core/store.ts`), and three's `Clock` constructor logs that warning (`src/core/Clock.js` at r187). It is expected and needs no action in your code.
- R3F: `useFrame((state, delta) => ...)` runs before each rendered frame; delta is in seconds (R3F hooks). Move by `delta`, not fixed amounts, or speed depends on the refresh rate (R3F pitfalls).
- R3F 9 computes delta with `state.clock.getDelta()` (`packages/fiber/src/core/loop.ts` at v9.8.2), and that file has no visibility handling. This skill's rule: clamp delta after a hidden tab.

## Scenes and cleanup

- Geometries, materials, textures and render targets are not released automatically; call their `dispose()`. Removing a mesh from the scene frees nothing. For an `ImageBitmap` texture source, also call `ImageBitmap.close()`. Check `renderer.info` to find leaks (manual, How to dispose of objects).
- r186 added `Object3D.dispose()`; custom subclasses that define `dispose()` must call `super.dispose()` (Migration Guide).
- R3F calls `dispose()` on unmount. Put `dispose={null}` on objects you cache yourself; it covers the whole subtree. `<primitive object>` is never disposed for you, and the same object must not be added twice (R3F objects).
- R3F: mounting is expensive, since every material compiles and every geometry is processed (R3F pitfalls). This skill's rule: pool entity views and toggle `visible` instead of mounting per spawn.

## Input

- three.js has no keyboard or gamepad layer; use `boilerplate/input-manager.ts`.
- `PointerLockControls` is "a perfect choice for first person 3D games" (PointerLockControls docs). The pointer-lock rules in `references/web.md` still apply.
- R3F: never `setState` in `useFrame` or in fast events; mutate refs (R3F pitfalls).

## Assets

- Prefer glTF (`.glb` or `.gltf`) where possible (manual, Loading 3D models).
- drei 10.7.9's `useGLTF` loads Draco decoders from the gstatic CDN by default (drei `useGLTF` docs). This skill's rule: pass a self-hosted decoder path for offline or locked-down deploys.

## Performance

- "Each mesh is a draw call": a few hundred is the target, 1000 the maximum (R3F, Scaling performance).
- `InstancedMesh` cuts draw calls when many objects share geometry and material (InstancedMesh docs).
- Pixel ratio: the manual calls `renderer.setPixelRatio(window.devicePixelRatio)` strongly not recommended and sizes the drawing buffer from the canvas's client size instead (manual, Responsive). `boilerplate/canvas-size.ts` does that. Wire it with `renderer.setPixelRatio(1)`, then in its callback `renderer.setSize(w, h, false)`, `camera.aspect = w / h` and `camera.updateProjectionMatrix()`. The sizes it passes are device pixels, and `setSize`'s third argument `false` stops three.js from writing the canvas's CSS size (WebGLRenderer docs); with the default `true`, the CSS box grows, the observer fires, and on a 2x screen the buffer grows without end. R3F's `<Canvas dpr>` defaults to `[1, 2]` (R3F Canvas).

## WebGPURenderer

- The manual calls it still experimental. `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile()` changes do not work with it (manual, WebGPURenderer). `llms.txt` says to keep `WebGLRenderer` as the default and pick `WebGPURenderer` for TSL, compute and node materials.
- `renderAsync()` and the other async `WebGPURenderer` methods are deprecated since r181 (Migration Guide).

## Where server-state interpolation hooks in

This skill's rule:
- Plain three.js: never call `ClientGameLoop.start()`. In the `setAnimationLoop` callback, before `renderer.render()`, call `timer.update(timestamp)` and, unless `gate.paused` (`engineDrivenLoop` in `boilerplate/visibility-resync.ts`), `loop.step(timestamp)`, then read `loop.getRenderState()` and the snapshot bracket from `game-state-sync`, and write position and quaternion on each entity's `Object3D`. If you set `matrixAutoUpdate = false` and write `matrix` yourself, also set `matrixWorldNeedsUpdate = true` (Migration Guide, r185).
- R3F: one `useFrame` with a negative priority calls `loop.step(performance.now())` unless `gate.paused`, reads `loop.getRenderState()`, and writes interpolated transforms into refs before other callbacks. Callbacks run in ascending priority; a negative value orders them without taking over rendering, while a positive one turns off automatic rendering (R3F hooks). Read snapshot data from a store with `getState()` inside `useFrame`, never through a reactive selector (R3F pitfalls).

## Version traps (older three.js and R3F code from training data)

- `THREE.Clock` (deprecated r183) and an addon import of `Timer` (core since r179).
- `RGBELoader` is `HDRLoader` since r180.
- `renderAsync()` on `WebGPURenderer` (deprecated r181).
- R3F 9: the Canvas `Props` type is `CanvasProps`, and hardcoded JSX types such as `MeshProps` are gone; use `ThreeElements['mesh']` (R3F v9 migration guide).
- Fiber 8 pairs with React 18; fiber 9 with React 19 (R3F introduction).
