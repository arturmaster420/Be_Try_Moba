// Centralized mouse + touch controller for aim & movement.

const state = {
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
};

export function handleMouseMove(x, y) {
  state.mouseX = x;
  state.mouseY = y;
}

export function handleMouseDown(button, x, y) {
  if (button === 0) {
    state.mouseDown = true;
    state.mouseX = x;
    state.mouseY = y;
  }
}

export function handleMouseUp(button) {
  if (button === 0) {
    state.mouseDown = false;
  }
}

export function handleTouchStart(id, x, y, canvasWidth) {
  const isLeft = x < canvasWidth / 2;

  if (isLeft) {
    if (state.moveTouchId === null) {
      state.moveTouchId = id;
      state.moveBaseX = x;
      state.moveBaseY = y;
      state.moveVecX = 0;
      state.moveVecY = 0;
      return;
    }
    if (state.aimTouchId === null) {
      state.aimTouchId = id;
      state.aimBaseX = x;
      state.aimBaseY = y;
      state.aimVecX = 0;
      state.aimVecY = 0;
      return;
    }
  } else {
    if (state.aimTouchId === null) {
      state.aimTouchId = id;
      state.aimBaseX = x;
      state.aimBaseY = y;
      state.aimVecX = 0;
      state.aimVecY = 0;
      return;
    }
    if (state.moveTouchId === null) {
      state.moveTouchId = id;
      state.moveBaseX = x;
      state.moveBaseY = y;
      state.moveVecX = 0;
      state.moveVecY = 0;
      return;
    }
  }
}

export function handleTouchMove(id, x, y) {
  const maxDist = 80;

  if (id === state.moveTouchId) {
    let dx = x - state.moveBaseX;
    let dy = y - state.moveBaseY;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const n = Math.min(1, len / maxDist);
      dx = (dx / len) * n;
      dy = (dy / len) * n;
      state.moveVecX = dx;
      state.moveVecY = dy;
    } else {
      state.moveVecX = 0;
      state.moveVecY = 0;
    }
  } else if (id === state.aimTouchId) {
    let dx = x - state.aimBaseX;
    let dy = y - state.aimBaseY;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const n = Math.min(1, len / maxDist);
      dx = (dx / len) * n;
      dy = (dy / len) * n;
      state.aimVecX = dx;
      state.aimVecY = dy;
    } else {
      state.aimVecX = 0;
      state.aimVecY = 0;
    }
  }
}

export function handleTouchEnd(id) {
  if (id === state.moveTouchId) {
    state.moveTouchId = null;
    state.moveVecX = 0;
    state.moveVecY = 0;
  } else if (id === state.aimTouchId) {
    state.aimTouchId = null;
    state.aimVecX = 0;
    state.aimVecY = 0;
  }
}

export function getMoveVectorFromPointer() {
  return { x: state.moveVecX, y: state.moveVecY };
}

export function isFiringActive() {
  return state.mouseDown || state.aimTouchId !== null;
}

export function getAimDirectionForPlayer(player, camera, canvas) {
  // Touch right-stick aim
  if (state.aimTouchId !== null) {
    const dx = state.aimVecX;
    const dy = state.aimVecY;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      return { x: dx / len, y: dy / len };
    }
  }

  // Mouse aim
  const w = canvas.width;
  const h = canvas.height;

  const wx =
    (state.mouseX - w / 2) / (camera.zoom || 1) + camera.x;
  const wy =
    (state.mouseY - h / 2) / (camera.zoom || 1) + camera.y;

  let dx = wx - player.x;
  let dy = wy - player.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;
  dx /= len;
  dy /= len;
  return { x: dx, y: dy };
}
