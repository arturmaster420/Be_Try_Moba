// Zones 2.0 — radial zones around world center (0,0)
//
// Zone 0 (Hub): safe, no enemies
// Zones 1–5: concentric rings
// Zone 6: outer ring + outer square (corners reserved for bosses)

// Hub shape (Zone 0): rounded square, centered at (0,0)
// NOTE: This is purely for zone logic + visuals. Keep tweaks minimal.
// Hub size tuning: make hub 2x smaller (side 600) and keep corners slightly rounded.
export const HUB_HALF = 300;          // half-size of the hub square (side = 600)
export const HUB_CORNER_R = 70;       // rounded corner radius

// Rounded-square hit test (with optional padding).
// Uses standard rounded-rect inclusion: clamp to corner circle.
export function isPointInHub(x, y, pad = 0) {
  const half = HUB_HALF + pad;
  const cr = Math.min(HUB_CORNER_R + pad, half);
  const inner = Math.max(half - cr, 0);

  const ax = Math.abs(x);
  const ay = Math.abs(y);

  // Quick reject
  if (ax > half || ay > half) return false;

  // Inside the straight edges region.
  if (ax <= inner || ay <= inner) return true;

  // Corner circle test.
  const dx = ax - inner;
  const dy = ay - inner;
  return (dx * dx + dy * dy) <= (cr * cr);
}

export const ZONE_RADII = {
  // Map size: back to 2x larger (vs the current reduced map)
  // Keep a nominal "hub size" value for compatibility (used by older ring/pattern code).
  // Zone membership is determined by isPointInHub() above.
  0: HUB_HALF,
  1: 5000,
  2: 10000,
  3: 15000,
  4: 20000,
  5: 25000, // Zone 6 starts here
  6: 30000, // Outer square half-size (world bounds)
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
    // Use ZONE_RADII so it stays consistent when map size changes.
    if (yy < ZONE_RADII[1]) return 1;
    if (yy < ZONE_RADII[2]) return 2;
    if (yy < ZONE_RADII[3]) return 3;
    if (yy < ZONE_RADII[4]) return 4;
    if (yy < ZONE_RADII[5]) return 5;
    return 6;
  }

  // Zone 0 (Hub): rounded square safe area.
  if (isPointInHub(x, y)) return 0;

  const r = Math.hypot(x, y);

  const r1 = ZONE_RADII[1];
  const r2 = ZONE_RADII[2];
  const r3 = ZONE_RADII[3];
  const r4 = ZONE_RADII[4];
  const r5 = ZONE_RADII[5];

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
    // Balanced curve for 1–500 weapon progression:
    // - HP scales stronger than damage (so fights last longer, but don't one-shot)
    // - Speed scales gently (so higher zones feel faster, but still dodgeable)
    hp: 1 + idx * 0.65 + idx * idx * 0.05,
    damage: 1 + idx * 0.35 + idx * idx * 0.03,
    speed: 1 + idx * 0.08 + idx * idx * 0.01,
    xp: 1 + idx * 0.55,
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
