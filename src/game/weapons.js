// Описание оружия и прогрессии по уровням

export const WEAPONS = {
  pistol: {
    key: "pistol",
    name: "Pistol",
    type: "bullet",
    levelRequired: 1,
    baseDamage: 6,
    baseFireRate: 1.3,
    baseRange: 800,
    bulletSpeed: 900,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
  },
  rifle: {
    key: "rifle",
    name: "Rifle",
    type: "bullet",
    levelRequired: 10,
    baseDamage: 5,
    baseFireRate: 4.0,
    baseRange: 250,
    bulletSpeed: 1100,
    pellets: 1,
    spreadDeg: 6,
    splashRadius: 0,
    splashDamage: 0,
  },
  shotgun: {
    key: "shotgun",
    name: "Shotgun",
    type: "bullet",
    levelRequired: 20,
    baseDamage: 3,
    baseFireRate: 1.4,
    baseRange: 600,
    bulletSpeed: 850,
    pellets: 7,
    spreadDeg: 25,
    splashRadius: 0,
    splashDamage: 0,
  },
  rocket: {
    key: "rocket",
    name: "Rocket Launcher",
    type: "bullet",
    levelRequired: 30,
    baseDamage: 20,
    baseFireRate: 0.8,
    baseRange: 1000,
    bulletSpeed: 700,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 80,
    splashDamage: 15,
  },
  laser: {
    key: "laser",
    name: "Laser Beam",
    type: "laser",
    levelRequired: 40,
    baseDamage: 4,
    baseFireRate: 0.1, // базовая частота 0.1 / сек
    baseRange: 250,
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
