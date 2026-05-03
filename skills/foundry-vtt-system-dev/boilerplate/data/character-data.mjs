const { fields } = foundry.data;

// --- Character Data Model ---
export class CharacterData extends foundry.abstract.TypeDataModel {
  // --- Schema Definition ---
  static defineSchema() {
    return {
      level: new fields.NumberField({
        required: true,
        integer: true,
        min: 1,
        max: 20,
        initial: 1,
      }),

      abilities: new fields.SchemaField({
        str: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        dex: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        con: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        int: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        wis: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        cha: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
      }),

      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      }),

      power: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
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

    // --- Health Max: base + level + conMod ---
    const conMod = this.abilities.con.mod;
    this.health.max = 10 + this.level + conMod;

    // --- Armor Class: dexMod + 10 ---
    const dexMod = this.abilities.dex.mod;
    this.armorClass = dexMod + 10;
  }

  // --- Migration ---
  static migrateData(data) {
    return super.migrateData(data);
  }
}
