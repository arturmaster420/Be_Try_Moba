
// Типы пикапов и их базовая логика

export const PICKUP_TYPES = {
  xpSmall: {
    key: "xpSmall",
    kind: "xp",
    amount: 8,
    radius: 9,
    color: "#facc15",
  },
  xpBig: {
    key: "xpBig",
    kind: "xp",
    amount: 25,
    radius: 11,
    color: "#f97316",
  },
  hpSmall: {
    key: "hpSmall",
    kind: "heal",
    amount: 18,
    radius: 10,
    color: "#ef4444",
  },
  tempDamage: {
    key: "tempDamage",
    kind: "temp",
    buff: "tempDamage",
    radius: 11,
    color: "#fb7185",
  },
  tempFireRate: {
    key: "tempFireRate",
    kind: "temp",
    buff: "tempFireRate",
    radius: 11,
    color: "#38bdf8",
  },
  tempRange: {
    key: "tempRange",
    kind: "temp",
    buff: "tempRange",
    radius: 11,
    color: "#a855f7",
  },
  tempCrit: {
    key: "tempCrit",
    kind: "temp",
    buff: "tempCrit",
    radius: 11,
    color: "#fbbf24",
  },
};

export const BUFF_DURATIONS = {
  xpBoost: 30,
  immortal: 6,
  tempDamage: 25,
  tempFireRate: 25,
  tempRange: 25,
  tempCrit: 25,
};

// Создание пикапа при смерти врага
export function createPickupForEnemy(enemy) {
  // базовый ХР орб
  const roll = Math.random();

  if (roll < 0.1) return { type: PICKUP_TYPES.hpSmall.key, x: enemy.x, y: enemy.y };
  if (roll < 0.18) return { type: PICKUP_TYPES.tempDamage.key, x: enemy.x, y: enemy.y };
  if (roll < 0.24) return { type: PICKUP_TYPES.tempFireRate.key, x: enemy.x, y: enemy.y };
  if (roll < 0.30) return { type: PICKUP_TYPES.tempRange.key, x: enemy.x, y: enemy.y };
  if (roll < 0.34) return { type: PICKUP_TYPES.tempCrit.key, x: enemy.x, y: enemy.y };

  // по-умолчанию — маленький ХР
  const kind = roll > 0.8 ? PICKUP_TYPES.xpBig : PICKUP_TYPES.xpSmall;
  return { type: kind.key, x: enemy.x, y: enemy.y };
}
