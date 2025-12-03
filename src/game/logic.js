
import { clamp } from "./utils";
import { WEAPONS, weaponKeyForLevel } from "./weapons";
import { ENEMY_TYPES, HALF_WORLD, spawnEnemyAtEdge, pickEnemyTypeForWave } from "./enemies";
import { PICKUP_TYPES, createPickupForEnemy } from "./pickups";
import { tickBuffTimers } from "./state";

const MAX_DAMAGE_MUL = 20;
const MAX_FIRE_MUL = 20;
const MAX_RANGE_MUL = 10;
const MAX_CRIT_MULT = 19998;
const MAX_MAGNET = 300;
const MAX_SPEED = 1100;

export function updateGame(state, dt, viewW, viewH, input) {
  if (!dt || dt <= 0) return;
  if (state.isGameOver) {
    state.gameOverTimer += dt;
    return;
  }

  state.time += dt;

  // --- управление / инпут ---
  if (input) {
    state.input = input;
  } else if (!state.input) {
    state.input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, shooting: false };
  }

  const p = state.player;
  const inMoveX = state.input.moveX || 0;
  const inMoveY = state.input.moveY || 0;

  // --- баффы ---
  tickBuffTimers(state, dt);

  // --- движение игрока ---
  let mvLen = Math.hypot(inMoveX, inMoveY);
  if (mvLen > 0.01) {
    const nx = inMoveX / mvLen;
    const ny = inMoveY / mvLen;
    const speed = p.speed;
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
  }

  // границы мира
  p.x = clamp(p.x, -HALF_WORLD + p.radius, HALF_WORLD - p.radius);
  p.y = clamp(p.y, -HALF_WORLD + p.radius, HALF_WORLD - p.radius);

  // --- aim ---
  const aimX = state.input.aimX || 0;
  const aimY = state.input.aimY || 0;
  let aimLen = Math.hypot(aimX, aimY);
  if (aimLen > 0.0001) {
    state.lastAimDir = { x: aimX / aimLen, y: aimY / aimLen };
  }

  // --- стрельба ---
  if (state.shootTimer == null) state.shootTimer = 0;

  const weapon = WEAPONS[state.currentWeapon] || WEAPONS.pistol;
  const fireRate = weapon.baseFireRate * (p.fireRateMul || 1);

  if (state.input.shooting && state.lastAimDir) {
    state.shootTimer += dt * fireRate;
    while (state.shootTimer >= 1) {
      state.shootTimer -= 1;
      fireWeapon(state, weapon, state.lastAimDir);
    }
  } else {
    // плавно сбрасываем, чтобы при следующем зажиме не было задержки
    state.shootTimer = Math.min(state.shootTimer, 1);
  }

  // --- обновление пуль ---
  updateBullets(state, dt);

  // --- враги ---
  updateEnemies(state, dt);

  // --- пикапы ---
  updatePickups(state, dt);

  // --- волны ---
  updateWaves(state);

  // --- камера за игроком ---
  state.cam.x = p.x;
  state.cam.y = p.y;
}

// ---------------- ВСПОМОГАТЕЛЬНОЕ ----------------

function fireWeapon(state, weapon, dir) {
  const p = state.player;

  if (!dir) return;

  if (weapon.type === "laser") {
    fireLaser(state, weapon, dir);
    return;
  }

  const originX = p.x;
  const originY = p.y;

  const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
  const pellets = weapon.pellets || 1;

  for (let i = 0; i < pellets; i++) {
    const t = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5;
    const angleOffset = spreadRad * t;
    const angle = Math.atan2(dir.y, dir.x) + angleOffset;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const speed = weapon.bulletSpeed;
    const range = weapon.baseRange * (state.player.rangeMul || 1);
    const life = range / speed;

    const bullet = {
      id: state.nextBulletId++,
      kind: weapon.type === "rocket" ? "rocket" : "bullet",
      weaponKey: weapon.key,
      x: originX,
      y: originY,
      vx: vx * speed,
      vy: vy * speed,
      radius: weapon.type === "rocket" ? 8 : 4,
      life,
      maxLife: life,
      baseDamage: weapon.baseDamage,
      splashRadius: weapon.splashRadius || 0,
      splashDamage: weapon.splashDamage || 0,
      color:
        weapon.key === "rifle"
          ? "#f97316"
          : weapon.key === "shotgun"
          ? "#e5e7eb"
          : weapon.key === "rocket"
          ? "#facc15"
          : "#e5e7eb",
    };

    state.bullets.push(bullet);
  }
}

