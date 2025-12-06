import { Player } from "./player.js";
import { Camera } from "./camera.js";
import { initInput, getKeyboardVector } from "./input.js";
import { renderStaticGrid } from "./gridRenderer.js";
import { updateWeapon } from "../weapons/weaponEvolution.js";
import { SpawnSystem } from "../world/spawnSystem.js";
import { renderHUD } from "../ui/hud.js";
import { renderUpgradeMenu, handleUpgradeClick } from "../ui/upgradeMenu.js";
import {
  loadProgression,
  saveProgression,
  getStartLevel,
  applyLimitsToPlayer,
} from "./progression.js";
import { updateBuffs } from "../buffs/buffs.js";
import { getZone } from "../world/zoneController.js";
import { getMoveVector, getAimStickVector, isFiringActive } from "./pointerState.js";
import {
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
} from "./mouseController.js";
import {
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} from "./touchController.js";

export function startGame(canvas) {
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (state) {
      state.uiScale = computeUIScale(canvas);
    }
  }
  window.addEventListener("resize", resize);
  resize();

  initInput();
  const progression = loadProgression();

  const state = createInitialState(canvas, ctx, progression);
  startNewRun(state);

  setupPointerEvents(canvas, state);

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    updateGame(state, dt);
    renderGame(state);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function computeUIScale(canvas) {
  const minSide = Math.min(canvas.width, canvas.height);
  if (minSide < 500) return 0.45;
  if (minSide < 768) return 0.6;
  return 1.0;
}

function createInitialState(canvas, ctx, progression) {
  return {
    canvas,
    ctx,
    progression,
    mode: "playing",
    player: null,
    camera: null,
    enemies: [],
    projectiles: [],
    rockets: [],
    xpOrbs: [],
    buffs: [],
    floatingTexts: [],
    popups: [],
    runScore: 0,
    lastRunSummary: null,
    spawnSystem: null,
    time: 0,
    _laserVisual: null,
    _lightningVisual: null,
    uiScale: computeUIScale(canvas),
    pauseButtonRect: null,
  };
}

function startNewRun(state) {
  const startLevel = getStartLevel(state.progression);
  const startPos = { x: 0, y: 1000 };

  const player = new Player(startPos, startLevel);
  applyLimitsToPlayer(player, state.progression.limits);

  state.player = player;
  state.camera = new Camera(state.canvas);

  state.enemies = [];
  state.projectiles = [];
  state.rockets = [];
  state.xpOrbs = [];
  state.buffs = [];
  state.floatingTexts = [];
  state.popups = [];
  state.runScore = 0;
  state.lastRunSummary = null;
  state._laserVisual = null;
  state._lightningVisual = null;
  state.time = 0;

  state.spawnSystem = new SpawnSystem(state);
  state.spawnSystem.reset();
  state.mode = "playing";
}

function setupPointerEvents(canvas, state) {
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
      handlePointerDown(state, x, y);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      handleMouseUp(0);
    }
  });

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
        handlePointerDown(state, x, y);
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

  const endHandler = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      handleTouchEnd(t.identifier);
    }
    e.preventDefault();
  };

  canvas.addEventListener("touchend", endHandler, { passive: false });
  canvas.addEventListener("touchcancel", endHandler, { passive: false });
}

function updateGame(state, dt) {
  if (state.mode === "playing") {
    state.time += dt;

    updateBuffs(state, dt);

    const kb = getKeyboardVector();
    const pointerMove = getMoveVector();
    let moveX = pointerMove.x;
    let moveY = pointerMove.y;
    if (Math.hypot(moveX, moveY) < 0.1) {
      moveX = kb.x;
      moveY = kb.y;
    }

    state.player.update(dt, { x: moveX, y: moveY });

    const aimDir = computeAimDirection(state);
    const firing = isFiringActive();

    updateWeapon(state.player, state, dt, aimDir, firing);

    state.spawnSystem.update(dt);

    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    updateXPOrbs(state, dt);
    updateFloatingTexts(state, dt);
    updatePopups(state, dt);

    state.camera.update(state.player, dt);
    checkPlayerDeath(state);
  } else if (state.mode === "paused") {
    updatePopups(state, dt);
  } else if (state.mode === "upgrade") {
    updatePopups(state, dt);
  }
}

