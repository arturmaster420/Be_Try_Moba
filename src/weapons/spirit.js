// Spirit (Magic Survival inspired): a wisp that orbits the player and shoots at enemies.

import { getNearestEnemy } from "../enemies/utils.js";

export function updateSpirit(player, state, dt, params) {
  const lvl = params?.level | 0;
  if (!player || !state || lvl <= 0) {
    if (player) player._spiritVis = null;
    return;
  }

  const time = state.time || 0;
  const projectiles = state.projectiles || (state.projectiles = []);

  const count = Math.max(1, params.count | 0);
  const orbitR = params.orbitR;
  const orbR = params.orbR;

  player._spiritVis = { count, orbitR, orbR, speed: params.orbitSpeed || 1.0 };

  // Shooting cooldown
  player._spiritCd = (player._spiritCd || 0) - dt;
  if (player._spiritCd > 0) return;
  player._spiritCd = params.cooldown;

  const target = getNearestEnemy(player, state.enemies || [], params.range);
  if (!target) return;

  // Spawn one projectile per spirit.
  const a0 = time * (params.orbitSpeed || 1.0);
  const step = (Math.PI * 2) / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    const a = a0 + i * step;
    const sx = player.x + Math.cos(a) * orbitR;
    const sy = player.y + Math.sin(a) * orbitR;

    const dx = target.x - sx;
    const dy = target.y - sy;
    const d = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;

    const speed = params.projectileSpeed;
    const pid = (state._nextProjectileId = (state._nextProjectileId || 0) + 1);
    projectiles.push({
      id: pid,
      x: sx,
      y: sy,
      ownerId: player.id || "local",
      vx: nx * speed,
      vy: ny * speed,
      speed,
      damage: params.damage,
      range: params.range,
      travel: 0,
      radius: 3,
      type: "spirit",
    });
  }
}
