const STORAGE_KEY = "btm_progress";

export function defaultProgression() {
  return {
    totalScore: 0,
    upgradePoints: 0,
    limits: {
      attackSpeed: 0,
      damage: 0,
      moveSpeed: 0,
      hp: 0,
      range: 0,
      laserOverheat: 0,
      hpRegen: 0,
    },
  };
}

export function loadProgression() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgression();

    const data = JSON.parse(raw);

    if (!data.limits) {
      data.limits = defaultProgression().limits;
    } else {
      const def = defaultProgression().limits;
      for (const key of Object.keys(def)) {
        if (typeof data.limits[key] !== "number") {
          data.limits[key] = def[key];
        }
      }
    }

    if (typeof data.totalScore !== "number") data.totalScore = 0;
    if (typeof data.upgradePoints !== "number") data.upgradePoints = 0;

    return data;
  } catch (err) {
    console.error("[Progression] Failed to load progression", err);
    return defaultProgression();
  }
}

export function saveProgression(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[Progression] Failed to save progression", err);
  }
}

export function getStartLevel(progression) {
  const total = progression?.totalScore || 0;
  return Math.min(100, Math.floor(total / 1000));
}

export function applyLimitsToPlayer(player, limits) {
  if (!limits) return;

  player.maxAttackSpeed *= 1 + (limits.attackSpeed || 0) / 100;
  player.maxDamage *= 1 + (limits.damage || 0) / 100;
  player.maxMoveSpeed *= 1 + (limits.moveSpeed || 0) / 100;
  player.maxHP *= 1 + (limits.hp || 0) / 100;
  player.rangeLimit *= 1 + (limits.range || 0) / 100;
  player.laserHeatRate *= 1 + (limits.laserOverheat || 0);

  player.baseAttackSpeed = Math.min(
    player.baseAttackSpeed,
    player.maxAttackSpeed
  );
  player.baseDamage = Math.min(player.baseDamage, player.maxDamage);
  player.baseMoveSpeed = Math.min(player.baseMoveSpeed, player.maxMoveSpeed);
  player.baseMaxHP = player.maxHP;
}
