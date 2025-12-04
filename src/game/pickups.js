// Типы пикапов и их базовая визуализация / длительности

export const PICKUP_TYPES = {
  hp: {
    key: "hp",
    kind: "heal",
    amount: 10,
  },
  hpMax: {
    key: "hpMax",
    kind: "perm",
    stat: "maxHp",
    amount: 10,
  },
  hpBig: {
    key: "hpBig",
    kind: "perm",
    stat: "maxHpBig",
    amount: 200,
  },
  radius: {
    key: "radius",
    kind: "perm",
    stat: "radius",
  },
  fireRate: {
    key: "fireRate",
    kind: "perm",
    stat: "fireRate",
  },
  damage: {
    key: "damage",
    kind: "perm",
    stat: "damage",
  },
  critChance: {
    key: "critChance",
    kind: "perm",
    stat: "critChance",
  },
  critDamage: {
    key: "critDamage",
    kind: "perm",
    stat: "critDamage",
  },
  range: {
    key: "range",
    kind: "perm",
    stat: "range",
  },
  xpBoost: {
    key: "xpBoost",
    kind: "temp",
    buff: "xpBoost",
  },
  immortal: {
    key: "immortal",
    kind: "temp",
    buff: "immortal",
  },
  tempDamage: {
    key: "tempDamage",
    kind: "temp",
    buff: "tempDamage",
  },
  tempFireRate: {
    key: "tempFireRate",
    kind: "temp",
    buff: "tempFireRate",
  },
  tempRange: {
    key: "tempRange",
    kind: "temp",
    buff: "tempRange",
  },
  tempCrit: {
    key: "tempCrit",
    kind: "temp",
    buff: "tempCrit",
  },
};

export const BUFF_DURATIONS = {
  xpBoost: 30,
  immortal: 10,
  tempDamage: 25,
  tempFireRate: 25,
  tempRange: 25,
  tempCrit: 25,
};
