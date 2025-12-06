import { fireBullets } from "./bullets.js";
import { fireRockets } from "./rockets.js";
import { updateLaser } from "./laser.js";
import { fireChainLightning } from "./lightning.js";
import {
  getAimDirectionForPlayer,
  isFiringActive,
} from "../core/mouseController.js";

export function getWeaponStage(level) {
  if (level < 50) return 1;
  if (level < 80) return 2;
  if (level < 100) return 3;
  return 4;
}

export function updateWeapon(player, state, dt) {
  const stage = getWeaponStage(player.level);
  player.weaponStage = stage;

  const aimDir = getAimDirectionForPlayer(
    player,
    state.camera,
    state.canvas
  );
  if (aimDir) {
    player.lastAimDir.x = aimDir.x;
    player.lastAimDir.y = aimDir.y;
  }

  if (stage === 1) {
    const params = bulletParamsForLevel(player.level);
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = params.range;
  } else if (stage === 2) {
    const params = rocketParamsForLevel(player.level);
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = params.range;
  } else if (stage === 3) {
    const maxRange = maxLaserRangeForLevel(player.level);
    player.range = maxRange;
  } else if (stage === 4) {
    const params = lightningParamsForLevel(player.level);
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = params.chainRange;
  }

  if (stage === 3) {
    updateLaser(player, state, dt, aimDir, isFiringActive());
    return;
  }

  if (!isFiringActive()) return;
  if (player.attackCooldown > 0) return;

  const dir = aimDir || { x: 0, y: 1 };
  let dx = dir.x;
  let dy = dir.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  if (stage === 1) {
    const params = bulletParamsForLevel(player.level);
    fireBullets(player, state, { dx, dy }, params);
  } else if (stage === 2) {
    const params = rocketParamsForLevel(player.level);
    fireRockets(player, state, { dx, dy }, params);
  } else if (stage === 4) {
    const params = lightningParamsForLevel(player.level);
    fireChainLightning(player, state, params, aimDir);
  }

  const atk = Math.min(
    player._weaponAttackSpeed || player.baseAttackSpeed,
    player.maxAttackSpeed
  );
  player.attackCooldown = 1 / Math.max(0.1, atk);
}

function bulletParamsForLevel(level) {
  const l = Math.max(0, Math.min(49, level));
  const damage = 2 + (l / 49) * 6;

  let count;
  if (l < 10) count = 1;
  else if (l < 20) count = 2;
  else if (l < 30) count = 3;
  else if (l < 40) count = 4;
  else count = 5 + Math.floor((l - 40) / 4);

  const spread = 2 + (l / 49) * 23;
  const attackSpeed = 2 + (l / 49) * 0.5;
  const range = 600 + l * 6;

  return { damage, count, spread, attackSpeed, range };
}

function rocketParamsForLevel(level) {
  const l = Math.max(0, Math.min(29, level - 50));
  const damage = 15 + (l / 29) * 25;
  const count = 1 + Math.floor((l / 29) * 2);
  const splashRadius = 40 + (l / 29) * 40;
  const attackSpeed = 1.0 - (l / 29) * 0.4;
  const range = 800 + l * 10;

  return { damage, count, splashRadius, attackSpeed, range };
}

function lightningParamsForLevel(level) {
  const l = Math.max(0, level - 100);
  const damage = 60 + (Math.min(l, 40) / 40) * 60;
  const chainRange = 150 + Math.min(100, l * 2.5);
  const attackSpeed = 3.0;

  return { damage, chainRange, attackSpeed };
}

function maxLaserRangeForLevel(level) {
  const l = Math.max(0, Math.min(19, level - 80));
  return 120 + (l / 19) * 120;
}
