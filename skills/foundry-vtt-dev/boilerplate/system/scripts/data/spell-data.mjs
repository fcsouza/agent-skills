const { fields } = foundry.data;

// Single source for the school list: `choices` and migrateData read the same
// array, so they cannot drift apart.
const SCHOOLS = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
];

// --- Spell Data Model ---
export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, min: 0, max: 9, initial: 0 }),
      school: new fields.StringField({
        required: true,
        initial: "evocation",
        choices: SCHOOLS,
      }),
      formula: new fields.StringField({ required: false, blank: true, initial: "" }),
    };
  }

  // --- Migration (must return the data in v14) ---
  // `choices` makes the field non-blank and non-nullable, so a document holding
  // a renamed, empty or missing school fails validation on load. Map anything
  // off the list back onto a valid value before the field ever sees it.
  static migrateData(data, options) {
    if (!SCHOOLS.includes(data.school)) data.school = "evocation";
    return super.migrateData(data, options);
  }
}