function renderGame(state) {
  const { canvas, ctx, player } = state;
  const w = canvas.width;
  const h = canvas.height;

  const zone = player ? getZone(player.y) : 1;
  const colors = {
    1: "#10141c",
    2: "#131720",
    3: "#171b26",
    4: "#1b1f2b",
    5: "#221d2f",
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors[zone] || "#10141c";
  ctx.fillRect(0, 0, w, h);

  renderStaticGrid(ctx, w, h);

  if (player) {
    state.camera.applyTransform(ctx);

    renderWorldBackground(state, ctx);
    renderXPOrbs(state, ctx);
    renderEnemies(state, ctx);
    renderProjectiles(state, ctx);
    playerRender(player, ctx);
    renderHPBarsWorld(state, ctx);
    renderBuffAuras(state, ctx);

    state.camera.resetTransform(ctx);
  }

  renderHUD(ctx, state);
  renderPopupsDisplay(ctx, state);

  if (state.mode === "paused") {
    renderPauseOverlay(ctx, state);
  } else if (state.mode === "upgrade") {
    renderUpgradeMenu(ctx, state);
  }
}

function computeAimDirection(state) {
  const { canvas, player, camera } = state;

  const stick = getAimStickVector();
  if (Math.hypot(stick.x, stick.y) > 0.1) {
    return { x: stick.x, y: stick.y };
  }

  const w = canvas.width;
  const h = canvas.height;

  const mouseX = state.canvas.getBoundingClientRect ? null : null;
  // compute from pointerState via mouseController: we know mouse coords stored there,
  // but to avoid importing pointerState directly for raw values, approximate via center.
  // We'll just aim from screen center straight up when no stick active.
  // (mouse aim is already handled via shooting only when mouseDown; direction is lastAimDir)
  return {
    x: player.lastAimDir.x,
    y: player.lastAimDir.y,
  };
}

function updateEnemies(state, dt) {
  const { enemies } = state;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.update) e.update(e, dt, state);
    if (e.hp <= 0 || e._remove) {
      if (!e._noScore) {
        state.runScore += e.scoreValue || 10;
      }
      if (e.onDeath) e.onDeath(e, state);
      enemies.splice(i, 1);
    }
  }
}

function updateProjectiles(state, dt) {
  const { projectiles, rockets, enemies } = state;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travel += b.speed * dt;

    if (b.travel >= b.range) {
      projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const r = (e.radius || 20) + (b.radius || 4);
      if (dx * dx + dy * dy <= r * r) {
        e.hp -= b.damage;
        hit = true;
        break;
      }
    }

    if (hit) {
      projectiles.splice(i, 1);
    }
  }

  for (let i = rockets.length - 1; i >= 0; i--) {
    const rkt = rockets[i];
    rkt.x += rkt.vx * dt;
    rkt.y += rkt.vy * dt;
    rkt.travel += rkt.speed * dt;

    let explode = false;

    if (rkt.travel >= rkt.range) {
      explode = true;
    } else {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - rkt.x;
        const dy = e.y - rkt.y;
        const rr = (e.radius || 24) + (rkt.radius || 6);
        if (dx * dx + dy * dy <= rr * rr) {
          explode = true;
          break;
        }
      }
    }

    if (explode) {
      explodeRocket(rkt, state);
      rockets.splice(i, 1);
    }
  }
}

function explodeRocket(rocket, state) {
  const { enemies, floatingTexts } = state;
  const r2 = rocket.splashRadius * rocket.splashRadius;

  for (const e of enemies) {
    const dx = e.x - rocket.x;
    const dy = e.y - rocket.y;
    if (dx * dx + dy * dy <= r2) {
      e.hp -= rocket.damage;
    }
  }

  floatingTexts.push({
    x: rocket.x,
    y: rocket.y,
    text: "BOOM",
    time: 0.6,
  });
}

function updateXPOrbs(state, dt) {
  const { xpOrbs, player } = state;

  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    orb.age = (orb.age || 0) + dt;
    orb.y += Math.sin(orb.age * 5) * 2 * dt;

    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const r = (player.radius || 18) + (orb.radius || 8);
    if (dx * dx + dy * dy <= r * r) {
      const oldLevel = player.level;
      const levelsGained = player.gainXP(orb.xp || 10);
      xpOrbs.splice(i, 1);

      if (levelsGained > 0) {
        state.floatingTexts.push({
          x: player.x,
          y: player.y - 30,
          text: "LEVEL UP!",
          time: 1.2,
        });
        state.popups.push({
          text: "Level Up! Lv " + player.level,
          time: 2.0,
        });
      }
    }
  }
}

function updateFloatingTexts(state, dt) {
  const { floatingTexts } = state;
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y -= 20 * dt;
    t.time -= dt;
    if (t.time <= 0) floatingTexts.splice(i, 1);
  }
}

function updatePopups(state, dt) {
  const arr = state.popups;
  for (let i = arr.length - 1; i >= 0; i--) {
    arr[i].time -= dt;
    if (arr[i].time <= 0) arr.splice(i, 1);
  }
}

function renderWorldBackground(state, ctx) {
  const { player } = state;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(player.x - 2000, player.y - 2000, 4000, 4000);
  ctx.restore();
}

function renderEnemies(state, ctx) {
  for (const e of state.enemies) {
    if (e.render) e.render(e, ctx);
  }
}

