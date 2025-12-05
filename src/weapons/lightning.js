import { getNearestEnemy, getChainTargets } from "../enemies/utils.js";

export function fireChainLightning(player, state, params) {
  const { enemies, floatingTexts } = state;

  const origin = getNearestEnemy(player, enemies, params.chainRange);
  if (!origin) return;

  const targets = getChainTargets(origin, enemies, 5, params.chainRange);
  let dmg = params.damage;

  state._lightningVisual = targets.map((t) => ({ x: t.x, y: t.y }));

  for (const t of targets) {
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
