export function getNearestEnemy(player, enemies, maxRange) {
  let best = null;
  const maxR2 = (maxRange || 999999) * (maxRange || 999999);

  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < maxR2) {
      if (!best || d2 < best.d2) {
        best = { e, d2 };
      }
    }
  }

  return best ? best.e : null;
}

export function getChainTargets(first, enemies, maxTargets, range) {
  const result = [first];
  let current = first;

  while (result.length < maxTargets) {
    let best = null;
    const maxR2 = range * range;

    for (const e of enemies) {
      if (e === current || e.hp <= 0 || result.includes(e)) continue;
      const dx = e.x - current.x;
      const dy = e.y - current.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= maxR2) {
        if (!best || d2 < best.d2) {
          best = { e, d2 };
        }
      }
    }

    if (!best) break;
    result.push(best.e);
    current = best.e;
  }

  return result;
}