function renderProjectiles(state, ctx) {
  const { projectiles, rockets, _laserVisual, _lightningVisual } = state;

  ctx.save();

  ctx.fillStyle = "#f4e9a3";
  for (const b of projectiles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius || 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ff7a3c";
  for (const rkt of rockets) {
    ctx.beginPath();
    ctx.arc(rkt.x, rkt.y, rkt.radius || 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (_laserVisual) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(173,246,255,0.9)";
    ctx.lineWidth = 6;
    ctx.moveTo(_laserVisual.x1, _laserVisual.y1);
    ctx.lineTo(_laserVisual.x2, _laserVisual.y2);
    ctx.stroke();
  }

  if (_lightningVisual && _lightningVisual.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(220,245,255,0.95)";
    ctx.lineWidth = 3;
    for (let i = 0; i < _lightningVisual.length - 1; i++) {
      const a = _lightningVisual[i];
      const b = _lightningVisual[i + 1];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function renderXPOrbs(state, ctx) {
  ctx.save();
  ctx.fillStyle = "#5af2ff";
  for (const orb of state.xpOrbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius || 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function playerRender(player, ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = "#8fe3ff";
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  const len = Math.hypot(player.lastAimDir.x, player.lastAimDir.y) || 1;
  const nx = player.lastAimDir.x / len;
  const ny = player.lastAimDir.y / len;

  ctx.beginPath();
  ctx.strokeStyle = "#ffffff";
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(
    player.x + nx * (player.radius + 10),
    player.y + ny * (player.radius + 10)
  );
  ctx.stroke();

  ctx.restore();
}

function renderHPBarsWorld(state, ctx) {
  ctx.save();

  for (const e of state.enemies) {
    const hp = e.hp;
    const maxHp = e.maxHp ?? e.maxHP ?? 0;
    if (maxHp <= 0 || hp <= 0) continue;

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const fullWidth = (e.radius || 20) * 2.2;
    const h = 4;
    const x = e.x - fullWidth / 2;
    const y = e.y - (e.radius || 20) - 10;

    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, fullWidth, h);
    ctx.fillStyle = "#4cff4c";
    ctx.fillRect(x, y, fullWidth * ratio, h);
  }

  const p = state.player;
  if (p) {
    const hp = p.hp;
    const maxHp = p.maxHP ?? p.maxHp ?? 0;
    if (maxHp > 0 && hp > 0) {
      const ratio = Math.max(0, Math.min(1, hp / maxHp));
      const fullWidth = (p.radius || 18) * 2.4;
      const h = 5;
      const x = p.x - fullWidth / 2;
      const y = p.y - (p.radius || 18) - 14;

      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, fullWidth, h);
      ctx.fillStyle = "#00ff7a";
      ctx.fillRect(x, y, fullWidth * ratio, h);
    }
  }

  ctx.restore();
}

function renderBuffAuras(state, ctx) {
  const { player, buffs } = state;
  if (!buffs || !buffs.length) return;

  ctx.save();
  ctx.globalAlpha = 0.35;

  for (const b of buffs) {
    switch (b.type) {
      case "damage":
        ctx.strokeStyle = "#ff4b7a";
        break;
      case "attackSpeed":
        ctx.strokeStyle = "#ffdd57";
        break;
      case "moveSpeed":
        ctx.strokeStyle = "#57ff9b";
        break;
      case "regen":
        ctx.strokeStyle = "#57c8ff";
        break;
      case "shield":
        ctx.strokeStyle = "#b857ff";
        break;
      case "ghost":
        ctx.strokeStyle = "#ffffff";
        break;
      default:
        ctx.strokeStyle = "#ffffff";
        break;
    }

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.arc(player.x, player.y, (player.radius || 18) + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function renderPopupsDisplay(ctx, state) {
  const { canvas, popups, uiScale } = state;
  const w = canvas.width;
  const s = uiScale || 1;

  ctx.save();
  ctx.font = `${18 * s}px sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  let y = 40 * s;
  for (const p of popups) {
    const alpha = Math.max(0, Math.min(1, p.time / 2));
    ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
    ctx.fillText(p.text, w / 2, y);
    y += 22 * s;
  }

  ctx.restore();
}

function renderPauseOverlay(ctx, state) {
  const { canvas, uiScale } = state;
  const w = canvas.width;
  const h = canvas.height;
  const s = uiScale || 1;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, w, h);

  ctx.font = `${28 * s}px sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("PAUSED", w / 2, h / 2 - 40 * s);

  ctx.restore();
}

function handlePointerDown(state, x, y) {
  if (state.pauseButtonRect) {
    const r = state.pauseButtonRect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (state.mode === "playing") state.mode = "paused";
      else if (state.mode === "paused") state.mode = "playing";
      return;
    }
  }

  if (state.mode === "upgrade") {
    const action = handleUpgradeClick(x, y, state);
    if (action === "start") {
      startNewRun(state);
    }
  }
}

function checkPlayerDeath(state) {
  const { player, progression } = state;
  if (player.hp > 0) return;
  if (state.mode !== "playing") return;

  state.mode = "upgrade";

  const runScore = Math.floor(state.runScore);
  const gainedPoints = Math.max(1, Math.floor(runScore / 400));

  progression.totalScore += runScore;
  progression.upgradePoints += gainedPoints;

  state.lastRunSummary = {
    runScore,
    totalScore: progression.totalScore,
    gainedPoints,
  };

  saveProgression(progression);
}
