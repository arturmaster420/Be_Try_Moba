export function updateLaser(player, state, dt, aimDir, isFiring) {
  const { enemies } = state;

  const maxRange = maxRangeForLevel(player.level);
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

  if (!isFiring || !aimDir) {
    player.laserHeat = Math.max(0, player.laserHeat - coolRate * dt);
    return;
  }

  const ox = player.x;
  const oy = player.y;
  let hitEnemy = null;
  let hitDist = maxRange;

  for (const e of enemies) {
    if (e.hp <= 0) continue;

    const ex = e.x - ox;
    const ey = e.y - oy;
    const proj = ex * aimDir.x + ey * aimDir.y;
    if (proj <= 0 || proj > maxRange) continue;

    const px = aimDir.x * proj;
    const py = aimDir.y * proj;
    const dx = ex - px;
    const dy = ey - py;
    const r = (e.radius || 20) + 6;
    if (dx * dx + dy * dy <= r * r) {
      if (proj < hitDist) {
        hitDist = proj;
        hitEnemy = e;
      }
    }
  }

  if (hitEnemy) {
    const dps = laserDpsForLevel(player.level);
    const damage = dps * dt;
    hitEnemy.hp -= damage;
  }

  state._laserVisual = {
    x1: ox,
    y1: oy,
    x2: ox + aimDir.x * hitDist,
    y2: oy + aimDir.y * hitDist,
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
