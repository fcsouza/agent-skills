const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

// --- Character Sheet ---
// Drag and drop is built into ActorSheetV2 (v14): dropping an Item, Actor,
// ActiveEffect or Folder onto the sheet routes through _onDrop →
// _onDropDocument → _onDropItem/_onDropActiveEffect/... Override those
// protected methods only to change the default behaviour.
export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // --- Default Options ---
  static DEFAULT_OPTIONS = {
    classes: ["my-system", "sheet", "actor", "character"],
    window: {
      icon: "fa-solid fa-user",
      contentClasses: ["standard-form"],
    },
    position: {
      width: 600,
      height: 680,
    },
    actions: {
      rollAbility: CharacterSheet.#onRollAbility,
      rollItem: CharacterSheet.#onRollItem,
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
  async _prepareContext(options) {
    // DocumentSheetV2 supplies document, source, fields, editable, user, rootId.
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.systemFields = this.actor.system.schema.fields;

    // --- Abilities with Modifiers ---
    context.abilities = Object.entries(context.system.abilities).map(([key, data]) => ({
      key,
      label: CONFIG.MY_SYSTEM.abilities[key]?.label ?? key,
      value: data.value,
      mod: data.mod,
    }));

    // --- Weapons ---
    context.weapons = this.actor.items.filter((i) => i.type === "weapon");

    // --- Effects (v14: changes live in effect.system.changes) ---
    context.effects = Array.from(this.actor.allApplicableEffects()).map((effect) => ({
      id: effect.id,
      name: effect.name,
      img: effect.img,
      disabled: effect.disabled,
      changes: effect.system.changes.map((c) => `${c.key} ${c.type} ${c.value}`).join(", "),
    }));

    // --- Enriched Biography ---
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.biography,
      { relativeTo: this.actor, rollData: this.actor.getRollData(), secrets: this.actor.isOwner }
    );

    return context;
  }

  // --- Roll Ability Action ---
  static async #onRollAbility(event, target) {
    const abilityKey = target.dataset.ability;
    const ability = this.actor.system.abilities[abilityKey];
    if (!ability) return;

    const roll = new Roll(`1d20 + @${abilityKey}`, this.actor.getRollData());
    await roll.evaluate();

    // messageMode: a key of CONFIG.ChatMessage.modes. Omit it to use the
    // user's core.messageMode setting.
    await roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${CONFIG.MY_SYSTEM.abilities[abilityKey]?.label ?? abilityKey} ${_loc("MY_SYSTEM.Check")}`,
      },
      { messageMode: event.shiftKey ? "gm" : undefined }
    );
  }

  // --- Roll Item Action ---
  static async #onRollItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    await item?.roll();
  }

  // --- Add Item Action ---
  static async #onAddItem(event, target) {
    const type = target.dataset.type;
    await Item.implementation.create(
      {
        name: _loc("MY_SYSTEM.Items.NewItem", { type }),
        type,
      },
      { parent: this.actor }
    );
  }

  // --- Delete Item Action ---
  static async #onDeleteItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    await this.actor.items.get(itemId)?.delete();
  }
}
