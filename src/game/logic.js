import { clamp, randRange, randInt, choose } from "./utils";
import { WEAPONS, weaponKeyForLevel } from "./weapons";
import { ENEMY_TYPES, BOSS_TYPES, HALF_WORLD } from "./enemies";
import { PICKUP_TYPES } from "./pickups";
import { WORLD_SIZE } from "./enemies";
import { tickBuffTimers, setBuff } from "./state";

const MAX_DAMAGE_MUL = 10;
const MAX_FIRE_MUL = 10;
const MAX_RANGE_MUL = 5;
const MAX_CRIT_MULT = 9999; // без лимита по сути
const MAX_MAGNET = 300;
const MAX_SPEED = 500;

export const WORLD_HALF = WORLD_SIZE / 2;

function applyPermanentPickup(state, type) {
  const p = state.player;
  switch (type) {
    case "hpMax":
      p.maxHp += 10;
      p.hp = Math.min(p.hp + 10, p.maxHp);
      break;
    case "hpBig":
      p.maxHp += 200;
      p.hp = Math.min(p.hp + 200, p.maxHp);
      break;
    case "radius":
      p.magnetRadius *= 1.01; // +1%
      p.magnetRadius = Math.min(p.magnetRadius, MAX_MAGNET);
      break;
    case "fireRate":
      p.fireRateMul *= 1 + 0.006; // 0.6%
      p.fireRateMul = Math.min(p.fireRateMul, MAX_FIRE_MUL);
      break;
    case "damage":
      p.damageMul *= 1 + 0.006;
      p.damageMul = Math.min(p.damageMul, MAX_DAMAGE_MUL);
      break;
    case "critChance":
      p.critChance = clamp(p.critChance + 0.01, 0, 0.5);
      break;
    case "critDamage":
      p.critMult *= 1 + 0.006;
      p.critMult = Math.min(p.critMult, MAX_CRIT_MULT);
      break;
    case "range":
      p.rangeMul *= 1 + 0.006;
      p.rangeMul = Math.min(p.rangeMul, MAX_RANGE_MUL);
      break;
    default:
      break;
  }
}

function addPickup(state, type, x, y) {
  if (!PICKUP_TYPES[type]) return;
  state.pickups.push({ type, x, y, r: 9 });
}

function levelUp(state) {
  state.level += 1;
  const p = state.player;
  // +5% к базовым статам (кроме критов и HP)
  p.damageMul *= 1.05;
  p.fireRateMul *= 1.05;
  p.rangeMul *= 1.05;
  p.bulletSpeedMul *= 1.05;
  p.magnetRadius *= 1.05;
  p.magnetRadius = Math.min(p.magnetRadius, MAX_MAGNET);
  p.hp = p.maxHp;
  state.xpToNext = Math.floor(10 + state.level * 3);
}

function addXp(state, amount) {
  let gain = amount;
  if (state.tempBuffs.xpBoost > 0) gain *= 2;
  state.xp += gain;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    levelUp(state);
  }
}

function enemyDef(e, wave) {
  if (e.bossType && BOSS_TYPES[e.bossType]) {
    return BOSS_TYPES[e.bossType];
  }
  if (ENEMY_TYPES[e.typeKey]) {
    return ENEMY_TYPES[e.typeKey];
  }
  return ENEMY_TYPES.normal;
}

function spawnSummonsAround(state, boss, wave) {
  const count = 5 + Math.floor(wave / 2);
  for (let i = 0; i < count; i++) {
    const dist = randRange(120, 240);
    const ang = Math.random() * Math.PI * 2;
    const ex = boss.x + Math.cos(ang) * dist;
    const ey = boss.y + Math.sin(ang) * dist;
    const def = ENEMY_TYPES.fast;
    state.enemies.push({
      typeKey: "fast",
      bossType: null,
      x: clamp(ex, -HALF_WORLD, HALF_WORLD),
      y: clamp(ey, -HALF_WORLD, HALF_WORLD),
      r: def.radius,
      hp: def.baseHp(wave),
      maxHp: def.baseHp(wave),
    });
  }
}

