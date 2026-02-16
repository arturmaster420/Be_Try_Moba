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

// --- Co-op targeting helpers -------------------------------------------------

export function getLivingPlayers(state) {
  const ps = (state && state.players && state.players.length) ? state.players : (state && state.player ? [state.player] : []);
  return ps.filter((p) => p && p.hp > 0);
}

/**
 * Pick a target player for an enemy.
 * Rules:
 *  - prefer a recent attacker for a short window (if still alive and reasonably close)
 *  - otherwise pick the nearest living player
 */
export function pickMobTarget(self, state, opts = {}) {
  const players = getLivingPlayers(state);
  if (!players.length) return state?.player || null;

  const x = self?.x || 0;
  const y = self?.y || 0;
  const aggroRange = Number.isFinite(opts.aggroRange) ? opts.aggroRange : (Number.isFinite(self?.aggroRange) ? self.aggroRange : 520);
  const attackerMemorySec = Number.isFinite(opts.attackerMemorySec) ? opts.attackerMemorySec : 3.0;
  const allowSwitchDist = Number.isFinite(opts.allowSwitchDist) ? opts.allowSwitchDist : (aggroRange * 1.8);

  let nearest = players[0];
  let nearestD2 = Infinity;
  for (const p of players) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = p;
    }
  }

  const now = state?.time || 0;
  const lastHitAt = self && typeof self._lastHitAt === "number" ? self._lastHitAt : null;
  const lastHitBy = self && self._lastHitBy != null ? String(self._lastHitBy) : null;

  if (lastHitAt != null && lastHitBy && (now - lastHitAt) <= attackerMemorySec) {
    const attacker = players.find((p) => String(p.id) === lastHitBy);
    if (attacker) {
      const dx = attacker.x - x;
      const dy = attacker.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= allowSwitchDist * allowSwitchDist) {
        return attacker;
      }
    }
  }

  return nearest;
}
