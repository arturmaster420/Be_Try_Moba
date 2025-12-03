
import { randRange, choose } from "./utils";

export const WORLD_SIZE = 2800;
export const HALF_WORLD = WORLD_SIZE / 2;

// Простые типы врагов. Баланс можно будет подкрутить.
export const ENEMY_TYPES = {
  grunt: {
    key: "grunt",
    radius: 16,
    speed: 90,
    hp: 26,
    damage: 10,
    xp: 7,
    weight: 5,
    color: "#4ade80",
  },
  runner: {
    key: "runner",
    radius: 14,
    speed: 150,
    hp: 18,
    damage: 7,
    xp: 8,
    weight: 3,
    color: "#22c55e",
  },
  brute: {
    key: "brute",
    radius: 22,
    speed: 60,
    hp: 55,
    damage: 16,
    xp: 14,
    weight: 2,
    color: "#166534",
  },
};

export function pickEnemyTypeForWave(wave) {
  if (wave < 3) return ENEMY_TYPES.grunt;
  if (wave < 7) {
    return choose([
      ENEMY_TYPES.grunt,
      ENEMY_TYPES.grunt,
      ENEMY_TYPES.runner,
    ]);
  }
  return choose([
    ENEMY_TYPES.grunt,
    ENEMY_TYPES.grunt,
    ENEMY_TYPES.runner,
    ENEMY_TYPES.runner,
    ENEMY_TYPES.brute,
  ]);
}

export function spawnEnemyAtEdge(state, type) {
  const p = state.player;
  const dist = randRange(550, 900);
  const angle = randRange(0, Math.PI * 2);

  let x = p.x + Math.cos(angle) * dist;
  let y = p.y + Math.sin(angle) * dist;

  // ограничиваем миром
  if (x < -HALF_WORLD) x = -HALF_WORLD;
  if (x > HALF_WORLD) x = HALF_WORLD;
  if (y < -HALF_WORLD) y = -HALF_WORLD;
  if (y > HALF_WORLD) y = HALF_WORLD;

  const enemy = {
    id: state.nextEnemyId++,
    type: type.key,
    color: type.color,
    x,
    y,
    radius: type.radius,
    hp: type.hp,
    maxHp: type.hp,
    speed: type.speed,
    damage: type.damage,
    xp: type.xp,
  };

  state.enemies.push(enemy);
}
