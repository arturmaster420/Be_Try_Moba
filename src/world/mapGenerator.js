import { WORLD_SQUARE_HALF } from "./zoneController.js";

// World 2.0 bounds — centered at (0,0), square outer bounds.
// The radial zones are defined in zoneController.js.
export const WORLD_HALF_SIZE = WORLD_SQUARE_HALF;

// Keep legacy exports (some render code uses WORLD_WIDTH/WORLD_HEIGHT)
export const WORLD_WIDTH = WORLD_HALF_SIZE * 2;
export const WORLD_HEIGHT = WORLD_HALF_SIZE * 2;

export function getWorldBounds() {
  return {
    minX: -WORLD_HALF_SIZE,
    maxX: WORLD_HALF_SIZE,
    minY: -WORLD_HALF_SIZE,
    maxY: WORLD_HALF_SIZE,
  };
}
