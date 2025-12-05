import { getNearestEnemy, getChainTargets } from "../enemies/utils.js";

export function fireChainLightning(player, state, params, aimDir) {
  const { enemies, floatingTexts } = state;

  let origin;
  if (aimDir) {
    // Prefer enemy in aim direction
    let best = null;
    const maxR = params.chainRange;
    const maxR2 = maxR * maxR;

    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > maxR2) continue;

      const dist = Math.sqrt(d2);
      const ndx = dx / dist;
      const ndy = dy / dist;
      const dot = ndx * aimDir.x + ndy * aimDir.y;
      if (dot < 0.4) continue;

      if (!best || d2 < best.d2) {
        best = { e, d2 };
      }
    }
    origin = best ? best.e : null;
  } else {
    origin = getNearestEnemy(player, enemies, params.chainRange);
  }

  if (!origin) return;

  const targets = getChainTargets(origin, enemies, 5, params.chainRange);
  let dmg = params.damage;

  state._lightningVisual = [{ x: player.x, y: player.y }];
  for (const t of targets) {
    state._lightningVisual.push({ x: t.x, y: t.y });
    t.hp -= dmg;
    floatingTexts.push({
      x: t.x,
      y: t.y - 20,
      text: Math.round(dmg).toString(),
      time: 0.5,
    });
    dmg *= 0.75;
  }
}
