// --- Custom Item ---
export class MySystemItem extends Item {
  // --- Roll ---
  async roll() {
    const formula = this.system.formula ?? this.system.damage;
    if (!formula) {
      ui.notifications.warn(`${this.name} has no roll formula.`);
      return null;
    }

    const rollData = this.getRollData();

    // --- Build and Evaluate Roll ---
    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    // --- Send to Chat ---
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: this.name,
    });

    return roll;
  }

  // --- Roll Data ---
  getRollData() {
    const data = super.getRollData();

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
