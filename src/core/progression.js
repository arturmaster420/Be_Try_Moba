const STORAGE_KEY = "btm_progress";

// ===============================
//  R-Tier configuration
// ===============================

export const UPGRADE_CATEGORIES_BY_RTIER = {
  1: ["attackSpeed", "damage", "moveSpeed"],
  2: ["hp", "hpRegen"],
  3: ["range", "pickupRadius"],
  4: ["score", "xpGain"],
  5: ["critChance", "critDamage"],
};

export const RES_CAP_CONFIG = {
  attackSpeed:   { baseMax: 10, perRes: 5,  unlockRTier: 1 },
  damage:        { baseMax: 15, perRes: 10, unlockRTier: 1 },
  moveSpeed:     { baseMax: 10, perRes: 5,  unlockRTier: 1 },

  hp:            { baseMax: 20, perRes: 20, unlockRTier: 2 },
  hpRegen:       { baseMax: 10, perRes: 5,  unlockRTier: 2 },

  range:         { baseMax: 10, perRes: 5,  unlockRTier: 3 },
  pickupRadius:  { baseMax: 10, perRes: 5,  unlockRTier: 3 },

  score:         { baseMax: 10, perRes: 5,  unlockRTier: 4 },
  xpGain:        { baseMax: 10, perRes: 5,  unlockRTier: 4 },
};

export const CRIT_CAP_CONFIG = {
  // 600 * 0.1% = 60%
  critChance:   { capPoints: 600, unlockRTier: 5 },
  // 600 * 1%   = 600%
  critDamage:   { capPoints: 600, unlockRTier: 5 },
};

export function defaultProgression() {
  return {
    totalScore: 0,
    upgradePoints: 0,
    metaVersion: 5,
    resurrectedTier: 1,
    resGuardianKills: 0,
    limits: {
      attackSpeed: 0,
      damage: 0,
      moveSpeed: 0,
      hp: 0,
      range: 0,
      laserOverheat: 0,
      hpRegen: 0,
      xpGain: 0,
      score: 0,
      pickupRadius: 0,
      critChance: 0,
      critDamage: 0,
    },
  };
}

// Sum of all spent points
export function computeTotalMetaPoints(limits) {
  if (!limits) return 0;
  let total = 0;
  for (const key in limits) {
    const v = limits[key];
    if (typeof v === "number" && !Number.isNaN(v)) total += v;
  }
  return total;
}

// Per-stat cap for given R-Tier
export function getMaxPointsForStat(resurrectedTier, statKey) {
  const r = Math.max(1, Math.min(5, resurrectedTier || 1));

  const resCfg = RES_CAP_CONFIG[statKey];
  if (resCfg) {
    if (r < resCfg.unlockRTier) return 0;
    return resCfg.baseMax + resCfg.perRes * (r - resCfg.unlockRTier);
  }

  const critCfg = CRIT_CAP_CONFIG[statKey];
  if (critCfg) {
    if (r < critCfg.unlockRTier) return 0;
    return critCfg.capPoints;
  }

  return Infinity;
}

// Total max points for given R-Tier (all stats)
export function getTotalMaxPointsForTier(resurrectedTier) {
  const r = Math.max(1, Math.min(5, resurrectedTier || 1));
  let total = 0;

  for (const key in RES_CAP_CONFIG) {
    const cfg = RES_CAP_CONFIG[key];
    if (r < cfg.unlockRTier) continue;
    total += cfg.baseMax + cfg.perRes * (r - cfg.unlockRTier);
  }

  for (const key in CRIT_CAP_CONFIG) {
    const cfg = CRIT_CAP_CONFIG[key];
    if (r < cfg.unlockRTier) continue;
    total += cfg.capPoints;
  }

  return total;
}

// 70% rule helper
export function hasReachedResurrectionThreshold(progression) {
  if (!progression) return false;
  const limits = progression.limits || {};
  const rTier = progression.resurrectedTier || 1;

  const totalMax = getTotalMaxPointsForTier(rTier);
  if (!totalMax || !Number.isFinite(totalMax)) return false;

  const used = computeTotalMetaPoints(limits);
  return used / totalMax >= 0.7;
}

