import { clamp } from "./utils";

export const WORLD_SIZE = 6000;
export const HALF_WORLD = WORLD_SIZE / 2;

export const ENEMY_TYPES = {
  normal: {
    key: "normal",
    radius: 18,
    baseHp: (wave) => 4 + wave * 0.8,
    speed: (wave) => 70 + wave * 2,
    dps: 8,
  },
  fast: {
    key: "fast",
    radius: 14,
    baseHp: (wave) => 3 + wave * 0.5,
    speed: (wave) => 120 + wave * 10,
    dps: 7,
  },
  tank: {
    key: "tank",
    radius: 26,
    baseHp: (wave) => 12 + wave * 2,
    speed: (wave) => 50 + wave * 1.5,
    dps: 10,
  },
  shooter: {
    key: "shooter",
    radius: 18,
    baseHp: (wave) => 5 + wave * 1.2,
    speed: (wave) => 65 + wave * 2,
    dps: 6,
  },
  shadow: {
    key: "shadow",
    radius: 18,
    baseHp: (wave) => 8 + wave * 0.8,
    speed: (wave) => 140 + wave * 5,
    dps: 6,
  },
};

export const BOSS_TYPES = {
  boss1: {
    key: "boss1",
    radius: 40,
    hp: (wave) => 300 + wave * 30,
    speed: (wave) => 60 + wave * 2,
    dps: 15,
    drops: { min: 1, max: 2 }, // перманентные
  },
  boss2: {
    key: "boss2",
    radius: 46,
    hp: (wave) => 500 + wave * 40,
    speed: (wave) => 70 + wave * 2,
    dps: 18,
    drops: { min: 2, max: 3 },
  },
  boss3: {
    key: "boss3",
    radius: 50,
    hp: (wave) => 800 + wave * 50,
    speed: (wave) => 65 + wave * 2,
    dps: 20,
    drops: { min: 3, max: 5 },
    isSummoner: true,
  },
  boss4: {
    key: "boss4",
    radius: 54,
    hp: (wave) => 1000 + wave * 60,
    speed: (wave) => 60 + wave * 2,
    dps: 22,
    drops: { min: 3, max: 5 },
    mega: true, // +50% к статам игрока
  },
  boss5: {
    key: "boss5",
    radius: 60,
    hp: (wave) => 2000 + wave * 80,
    speed: (wave) => 55 + wave * 2,
    dps: 25,
    drops: { min: 1, max: 2 }, // большие HP
  },
  bossXp: {
    key: "bossXp",
    radius: 36,
    hp: (wave) => 400 + wave * 40,
    speed: (wave) => 70 + wave * 3,
    dps: 14,
  },
  bossTemp: {
    key: "bossTemp",
    radius: 36,
    hp: (wave) => 350 + wave * 35,
    speed: (wave) => 75 + wave * 3,
    dps: 14,
  },
};
