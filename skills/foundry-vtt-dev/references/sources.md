# Sources

Each page, release note, package listing or source file below was opened on 2026-11-15. Foundry publishes no llms.txt, MCP server or agent skill (foundryvtt.com/llms.txt returns 404; the foundryvtt GitHub organisation has none), so the API docs and release notes are the primary sources.

## Versions and release notes

- Foundry Gaming, "API Documentation - Version 14" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/index.html - supports: "Public API documentation for Foundry Virtual Tabletop version 14.370 Stable" - checked 2026-11-15
- Foundry Gaming, "Release 14.370" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.370 - supports: Version 14 Stable 12, November 02, 2026; "The new Grid Space Tool allows you to select individual Grid Spaces that you want to include (or exclude) in a Region"; "Added CONFIG.Region.templateModeConfig to allow systems to configure Measured Template Mode"; "CONFIG.Region.templateModeConfig.gridBased" - checked 2026-11-15
- Foundry Gaming, "Release 14.352" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.352 - supports: "CONFIG.statusEffects has been changed from StatusEffectConfig[] to {[id: string]: StatusEffectConfig} with backwards compatibility"; "The legacy system template.json specification has entered its deprecation period"; "The layerClass property of Canvas Document CONFIG entries is now deprecated and will be removed in the future" - checked 2026-11-15
- Foundry Gaming, "Release 14.355" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.355 - supports: "Upgraded Electron to version 40 and increased the minimum Node version to 24"; message modes replace roll modes; "Backwards compatible support for old roll modes is preserved until V16" - checked 2026-11-15
- Foundry Gaming, "Release 14.365" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.365 - supports: "Fixed a bug where _replace / _del operators nested inside _replace were not applied", the notes' name for the operator globals - checked 2026-11-15
- Foundry Gaming, "Release 14.356" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.356 - supports: "Measured Templates are gone!" with Template Regions as the replacement (repeated in 14.359); animejs added as a core dependency for the opt-in VFX framework, exposed as globalThis.animejs - checked 2026-11-15
- Foundry Gaming, "Release 14.359" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.359 - supports: first v14 Stable; repeats "Measured Templates are gone!"; a module that causes a world quickstart is recorded under relationships.required with compatibility.minimum set to the module version - checked 2026-11-15
- Foundry Gaming, "Release 14.361" (foundryvtt.com, 2026) - https://foundryvtt.com/releases/14.361 - supports: "Foundry VTT now serves HTML files with a "text/plain" content type and such files can still be used in downstream processing like template rendering" - checked 2026-11-15
- Foundry Gaming, "Release notes 13.332" (github.com/foundryvtt/foundryvtt, 2025) - https://github.com/foundryvtt/foundryvtt/blob/master/releases/notes-13.332.html - supports: classes moved under the foundry namespace keep their old global name "with a deprecation warning and redirect that will remain in place until Version 15" - checked 2026-11-15
- Foundry Gaming, "Release notes 13.335" (github.com/foundryvtt/foundryvtt, 2025) - https://github.com/foundryvtt/foundryvtt/blob/master/releases/notes-13.335.html - supports: "Added User#query, which allows a user to send a query registered in CONFIG.queries to another user for a response" - checked 2026-11-15
- Foundry Gaming, "Issue 11235: User#query" (github.com/foundryvtt/foundryvtt, 2025) - https://github.com/foundryvtt/foundryvtt/issues/11235 - supports: "The querying user needs the QUERY_USER permission to be able to send a query" - checked 2026-11-15

## Knowledge base articles

- Foundry Gaming, "Requirements" (foundryvtt.com, 2026) - https://foundryvtt.com/article/requirements/ - supports: "22 is required for V13 and below and 24 is required for V14 and above" - checked 2026-11-15
- Foundry Gaming, "Module Development" (foundryvtt.com, 2026) - https://foundryvtt.com/article/module-development/ - supports: authors keys name, email, discord, url; esmodules is "The preferred method for including Javascript"; socket namespace request; manifest and download URL roles - checked 2026-11-15
- Foundry Gaming, "Module Sub-Types" (foundryvtt.com, 2026) - https://foundryvtt.com/article/module-sub-types/ - supports: "The sub-type names are automatically prefixed by your Module's ID"; register CONFIG dataModels and sheets with the prefixed key ("quest-pages.quest") - checked 2026-11-15
- Foundry Gaming, "System Development" (foundryvtt.com, 2026) - https://foundryvtt.com/article/system-development/ - supports: "Custom Document sub-types drive the majority of the implementation of the System" through documentTypes in system.json - checked 2026-11-15
- Foundry Gaming, "Backups" (foundryvtt.com, 2026) - https://foundryvtt.com/article/backups/ - supports: "find the World you want to back up in the setup screen, right click it, and select "Take Backup""; "Restore Latest" restores the most recent backup - checked 2026-11-15
- Foundry Gaming, "Submit a Package" (foundryvtt.com, 2026) - https://foundryvtt.com/packages/submit - supports: package submission page - checked 2026-11-15

