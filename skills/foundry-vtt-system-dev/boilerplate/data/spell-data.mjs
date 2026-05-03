const { fields } = foundry.data;

// --- Spell Data Model ---
export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, min: 0, max: 9, initial: 0 }),
      school: new fields.StringField({ required: true, initial: "evocation" }),
      formula: new fields.StringField({ required: false, blank: true, initial: "" }),
    };
  }
}