function onEnemyKilled(state, e) {
  const wave = state.wave;

  // Обычные враги
  if (!e.bossType) {
    addXp(state, 1);

    // Shadow: даёт бессмертие
    if (e.typeKey === "shadow") {
      addPickup(state, "immortal", e.x, e.y);
      return;
    }

    // простые зомби: только HP с шансом 10%
    if (Math.random() < 0.1) {
      addPickup(state, "hp", e.x, e.y);
    }
    return;
  }

  // Боссы
  addXp(state, 5);

  if (e.bossType === "bossXp") {
    addPickup(state, "xpBoost", e.x, e.y);
    return;
  }

  if (e.bossType === "bossTemp") {
    const tempTypes = ["tempDamage", "tempFireRate", "tempRange", "tempCrit"];
    const num = randInt(2, 4);
    for (let i = 0; i < num; i++) {
      addPickup(
        state,
        choose(tempTypes),
        e.x + randRange(-40, 40),
        e.y + randRange(-40, 40)
      );
    }
    return;
  }

  if (e.bossType === "boss5") {
    const num = randInt(1, 2);
    for (let i = 0; i < num; i++) {
      addPickup(
        state,
        "hpBig",
        e.x + randRange(-30, 30),
        e.y + randRange(-30, 30)
      );
    }
    return;
  }

  const def = enemyDef(e, wave);

  if (def.mega) {
    // Boss4: +50% к постоянным статам (кроме критов и движения)
    const p = state.player;
    p.damageMul = Math.min(p.damageMul * 1.5, MAX_DAMAGE_MUL);
    p.fireRateMul = Math.min(p.fireRateMul * 1.5, MAX_FIRE_MUL);
    p.rangeMul = Math.min(p.rangeMul * 1.5, MAX_RANGE_MUL);
    p.bulletSpeedMul *= 1.5;
    p.magnetRadius = Math.min(p.magnetRadius * 1.5, MAX_MAGNET);
  }

  if (def.isSummoner) {
    spawnSummonsAround(state, e, wave);
  }

  if (def.drops) {
    const baseTypes = [
      "hpMax",
      "radius",
      "fireRate",
      "damage",
      "critChance",
      "critDamage",
      "range",
    ];
    const num = randInt(def.drops.min, def.drops.max);
    for (let i = 0; i < num; i++) {
      addPickup(
        state,
        choose(baseTypes),
        e.x + randRange(-40, 40),
        e.y + randRange(-40, 40)
      );
    }
  }
}

