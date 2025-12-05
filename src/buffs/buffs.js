import { saveProgression } from "../core/progression.js";

export function updateBuffs(state, dt) {
  const { buffs, player } = state;

  let damageBoost = 0;
  let attackSpeedBoost = 0;
  let moveSpeedBoost = 0;
  let regenPerSec = 0;
  let shieldActive = false;
  let ghostActive = false;

  for (let i = buffs.length - 1; i >= 0; i--) {
    const b = buffs[i];
    b.timeLeft -= dt;

    if (b.type === "damage") damageBoost += b.multiplier || 0.3;
    if (b.type === "attackSpeed") attackSpeedBoost += b.multiplier || 0.3;
    if (b.type === "moveSpeed") moveSpeedBoost += b.multiplier || 0.3;
    if (b.type === "regen") regenPerSec += b.amount || 4;
    if (b.type === "shield") shieldActive = true;
    if (b.type === "ghost") ghostActive = true;

    if (b.timeLeft <= 0) {
      buffs.splice(i, 1);
    }
  }

  const baseDamage = player._weaponDamage || player.baseDamage;
  const baseAttackSpeed =
    player._weaponAttackSpeed || player.baseAttackSpeed;

  player.damage = baseDamage * (1 + damageBoost);
  player.attackSpeed = baseAttackSpeed * (1 + attackSpeedBoost);
  player.moveSpeed = player.baseMoveSpeed * (1 + moveSpeedBoost);

  if (regenPerSec > 0) {
    player.hp = Math.min(player.maxHP, player.hp + regenPerSec * dt);
  }

  player._shieldActive = shieldActive;
  player._ghostActive = ghostActive;
}

export function givePermanentBuffFromZone5(state) {
  const { progression, player } = state;
  const keys = [
    "attackSpeed",
    "damage",
    "moveSpeed",
    "hp",
    "range",
    "laserOverheat",
  ];

  const key = keys[Math.floor(Math.random() * keys.length)];
  const limits = progression.limits;

  if (key === "attackSpeed") limits.attackSpeed += 1;
  else if (key === "damage") limits.damage += 0.5;
  else if (key === "moveSpeed") limits.moveSpeed += 1;
  else if (key === "hp") limits.hp += 0.5;
  else if (key === "range") limits.range += 0.5;
  else if (key === "laserOverheat") limits.laserOverheat -= 0.2;

  saveProgression(progression);

  state.floatingTexts.push({
    x: player.x,
    y: player.y - 60,
    text: "Permanent +" + key,
    time: 2.2,
  });
}
