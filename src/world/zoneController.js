export function getZone(y) {
  if (y < 10000) return 1;
  if (y < 20000) return 2;
  if (y < 30000) return 3;
  if (y < 40000) return 4;
  if (y < 50000) return 5;
  return 6;
}

export function getZoneScaling(zone) {
  const idx = Math.max(0, (zone | 0) - 1);
  return {
    hp: 1 + idx * 0.75,
    damage: 1 + idx * 0.5,
    speed: 1 + idx * 0.25,
    xp: 1 + idx * 0.3,
  };
}

export const zoneTargetCounts = {
  1: { min: 10, max: 15 },
  2: { min: 15, max: 20 },
  3: { min: 20, max: 25 },
  4: { min: 25, max: 30 },
  5: { min: 30, max: 35 },
  6: { min: 35, max: 40 },
};
