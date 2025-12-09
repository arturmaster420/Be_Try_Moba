const STORAGE_KEY = "btm_progress";

// R-Tier based upgrade configuration

export const UPGRADE_CATEGORIES_BY_RTIER = {
  1: ["damage", "attackSpeed", "moveSpeed"],
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
  critChance:   { capPoints: 600, unlockRTier: 5 }, // 600 * 0.1% = 60%
  critDamage:   { capPoints: 600, unlockRTier: 5 }, // 600 * 1%   = 600%
};

export function defaultProgression() {
  return {
    totalScore: 0,
    upgradePoints: 0,
    metaVersion: 5,
    resurrectedTier: 1,
    resGuardianKills: 0,
    limits: {
      damage: 0,
      attackSpeed: 0,
      moveSpeed: 0,
      hp: 0,
      hpRegen: 0,
      range: 0,
      pickupRadius: 0,
      score: 0,
      xpGain: 0,
      critChance: 0,
      critDamage: 0,
    },
  };
}

// Sum of all limit points actually spent
export function computeTotalMetaPoints(limits) {
  if (!limits) return 0;
  let total = 0;
  for (const key of Object.keys(limits)) {
    const val = limits[key];
    if (typeof val === "number" && !Number.isNaN(val)) {
      total += val;
    }
  }
  return total;
}

// Total maximum points available for current R-Tier (including crits if unlocked)
export function getTotalMaxPointsForTier(resurrectedTier) {
  const r = Math.max(1, Math.min(5, resurrectedTier || 1));
  let total = 0;

  // Non-crit stats
  for (const [key, cfg] of Object.entries(RES_CAP_CONFIG)) {
    const unlock = cfg.unlockRTier;
    if (r < unlock) continue;
    const cap = cfg.baseMax + cfg.perRes * (r - unlock);
    total += cap;
  }

  // Crit stats
  for (const [key, cfg] of Object.entries(CRIT_CAP_CONFIG)) {
    if (r < cfg.unlockRTier) continue;
    total += cfg.capPoints;
  }

  return total;
}

// Per-stat cap for given R-Tier
export function getMaxPointsForStat(resurrectedTier, statKey) {
  const r = Math.max(1, Math.min(5, resurrectedTier || 1));

  if (RES_CAP_CONFIG[statKey]) {
    const cfg = RES_CAP_CONFIG[statKey];
    if (r < cfg.unlockRTier) return 0;
    return cfg.baseMax + cfg.perRes * (r - cfg.unlockRTier);
  }

  if (CRIT_CAP_CONFIG[statKey]) {
    const cfg = CRIT_CAP_CONFIG[statKey];
    if (r < cfg.unlockRTier) return 0;
    return cfg.capPoints;
  }

  // Unknown stats are uncapped
  return Infinity;
}

// Helper used by spawn system for 70% rule
export function hasReachedResurrectionThreshold(progression) {
  if (!progression) return false;
  const limits = progression.limits || {};
  const rTier = progression.resurrectedTier || 1;

  const totalMax = getTotalMaxPointsForTier(rTier);
  if (!totalMax || !Number.isFinite(totalMax) || totalMax <= 0) {
    return false;
  }

  const used = computeTotalMetaPoints(limits);
  const ratio = used / totalMax;
  return ratio >= 0.7;
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
      resurrectedTier: typeof parsed.resurrectedTier === "number"
        ? parsed.resurrectedTier
        : base.resurrectedTier,
      resGuardianKills: typeof parsed.resGuardianKills === "number"
        ? parsed.resGuardianKills
        : 0,
      limits: {},
    };

    const srcLimits = parsed.limits && typeof parsed.limits === "object" ? parsed.limits : {};
    for (const key of Object.keys(base.limits)) {
      const v = srcLimits[key];
      data.limits[key] = typeof v === "number" && !Number.isNaN(v) ? v : 0;
    }

    // Clamp any overcapped stats for this R-Tier
    const rTier = data.resurrectedTier || 1;
    for (const key of Object.keys(data.limits)) {
      const maxForStat = getMaxPointsForStat(rTier, key);
      if (Number.isFinite(maxForStat) && data.limits[key] > maxForStat) {
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

  // Attack speed: +2% per point
  const attackMult = 1 + attackPoints * 0.02;
  player.attackSpeedMult = (player.attackSpeedMult || 1) * attackMult;

  // Damage: +2% per point
  const damageMult = 1 + damagePoints * 0.02;
  player.damageMult = (player.damageMult || 1) * damageMult;

  // Move speed: +1% per point
  const moveMult = 1 + movePoints * 0.01;
  player.moveSpeedMult = (player.moveSpeedMult || 1) * moveMult;

  // Range: +2% per point
  const rangeMult = 1 + rangePoints * 0.02;
  player.rangeMult = (player.rangeMult || 1) * rangeMult;

  // Max HP: +5 HP per point
  const hpBonus = 5 * hpPoints;
  player.baseMaxHP += hpBonus;
  player.maxHP = player.baseMaxHP;
  if (player.hp > player.maxHP) {
    player.hp = player.maxHP;
  }

  // Permanent HP regen (HP/s)
  player.metaHpRegen = 0.25 * regenPoints;

  // Crit stats from meta progression
  // Crit Chance Bonus: +0.1% per point, base 0%
  player.metaCritChance = (critChancePoints * 0.1) / 100;
  // Crit Damage Bonus: +1% per point, base 0% -> multiplier
  player.metaCritDamageMult = 1 + critDamagePoints * 0.01;

  // Global non-player stats (XP, score, pickup radius)
  const xpGainMult = 1 + xpGainPoints * 0.005;
  const scoreMult = 1 + scorePoints * 0.02;
  const pickupBonusRadius = pickupPoints * 1; // +1 radius per point

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

// Resurection apply function (R-Tier increment + limits reset)
export function applyResurrection(progression) {
  if (!progression) return;

  const current = progression.resurrectedTier || 1;
  const next = Math.min(5, current + 1);
  progression.resurrectedTier = next;

  const base = defaultProgression();
  const newLimits = {};
  for (const key of Object.keys(base.limits)) {
    newLimits[key] = 0;
  }
  progression.limits = newLimits;

  saveProgression(progression);
}
