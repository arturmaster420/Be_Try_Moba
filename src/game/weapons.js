// Weapon definitions and progression
export const WEAPONS = {
  pistol: {
    key: "pistol",
    name: "Pistol",
    levelRequired: 1,
    baseDamage: 6,
    baseFireRate: 1.3,
    baseRange: 800,
    bulletSpeed: 700,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
    type: "bullet",
  },
  rifle: {
    key: "rifle",
    name: "Rifle",
    levelRequired: 5,
    baseDamage: 5,
    baseFireRate: 4,
    baseRange: 900,
    bulletSpeed: 900,
    pellets: 1,
    spreadDeg: 6,
    splashRadius: 0,
    splashDamage: 0,
    type: "bullet",
  },
  shotgun: {
    key: "shotgun",
    name: "Shotgun",
    levelRequired: 10,
    baseDamage: 3,
    baseFireRate: 1.4,
    baseRange: 600,
    bulletSpeed: 750,
    pellets: 7,
    spreadDeg: 25,
    splashRadius: 0,
    splashDamage: 0,
    type: "bullet",
  },
  rocket: {
    key: "rocket",
    name: "Rocket",
    levelRequired: 15,
    baseDamage: 20,
    baseFireRate: 0.8,
    baseRange: 1000,
    bulletSpeed: 500,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 60,
    splashDamage: 15,
    type: "rocket",
  },
  laser: {
    key: "laser",
    name: "Laser",
    levelRequired: 20,
    baseDamage: 6,
    baseFireRate: 2, // 2 тика в секунду
    baseRange: 800,
    bulletSpeed: 0,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
    type: "laser",
  },
};

export function weaponForLevel(level) {
  if (level >= WEAPONS.laser.levelRequired) return WEAPONS.laser;
  if (level >= WEAPONS.rocket.levelRequired) return WEAPONS.rocket;
  if (level >= WEAPONS.shotgun.levelRequired) return WEAPONS.shotgun;
  if (level >= WEAPONS.rifle.levelRequired) return WEAPONS.rifle;
  return WEAPONS.pistol;
}
