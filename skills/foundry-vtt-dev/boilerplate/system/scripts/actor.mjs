// --- Custom Actor ---
// Active effects: do not override applyActiveEffects unless the system needs a
// custom phase. v14 applies effects per phase (see Actor#applyActiveEffects)
// and reads changes from effect.system.changes.
export class MySystemActor extends Actor {
  // --- Roll Data ---
  getRollData() {
    // Actor#getRollData returns the live system model. Copy it before adding
    // shorthands so roll data never mutates prepared data.
    const system = super.getRollData();
    const data = { ...system, abilities: foundry.utils.deepClone(system.abilities ?? {}) };

    // --- Abilities Shorthand: @str, @dex, ... resolve to the modifier ---
    for (const [key, ability] of Object.entries(data.abilities)) {
      data[key] = ability.mod ?? 0;
    }

    // --- Level Shorthand ---
    data.level = data.level ?? 0;

    return data;
  }

  // --- Pre-Create ---
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const updates = {};

    // --- Default Items for Character ---
    if (data.type === "character" && !data.items?.length) {
      updates.items = [
        {
          name: _loc("MY_SYSTEM.Items.UnarmedStrike"),
          type: "weapon",
          system: { damage: "1", quantity: 1 },
        },
        {
          name: _loc("MY_SYSTEM.Items.BasicSpell"),
          type: "spell",
          system: { description: _loc("MY_SYSTEM.Items.BasicSpellDesc"), level: 0 },
        },
      ];
    }

    // --- Prototype Token Defaults ---
    updates.prototypeToken = {
      texture: {
        src: this.img || "icons/svg/mystery-man.svg",
      },
      name: data.name,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
      // These match primary/secondaryTokenAttribute in system.json. Every type
      // must declare both paths, or the bar resolves to nothing.
      bar1: { attribute: "health" },
      bar2: { attribute: "power" },
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
      sight: {
        enabled: true,
        range: 0,
      },
    };

    this.updateSource(updates);
  }
}
