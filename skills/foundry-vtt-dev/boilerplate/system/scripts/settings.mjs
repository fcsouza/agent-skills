/**
 * All game.settings.register calls live here. Called once from init.
 */

export function registerSystemSettings(systemId) {
  game.settings.register(systemId, "schemaVersion", {
    name: "MY_SYSTEM.Settings.SchemaVersion",
    scope: "world",
    config: false,
    type: String,
    default: "0",
  });

  game.settings.register(systemId, "useStrictHitPoints", {
    name: "MY_SYSTEM.Settings.StrictHP",
    hint: "MY_SYSTEM.Settings.StrictHPHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}
