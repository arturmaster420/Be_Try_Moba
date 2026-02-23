// Energy Barrier (Magic Survival inspired):
// Early levels apply a mild debuff (slow + small mitigation) so enemies can still approach.
// Later levels add repel + damage pulses.

import { applyCritToDamage, applyLifeSteal } from "../core/progression.js";

export function updateEnergyBarrier(player, state, dt, params) {
  const lvl = params?.level | 0;
  if (!player || !state || lvl <= 0) {
    if (player) player._energyBarrierVis = null;
    return;
  }

  const enemies = state.enemies || [];

  const r = params.radius || 0;
  const pushSpeed = params.pushSpeed || 0;
  const dmg = params.pulseDamage || 0;
  const tick = params.tick || 0.3;

  // Debuff settings (always on while inside ring)
  const slowMult = (params.slowMult ?? 0.85);
  const dmgMult = (params.dmgMult ?? 0.95);
  const debuffHold = 0.45; // seconds; refreshed while inside ring

  player._energyBarrierVis = { radius: r, lvl };

  const r2 = r * r;

  // Apply debuff to enemies currently inside the ring.
  for (const e of enemies) {
    if (!e || e.hp <= 0) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;

    e._barrierDebuffUntil = state.time + debuffHold;
    e._barrierSlowMult = slowMult;
    e._barrierDmgMult = dmgMult;
  }

  // Repel only from mid levels. Use an inner radius so mobs can still "touch" the barrier edge.
  if (pushSpeed > 0) {
    const inner = Math.max(0, r - 26);
    const inner2 = inner * inner;
    for (const e of enemies) {
      if (!e || e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > inner2) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      const push = pushSpeed * dt;
      e.x += nx * push;
      e.y += ny * push;
    }
  }

  // Damage pulse (later levels only)
  if (dmg <= 0) return;

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
