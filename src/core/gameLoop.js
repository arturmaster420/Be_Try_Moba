import { Player } from "./player.js";
import { Camera } from "./camera.js";
import { initInput } from "./input.js";
import { updateWeapon } from "../weapons/weaponEvolution.js";
import { SpawnSystem } from "../world/spawnSystem.js";
import { renderHUD } from "../ui/hud.js";
import { renderUpgradeMenu, handleUpgradeClick } from "../ui/upgradeMenu.js";
import {
  saveProgression,
  getStartLevel,
  applyLimitsToPlayer,
} from "./progression.js";
import { updateBuffs } from "../buffs/buffs.js";
import { getZone } from "../world/zoneController.js";

export function createGame(canvas, ctx, progression) {
  initInput();

  const state = {
    canvas,
    ctx,
    progression,
    mode: "playing",
    paused: false,
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
    _hpRegenAccumulator: 0,
    _pauseButtonRect: null,
  };

  startNewRun(state);

  function update(dt) {
    state.time += dt;

    if (state.mode !== "playing") {
      updatePopups(state, dt);
      return;
    }

    updateBuffs(state, dt);
    state.player.update(dt, state);
    updateWeapon(state.player, state, dt);
    state.spawnSystem.update(dt);

    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    updateXPOrbs(state, dt);
    updateFloatingTexts(state, dt);
    updatePopups(state, dt);

    state.camera.update(state.player, dt);
    checkPlayerDeath(state);
  }

  function render() {
    const { canvas, ctx, player } = state;
    const w = canvas.width;
    const h = canvas.height;

    // Static background + grid (screen-space)
    const zone = getZone(player.y);
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

    // World space (follows camera)
    state.camera.applyTransform(ctx);

    renderWorldBackground(state, ctx);
    renderXPOrbs(state, ctx);
    renderEnemies(state, ctx);
    renderProjectiles(state, ctx);
    state.player.render(ctx);
    renderHPBarsWorld(state, ctx);
    renderBuffAuras(state, ctx);

    state.camera.resetTransform(ctx);

    renderFloatingTexts(ctx, state);
    renderHUD(ctx, state);
    renderPopups(ctx, state);

    if (state.mode === "upgrade") {
      renderUpgradeMenu(ctx, state);
    }
  }

  function handlePointerDown(x, y) {
    // Upgrade menu clicks
    if (state.mode === "upgrade") {
      var action = handleUpgradeClick(x, y, state);
      if (action === "start") {
        startNewRun(state);
      }
      return;
    }

    // Pause button hit test
    var rect = state._pauseButtonRect;
    if (rect) {
      if (
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      ) {
        state.paused = !state.paused;
        return;
      }
    }
  }

  return {
    state,
    get player() {
      return state.player;
    },
    update,
    render,
    handlePointerDown,
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

  state.spawnSystem = new SpawnSystem(state);
  state.mode = "playing";
}

function updateEnemies(state, dt) {
  const { enemies } = state;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.update) {
      e.update(e, dt, state);
    }

    if (e.hp <= 0 || e._remove) {
      if (!e._noScore) {
        state.runScore += e.scoreValue || 10;
      }
      if (e.onDeath) {
        e.onDeath(e, state);
      }
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
      player.gainXP(orb.xp || 10, state);
      xpOrbs.splice(i, 1);
    }
  }
}

function updateFloatingTexts(state, dt) {
  const { floatingTexts } = state;

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y -= 20 * dt;
    t.time -= dt;
    if (t.time <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}


function renderFloatingTexts(ctx, state) {
  var floatingTexts = state.floatingTexts;

  ctx.save();
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  for (var i = 0; i < floatingTexts.length; i++) {
    var t = floatingTexts[i];
    var alpha = t.time / 1.2;
    if (alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(2) + ")";
    ctx.fillText(t.text, t.x, t.y);
  }

  ctx.restore();
}
function updatePopups(state, dt) {
  const arr = state.popups;
  for (let i = arr.length - 1; i >= 0; i--) {
    arr[i].time -= dt;
    if (arr[i].time <= 0) {
      arr.splice(i, 1);
    }
  }
}

function renderStaticGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const step = 120;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
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
    if (e.render) {
      e.render(e, ctx);
    }
  }
}

function renderProjectiles(state, ctx) {
  const { projectiles, rockets, _laserVisual, _lightningVisual } =
    state;

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

function renderHPBarsWorld(state, ctx) {
  ctx.save();

  // Enemies
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

  // Player
  const p = state.player;
  if (p) {
    const hp = p.hp;
    const maxHp = p.maxHP ?? p.maxHp ?? p.maxHP ?? 0;
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

function renderPopups(ctx, state) {
  const { canvas, popups } = state;
  const w = canvas.width;

  ctx.save();
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  let y = 40;
  for (const p of popups) {
    const alpha = Math.max(0, Math.min(1, p.time / 2));
    ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
    ctx.fillText(p.text, w / 2, y);
    y += 22;
  }

  ctx.restore();
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
