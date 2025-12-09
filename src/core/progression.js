const STORAGE_KEY = "btm_progress";

/**
 * Meta progression 2.0 — Tier system
 *
 * metaVersion history:
 * 1 — initial meta (no crit fields)
 * 2 — critChance / critDamage added
 * 3 — Tier system (META_TIERS, metaTier, clamping)
 */

export const META_TIERS = [
  {
    id: 1,
    label: "Tier 1",
    unlockTotalPoints: 0,
    maxPoints: {
      attackSpeed: 20,
      damage: 20,
      moveSpeed: 20,
      hp: 20,
      range: 20,
      hpRegen: 20,
      xpGain: 20,
      score: 20,
      pickupRadius: 20,
      // crits недоступны
      critChance: 0,
      critDamage: 0,
    },
  },
  {
    id: 2,
    label: "Tier 2",
    unlockTotalPoints: 40,
    maxPoints: {
      attackSpeed: 40,
      damage: 40,
      moveSpeed: 40,
      hp: 40,
      range: 40,
      hpRegen: 40,
      xpGain: 40,
      score: 40,
      pickupRadius: 40,
      critChance: 0,
      critDamage: 0,
    },
  },
  {
    id: 3,
    label: "Tier 3",
    unlockTotalPoints: 80,
    maxPoints: {
      attackSpeed: 60,
      damage: 60,
      moveSpeed: 60,
      hp: 60,
      range: 60,
      hpRegen: 60,
      xpGain: 60,
      score: 60,
      pickupRadius: 60,
      critChance: 0,
      critDamage: 0,
    },
  },
  {
    id: 4,
    label: "Tier 4",
    unlockTotalPoints: 120,
    maxPoints: {
      attackSpeed: 80,
      damage: 80,
      moveSpeed: 80,
      hp: 80,
      range: 80,
      hpRegen: 80,
      xpGain: 80,
      score: 80,
      pickupRadius: 80,
      critChance: 0,
      critDamage: 0,
    },
  },
  {
    id: 5,
    label: "Tier 5",
    unlockTotalPoints: 160,
    maxPoints: {
      attackSpeed: 100,
      damage: 100,
      moveSpeed: 100,
      hp: 100,
      range: 100,
      hpRegen: 100,
      xpGain: 100,
      score: 100,
      pickupRadius: 100,
      // Tier 5 — критовый
      critChance: 600,  // 600 * 0.1% = 60%
      critDamage: 400,  // 400 * 1%   = +400% (x5)
    },
  },
];

export function computeTotalMetaPoints(limits) {
  if (!limits) return 0;
  let total = 0;
  for (const key of Object.keys(limits)) {
    const v = limits[key];
    if (typeof v === "number" && !Number.isNaN(v)) {
      total += v;
    }
  }
  return total;
}

export function getMetaTierForPoints(totalPoints) {
  let result = 1;
  for (const tier of META_TIERS) {
    if (totalPoints >= tier.unlockTotalPoints) {
      result = tier.id;
    }
  }
  return result;
}

export function getMaxPointsForStat(metaTier, statKey) {
  const tier = META_TIERS.find((t) => t.id === metaTier);
  if (!tier) return Infinity;
  const cfg = tier.maxPoints || {};
  if (Object.prototype.hasOwnProperty.call(cfg, statKey)) {
    const v = cfg[statKey];
    if (typeof v === "number") return v;
  }
  return Infinity;
}

export function defaultProgression() {
  return {
    totalScore: 0,
    upgradePoints: 0,
    metaVersion: 3,
    metaTier: 1,
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

export function loadProgression() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgression();

    const data = JSON.parse(raw) || {};
    const def = defaultProgression();

    // Ensure limits exist and have numeric values
    if (!data.limits) {
      data.limits = { ...def.limits };
    } else {
      const merged = { ...def.limits, ...data.limits };
      for (const key of Object.keys(merged)) {
        const v = merged[key];
        merged[key] =
          typeof v === "number" && !Number.isNaN(v) ? v : def.limits[key] || 0;
      }
      data.limits = merged;
    }

    if (typeof data.totalScore !== "number") data.totalScore = 0;
    if (typeof data.upgradePoints !== "number") data.upgradePoints = 0;

    if (!data.metaVersion) {
      data.metaVersion = 1;
    }

    // v2: ensure crit fields exist
    if (data.metaVersion < 2) {
      const limits = data.limits || {};
      if (typeof limits.critChance !== "number") limits.critChance = 0;
      if (typeof limits.critDamage !== "number") limits.critDamage = 0;
      data.limits = limits;
      data.metaVersion = 2;
    }

    // v3: introduce tiers
    if (data.metaVersion < 3) {
      const totalPoints = computeTotalMetaPoints(data.limits);
      data.metaTier = getMetaTierForPoints(totalPoints);
      data.metaVersion = 3;
    }

    // Recompute tier from current total meta points and clamp per stat
    const limits = data.limits || {};
    const totalPoints = computeTotalMetaPoints(limits);
    const metaTier = getMetaTierForPoints(totalPoints);
    data.metaTier = metaTier;

    for (const key of Object.keys(limits)) {
      const maxForStat = getMaxPointsForStat(metaTier, key);
      if (Number.isFinite(maxForStat) && limits[key] > maxForStat) {
        limits[key] = maxForStat;
      }
    }
    data.limits = limits;

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

  // Steps for multiplicative bonuses
  const ATTACK_STEP = 0.02; // +2% attack speed per point
  const DAMAGE_STEP = 0.02; // +2% damage per point
  const MOVE_STEP = 0.01;   // +1% move speed per point
  const RANGE_STEP = 0.02;  // +2% range per point

  // Store meta multipliers on the player so buffs / weapons can combine with them
  player.metaAttackMult = 1 + attackPoints * ATTACK_STEP;
  player.metaDamageMult = 1 + damagePoints * DAMAGE_STEP;
  player.metaMoveMult = 1 + movePoints * MOVE_STEP;
  player.metaRangeMult = 1 + rangePoints * RANGE_STEP;

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