function fireLaser(state, weapon, dir) {
  const p = state.player;
  const range = weapon.baseRange * (p.rangeMul || 1);
  const x1 = p.x;
  const y1 = p.y;
  const x2 = p.x + dir.x * range;
  const y2 = p.y + dir.y * range;

  // луч живёт очень мало, просто для визуала
  const life = 0.12;
  const beam = {
    x1,
    y1,
    x2,
    y2,
    life,
    maxLife: life,
  };
  if (!state.beams) state.beams = [];
  state.beams.push(beam);

  // урон всем врагам на луче
  const baseDamage = weapon.baseDamage * (p.damageMul || 1);
  for (const enemy of state.enemies) {
    const dist = distancePointToSegment(enemy.x, enemy.y, x1, y1, x2, y2);
    if (dist <= enemy.radius + 4) {
      applyDamageToEnemy(state, enemy, baseDamage, true);
    }
  }
}

function updateBullets(state, dt) {
  const p = state.player;
  const newBullets = [];

  for (const b of state.bullets) {
    b.life -= dt;
    if (b.life <= 0) continue;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // выходим далеко за пределы мира — убираем
    if (
      b.x < -HALF_WORLD * 1.2 ||
      b.x > HALF_WORLD * 1.2 ||
      b.y < -HALF_WORLD * 1.2 ||
      b.y > HALF_WORLD * 1.2
    ) {
      continue;
    }

    let hit = false;

    for (const enemy of state.enemies) {
      const dx = enemy.x - b.x;
      const dy = enemy.y - b.y;
      const r = enemy.radius + (b.radius || 4);
      if (dx * dx + dy * dy <= r * r) {
        if (b.kind === "rocket" && b.splashRadius > 0) {
          // сплэш-урон
          for (const e2 of state.enemies) {
            const ddx = e2.x - b.x;
            const ddy = e2.y - b.y;
            const dist2 = Math.hypot(ddx, ddy);
            if (dist2 <= b.splashRadius) {
              const factor = 1 - dist2 / b.splashRadius;
              const dmg =
                (factor * (b.splashDamage || b.baseDamage)) * (p.damageMul || 1);
              applyDamageToEnemy(state, e2, dmg, true);
            }
          }
        } else {
          const dmg = b.baseDamage * (p.damageMul || 1);
          applyDamageToEnemy(state, enemy, dmg, true);
        }

        hit = true;
        break;
      }
    }

    if (!hit) {
      newBullets.push(b);
    }
  }

  state.bullets = newBullets;

  // лазерные лучи
  if (state.beams && state.beams.length > 0) {
    state.beams = state.beams.filter((beam) => {
      beam.life -= dt;
      return beam.life > 0;
    });
  }
}

function updateEnemies(state, dt) {
  const p = state.player;
  const newEnemies = [];

  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      const speed = enemy.speed;
      enemy.x += nx * speed * dt;
      enemy.y += ny * speed * dt;
    }

    // урон игроку при контакте
    const hitDist = enemy.radius + p.radius;
    if (dist <= hitDist) {
      const dmgPerSecond = enemy.damage;
      p.hp -= dmgPerSecond * dt;
      if (p.hp <= 0) {
        p.hp = 0;
        state.isGameOver = true;
      }
    }

    if (enemy.hp > 0) {
      newEnemies.push(enemy);
    } else {
      onEnemyKilled(state, enemy);
    }
  }

  state.enemies = newEnemies;
}

function onEnemyKilled(state, enemy) {
  // шанс пикапа
  const pickup = createPickupForEnemy(enemy);
  if (pickup) {
    state.pickups.push(pickup);
  }

  // XP
  const xp = enemy.xp || 5;
  gainXp(state, xp);
}