## API pages (v14)

- Foundry Gaming, "CONFIG.statusEffects" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/variables/CONFIG.statusEffects.html - supports: type `{ [id: string]: StatusEffectConfig }` - checked 2026-11-15
- Foundry Gaming, "CONFIG.Region" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/variables/CONFIG.Region.html - supports: `templateModeConfig: RegionTemplateModeConfig` alongside documentClass, objectClass, sidebar - checked 2026-11-15
- Foundry Gaming, "RegionTemplateModeConfig" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/interfaces/foundry.types.RegionTemplateModeConfig.html - supports: fields color, coneAngle, coneCurvature, displayMeasurements, gridBased, highlightMode, restriction, ringAlignment, shapeTypes, visibility - checked 2026-11-15
- Foundry Gaming, "CONFIG.queries (v14)" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/variables/CONFIG.queries.html - supports: "System and modules must prefix the names of the queries they register"; "Non-prefixed query names are reserved by core"; in v14 core's dialog handler takes a second argument `{ user: User }` - checked 2026-11-15
- Foundry Gaming, "CONFIG.queries (v13)" (foundryvtt.com, 2025) - https://foundryvtt.com/api/v13/variables/CONFIG.queries.html - supports: in v13 the dialog handler takes one argument, so the `{ user }` context is v14 only; the community wiki describes the v13 second argument as timeout information - checked 2026-11-15
- Foundry Gaming, "User" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.documents.User.html - supports: `query(queryName, queryData, queryOptions?: { timeout })`; `targets: Set<Token>` - checked 2026-11-15
- Foundry Gaming, "Users" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.documents.collections.Users.html - supports: activeGM "Get one User who is an active Gamemaster (non-assistant if possible), or null if no active GM is available" - checked 2026-11-15
- Foundry Gaming, "Actor" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.documents.Actor.html - supports: `canUserModify(user, action, data?)` "Test whether a given User has permission to perform some action on this Document"; `testUserPermission(user, permission, options?)` - checked 2026-11-15
- Foundry Gaming, "CONST.USER_PERMISSIONS" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/variables/CONST.USER_PERMISSIONS.html - supports: REGION_CREATE and QUERY_USER exist; TEMPLATE_CREATE is absent - checked 2026-11-15
- Foundry Gaming, "DialogV2" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.applications.api.DialogV2.html - supports: `confirm()` resolves true for yes, false for no, null when dismissed with rejectClose false - checked 2026-11-15
- Foundry Gaming, "Notifications" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.applications.ui.Notifications.html - supports: `warn("LOCALIZED.WARNING.MESSAGE", { localize: true })` - checked 2026-11-15
- Foundry Gaming, "RollParser" and "Roll" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.dice.RollParser.html - supports: static `flattenTree(root)`; Roll static `instantiateAST(ast)` - checked 2026-11-15
- Foundry Gaming, "BaseRegion" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.documents.BaseRegion.html - supports: `_migrateMeasuredTemplateData` exists on the v14 page - checked 2026-11-15

- Foundry Gaming, "foundry.data.operators" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/modules/foundry.data.operators.html - supports: the namespace lists classes DataFieldOperator, ForcedDeletion, ForcedReplacement; `_del` and `_replace` are not listed there - checked 2026-11-15
- Foundry Gaming, "Document" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.abstract.Document.html - supports: static `canUserCreate(user)` "does not guarantee that the User is able to create all Documents of this type"; `canUserModify(user, action, data)` - checked 2026-11-15
- Foundry Gaming, "DocumentClassMetadata" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/interfaces/foundry.abstract.types.DocumentClassMetadata.html - supports: permission actions are "view", "create", "update", "delete" - checked 2026-11-15
- Foundry Gaming, "Item" (foundryvtt.com, 2026) - https://foundryvtt.com/api/v14/classes/foundry.documents.Item.html - supports: static `implementation` returns the configured subclass; the constructor's data object "may be mutated" - checked 2026-11-15

## Sockets, queries and permission checks

