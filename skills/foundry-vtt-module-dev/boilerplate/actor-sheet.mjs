const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2 } = foundry.applications.api;

const MODULE_ID = 'my-module';

export class HeroActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: 'hero-actor-sheet-{id}',
    classes: ['my-module', 'actor', 'hero'],
    window: {
      title: 'MY_MODULE.sheet.hero.title',
      icon: 'fa-solid fa-person-sword',
      resizable: true,
    },
    position: {
      width: 680,
      height: 520,
    },
    actions: {
      rollAbility: HeroActorSheet.#onRollAbility,
      addItem:     HeroActorSheet.#onAddItem,
      editItem:    HeroActorSheet.#onEditItem,
      deleteItem:  HeroActorSheet.#onDeleteItem,
    },
    form: {
      submitOnChange: true,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/sheet.hbs`,
      scrollable: ['.inventory-list'],
    },
  };

  // ─── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const actor = this.document;
    const system = actor.system;

    return {
      ...context,
      actor,
      system,
      items: [...actor.items].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      }),
      abilities: this.#prepareAbilities(system),
      isOwner:    actor.isOwner,
      isEditable: this.isEditable,
      classChoices: Object.fromEntries(
        CONFIG.Actor.dataModels.hero.schema.fields.characterClass.choices.map(
          c => [c, game.i18n.localize(`MY_MODULE.class.${c}`)]
        )
      ),
    };
  }

  #prepareAbilities(system) {
    const labels = {
      str: 'MY_MODULE.ability.str',
      dex: 'MY_MODULE.ability.dex',
      con: 'MY_MODULE.ability.con',
      int: 'MY_MODULE.ability.int',
      wis: 'MY_MODULE.ability.wis',
      cha: 'MY_MODULE.ability.cha',
    };

    return Object.entries(system.abilities).map(([key, score]) => ({
      key,
      score,
      mod: system.abilityModifiers?.[key] ?? Math.floor((score - 10) / 2),
      label: game.i18n.localize(labels[key]),
    }));
  }

  // ─── Action handlers ────────────────────────────────────────────────────────

  static async #onRollAbility(event, target) {
    const ability = target.dataset.ability;
    if (!ability) return;

    const actor  = this.document;
    const score  = actor.system.abilities[ability] ?? 10;
    const mod    = Math.floor((score - 10) / 2);
    const label  = game.i18n.localize(`MY_MODULE.ability.${ability}`);

    const roll = new Roll('1d20 + @mod', { mod });
    await roll.evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  game.i18n.format('MY_MODULE.roll.abilityCheck', { ability: label }),
    }, { rollMode: game.settings.get('core', 'rollMode') });
  }

  static async #onAddItem(event, target) {
    const actor = this.document;
    await actor.createEmbeddedDocuments('Item', [
      {
        name: game.i18n.localize('MY_MODULE.item.newItem'),
        type: 'equipment',
      },
    ]);
  }

  static async #onEditItem(event, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const item = this.document.items.get(itemId);
    item?.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const item = this.document.items.get(itemId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize('MY_MODULE.dialog.deleteItem.title') },
      content: game.i18n.format('MY_MODULE.dialog.deleteItem.content', { name: item.name }),
      rejectClose: false,
    });

    if (confirmed) await item.delete();
  }

  // ─── Registration ────────────────────────────────────────────────────────────

  static registerSheet() {
    Actors.registerSheet(MODULE_ID, HeroActorSheet, {
      types: ['hero'],
      makeDefault: true,
      label: 'MY_MODULE.sheet.hero.label',
    });
  }
}
