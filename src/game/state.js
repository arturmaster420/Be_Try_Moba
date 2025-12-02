import { BUFF_DURATIONS } from "./pickups";
import { WORLD_SIZE } from "./enemies";

export const HALF_WORLD = WORLD_SIZE / 2;

const BASE_PLAYER = {
  x: 0,
  y: 0,
  radius: 18,
  maxHp: 100,
  hp: 100,
  speed: 160,
  baseDamageMul: 1,
  damageMul: 1,
  baseFireRateMul: 1,
  fireRateMul: 1,
  rangeMul: 1,
  bulletSpeedMul: 1,
  magnetRadius: 120,
  critChance: 0.01,
  critMult: 1.5,
};

export function createInitialState() {
  return {
    player: { ...BASE_PLAYER },
    level: 1,
    xp: 0,
    xpToNext: 10,
    wave: 1,
    elapsed: 0,

    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    laserBeams: [],

    waveInProgress: false,
    fireCooldown: 0,

    tempBuffs: {
      xpBoost: 0,
      immortal: 0,
      tempDamage: 0,
      tempFireRate: 0,
      tempRange: 0,
      tempCrit: 0,
    },

    cam: { x: 0, y: 0 },

    weaponName: "Pistol",
    selectedWeaponKey: null,
  };
}

export function resetState(state) {
  const fresh = createInitialState();
  Object.keys(fresh).forEach((k) => {
    state[k] = fresh[k];
  });
}

export function tickBuffTimers(state, dt) {
  const b = state.tempBuffs;
  for (const key of Object.keys(b)) {
    if (b[key] > 0) {
      b[key] -= dt;
      if (b[key] < 0) b[key] = 0;
    }
  }
}

export function setBuff(state, buffKey) {
  const dur = BUFF_DURATIONS[buffKey];
  if (!dur) return;
  state.tempBuffs[buffKey] = Math.max(state.tempBuffs[buffKey] || 0, dur);
}
