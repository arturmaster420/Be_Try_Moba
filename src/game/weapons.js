
// Описание оружия и прогрессии по уровням

export const WEAPONS = {
  pistol: {
    key: "pistol",
    name: "Pistol",
    shortLabel: "P",
    type: "bullet",
    levelRequired: 1,
    baseDamage: 8,
    baseFireRate: 2.0, // выстрелов в секунду
    baseRange: 850,
    bulletSpeed: 1000,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
  },
  rifle: {
    key: "rifle",
    name: "Rifle",
    shortLabel: "R",
    type: "bullet",
    levelRequired: 10,
    baseDamage: 7,
    baseFireRate: 4.0,
    baseRange: 900,
    bulletSpeed: 1250,
    pellets: 1,
    spreadDeg: 4,
    splashRadius: 0,
    splashDamage: 0,
  },
  shotgun: {
    key: "shotgun",
    name: "Shotgun",
    shortLabel: "SG",
    type: "pellet",
    levelRequired: 20,
    baseDamage: 4,
    baseFireRate: 1.3,
    baseRange: 520,
    bulletSpeed: 950,
    pellets: 6,
    spreadDeg: 24,
    splashRadius: 0,
    splashDamage: 0,
  },
  rocket: {
    key: "rocket",
    name: "Rocket",
    shortLabel: "RL",
    type: "rocket",
    levelRequired: 30,
    baseDamage: 22,
    baseFireRate: 1.1,
    baseRange: 900,
    bulletSpeed: 700,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 140,
    splashDamage: 18,
  },
  laser: {
    key: "laser",
    name: "Laser",
    shortLabel: "LZ",
    type: "laser",
    levelRequired: 40,
    // базовая частота — 2 луча/сек, как просил
    baseDamage: 16,
    baseFireRate: 2.0,
    baseRange: 1000,
    bulletSpeed: 0,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
  },
};

export function weaponKeyForLevel(level) {
  if (level >= 40) return "laser";
  if (level >= 30) return "rocket";
  if (level >= 20) return "shotgun";
  if (level >= 10) return "rifle";
  return "pistol";
}

export function weaponForLevel(level) {
  const key = weaponKeyForLevel(level);
  return WEAPONS[key];
}
