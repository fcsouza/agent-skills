const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

// --- Item Sheet ---
// Registered for every Item subtype, so the template may only read `systemFields`
// entries that exist in all of them. ItemSheetV2.DEFAULT_OPTIONS sets position
// only — the `form` block below is what makes edits persist.
export class ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["my-system", "sheet", "item"],
    window: {
      icon: "fa-solid fa-suitcase",
      contentClasses: ["standard-form"],
    },
    position: {
      width: 480,
      height: 480,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    sheet: {
      template: "systems/my-system/templates/item/item-sheet.hbs",
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.systemFields = this.item.system.schema.fields;

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { relativeTo: this.item, rollData: this.item.getRollData?.(), secrets: this.item.isOwner }
    );

    return context;
  }
}
