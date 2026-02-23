// Energy Barrier (Magic Survival inspired): protective ring that repels enemies and pulses damage.

import { applyCritToDamage, applyLifeSteal } from "../core/progression.js";

export function updateEnergyBarrier(player, state, dt, params) {
  const lvl = params?.level | 0;
  if (!player || !state || lvl <= 0) {
    if (player) player._energyBarrierVis = null;
    return;
  }

  const enemies = state.enemies || [];

  const r = params.radius;
  const pushSpeed = params.pushSpeed;
  const dmg = params.pulseDamage;
  const tick = params.tick;

  player._energyBarrierVis = { radius: r };

  // Continuous repel (smooth, prevents clipping).
  const r2 = r * r;
  for (const e of enemies) {
    if (!e || e.hp <= 0) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;
    const push = pushSpeed * dt;
    e.x += nx * push;
    e.y += ny * push;
  }

  // Damage pulse (avoid per-frame AoE damage).
  player._energyBarrierTick = (player._energyBarrierTick || 0) - dt;
  if (player._energyBarrierTick > 0) return;
  player._energyBarrierTick = tick;

  let didHit = false;
  for (const e of enemies) {
    if (!e || e.hp <= 0) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const rr = r + (e.radius || 20);
    if (dx * dx + dy * dy <= rr * rr) {
      const dealt = applyCritToDamage(player, dmg);
      e.hp -= dealt;
      applyLifeSteal(player, dealt);
      didHit = true;
      e._lastHitAt = state.time;
      e._lastHitBy = player.id || "local";
      e.aggroed = true;
    }
  }

  if (didHit) player._lastCombatAt = state.time;
}
