const { fields } = foundry.data;

const abilityField = () =>
  new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
  });

// --- Character Data Model ---
// Declared in system.json `documentTypes.Actor.character` and registered in
// CONFIG.Actor.dataModels. This class, not template.json, defines the data.
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
        str: abilityField(),
        dex: abilityField(),
        con: abilityField(),
        int: abilityField(),
        wis: abilityField(),
        cha: abilityField(),
      }),

      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      }),

      power: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
      }),

      // Declared in system.json documentTypes.Actor.character.filePathFields so
      // the server cleans the path on save.
      portrait: new fields.FilePathField({ categories: ["IMAGE"] }),

      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    };
  }

  // --- Derived Data ---
  prepareDerivedData() {
    // --- Ability Modifiers ---
    for (const ability of Object.values(this.abilities)) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }

    // --- Health Max: base + level + conMod ---
    this.health.max = 10 + this.level + this.abilities.con.mod;

    // --- Armor Class: dexMod + 10 ---
    this.armorClass = this.abilities.dex.mod + 10;
  }

  // --- Migration ---
  // v14 requires migrateData to return the data. Mutate `data` in place for
  // legacy shapes, then return super.migrateData(data, options).
  static migrateData(data, options) {
    if (typeof data.abilities?.str === "number") {
      for (const [key, value] of Object.entries(data.abilities)) {
        if (typeof value === "number") data.abilities[key] = { value };
      }
    }
    return super.migrateData(data, options);
  }
}