function spawnEnemiesForWave(state) {
  const wave = state.wave;
  const count = 5 + wave * 2;

  // обычные враги вокруг игрока
  for (let i = 0; i < count; i++) {
    const dist = randRange(1600, 2000);
    const ang = Math.random() * Math.PI * 2;
    const ex = state.player.x + Math.cos(ang) * dist;
    const ey = state.player.y + Math.sin(ang) * dist;

    let typeKey = "normal";
    if (wave >= 7 && Math.random() < 0.15) typeKey = "shooter";
    else if (wave >= 5 && Math.random() < 0.2) typeKey = "fast";
    else if (wave >= 3 && Math.random() < 0.15) typeKey = "tank";

    const def = ENEMY_TYPES[typeKey];
    state.enemies.push({
      typeKey,
      bossType: null,
      x: clamp(ex, -HALF_WORLD, HALF_WORLD),
      y: clamp(ey, -HALF_WORLD, HALF_WORLD),
      r: def.radius,
      hp: def.baseHp(wave),
      maxHp: def.baseHp(wave),
    });
  }

  // Shadow каждые 3 волны, начиная с 3
  if (wave >= 3 && wave % 3 === 0) {
    const dist = randRange(1600, 2000);
    const ang = Math.random() * Math.PI * 2;
    const ex = state.player.x + Math.cos(ang) * dist;
    const ey = state.player.y + Math.sin(ang) * dist;
    const def = ENEMY_TYPES.shadow;
    state.enemies.push({
      typeKey: "shadow",
      bossType: null,
      x: clamp(ex, -HALF_WORLD, HALF_WORLD),
      y: clamp(ey, -HALF_WORLD, HALF_WORLD),
      r: def.radius,
      hp: def.baseHp(wave),
      maxHp: def.baseHp(wave),
    });
  }

  const bossesToSpawn = [];

  // Boss1: с 10-й, далее каждые 5 волн, +1
  if (wave >= 10) {
    const num = clamp(1 + Math.floor((wave - 10) / 5), 1, 4);
    for (let i = 0; i < num; i++) bossesToSpawn.push("boss1");
  }

  // Boss2: с 20-й
  if (wave >= 20) {
    const num = clamp(1 + Math.floor((wave - 20) / 5), 1, 3);
    for (let i = 0; i < num; i++) bossesToSpawn.push("boss2");
  }

  // Boss3: с 30-й
  if (wave >= 30) {
    const num = clamp(1 + Math.floor((wave - 30) / 5), 1, 2);
    for (let i = 0; i < num; i++) bossesToSpawn.push("boss3");
  }

  // Boss4: с 40-й, каждые 5 волн по одному
  if (wave >= 40 && (wave - 40) % 5 === 0) {
    bossesToSpawn.push("boss4");
  }

  // Boss5: с 50-й, каждые 10 волн
  if (wave >= 50 && (wave - 50) % 10 === 0) {
    bossesToSpawn.push("boss5");
  }

  // Босс XP: каждая 2-я волна начиная с 10
  if (wave >= 10 && wave % 2 === 0) {
    bossesToSpawn.push("bossXp");
  }

  // Босс временных бафов: каждая 4-я волна начиная с 8
  if (wave >= 8 && wave % 4 === 0) {
    bossesToSpawn.push("bossTemp");
  }

  for (const bKey of bossesToSpawn) {
    const dist = randRange(1600, 2000);
    const ang = Math.random() * Math.PI * 2;
    const ex = state.player.x + Math.cos(ang) * dist;
    const ey = state.player.y + Math.sin(ang) * dist;
    const def = BOSS_TYPES[bKey];
    state.enemies.push({
      typeKey: "boss",
      bossType: bKey,
      x: clamp(ex, -HALF_WORLD, HALF_WORLD),
      y: clamp(ey, -HALF_WORLD, HALF_WORLD),
      r: def.radius,
      hp: def.hp(state.wave),
      maxHp: def.hp(state.wave),
    });
  }

  state.waveInProgress = true;
}

function damagePlayer(state, amount, dtBased = false, dt = 0) {
  if (state.tempBuffs.immortal > 0) return;
  const p = state.player;
  const dmg = dtBased ? amount * dt : amount;
  p.hp -= dmg;
  if (p.hp < 0) p.hp = 0;
}

