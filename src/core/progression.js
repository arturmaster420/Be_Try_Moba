const STORAGE_KEY = "btm_progress";

export function defaultProgression() {
  return {
    totalScore: 0,
    upgradePoints: 0,
    metaVersion: 2,
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

    // Meta versioning: ensure crit fields exist
    if (!data.metaVersion) {
      data.metaVersion = 1;
    }

    if (data.metaVersion < 2) {
      const limits = data.limits || {};
      if (typeof limits.critChance !== "number") limits.critChance = 0;
      if (typeof limits.critDamage !== "number") limits.critDamage = 0;
      data.limits = limits;
      data.metaVersion = 2;
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
