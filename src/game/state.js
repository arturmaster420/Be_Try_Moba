import { TEMP_BUFF_DURATIONS } from "./pickups";

export const WORLD_SIZE = 6000;
export const HALF_WORLD = WORLD_SIZE / 2;

export const BASE_PLAYER = {
  hp: 100,
  maxHp: 100,
  speed: 220,
  radius: 18,
  magnetRadius: 120,
  baseDamageMul: 1,
  baseFireRateMul: 1,
  baseRangeMul: 1,
  baseBulletSpeedMul: 1,
  critChance: 0.01, // 1%
  critMult: 1.5,
};

export function createInitialState(width, height) {
  return {
    w: width,
    h: height,
    elapsed: 0,
    player: {
      x: 0,
      y: 0,
      ...BASE_PLAYER,
      damageMul: 1,
      fireRateMul: 1,
      rangeMul: 1,
      bulletSpeedMul: 1,
      hp: BASE_PLAYER.hp,
      maxHp: BASE_PLAYER.maxHp,
      magnetRadius: BASE_PLAYER.magnetRadius,
      immortalTimer: 0,
      xpBoostTimer: 0,
    },
    weaponName: "Pistol",
    bullets: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    wave: 1,
    waveInProgress: false,
    xp: 0,
    level: 1,
    xpToNext: 10,
    tempBuffs: {
      tempDamage: 0,
      tempFireRate: 0,
      tempRange: 0,
      tempCrit: 0,
      xpBoost: 0,
      immortal: 0,
    },
    cam: { x: 0, y: 0 },
    fireCooldown: 0,
  };
}

export function resetTempBuffTimers(state) {
  const p = state.player;
  p.immortalTimer = state.tempBuffs.immortal;
  p.xpBoostTimer = state.tempBuffs.xpBoost;
}

export function tickBuffTimers(state, dt) {
  for (const key of Object.keys(state.tempBuffs)) {
    if (state.tempBuffs[key] > 0) {
      state.tempBuffs[key] -= dt;
      if (state.tempBuffs[key] < 0) state.tempBuffs[key] = 0;
    }
  }
  resetTempBuffTimers(state);
}

export function setBuff(state, type) {
  const dur = TEMP_BUFF_DURATIONS[type] || 20;
  state.tempBuffs[type] = Math.max(state.tempBuffs[type], dur);
  resetTempBuffTimers(state);
}
