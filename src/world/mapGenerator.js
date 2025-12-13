export const WORLD_HEIGHT = 60000;
export const WORLD_WIDTH = 4000;

export function getWorldBounds() {
  return {
    minX: -WORLD_WIDTH / 2,
    maxX: WORLD_WIDTH / 2,
    minY: 0,
    maxY: WORLD_HEIGHT,
  };
}
