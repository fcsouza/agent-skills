const {
  StringField,
  NumberField,
  BooleanField,
  SchemaField,
  ArrayField,
  ObjectField,
} = foundry.data.fields;

export class HeroDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Basic identity
      characterClass: new StringField({
        required: true,
        blank: false,
        initial: 'fighter',
        choices: ['fighter', 'rogue', 'wizard', 'cleric', 'ranger', 'paladin'],
        label: 'MY_MODULE.hero.class',
      }),

      level: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        initial: 1,
        label: 'MY_MODULE.hero.level',
      }),

      biography: new StringField({
        required: false,
        blank: true,
        initial: '',
        label: 'MY_MODULE.hero.biography',
        textSearch: true,
      }),

      // Vitals
      health: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 10,
        label: 'MY_MODULE.hero.health',
      }),

      mana: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
        label: 'MY_MODULE.hero.mana',
      }),

      maxMana: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
        label: 'MY_MODULE.hero.maxMana',
      }),

      // Flags
      isNPC: new BooleanField({
        required: true,
        initial: false,
        label: 'MY_MODULE.hero.isNPC',
      }),

      // Six core abilities
      abilities: new SchemaField({
        str: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        dex: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        con: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        int: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        wis: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        cha: new NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
      }),

      // Proficient skills (list of skill keys)
      skills: new ArrayField(
        new StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),

      // Arbitrary key-value metadata (module-use, integrations, etc.)
      metadata: new ObjectField({
        required: true,
        initial: {},
        nullable: false,
      }),
    };
  }

  /**
   * Compute derived values. Called after the base data is prepared.
   * Do NOT store results back to the database here — these are ephemeral.
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    const { abilities } = this;

    // Constitution modifier drives max health (base 10 + CON modifier per level)
    const conMod = Math.floor((abilities.con - 10) / 2);
    const level = this.level ?? 1;
    this.maxHealth = 10 + (conMod * level);

    // Dexterity modifier contributes to armor class
    const dexMod = Math.floor((abilities.dex - 10) / 2);
    this.armorClass = 10 + dexMod;

    // Ability modifiers (expose for templates)
    this.abilityModifiers = Object.fromEntries(
      Object.entries(abilities).map(([key, score]) => [
        key,
        Math.floor((score - 10) / 2),
      ])
    );
  }

  /**
   * Pre-create lifecycle hook. Sets a default token image based on character class.
   * Runs before the Actor document is created in the database.
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const classTokenImages = {
      fighter: 'icons/svg/sword.svg',
      rogue:   'icons/svg/dagger.svg',
      wizard:  'icons/svg/magic-swirl.svg',
      cleric:  'icons/svg/holy-shield.svg',
      ranger:  'icons/svg/oak.svg',
      paladin: 'icons/svg/holy-shield.svg',
    };

    const characterClass = data.system?.characterClass ?? 'fighter';
    const tokenImg = classTokenImages[characterClass] ?? 'icons/svg/mystery-man.svg';

    this.parent.updateSource({
      'prototypeToken.texture.src': tokenImg,
      img: tokenImg,
    });
  }

  /**
   * Pre-update lifecycle hook. Clamps health between 0 and maxHealth before
   * the update is persisted.
   */
  async _preUpdate(changes, options, user) {
    await super._preUpdate(changes, options, user);

    if (foundry.utils.hasProperty(changes, 'system.health')) {
      const maxHealth = this.maxHealth ?? this.parent.system.maxHealth;
      const rawHealth = changes.system.health;
      changes.system.health = Math.clamp(rawHealth, 0, maxHealth);
    }
  }
}
