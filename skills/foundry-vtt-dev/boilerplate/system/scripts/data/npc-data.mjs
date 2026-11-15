const { fields } = foundry.data;

const abilityField = () =>
  new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
  });

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

      power: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),

      abilities: new fields.SchemaField({
        str: abilityField(),
        dex: abilityField(),
      }),

      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    };
  }

  // --- Derived Data ---
  prepareDerivedData() {
    // --- Ability Modifiers ---
    for (const ability of Object.values(this.abilities)) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }
  }

  // --- Migration (must return the data in v14) ---
  static migrateData(data, options) {
    return super.migrateData(data, options);
  }
}
