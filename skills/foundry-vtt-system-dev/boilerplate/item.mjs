// --- Custom Item ---
export class MySystemItem extends Item {
  // --- Roll ---
  /**
   * Roll this item's formula to chat.
   * @param {object} [options]
   * @param {string} [options.messageMode]  A key of CONFIG.ChatMessage.modes
   *   ("public", "gm", "blind", "self", ...). Defaults to the user's
   *   core.messageMode setting. v13 `rollMode` is deprecated until v16.
   * @returns {Promise<Roll|null>}
   */
  async roll({ messageMode } = {}) {
    const formula = this.system.formula || this.system.damage;
    if (!formula) {
      ui.notifications.warn(`${this.name} has no roll formula.`);
      return null;
    }

    const rollData = this.getRollData();

    // --- Build and Evaluate Roll ---
    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    // --- Send to Chat ---
    await roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: this.name,
      },
      { messageMode }
    );

    return roll;
  }

  // --- Roll Data ---
  getRollData() {
    // Item#getRollData returns the live system model; copy before merging.
    const data = { ...super.getRollData() };

    // --- Merge Actor Roll Data ---
    if (this.actor) {
      const actorData = this.actor.getRollData();
      data.actor = actorData;
      data.abilities = actorData.abilities;
      data.level = actorData.level;
    }

    return data;
  }
}
