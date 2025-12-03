
import { BUFF_DURATIONS } from "./pickups";
import { WORLD_SIZE } from "./enemies";

export const HALF_WORLD = WORLD_SIZE / 2;

const BASE_PLAYER = {
  x: 0,
  y: 0,
  radius: 18,
  maxHp: 100,
  hp: 100,
  baseSpeed: 320,
  speed: 320,
  baseDamageMul: 1,
  damageMul: 1,
  baseFireRateMul: 1,
  fireRateMul: 1,
  baseRangeMul: 1,
  rangeMul: 1,
  baseCritChance: 0.05,
  critChance: 0.05,
  baseCritMultiplier: 2,
  critMultiplier: 2,
  baseMagnetRadius: 90,
  magnetRadius: 90,
  xp: 0,
  totalXp: 0,
  level: 1,
  xpToNext: 40,
};

export function xpRequiredForLevel(level) {
  // делаем прогрессию быстрее, чтобы вся игра проходилась ~в 2 раза быстрее
  // чем раньше: невысокая кривая, но растущая
  return 40 + level * 18 + level * level * 3;
}

export function createInitialState() {
  return {
    time: 0,
    player: {
      ...BASE_PLAYER,
      xpToNext: xpRequiredForLevel(1),
    },
    bullets: [],
    beams: [], // коротко-живущие лазерные лучи
    enemies: [],
    pickups: [],
    cam: { x: 0, y: 0 },
    wave: 0,
    waveInProgress: false,
    isGameOver: false,
    gameOverTimer: 0,
    nextEnemyId: 1,
    nextBulletId: 1,
    input: { moveX: 0, moveY: 0, aimX: 0, aimY: 0, shooting: false },
    unlockedWeapons: ["pistol"],
    currentWeapon: "pistol",
    messages: [], // { id, text, ttl }
    tempBuffs: {}, // buffKey -> remaining seconds
  };
}

export function resetState(state) {
  const fresh = createInitialState();
  for (const key of Object.keys(fresh)) {
    state[key] = fresh[key];
  }
}

// считать финальные статы игрока с учётом баффов
export function recalcPlayerStatsFromBuffs(state) {
  const p = state.player;
  const buffs = state.tempBuffs || {};

  let damageMul = p.baseDamageMul;
  let fireMul = p.baseFireRateMul;
  let rangeMul = p.baseRangeMul;
  let speedMul = 1;
  let magnetMul = 1;
  let critChance = p.baseCritChance;
  let critMult = p.baseCritMultiplier;

  if (buffs.tempDamage > 0) damageMul *= 1.4;
  if (buffs.tempFireRate > 0) fireMul *= 1.5;
  if (buffs.tempRange > 0) rangeMul *= 1.35;
  if (buffs.tempCrit > 0) {
    critChance = Math.min(0.55, critChance + 0.25);
    critMult *= 1.6;
  }

  p.damageMul = damageMul;
  p.fireRateMul = fireMul;
  p.rangeMul = rangeMul;
  p.speed = p.baseSpeed * speedMul;
  p.magnetRadius = p.baseMagnetRadius * magnetMul;
  p.critChance = critChance;
  p.critMultiplier = critMult;
}

export function tickBuffTimers(state, dt) {
  const b = state.tempBuffs;
  for (const key of Object.keys(b)) {
    if (b[key] > 0) {
      b[key] -= dt;
      if (b[key] <= 0) {
        b[key] = 0;
      }
    }
  }
  recalcPlayerStatsFromBuffs(state);
}

export function setBuff(state, buffKey) {
  const dur = BUFF_DURATIONS[buffKey];
  if (!dur) return;
  const current = state.tempBuffs[buffKey] || 0;
  state.tempBuffs[buffKey] = Math.max(current, dur);
}
