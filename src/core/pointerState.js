export const pointerState = {
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,

  moveTouchId: null,
  moveBaseX: 0,
  moveBaseY: 0,
  moveVecX: 0,
  moveVecY: 0,

  aimTouchId: null,
  aimBaseX: 0,
  aimBaseY: 0,
  aimVecX: 0,
  aimVecY: 0,
  aimActive: false,
};

export function getMoveVector() {
  return { x: pointerState.moveVecX, y: pointerState.moveVecY };
}

export function getAimStickVector() {
  if (!pointerState.aimActive) return { x: 0, y: 0 };
  const x = pointerState.aimVecX;
  const y = pointerState.aimVecY;
  const len = Math.hypot(x, y);
  if (len < 0.001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function isFiringActive() {
  return pointerState.mouseDown || pointerState.aimActive;
}
