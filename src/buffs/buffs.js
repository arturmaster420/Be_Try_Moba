import { saveProgression } from "../core/progression.js";

export function updateBuffs(state, dt) {
  const { buffs } = state;
  const players = state.players && state.players.length ? state.players : (state.player ? [state.player] : []);

  let damageBoost = 0;
  let attackSpeedBoost = 0;
  let moveSpeedBoost = 0;
  let xpGainBoost = 0;
  let regenPerSec = 0;
  let shieldActive = false;
  let ghostActive = false;

  for (let i = buffs.length - 1; i >= 0; i--) {
    const b = buffs[i];
    b.timeLeft -= dt;

    if (b.type === "damage") damageBoost += b.multiplier || 0.3;
    if (b.type === "attackSpeed") attackSpeedBoost += b.multiplier || 0.3;
    if (b.type === "moveSpeed") moveSpeedBoost += b.multiplier || 0.3;
    if (b.type === "xpGain") xpGainBoost += b.multiplier || 0.4;
    if (b.type === "regen") regenPerSec += b.amount || 4;
    if (b.type === "shield") shieldActive = true;
    if (b.type === "ghost") ghostActive = true;

    if (b.timeLeft <= 0) {
      buffs.splice(i, 1);
    }
  }

  // expose temporary XP gain boost for XP orb collection (global)
  state.tempXpGainBoost = xpGainBoost;

  for (const player of players) {
    const metaDamageMult = player.metaDamageMult || 1;
    const metaAttackMult = player.metaAttackMult || 1;
    const metaMoveMult = player.metaMoveMult || 1;
    const runDamageMult = player.runDamageMult || 1;
    const runAttackMult = player.runAttackMult || 1;
    const runMoveMult = player.runMoveMult || 1;

    const baseDamage = (player.baseDamage || 4) * metaDamageMult * runDamageMult;
    const baseAttackSpeed = (player.baseAttackSpeed || 2) * metaAttackMult * runAttackMult;

    player.damage = baseDamage * (1 + damageBoost);
    player.attackSpeed = baseAttackSpeed * (1 + attackSpeedBoost);
    player.moveSpeed = (player.baseMoveSpeed || 260) * metaMoveMult * runMoveMult * (1 + moveSpeedBoost);

    // Convenience cache: total range multiplier used by skill system.
    player._totalRangeMult = (player.metaRangeMult || 1) * (player.runRangeMult || 1);

    if (regenPerSec > 0) {
      player.hp = Math.min(player.maxHP, player.hp + regenPerSec * dt);
    }

    player._shieldActive = shieldActive;
    player._ghostActive = ghostActive;
  }
}

export function givePermanentBuffFromZone5(state) {
  const { progression, player } = state;
  const keys = [
    "attackSpeed",
    "damage",
    "moveSpeed",
    "hp",
    "range",
  ];

  const key = keys[Math.floor(Math.random() * keys.length)];
  const limits = progression.limits;

  if (key === "attackSpeed") limits.attackSpeed += 1;
  else if (key === "damage") limits.damage += 0.5;
  else if (key === "moveSpeed") limits.moveSpeed += 1;
  else if (key === "hp") limits.hp += 0.5;
  else if (key === "range") limits.range += 0.5;

  saveProgression(progression);

  const label =
    key === "attackSpeed"
      ? "Attack Speed"
      : key === "damage"
      ? "Damage"
      : key === "moveSpeed"
      ? "Move Speed"
      : key === "hp"
      ? "HP"
      : key === "range"
      ? "Range"
      : "Range";

  state.floatingTexts.push({
    x: player.x,
    y: player.y - 60,
    text: "Permanent +" + label,
    time: 2.2,
  });

  state.popups.push({
    text: "Permanent bonus increased: " + label,
    time: 3.0,
  });
}