export function loadProgression() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultProgression();
    }

    const parsed = JSON.parse(raw) || {};
    const base = defaultProgression();

    const data = {
      totalScore: typeof parsed.totalScore === "number" ? parsed.totalScore : base.totalScore,
      upgradePoints: typeof parsed.upgradePoints === "number" ? parsed.upgradePoints : base.upgradePoints,
      metaVersion: 5,
      resurrectedTier:
        typeof parsed.resurrectedTier === "number"
          ? parsed.resurrectedTier
          : 1,
      resGuardianKills:
        typeof parsed.resGuardianKills === "number" ? parsed.resGuardianKills : 0,
      limits: {},
    };

    const srcLimits = parsed.limits && typeof parsed.limits === "object" ? parsed.limits : {};
    const defLimits = base.limits;
    for (const key in defLimits) {
      const v = srcLimits[key];
      data.limits[key] = typeof v === "number" && !Number.isNaN(v) ? v : 0;
    }

    // Clamp any overcapped stats for this R-Tier
    const rTier = data.resurrectedTier || 1;
    for (const key in data.limits) {
      const maxForStat = getMaxPointsForStat(rTier, key);
      const cur = data.limits[key];
      if (Number.isFinite(maxForStat) && cur > maxForStat) {
        data.limits[key] = maxForStat;
      }
    }

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

// Apply meta limits to player stats and return global multipliers
export function applyLimitsToPlayer(player, limits) {
  if (!limits) return null;

  const attackPoints = limits.attackSpeed || 0;
  const damagePoints = limits.damage || 0;
  const movePoints = limits.moveSpeed || 0;
  const hpPoints = limits.hp || 0;
  const rangePoints = limits.range || 0;
  const regenPoints = limits.hpRegen || 0;

  const xpGainPoints = limits.xpGain || 0;
  const scorePoints = limits.score || 0;
  const pickupPoints = limits.pickupRadius || 0;
  const critChancePoints = limits.critChance || 0;
  const critDamagePoints = limits.critDamage || 0;

  const ATTACK_STEP = 0.02;
  const DAMAGE_STEP = 0.02;
  const MOVE_STEP = 0.01;
  const RANGE_STEP = 0.02;

  player.metaAttackMult = 1 + attackPoints * ATTACK_STEP;
  player.metaDamageMult = 1 + damagePoints * DAMAGE_STEP;
  player.metaMoveMult = 1 + movePoints * MOVE_STEP;
  player.metaRangeMult = 1 + rangePoints * RANGE_STEP;

  const baseMaxHP = player.baseMaxHP ?? player.maxHP ?? 100;
  const hpBonus = hpPoints * 5;
  player.baseMaxHP = baseMaxHP;
  player.maxHP = baseMaxHP + hpBonus;
  if (player.hp > player.maxHP) {
    player.hp = player.maxHP;
  }

  player.metaHpRegen = regenPoints * 0.25;

  player.metaCritChance = (critChancePoints * 0.1) / 100;
  player.metaCritDamageMult = 1 + critDamagePoints * 0.01;

  const xpGainMult = 1 + xpGainPoints * 0.005;
  const scoreMult = 1 + scorePoints * 0.02;
  const pickupBonusRadius = pickupPoints * 1;

  return {
    xpGainMult,
    scoreMult,
    pickupBonusRadius,
  };
}

export function applyCritToDamage(player, baseDamage) {
  const chance = player?.metaCritChance || 0;
  const mult = player?.metaCritDamageMult || 1;

  if (chance > 0 && Math.random() < chance) {
    return baseDamage * mult;
  }

  return baseDamage;
}

// Resurection: R-Tier up + reset limits
export function applyResurrection(progression) {
  if (!progression) return;

  const current = progression.resurrectedTier || 1;
  const next = Math.min(5, current + 1);
  progression.resurrectedTier = next;

  const base = defaultProgression();
  const newLimits = {};
  for (const key in base.limits) {
    newLimits[key] = 0;
  }
  progression.limits = newLimits;

  saveProgression(progression);
}