function updatePickups(state, dt) {
  const p = state.player;
  const newPickups = [];

  for (const pick of state.pickups) {
    const def = PICKUP_TYPES[pick.type];
    if (!def) continue;

    const dx = pick.x - p.x;
    const dy = pick.y - p.y;
    const dist = Math.hypot(dx, dy);

    // магнит
    const magnetR = p.magnetRadius;
    if (dist <= magnetR && dist > p.radius) {
      const nx = -dx / dist;
      const ny = -dy / dist;
      const speed = 380;
      pick.x += nx * speed * dt;
      pick.y += ny * speed * dt;
    }

    // сбор
    if (dist <= p.radius + (def.radius || 8)) {
      applyPickup(state, def);
      continue;
    }

    newPickups.push(pick);
  }

  state.pickups = newPickups;
}

function applyPickup(state, def) {
  const p = state.player;
  switch (def.kind) {
    case "xp": {
      gainXp(state, def.amount || 5);
      break;
    }
    case "heal": {
      p.hp = Math.min(p.maxHp, p.hp + (def.amount || 10));
      break;
    }
    case "perm": {
      if (def.stat === "maxHp") {
        p.maxHp += def.amount || 5;
        p.hp = Math.min(p.maxHp, p.hp + def.amount || 5);
      }
      break;
    }
    case "temp": {
      // бафф по ключу
      if (def.buff) {
        state.tempBuffs[def.buff] = Math.max(
          state.tempBuffs[def.buff] || 0,
          25
        );
      }
      break;
    }
    default:
      break;
  }
}

function gainXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  p.totalXp += amount;

  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    levelUp(state);
  }
}

function levelUp(state) {
  const p = state.player;
  p.level += 1;
  p.xpToNext = 40 + p.level * 18 + p.level * p.level * 3;

  addMessage(state, `Level ${p.level}!`);

  // анлок оружия строго по уровням 10 / 20 / 30 / 40
  const unlockedKey = weaponKeyForLevel(p.level);
  if (!state.unlockedWeapons.includes(unlockedKey)) {
    state.unlockedWeapons.push(unlockedKey);

    const name = WEAPONS[unlockedKey].name;
    addMessage(state, `Lvl-${p.level} Unlocked ${name}`);
  }
}

function addMessage(state, text) {
  const msg = {
    id: (state.nextMessageId = (state.nextMessageId || 0) + 1),
    text,
    ttl: 3.0,
    maxTtl: 3.0,
  };
  if (!state.messages) state.messages = [];
  state.messages.push(msg);

  // чистим старые
  state.messages = state.messages.filter((m) => m.ttl > 0);
}

function updateWaves(state) {
  // уменьшаем ttl сообщений
  if (state.messages && state.messages.length > 0) {
    for (const m of state.messages) {
      m.ttl -= 1 / 60;
    }
    state.messages = state.messages.filter((m) => m.ttl > 0);
  }

  if (state.waveInProgress && state.enemies.length === 0) {
    state.waveInProgress = false;
  }
  if (!state.waveInProgress && state.enemies.length === 0) {
    state.wave += 1;
    spawnEnemiesForWave(state);
  }
}

function spawnEnemiesForWave(state) {
  state.waveInProgress = true;
  const wave = state.wave || 1;

  const baseCount = 6 + wave * 3;
  const count = baseCount;

  for (let i = 0; i < count; i++) {
    const type = pickEnemyTypeForWave(wave);
    spawnEnemyAtEdge(state, type);
  }
}

// расстояние от точки до отрезка (для лазера)
function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const projX = x1 + t * vx;
  const projY = y1 + t * vy;
  return Math.hypot(px - projX, py - projY);
}

function applyDamageToEnemy(state, enemy, rawDamage, canCrit) {
  const p = state.player;
  let dmg = rawDamage;

  if (canCrit) {
    const chance = p.critChance || 0.05;
    const mult = p.critMultiplier || 2;
    if (Math.random() < chance) {
      dmg *= mult;
    }
  }

  enemy.hp -= dmg;
}
