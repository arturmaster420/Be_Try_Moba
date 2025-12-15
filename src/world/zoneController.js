// Zones 2.0 — radial zones around world center (0,0)
//
// Zone 0 (Hub): safe, no enemies
// Zones 1–5: concentric rings
// Zone 6: outer ring + outer square (corners reserved for bosses)

export const ZONE_RADII = {
  0: 2000,  // Hub radius
  1: 10000,
  2: 20000,
  3: 30000,
  4: 40000,
  5: 50000, // Zone 6 starts here
  6: 60000, // Outer square half-size (world bounds)
};

export const ZONE6_SQUARE_HALF = ZONE_RADII[6];

// Corner points for Zone 6 (structure for future corner bosses)
export const ZONE6_CORNER_POINTS = [
  { x:  ZONE6_SQUARE_HALF, y:  ZONE6_SQUARE_HALF },
  { x: -ZONE6_SQUARE_HALF, y:  ZONE6_SQUARE_HALF },
  { x:  ZONE6_SQUARE_HALF, y: -ZONE6_SQUARE_HALF },
  { x: -ZONE6_SQUARE_HALF, y: -ZONE6_SQUARE_HALF },
];

// Backward-compatible signature:
// - getZone(x, y) recommended
// - getZone(y) legacy (treated as old vertical system fallback)
export function getZone(x, y) {
  if (typeof y === "undefined") {
    // Legacy fallback: keep behavior if any call site still uses getZone(y)
    const yy = x;
    if (yy < 10000) return 1;
    if (yy < 20000) return 2;
    if (yy < 30000) return 3;
    if (yy < 40000) return 4;
    if (yy < 50000) return 5;
    return 6;
  }

  const r = Math.hypot(x, y);

  const r0 = ZONE_RADII[0];
  const r1 = ZONE_RADII[1];
  const r2 = ZONE_RADII[2];
  const r3 = ZONE_RADII[3];
  const r4 = ZONE_RADII[4];
  const r5 = ZONE_RADII[5];

  if (r < r0) return 0;
  if (r < r1) return 1;
  if (r < r2) return 2;
  if (r < r3) return 3;
  if (r < r4) return 4;
  if (r < r5) return 5;

  return 6;
}

export function getZoneScaling(zone) {
  // Zone 0 shares scaling of Zone 1 (but Zone 0 is safe anyway)
  const idx = Math.max(0, (zone | 0) - 1);
  return {
    hp: 1 + idx * 0.75,
    damage: 1 + idx * 0.5,
    speed: 1 + idx * 0.25,
    xp: 1 + idx * 0.3,
  };
}

// Kept for compatibility (old spawn system used it).
// Zone 0 intentionally omitted (safe).
export const zoneTargetCounts = {
  1: { min: 10, max: 15 },
  2: { min: 15, max: 20 },
  3: { min: 20, max: 25 },
  4: { min: 25, max: 30 },
  5: { min: 30, max: 35 },
  6: { min: 35, max: 40 },
};
