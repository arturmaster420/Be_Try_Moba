import { pointerState } from "./pointerState.js";

export function handleTouchStart(id, x, y, canvasWidth) {
  const isLeft = x < canvasWidth / 2;

  if (isLeft) {
    if (pointerState.moveTouchId === null) {
      pointerState.moveTouchId = id;
      pointerState.moveBaseX = x;
      pointerState.moveBaseY = y;
      pointerState.moveVecX = 0;
      pointerState.moveVecY = 0;
      return;
    }
    if (pointerState.aimTouchId === null) {
      pointerState.aimTouchId = id;
      pointerState.aimBaseX = x;
      pointerState.aimBaseY = y;
      pointerState.aimVecX = 0;
      pointerState.aimVecY = 0;
      pointerState.aimActive = false;
      return;
    }
  } else {
    if (pointerState.aimTouchId === null) {
      pointerState.aimTouchId = id;
      pointerState.aimBaseX = x;
      pointerState.aimBaseY = y;
      pointerState.aimVecX = 0;
      pointerState.aimVecY = 0;
      pointerState.aimActive = false;
      return;
    }
    if (pointerState.moveTouchId === null) {
      pointerState.moveTouchId = id;
      pointerState.moveBaseX = x;
      pointerState.moveBaseY = y;
      pointerState.moveVecX = 0;
      pointerState.moveVecY = 0;
      return;
    }
  }
}

export function handleTouchMove(id, x, y) {
  const maxDist = 80;

  if (id === pointerState.moveTouchId) {
    let dx = x - pointerState.moveBaseX;
    let dy = y - pointerState.moveBaseY;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const n = Math.min(1, len / maxDist);
      dx = (dx / len) * n;
      dy = (dy / len) * n;
      pointerState.moveVecX = dx;
      pointerState.moveVecY = dy;
    } else {
      pointerState.moveVecX = 0;
      pointerState.moveVecY = 0;
    }
  } else if (id === pointerState.aimTouchId) {
    let dx = x - pointerState.aimBaseX;
    let dy = y - pointerState.aimBaseY;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const n = Math.min(1, len / maxDist);
      dx = (dx / len) * n;
      dy = (dy / len) * n;
      pointerState.aimVecX = dx;
      pointerState.aimVecY = dy;
      pointerState.aimActive = true;
    } else {
      pointerState.aimVecX = 0;
      pointerState.aimVecY = 0;
      pointerState.aimActive = false;
    }
  }
}

export function handleTouchEnd(id) {
  if (id === pointerState.moveTouchId) {
    pointerState.moveTouchId = null;
    pointerState.moveVecX = 0;
    pointerState.moveVecY = 0;
  } else if (id === pointerState.aimTouchId) {
    pointerState.aimTouchId = null;
    pointerState.aimVecX = 0;
    pointerState.aimVecY = 0;
    pointerState.aimActive = false;
  }
}
