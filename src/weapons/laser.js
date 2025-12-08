export function updateLaser(player, state, dt, aimDir, isFiring) {
  const { enemies } = state;

  const maxRange = maxRangeForLevel(player.level);

  // Reset visual each frame
  state._laserVisual = null;

  if (!isFiring || !aimDir) {
    return;
  }

  // Raycast along aimDir and damage all enemies on the line.
  const ox = player.x;
  const oy = player.y;
  const hitEnemies = [];
  let furthestHit = 0;

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
      hitEnemies.push({ enemy: e, dist: proj });
      if (proj > furthestHit) furthestHit = proj;
    }
  }

  const dps = laserDpsForLevel(player.level);
  const damage = dps * dt;

  for (const h of hitEnemies) {
    h.enemy.hp -= damage;
  }

  // Beam length: go to furthest hit, or full range if no hits.
  const beamLen = hitEnemies.length > 0 ? furthestHit : maxRange;

  state._laserVisual = {
    x1: ox,
    y1: oy,
    x2: ox + aimDir.x * beamLen,
    y2: oy + aimDir.y * beamLen,
  };
}

function laserDpsForLevel(level) {
  // Laser stage: levels 100–150 (50 levels of scaling)
  const l = Math.max(0, Math.min(49, level - 100));
  // Slightly stronger baseline and growth
  return 30 + (l / 49) * 60; // 30 → 90 DPS
}

function maxRangeForLevel(level) {
  const l = Math.max(0, Math.min(49, level - 100));
  // Range grows moderately with level
  return 180 + (l / 49) * 120; // 180 → 300
}
