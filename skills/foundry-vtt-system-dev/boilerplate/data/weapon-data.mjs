const { fields } = foundry.data;

// --- Weapon Data Model ---
export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      damage: new fields.StringField({ required: true, initial: "1d6" }),
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      weight: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      price: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    };
  }
}