export function updateGame(state, input, dt) {
  const p = state.player;

  if (input.paused || input.gameOver) {
    state.elapsed += dt;
    return;
  }

  state.elapsed += dt;

  // таймеры бафов и лазера
  tickBuffTimers(state, dt);
  for (let i = state.laserBeams.length - 1; i >= 0; i--) {
    const beam = state.laserBeams[i];
    beam.life -= dt;
    if (beam.life <= 0) state.laserBeams.splice(i, 1);
  }

  // движение игрока
  let mvx = input.moveX;
  let mvy = input.moveY;
  const mvLen = Math.hypot(mvx, mvy);
  if (mvLen > 0.05) {
    const nx = mvx / mvLen;
    const ny = mvy / mvLen;
    p.x += nx * p.speed * dt;
    p.y += ny * p.speed * dt;
  }

  p.x = clamp(p.x, -HALF_WORLD + p.radius, HALF_WORLD - p.radius);
  p.y = clamp(p.y, -HALF_WORLD + p.radius, HALF_WORLD - p.radius);

  // оружие
  const baseKey = weaponKeyForLevel(state.level);
  if (!state.selectedWeaponKey) {
    state.selectedWeaponKey = baseKey;
  }
  let weaponKey = baseKey;
  if (state.level >= 50 && state.selectedWeaponKey) {
    weaponKey = state.selectedWeaponKey;
  }
  const weapon = WEAPONS[weaponKey];
  state.weaponName = weapon.name;

  if (state.fireCooldown > 0) state.fireCooldown -= dt;

  const aimLen = Math.hypot(input.aimX, input.aimY);
  const shooting = input.shooting && aimLen > 0.25;

  // стрельба: лазер отдельно
  if (weapon.type === "laser") {
    const baseRate = weapon.baseFireRate;
    const rateMul =
      p.fireRateMul *
      p.baseFireRateMul *
      (state.tempBuffs.tempFireRate > 0 ? 1.6 : 1);
    const trueRate = Math.min(baseRate * rateMul, 2); // кэп 2/сек
    const cd = 1 / trueRate;

    if (shooting && state.fireCooldown <= 0) {
      state.fireCooldown = cd;
      const nx = input.aimX / aimLen;
      const ny = input.aimY / aimLen;
      const range =
        weapon.baseRange *
        p.rangeMul *
        (state.tempBuffs.tempRange > 0 ? 1.5 : 1);
      const dmgBase = weapon.baseDamage * 0.5;
      const dmgMul =
        p.damageMul *
        p.baseDamageMul *
        (state.tempBuffs.tempDamage > 0 ? 1.5 : 1);

      let chance =
        p.critChance + (state.tempBuffs.tempCrit > 0 ? 0.2 : 0);
      chance = clamp(chance, 0, 0.5);
      const critMult = p.critMult;

      // повредить всех на луче
      for (const e of state.enemies) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const proj = dx * nx + dy * ny;
        if (proj <= 0 || proj > range) continue;
        const px = p.x + nx * proj;
        const py = p.y + ny * proj;
        const dist2 = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py);
        const rr = e.r * e.r + 36;
        if (dist2 <= rr) {
          const isCrit = Math.random() < chance;
          let dmg = dmgBase * dmgMul;
          if (isCrit) dmg *= critMult * 1.5;
          e.hp -= dmg;
        }
      }

      // запоминаем луч для рендера
      state.laserBeams.push({
        x1: p.x,
        y1: p.y,
        x2: p.x + nx * range,
        y2: p.y + ny * range,
        life: 0.08,
      });
    }
  } else {
    // обычные пули
    const baseRate = weapon.baseFireRate;
    const rateMul =
      p.fireRateMul *
      p.baseFireRateMul *
      (state.tempBuffs.tempFireRate > 0 ? 1.6 : 1);
    const trueRate = Math.min(baseRate * rateMul, 10);
    const cd = 1 / trueRate;

    if (shooting && state.fireCooldown <= 0) {
      state.fireCooldown = cd;
      const nx = input.aimX / aimLen;
      const ny = input.aimY / aimLen;
      const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
      const pellets = weapon.pellets;
      const range =
        weapon.baseRange *
        p.rangeMul *
        (state.tempBuffs.tempRange > 0 ? 1.5 : 1);
      const speed = weapon.bulletSpeed * p.bulletSpeedMul;
      const dmgBase = weapon.baseDamage;
      const dmgMul =
        p.damageMul *
        p.baseDamageMul *
        (state.tempBuffs.tempDamage > 0 ? 1.5 : 1);

      let chance =
        p.critChance + (state.tempBuffs.tempCrit > 0 ? 0.2 : 0);
      chance = clamp(chance, 0, 0.5);
      const critMult = p.critMult;

      const baseAngle = Math.atan2(ny, nx);
      for (let i = 0; i < pellets; i++) {
        const angOffset = pellets === 1 ? 0 : randRange(-spreadRad, spreadRad);
        const ax = Math.cos(baseAngle + angOffset);
        const ay = Math.sin(baseAngle + angOffset);
        const isCrit = Math.random() < chance;

        state.bullets.push({
          x: p.x + ax * (p.radius + 8),
          y: p.y + ay * (p.radius + 8),
          vx: ax * speed,
          vy: ay * speed,
          r: 4,
          life: range / speed,
          dmgBase,
          dmgMul,
          isCrit,
          critMult,
          weaponKey,
          splashRadius: weapon.splashRadius,
          splashDamage: weapon.splashDamage,
        });
      }
    }
  }

  // пули игрока
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) {
      state.bullets.splice(i, 1);
    }
  }

  // движение врагов
  for (const e of state.enemies) {
  const dx = state.player.x - e.x;
  const dy = state.player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;

  // базовая скорость врага
  let spd = e.speed;

  // фиолетовые (fast) никогда не быстрее игрока
  if (e.typeKey === "fast") {
    const basePlayerSpeed =
      state.player.baseSpeed || state.player.speed || 220;
    const maxFastSpeed = basePlayerSpeed * 0.95; // максимум 95% скорости игрока
    if (spd > maxFastSpeed) spd = maxFastSpeed;
  }

  const s = spd * dt;
  e.x += (dx / dist) * s;
  e.y += (dy / dist) * s;
  }

  // стрелки (обычные и boss4) стреляют
  for (const e of state.enemies) {
    const isShooter = e.typeKey === "shooter" || e.bossType === "boss4";
    if (!isShooter) continue;
    if (!e.shootCd) e.shootCd = randRange(0, 1);
    e.shootCd -= dt;
    if (e.shootCd <= 0) {
      e.shootCd = 1.2;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1400) {
        const nx = dx / dist;
        const ny = dy / dist;
        const speed = 550;
        const def = enemyDef(e, state.wave);
        state.enemyBullets.push({
          x: e.x + nx * (e.r + 4),
          y: e.y + ny * (e.r + 4),
          vx: nx * speed,
          vy: ny * speed,
          r: 4,
          dmg: def.dps,
          life: 2.5,
        });
      }
    }
  }

  // пули врагов
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) {
      state.enemyBullets.splice(i, 1);
      continue;
    }
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = (b.r + p.radius) * (b.r + p.radius);
    if (dx * dx + dy * dy <= rr) {
      damagePlayer(state, b.dmg);
      state.enemyBullets.splice(i, 1);
    }
  }

  // столкновения врагов с игроком
  for (const e of state.enemies) {
    const def = enemyDef(e, state.wave);
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const rr = (e.r + p.radius) * (e.r + p.radius);
    if (dx * dx + dy * dy <= rr) {
      damagePlayer(state, def.dps, true, dt);
    }
  }

  // попадания пуль игрока
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    let hit = false;
    for (const e of state.enemies) {
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const rr = (e.r + b.r) * (e.r + b.r);
      if (dx * dx + dy * dy <= rr) {
        hit = true;
        let dmg = b.dmgBase * b.dmgMul;
        if (b.isCrit) dmg *= b.critMult * 1.5;
        e.hp -= dmg;

        if (b.splashRadius > 0) {
          for (const e2 of state.enemies) {
            if (e2 === e) continue;
            const dx2 = e2.x - b.x;
            const dy2 = e2.y - b.y;
            const dist2 = Math.hypot(dx2, dy2);
            if (dist2 <= b.splashRadius + e2.r) {
              e2.hp -= b.splashDamage * b.dmgMul;
            }
          }
        }
        break;
      }
    }
    if (hit) {
      state.bullets.splice(i, 1);
    }
  }

  // смерть врагов
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hp <= 0) {
      onEnemyKilled(state, e);
      state.enemies.splice(i, 1);
    }
  }

  // магнит и сбор пикапов
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    const dx = pk.x - p.x;
    const dy = pk.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= p.magnetRadius) {
      const nx = dx / dist;
      const ny = dy / dist;
      pk.x -= nx * 400 * dt;
      pk.y -= ny * 400 * dt;
    }

    const rr = (pk.r + p.radius) * (pk.r + p.radius);
    if (dx * dx + dy * dy <= rr) {
      if (pk.type === "hp") {
        // просто лечение
        p.hp = Math.min(p.hp + 10, p.maxHp);
      } else if (
        pk.type === "xpBoost" ||
        pk.type === "immortal" ||
        pk.type.startsWith("temp")
      ) {
        setBuff(state, pk.type);
      } else {
        applyPermanentPickup(state, pk.type);
      }
      state.pickups.splice(i, 1);
    }
  }

  // волны
  if (state.waveInProgress && state.enemies.length === 0) {
    state.waveInProgress = false;
  }
  if (!state.waveInProgress && state.enemies.length === 0) {
    state.wave += 1;
    spawnEnemiesForWave(state);
  }

  // камера
  state.cam.x = p.x;
  state.cam.y = p.y;
}
