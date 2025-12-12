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

function isPortraitMobile() {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const maxDim = Math.max(w, h);
  return h > w && maxDim < 900;
}


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
  const isPortrait = isPortraitMobile();
  const isLeft = x < canvasWidth / 2;

  if (isPortrait) {
    // One-finger control in vertical mobile: single move joystick anywhere
    if (state.moveTouchId === null) {
      state.moveTouchId = id;
      state.moveBaseX = x;
      state.moveBaseY = y;
      state.moveVecX = 0;
      state.moveVecY = 0;
    }
    return;
  }


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
  const isPortrait = isPortraitMobile();
  const maxDist = 80;

  if (isPortrait) {
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
    }
    return;
  }


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
  const isPortrait = isPortraitMobile();
  if (id === state.moveTouchId) {
    state.moveTouchId = null;
    state.moveVecX = 0;
    state.moveVecY = 0;
    if (isPortrait) {
      // In one-finger mode there is no separate aim touch.
      return;
    }
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
  if (isPortraitMobile()) {
    // In vertical mobile: moving finger always fires in move direction.
    return state.moveTouchId !== null;
  }
  return state.mouseDown || state.aimTouchId !== null;
}


export function getAimDirectionForPlayer(player, camera, canvas, enemies, attackRange) {
  // Portrait mobile: auto-aim to nearest enemy within current weapon range.
  if (isPortraitMobile()) {
    const hasEnemies = Array.isArray(enemies) && enemies.length > 0;
    const maxRange = attackRange && attackRange > 0 ? attackRange : 0;

    let best = null;

    if (hasEnemies && maxRange > 0) {
      const maxR2 = maxRange * maxRange;
      for (const e of enemies) {
        if (!e || e.hp <= 0) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxR2) continue;
        if (!best || d2 < best.d2) {
          best = { dx, dy, d2 };
        }
      }
    }

    if (best) {
      const len = Math.sqrt(best.d2) || 1;
      return { x: best.dx / len, y: best.dy / len };
    }

    // Fallback: if no enemies in range — keep old behaviour (shoot where you move).
    const mdx = state.moveVecX;
    const mdy = state.moveVecY;
    const mlen = Math.hypot(mdx, mdy);
    if (mlen > 0.1) {
      return { x: mdx / mlen, y: mdy / mlen };
    }

    // No movement & no valid target — no aim.
    return null;
  }

  // Touch right-stick aim (landscape mobile)
  if (state.aimTouchId !== null) {
    const dx = state.aimVecX;
    const dy = state.aimVecY;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      return { x: dx / len, y: dy / len };
    }
  }

  // Mouse aim (PC / desktop)
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
