const { fields } = foundry.data;

// --- Spell Data Model ---
export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, min: 0, max: 9, initial: 0 }),
      school: new fields.StringField({
        required: true,
        initial: "evocation",
        choices: ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"],
      }),
      formula: new fields.StringField({ required: false, blank: true, initial: "" }),
    };
  }

  // --- Migration (must return the data in v14) ---
  static migrateData(data, options) {
    return super.migrateData(data, options);
  }
}
