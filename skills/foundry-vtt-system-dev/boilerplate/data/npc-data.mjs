const { fields } = foundry.data;

// --- NPC Data Model ---
export class NpcData extends foundry.abstract.TypeDataModel {
  // --- Schema Definition ---
  static defineSchema() {
    return {
      cr: new fields.NumberField({
        required: true,
        integer: true,
        min: 0,
        max: 30,
        initial: 1,
      }),

      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      }),

      abilities: new fields.SchemaField({
        str: new fields.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        dex: new fields.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
      }),

      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    };
  }

  // --- Derived Data ---
  prepareDerivedData() {
    // --- Ability Modifiers ---
    for (const [key, value] of Object.entries(this.abilities)) {
      const mod = Math.floor((value - 10) / 2);
      this.abilities[key] = { value, mod };
    }
  }

  // --- Migration ---
  static migrateData(data) {
    return super.migrateData(data);
  }
}
