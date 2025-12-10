import { fireBullets } from "./bullets.js";
import { fireRockets } from "./rockets.js";
import { updateLaser } from "./laser.js";
import { fireChainLightning } from "./lightning.js";
import {
  getAimDirectionForPlayer,
  isFiringActive,
} from "../core/mouseController.js";

export function getWeaponStage(level) {
  // 0–49  : Stage 1 (Bullets)
  // 50–99 : Stage 2 (Rockets, splash, up to 7 rockets)
  // 100–149 : Stage 3 (Laser)
  // 150+ : Stage 4 (Chain Lightning)
  if (level < 50) return 1;
  if (level < 100) return 2;
  if (level < 150) return 3;
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

  const rangeMult = player.metaRangeMult || 1;

  if (stage === 1) {
    const params = bulletParamsForLevel(player.level);
    const finalRange = params.range * rangeMult;
    fireBullets(player, state, { dx, dy }, { ...params, range: finalRange });
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = finalRange;
  } else if (stage === 2) {
    const params = rocketParamsForLevel(player.level);
    const finalRange = params.range * rangeMult;
    fireRockets(player, state, { dx, dy }, { ...params, range: finalRange });
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = finalRange;
  } else if (stage === 4) {
    const params = lightningParamsForLevel(player.level);
    const finalRange = params.chainRange * rangeMult;
    fireChainLightning(
      player,
      state,
      { ...params, chainRange: finalRange },
      aimDir
    );
    player._weaponDamage = params.damage;
    player._weaponAttackSpeed = params.attackSpeed;
    player.range = finalRange;
  }

  const baseAtk = player._weaponAttackSpeed || player.baseAttackSpeed;
  const metaAttackMult = player.metaAttackMult || 1;
  const atk = baseAtk * metaAttackMult;
  player.attackCooldown = 1 / Math.max(0.1, atk);
}

function bulletParamsForLevel(level) {
  // Stage 1: 0–49 levels
  const l = Math.max(0, Math.min(49, level));
  const damage = 2 + (l / 49) * 6;

  let count;
  if (l < 10) count = 1;
  else if (l < 20) count = 2;
  else if (l < 30) count = 3;
  else if (l < 40) count = 4;
  else count = 5 + Math.floor((l - 40) / 4); // up to 7 bullets

  const spread = 2 + (l / 49) * 23;
  const attackSpeed = 2 + (l / 49) * 0.5;
  const range = (600 + l * 6) / 3;

  return { damage, count, spread, attackSpeed, range };
}



function rocketParamsForLevel(level) {
  // Stage 2: 50–99 levels mapped to 0–49
  const l = Math.max(0, Math.min(49, level - 50));

  const damage = 18 + (l / 49) * 32; // 18 → 50
  let count;
  if (l < 10) count = 1;
  else if (l < 20) count = 2;
  else if (l < 30) count = 3;
  else if (l < 40) count = 4;
  else count = 5 + Math.floor((l - 40) / 4); // up to 7 rockets

  const splashRadius = 40 + (l / 49) * 40; // 40 → 80
  const attackSpeed = 1.0 - (l / 49) * 0.4; // slower but improves a bit
  const range = (800 + l * 10) / 3;

  return { damage, count, splashRadius, attackSpeed, range };
}

function lightningParamsForLevel(level) {
  // Stage 4: 150+ mapped to 0–49
  const l = Math.max(0, Math.min(49, level - 150));
  const damage = 60 + (l / 49) * 60; // 60 → 120
  const chainRange = 150 + (l / 49) * 100; // 150 → 250
  const attackSpeed = 3.0;

  return { damage, chainRange, attackSpeed };
}
