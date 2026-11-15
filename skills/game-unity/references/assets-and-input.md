# Assets and input

Checked against the Unity 6000.3 and 6000.6 package lists on 2026-11-14: Input System 1.20, Addressables 4.2 and Localization 1.5 are listed for both.

## Input: the Input System package

The legacy Input Manager is deprecated and will be removed. Use the Input System package (`com.unity.inputsystem` 1.20 on 6.3 and 6.6). Its manual names three workflows:

- **Actions**, the recommended workflow: define actions (Move, Fire) and bind them to devices, so code reads an action, not a key.
- **Actions with the `PlayerInput` component**: adds callbacks and multiplayer features.
- **Reading device state directly** from a script: for fast prototypes or single-platform apps.

Rules for this pack (this skill's):

- Sample actions into the input struct that `game-state-sync` sends each tick. The server validates it (`game-anti-cheat`); never send positions or results.
- Read input in `Update`, not `FixedUpdate`: a press that lands between two fixed steps can be missed or counted twice, and the network tick runs from `Update` (networking.md).
- The Input System 7.0 docs describe a core package for Unity 6.7 and later. Read the 1.20 docs.

## Content loading: Addressables

Addressables 4.2 is the content-loading package listed for 6.3 and 6.6.

- In CI, build content with `AddressableAssetSettings.BuildPlayerContent`. Clear old results first: call `ClearCachedData` on the data builder and `BuildCache.PurgeCache(false)` (the `false` skips a confirmation dialog). Stale cache files cause inconsistent builds.
- When CI builds several platforms, restart Unity for each one, so scripts compile for each target.
- A Player build includes Addressables content only when the **Build Addressables on Player Build** setting is on. Otherwise build content as its own step before the Player.
- Use `Resources` only for small, always-needed assets: everything in it ships in the build and loads by name (this skill's rule).

## Assets from Blender

`game-blender` covers modelling, rigging and export. On the Unity side:

- Put imported files under `Assets/` and let Unity create their `.meta` files. Commit file and `.meta` together. Moving them later outside Unity means moving the `.meta` too.
- Change import settings in the Editor or through an editor script, never by editing the `.meta` text (this skill's rule; the `.meta` holds the import settings and the GUID references depend on).
- Unity's world is left-handed with `Vector3.forward` at (0, 0, 1). Check orientation and scale of every model after the first import.

## Localization

The Localization package 1.5 holds string tables and asset tables per locale, Smart Strings for placeholders and plurals, pseudo-localization for testing, and import and export through XLIFF, CSV and Google Sheets. String IDs, plural rules and the translation process are in `game-localization`. Use the `localize-unity-project` skill if it is installed, otherwise https://docs.unity3d.com/Packages/com.unity.localization@1.5/manual/index.html.
