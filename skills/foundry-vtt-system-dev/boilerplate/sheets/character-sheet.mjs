const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// --- Character Sheet ---
export class CharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  // --- Default Options ---
  static DEFAULT_OPTIONS = {
    id: "my-system-character",
    classes: ["my-system", "sheet", "actor", "character"],
    window: {
      title: "MY_SYSTEM.SheetLabels.character",
      icon: "fas fa-user",
      contentClasses: ["standard-form"],
    },
    position: {
      width: 600,
      height: 680,
    },
    actions: {
      rollAbility: CharacterSheet.#onRollAbility,
      addItem: CharacterSheet.#onAddItem,
      deleteItem: CharacterSheet.#onDeleteItem,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  // --- Template Parts ---
  static PARTS = {
    sheet: {
      template: "systems/my-system/templates/actor/character-sheet.hbs",
    },
  };

  // --- Prepare Context ---
  async _prepareContext() {
    const context = {};
    context.actor = this.actor;
    context.system = this.actor.system;
    context.isEditable = this.isEditable;

    // --- Abilities with Modifiers ---
    context.abilities = Object.entries(context.system.abilities ?? {}).map(([key, data]) => ({
      key,
      label: game.i18n.localize(`MY_SYSTEM.Abilities.${key}`),
      value: data.value,
      mod: data.mod,
    }));

    // --- Items ---
    context.items = this.actor.items.contents;

    // --- Weapons ---
    context.weapons = this.actor.items.filter((i) => i.type === "weapon");

    // --- Effects ---
    context.effects = Array.from(this.actor.allApplicableEffects());

    // --- Enriched Biography ---
    context.enrichedBiography = await TextEditor.enrichHTML(context.system.biography, {
      relativeTo: this.actor,
      async: true,
    });

    return context;
  }

  // --- Roll Ability Action ---
  static async #onRollAbility(event, target) {
    const abilityKey = target.dataset.ability;
    const ability = this.actor.system.abilities[abilityKey];
    const mod = ability.mod;

    const roll = new Roll(`1d20 + ${mod}`, this.actor.getRollData());
    await roll.evaluate();

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${game.i18n.localize(`MY_SYSTEM.Abilities.${abilityKey}`)} Check`,
    });
  }

  // --- Add Item Action ---
  static #onAddItem(event, target) {
    const type = target.dataset.type;
    Item.create(
      {
        name: game.i18n.format("MY_SYSTEM.Items.NewItem", { type }),
        type,
      },
      { parent: this.actor }
    );
  }

  // --- Delete Item Action ---
  static #onDeleteItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) {
      this.actor.items.get(itemId).delete();
    }
  }
}
