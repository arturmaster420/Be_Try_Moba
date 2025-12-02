// Enemy and Boss type definitions
export const ENEMY_TYPES = {
  normal: {
    radius: 16,
    baseHp: (wave) => 4 + wave * 0.8,
    speed: (wave) => 70 + wave * 1.8,
    dps: 10,
    color: '#f97373',
  },
  fast: {
    radius: 13,
    baseHp: (wave) => 3 + wave * 0.5,
    speed: (wave) => 120 + wave * 2.5,
    dps: 14,
    color: '#fb7185',
  },
  tank: {
    radius: 22,
    baseHp: (wave) => 12 + wave * 2,
    speed: (wave) => 50 + wave * 1.2,
    dps: 18,
    color: '#facc15',
  },
  shooter: {
    radius: 16,
    baseHp: (wave) => 5 + wave * 1.0,
    speed: (wave) => 60 + wave * 1.5,
    dps: 8,
    color: '#a5b4fc',
  },
  shadow: {
    radius: 18,
    baseHp: (wave) => 8 + wave * 0.3,
    speed: (wave) => 140 + wave * 3,
    dps: 14,
    color: '#020617',
    isShadow: true,
  },
};

export const BOSS_TYPES = {
  boss1: {
    radius: 40,
    hp: (wave) => 300 + (wave - 5) * 20,
    color: '#f97316',
    drops: { min: 1, max: 1, permanent: true },
  },
  boss2: {
    radius: 42,
    hp: (wave) => 500 + (wave - 10) * 30,
    color: '#22c55e',
    drops: { min: 2, max: 3, permanent: true },
  },
  boss3: {
    radius: 38,
    hp: (wave) => 800 + (wave - 15) * 40,
    color: '#ec4899',
    drops: { min: 3, max: 5, permanent: true },
    isSummoner: true,
  },
  boss4: {
    radius: 46,
    hp: (wave) => 1000 + Math.max(0, wave - 20) * 100,
    color: '#eab308',
    drops: { min: 0, max: 0, mega: true },
    isFinal: true,
  },
  bossXp: {
    radius: 30,
    hp: (wave) => 200 + wave * 20,
    color: '#22c55e',
    xpBoostBoss: true,
  },
  bossTemp: {
    radius: 30,
    hp: (wave) => 220 + wave * 25,
    color: '#0ea5e9',
    tempBuffBoss: true,
  },
};
