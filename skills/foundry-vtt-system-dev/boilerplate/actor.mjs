// --- Custom Actor ---
export class MySystemActor extends Actor {
  // --- Roll Data ---
  getRollData() {
    const data = super.getRollData();

    // --- Abilities Shorthand ---
    if (data.abilities) {
      for (const [key, ability] of Object.entries(data.abilities)) {
        ability.mod = Math.floor((ability.value - 10) / 2);
        data[key] = ability.mod;
      }
    }

    // --- Level Shorthand ---
    data.level = data.level ?? 0;

    return data;
  }

  // --- Pre-Create ---
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const updates = {};

    // --- Default Items for Character ---
    if (data.type === "character") {
      const items = [
        {
          name: game.i18n.localize("MY_SYSTEM.Items.UnarmedStrike"),
          type: "weapon",
          system: { damage: "1", quantity: 1 },
        },
        {
          name: game.i18n.localize("MY_SYSTEM.Items.BasicSpell"),
          type: "spell",
          system: { description: game.i18n.localize("MY_SYSTEM.Items.BasicSpellDesc"), level: 0 },
        },
      ];
      updates.items = items;
    }

    // --- Prototype Token Defaults ---
    updates.prototypeToken = {
      texture: {
        src: this.img || "icons/svg/mystery-man.svg",
      },
      name: data.name,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
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