- Foundry Gaming, "Crucible: message-rest.mjs" (github.com/foundryvtt/crucible, 2026) - https://github.com/foundryvtt/crucible/blob/master/module/models/message-rest.mjs - supports: query handlers take `({...}, {user})` and refuse unless `actor.testUserPermission(user, "OWNER")`; registered in CONFIG.queries in crucible.mjs - checked 2026-11-15
- Foundry VTT Community Wiki, "Sockets" (foundryvtt.wiki, 2026) - https://foundryvtt.wiki/en/development/api/sockets - supports: "socket": true in the manifest; event names module.{id} or system.{id}; listeners get only the emitted arguments and the emitter does not receive its own event; "direct sockets do not have any built-in permission controls, while queries have the QUERY_USER permission which is available to all players by default"; game.users.activeGM for delegating to one GM - checked 2026-11-15
- Foundry VTT Community Wiki, "CSS Cascade Layers" (foundryvtt.wiki, 2025) - https://foundryvtt.wiki/en/development/guides/css-cascade-layers - supports: layer order reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions (13.334); a plain string style lands in the package layer; "layer": null leaves the sheet unlayered, above every layered rule - checked 2026-11-15

## Tooling

- Foundry Gaming, "foundryvtt-cli README" (github.com, 2026) - https://github.com/foundryvtt/foundryvtt-cli - supports: `fvtt package workon "1001-fish" --type "Module"`, `fvtt package unpack`, `fvtt package pack`, `fvtt package clear`; examples use `-n`, `--outputDirectory` and `--inputDirectory`; `yaml` is an option of the library functions, not a documented flag; no extract verb - checked 2026-11-15
- npm, "@foundryvtt/foundryvtt-cli" (npmjs.com, 2026) - https://www.npmjs.com/package/@foundryvtt/foundryvtt-cli - supports: latest 3.0.5 - checked 2026-11-15
- npm, "fvtt-types" (npmjs.com, 2026) - https://www.npmjs.com/package/fvtt-types - supports: dist-tags latest 13.346.0-beta.20250812191140, prerelease 14.366.0-beta.20260816170037, beta 14.370.0-beta.20261107215328 - checked 2026-11-15
- League of Foundry Developers, "foundry-vtt-types README" (github.com, 2026) - https://github.com/League-of-Foundry-Developers/foundry-vtt-types - supports: install instructions cover v13 only - checked 2026-11-15
- npm, "vite" (npmjs.com, 2026) - https://www.npmjs.com/package/vite - supports: latest 8.3.8; the boilerplate builds with it and dist holds every manifest path - checked 2026-11-15
- npm, "ultracite" (npmjs.com, 2026) - https://www.npmjs.com/package/ultracite - supports: latest 8.2.1 with init, check and fix commands; peer @biomejs/biome ^2.6.2 - checked 2026-11-15
- Ultracite, "ultracite init" (local run of ultracite 8.2.1, 2026) - https://www.npmjs.com/package/ultracite - supports: `ultracite init --pm bun --linter biome -y` writes `biome.jsonc` extending "ultracite/biome/core" and a `.gitignore`; Biome then needs that ignore file - checked 2026-11-15
- npm, "less" (npmjs.com, 2026) - https://www.npmjs.com/package/less - supports: 4.9.1, the version the system `build:css` step was run with - checked 2026-11-15
- npm, "@biomejs/biome" (npmjs.com, 2026) - https://www.npmjs.com/package/@biomejs/biome - supports: 2.6.8, the version pinned in the boilerplate - checked 2026-11-15
- GitHub, "actions/checkout releases" (github.com, 2026) - https://github.com/actions/checkout/releases - supports: latest v7.0.1, tag commit 3d3c42e5aac5ba805825da76410c181273ba90b1 - checked 2026-11-15
- softprops, "action-gh-release releases" (github.com, 2026) - https://github.com/softprops/action-gh-release/releases - supports: latest v3.0.4 (2026-11-05), tag commit 8a0cd651e5b2365bd640854a3fa5dfc70e4875f3; inputs files, generate_release_notes; README sets `permissions: contents: write` - checked 2026-11-15
- Oven, "setup-bun releases" (github.com, 2026) - https://github.com/oven-sh/setup-bun/releases - supports: latest v2.2.0, tag commit 0c5077e51419868618aeaa5fe8019c62421857d6 - checked 2026-11-15
- GitHub, "Secure use reference" (docs.github.com, 2026) - https://docs.github.com/en/actions/reference/security/secure-use - supports: pin actions to a full-length commit SHA - checked 2026-11-15

## Reference implementations

- Foundry Gaming, "dnd5e" (github.com, 2026) - https://github.com/foundryvtt/dnd5e - supports: production system layout, barrel files, migration flags - checked 2026-11-15
- Foundry Gaming, "pf2e" (github.com, 2026) - https://github.com/foundryvtt/pf2e - supports: registers a system query in CONFIG.queries (src/scripts/hooks/load.ts) - checked 2026-11-15
