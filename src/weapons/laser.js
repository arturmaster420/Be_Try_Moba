import { getNearestEnemy } from "../enemies/utils.js";

export function updateLaser(player, state, dt) {
  const { enemies } = state;

  const maxRange = maxRangeForLevel(player.level);
  const target = getNearestEnemy(player, enemies, maxRange);

  const heatRate = 35 * player.laserHeatRate;
  const coolRate = 40;

  state._laserVisual = null;

  if (player.laserOverheated) {
    player.laserHeat -= coolRate * dt;
    if (player.laserHeat <= 0) {
      player.laserHeat = 0;
      player.laserOverheated = false;
    }
    return;
  }

  if (!target) {
    player.laserHeat = Math.max(0, player.laserHeat - coolRate * dt);
    return;
  }

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (dist > maxRange) {
    player.laserHeat = Math.max(0, player.laserHeat - coolRate * dt);
    return;
  }

  const dps = laserDpsForLevel(player.level);
  const damage = dps * dt;
  target.hp -= damage;

  state._laserVisual = {
    x1: player.x,
    y1: player.y,
    x2: target.x,
    y2: target.y,
  };

  player.laserHeat += heatRate * dt;
  if (player.laserHeat >= player.laserMaxHeat) {
    player.laserHeat = player.laserMaxHeat;
    player.laserOverheated = true;
  }
}

function laserDpsForLevel(level) {
  const l = Math.max(0, Math.min(19, level - 80));
  return 20 + (l / 19) * 50;
}

function maxRangeForLevel(level) {
  const l = Math.max(0, Math.min(19, level - 80));
  return 120 + (l / 19) * 120;
}
