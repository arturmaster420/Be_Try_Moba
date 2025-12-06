import { createGame } from "./core/gameLoop.js";
import { loadProgression } from "./core/progression.js";
import {
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} from "./core/mouseController.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (game && game.handleResize) {
    game.handleResize(canvas.width, canvas.height);
  }
}

window.addEventListener("resize", resize);
resize();

const progression = loadProgression();
const game = createGame(canvas, ctx, progression);

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  game.update(dt);
  game.render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Desktop mouse
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleMouseMove(x, y);
});

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (e.button === 0) {
    handleMouseDown(0, x, y);
  }
  if (game.handlePointerDown) {
    game.handlePointerDown(x, y);
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    handleMouseUp(0);
  }
});

// Touch (mobile dual-stick + UI)
canvas.addEventListener(
  "touchstart",
  (e) => {
    const rect = canvas.getBoundingClientRect();
    const w = canvas.width;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      handleTouchStart(t.identifier, x, y, w);
      if (game.handlePointerDown) {
        game.handlePointerDown(x, y);
      }
    }
    e.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      handleTouchMove(t.identifier, x, y);
    }
    e.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      handleTouchEnd(t.identifier);
    }
    e.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchcancel",
  (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      handleTouchEnd(t.identifier);
    }
    e.preventDefault();
  },
  { passive: false }
);
