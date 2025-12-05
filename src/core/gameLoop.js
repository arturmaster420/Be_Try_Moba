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
    player: null,
    camera: null,
    enemies: [],
    projectiles: [],
    rockets: [],
    xpOrbs: [],
    buffs: [],
    floatingTexts: [],
    runScore: 0,
    lastRunSummary: null,
    spawnSystem: null,
    time: 0,
    _laserVisual: null,
    _lightningVisual: null,
  };

  startNewRun(state);

  function update(dt) {
    state.time += dt;

    if (state.mode !== "playing") return;

    updateBuffs(state, dt);
    state.player.update(dt, state);
    updateWeapon(state.player, state, dt);
    state.spawnSystem.update(dt);

    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    updateXPOrbs(state, dt);
    updateFloatingTexts(state, dt);

    state.camera.update(state.player, dt);
    checkPlayerDeath(state);
  }

  function render() {
    const { canvas, ctx } = state;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state.camera.applyTransform(ctx);

    renderBackground(state, ctx);
    renderXPOrbs(state, ctx);
    renderEnemies(state, ctx);
    renderProjectiles(state, ctx);
    state.player.render(ctx);
    renderBuffAuras(state, ctx);

    state.camera.resetTransform(ctx);

    renderHUD(ctx, state);

    if (state.mode === "upgrade") {
      renderUpgradeMenu(ctx, state);
    }
  }

  function handlePointerDown(x, y) {
    if (state.mode === "upgrade") {
      const action = handleUpgradeClick(x, y, state);
      if (action === "start") {
        startNewRun(state);
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
      player.gainXP(orb.xp || 10);
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

function renderBackground(state, ctx) {
  const { player } = state;
  const zone = getZone(player.y);

  const colors = {
    1: "#10141c",
    2: "#131720",
    3: "#171b26",
    4: "#1b1f2b",
    5: "#221d2f",
  };

  ctx.fillStyle = colors[zone] || "#10141c";
  ctx.fillRect(player.x - 2000, player.y - 2000, 4000, 4000);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;

  const step = 120;

  ctx.beginPath();
  for (let x = player.x - 1500; x <= player.x + 1500; x += step) {
    ctx.moveTo(x, player.y - 1500);
    ctx.lineTo(x, player.y + 1500);
  }
  for (let y = player.y - 1500; y <= player.y + 1500; y += step) {
    ctx.moveTo(player.x - 1500, y);
    ctx.lineTo(player.x + 1500, y);
  }
  ctx.stroke();
}

function renderEnemies(state, ctx) {
  for (const e of state.enemies) {
    if (e.render) {
      e.render(e, ctx);
    }
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
