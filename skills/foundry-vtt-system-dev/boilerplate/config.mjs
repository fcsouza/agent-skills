/**
 * Single source of truth for system constants. Assigned to CONFIG.MY_SYSTEM
 * during init. The i18nInit hook localizes label strings in place.
 */

export const MY_SYSTEM = {};

MY_SYSTEM.id = "my-system";

MY_SYSTEM.abilities = {
  str: { label: "MY_SYSTEM.AbilityStr", abbr: "STR" },
  dex: { label: "MY_SYSTEM.AbilityDex", abbr: "DEX" },
  con: { label: "MY_SYSTEM.AbilityCon", abbr: "CON" },
  int: { label: "MY_SYSTEM.AbilityInt", abbr: "INT" },
  wis: { label: "MY_SYSTEM.AbilityWis", abbr: "WIS" },
  cha: { label: "MY_SYSTEM.AbilityCha", abbr: "CHA" },
};

MY_SYSTEM.damageTypes = {
  acid: "MY_SYSTEM.DamageAcid",
  cold: "MY_SYSTEM.DamageCold",
  fire: "MY_SYSTEM.DamageFire",
  physical: "MY_SYSTEM.DamagePhysical",
};

MY_SYSTEM.weaponProperties = {
  finesse: "MY_SYSTEM.PropertyFinesse",
  heavy: "MY_SYSTEM.PropertyHeavy",
  light: "MY_SYSTEM.PropertyLight",
  reach: "MY_SYSTEM.PropertyReach",
};
