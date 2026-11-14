# PixiJS 8 client

Checked against `pixi.js` 8.23.0. PixiJS calls itself a 2D rendering engine, "just a rendering engine": scenes, physics, keyboard and gamepad input, and sound are yours to add (PixiJS intro and ecosystem guides). Each rule names its source; full citations are in `sources.md`. "This skill's rule" marks a choice no source states.

## Vendor skill first

Since 8.23.0 PixiJS ships one `pixijs` agent skill inside the npm package at `node_modules/pixi.js/skills/`, replacing the old separate `pixijs-*` skills (v8.23.0 release notes). Use the `pixijs` skill if it is installed, otherwise https://pixijs.com/8.x/guides and https://pixijs.download/release/docs/llms.txt. Point any agent config that names an old `pixijs-*` skill at `skills/pixijs`.

## Setup under Bun

- `bun create pixi.js my-app --template bundler-vite` scaffolds from the official templates; game templates include `starter-web` and `starter-web-multiplayer` (Colyseus). The templates need Node.js 22.12 or newer (create-pixi README).
- This skill's rule: keep the Vite template and use Bun as package manager. No PixiJS source covers Bun's bundler.

## Application and ticker

- Construct, then `await app.init({...})`. Constructor options are ignored, and `app.renderer` is undefined until `init` resolves (`pixijs` skill; v8 migration guide, "Async Initialisation").
- Each app gets its own ticker unless `sharedTicker: true` (`src/app/TickerPlugin.ts` at v8.23.0).
- Ticker priorities: INTERACTION 50, HIGH 25, NORMAL 0, LOW -25 (application render), UTILITY -50 (`src/ticker/const.ts` at v8.23.0).
- `deltaTime` is about 1.0 per 60 fps frame, not milliseconds; use `deltaMS` for per-second rates. `ticker.speed` scales both (`pixijs` skill, `references/ticker.md`).
- The ticker does not pause on blur or `visibilitychange`; the first frame back gets the capped delta. To pause, call `app.stop()` / `app.start()` from a `visibilitychange` listener (`references/ticker.md`).
- Put game logic on `app.ticker`. `AnimatedSprite` runs on `Ticker.shared`, so stopping `app.ticker` does not pause it (`pixijs` skill).

## Scenes and cleanup

- PixiJS has no scene manager. The official sample games swap "screens": each screen lists the asset bundles it needs, loaded before it shows, and adds its `update` to `app.ticker` on show and removes it on hide (pixijs/open-games, `navigation.ts`). Copy that shape.
- Only a `Container` holds children; `Sprite`, `Graphics`, `Text` and `Mesh` are leaves (`references/scene-container.md`).
- Destroy a subtree with `destroy({ children: true })` and free loaded files with `Assets.unload(key)`. `destroy(true)` also destroys shared textures and atlases, and later renders that use them throw (`pixijs` skill).
- `app.destroy({ removeView: true, releaseGlobalResources: true })` when you tear down and re-create an app in the same tab (`references/application.md`).

## Input

- Give every object that listens `eventMode = 'static'`; the default `'passive'` never fires its own listeners. For clicks on empty canvas set `app.stage.eventMode = 'static'` and `app.stage.hitArea = app.screen` (`pixijs` skill).
- Since 8.23.0 an interactive ancestor receives `globalpointermove` once per move instead of twice; code that summed movement per call sees half as many calls (v8.23.0 release notes). Read positions, never count calls.
- The API index lists keyboard only under accessibility and has no gamepad entry (llms.txt). Use `boilerplate/input-manager.ts` for keys and pads.

## Assets

- `Texture.from(url)` no longer loads from a URL in v8; load first with `Assets` (v8 migration guide).
- `Assets.init({ basePath, manifest })` must run before the first load; a URL with no extension needs `parser: 'texture'`, and audio has no loader and resolves `null` (`pixijs` skill).
- Asset bundles, background loading and progress are in the Assets guide.

## Performance

- Sprites batch with up to 16 textures, depending on hardware. Use spritesheets (performance tips guide).
- Culling is off by default. `cullable = true` only marks eligibility; register `CullerPlugin` or call `Culler.shared.cull(...)` (`references/performance.md`). Cull when GPU-bound; it costs CPU (performance tips guide).
- Strings that change every frame (score, ping) go in `BitmapText`; each `Text` change redraws and re-uploads a canvas (`pixijs` skill).
- Textures over 4096 px on either axis fail on some mobile GPUs (`references/performance.md`).
- Resolution: `resolution: window.devicePixelRatio` with `autoDensity: true` at init; later `app.renderer.resize(w, h, window.devicePixelRatio)` (`references/application.md`).

## Where server-state interpolation hooks in

This skill's rule: the WebSocket handler only writes snapshots; it never touches display objects. Keep `ClientGameLoop` running for ticks with `onRender` unset. Add one `app.ticker` callback at `UPDATE_PRIORITY.NORMAL` (after HIGH, before the LOW render) that calls `getInterpolationData()` and the snapshot bracket from `game-state-sync`, then writes `x`, `y`, `rotation` on the views. Spawn a view on the first snapshot that names an entity; despawn with `destroy({ children: true })`.

## Version traps (PixiJS 7 code from training data)

- `new Application({...})` with options: ignored in v8. Use `await app.init`.
- Ticker callbacks receive the `Ticker`, not a delta number.
- `Texture.from(url)` without loading draws nothing.
- Adding children to a `Sprite` or `Graphics`: only `Container` takes children.
