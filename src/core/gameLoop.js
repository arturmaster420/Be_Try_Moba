import { Player } from "./player.js";
import { Camera } from "./camera.js";
import { initInput } from "./input.js";
import { getKeyboardVector } from "./input.js";
import { setControlMode } from "./mouseController.js";
import { getMoveVectorFromPointer, getAimDirectionForPlayer, isFiringActive } from "./mouseController.js";
import { updateWeapon } from "../weapons/weaponEvolution.js";
import { updateWeaponNet, getAttackRangeForPlayer } from "../weapons/weaponEvolution.js";
import { SpawnSystem } from "../world/spawnSystem.js";
import { renderHUD } from "../ui/hud.js";
import { renderUpgradeMenu, handleUpgradeClick } from "../ui/upgradeMenu.js";
import { renderResurrectionScreen, handleResurrectionClick } from "../ui/resurrectionScreen.js";
import {
  renderStartMenu,
  tickStartMenu,
  handleStartMenuPointerDown,
  handleStartMenuPointerMove,
  handleStartMenuPointerUp,
  renderSettingsMenu,
  handleSettingsClick,
} from "../ui/startMenu.js";
import {
  saveProgression,
  getStartLevel,
  applyLimitsToPlayer,
  applyCritToDamage,
  applyLifeSteal,
} from "./progression.js";
import { updateBuffs } from "../buffs/buffs.js";
import { getZone, ZONE_RADII, ZONE6_SQUARE_HALF } from "../world/zoneController.js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../world/mapGenerator.js";
import { createNetClient, getDefaultWsUrl } from "../net/netClient.js";

export function createGame(canvas, ctx, progression) {
  initInput();

  const state = {
    canvas,
    ctx,
    progression,
    mode: "startMenu",
    paused: false,
    player: null,
    players: [],
    camera: null,
    enemies: [],
    projectiles: [],
    rockets: [],
    xpOrbs: [],
    buffs: [],
    floatingTexts: [],
    popups: [],
    flags: {
      resGuardianKilledThisRun: false,
    },
    runScore: 0,
    lastRunSummary: null,
    spawnSystem: null,
    time: 0,
    currentZone: 1,
    _laserVisual: null,
    _lightningVisual: null,
    _pauseButtonRect: null,
    players: [],
    net: null,
    _netLastInputSentAt: 0,
    _netLastSnapshotSentAt: 0,
    _netLastAppliedSnapshotAt: 0,
    _netLastAppliedPStateAt: 0,
    meta: {
      xpGainMult: 1,
      scoreMult: 1,
      pickupBonusRadius: 0,
    },
    net: createNetClient(),
    _netLastInputSendAt: 0,
    _netLastSnapshotSendAt: 0,

    // Online-only overlays (so host can keep simulating the world while showing UI)
    overlayMode: null, // 'resurrection' | 'upgrade' | null
    _deathHandled: false,
    _waitingRespawnAck: false,

    // Host keeps per-player meta snapshots (limits/resTier/etc.)
    _netMetaById: new Map(),
  };

  // Net client (optional)
  state.net = createNetClient();

  
  // If opened via invite link, prefill room code
  try {
    const params = new URLSearchParams(location.search || "");
    const raw = params.get("code") || params.get("room");
    if (raw && state.progression) {
      const cleaned = raw.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (cleaned) state.progression.roomCode = cleaned;
    }
  } catch {}
// Initialize a preview run so the world/player can render behind the menu.
  startNewRun(state);
  state.mode = "startMenu";
  state.paused = false;

  // Net callbacks
  state.net.onMessage = (msg) => {
    if (msg.type === "joined") {
      // Persist room code so it stays visible and can be re-used.
      try {
        const rc = (msg.roomCode || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        if (rc && state.progression) {
          state.progression.roomCode = rc;
          saveProgression(state.progression);
          // Show a quick on-screen hint for sharing.
          if (state.popups) state.popups.push({ text: `Room: ${rc}`, time: 6 });
        }
      } catch {}

      // Enter the run immediately (Host/Join/FastJoin -> gameplay).
      // Start Menu is only for setup / fallback Start button.
      if (state.net.isHost) {
        // Host immediately plays. Keep existing world, but ensure local player id matches server id.
        if (state.player) {
          state.player.id = String(state.net.playerId);
          state.player.color = pickColorForId(state.player.id);
          state.player.nickname = state.progression?.nickname || state.player.nickname;
          if (typeof state.progression?.avatarIndex === "number") state.player.avatarIndex = state.progression.avatarIndex | 0;
        }
        syncHostPlayersFromRoomInfo(state);
        state.mode = "playing";
        state.paused = false;
      } else {
        // Joiner plays immediately; snapshots will correct world state.
        if (state.player && state.net.playerId) {
          state.player.id = String(state.net.playerId);
          state.player.color = pickColorForId(state.player.id);
          state.player.nickname = state.progression?.nickname || state.player.nickname;
          if (typeof state.progression?.avatarIndex === "number") state.player.avatarIndex = state.progression.avatarIndex | 0;
        }
        state.mode = "playing";
        state.paused = false;
      }

      // Joiners sync their current meta to host so stats match.
      if (state.net && state.net.status === "connected" && !state.net.isHost) {
        state.net.sendMeta(getNetMetaPayload(state.progression));
      }
    }
    if (msg.type === "roomInfo") {
      if (state.net.isHost) {
        syncHostPlayersFromRoomInfo(state);
      }
    }

    if (msg.type === "syncMeta") {
      // Host receives a player's meta/progression snapshot.
      if (!state.net.isHost) return;
      const from = String(msg.from || "");
      if (!from) return;
      const meta = msg.meta || null;
      if (meta) state._netMetaById.set(from, meta);
      const p = getPlayerById(state, from);
      if (p && meta) applyNetMetaToPlayer(state, p, meta);
      return;
    }

    if (msg.type === "respawn") {
      // Host: a player finished death screens and requests respawn.
      if (!state.net.isHost) return;
      const from = String(msg.from || "");
      if (!from) return;
      const meta = msg.meta || null;
      if (meta) state._netMetaById.set(from, meta);
      const p = getPlayerById(state, from);
      if (p) p._netRespawnRequested = true;
      return;
    }

    if (msg.type === "startRun") {
      if (state.net.isHost) return;

      // Host started a new run: switch from lobby to gameplay.
      // Joiners keep the world purely snapshot-driven, but we still reset local state
      // so visuals are clean and consistent.
      startNewRun(state);

      if (state.player && state.net.playerId) {
        state.player.id = String(state.net.playerId);
        state.player.color = pickColorForId(state.player.id);
        state.player.nickname = state.progression?.nickname || state.player.nickname;
        if (typeof state.progression?.avatarIndex === "number") state.player.avatarIndex = state.progression.avatarIndex | 0;
      }

      state.mode = "playing";
      state.paused = false;

      // Drop stale snapshots so we don't apply an old frame right after reset.
      if (state.net) {
        state.net.latestSnapshot = null;
        state.net.latestPlayerState = null;
      }

      state.enemies = [];
      state.projectiles = [];
      state.rockets = [];
      state.xpOrbs = [];
      state.buffs = [];
      state.floatingTexts = [];
      state.popups = [];
      return;
    }
  };

  // Internal sim/update (variable dt for offline/joiners; fixed-step wrapper may call this).
  function updateSim(dt) {
    state.time += dt;

    // Start menu (mobile portrait): inertial scrolling + friction.
    if (state.mode === "startMenu") {
      try {
        tickStartMenu(dt, state);
      } catch {}
    }

    const online = isOnline(state);

    // Joiner client: do not simulate world; send input and apply snapshots.
    if (online && !state.net.isHost) {
      // Joiner client: snapshot-driven.
      // If the host is already running (snapshots coming in) and we're still in the lobby,
      // auto-enter gameplay so we actually "connect into the same match".
      if (state.mode !== "playing" && state.net && state.net.latestSnapshot) {
        startNewRun(state);
        if (state.player && state.net.playerId) {
          state.player.id = String(state.net.playerId);
          state.player.color = pickColorForId(state.player.id);
          state.player.nickname = state.progression?.nickname || state.player.nickname;
          if (typeof state.progression?.avatarIndex === "number") state.player.avatarIndex = state.progression.avatarIndex | 0;
        }
        state.mode = "playing";
        state.paused = false;
      }

      // Lightweight client-side prediction for our own movement
      // (we still rely on host for all combat/world state).
      if (state.mode === "playing" && !state.paused && state.player && typeof state.player.update === "function") {
        if (state.player.hp > 0 && !state.overlayMode) {
          state.player.update(dt, state);
        }
      }

      updatePopups(state, dt);

      if (state.mode === "playing") {
        sendLocalInputToHost(state);

        if (state.net.latestPlayerState) {
          applyPlayerStateToClient(state, state.net.latestPlayerState);
        }
        if (state.net.latestSnapshot) {
          applySnapshotToClient(state, state.net.latestSnapshot);
        }
        // Smooth remote snapshot motion (reduces jitter/"laggy" feel)
        smoothNetEntities(state, dt);
        // Projectiles/rockets are visual-only on joiners; advance them between snapshots.
        updateNetVisualProjectiles(state, dt);
        // Keep camera following our local player smoothly
        if (state.camera && state.player) {
          state.camera.update(state.player, dt);
        }
        maybeEnterOnlineDeathOverlay(state);
      }

      return;
    }

    if (state.mode !== "playing") {
      // Only animate popups (e.g., death screen messages) when not in gameplay
      updatePopups(state, dt);
      return;
    }

    if (state.paused) {
      // When paused: don't move entities or advance timers except popups
      updatePopups(state, dt);
      return;
    }

    // Host (online) or offline: simulate world
    // Clear transient weapon visuals each tick (co-op safe).
    if (state._laserVisuals && typeof state._laserVisuals.clear === "function") state._laserVisuals.clear();
    if (state._lightningVisuals && typeof state._lightningVisuals.clear === "function") state._lightningVisuals.clear();
    state._laserVisual = null;
    state._lightningVisual = null;
    updateBuffs(state, dt);
    updatePlayers(state, dt, online);

    // Permanent HP regen from meta bonuses (HP/s)
    const regenPerSec = state.player.metaHpRegen || 0;
    if (regenPerSec > 0 && state.player.hp > 0) {
      state.player.hp = Math.min(
        state.player.maxHP,
        state.player.hp + regenPerSec * dt
      );
    }

    // Soft zone logic: track current zone and trigger simple feedback
    const newZone = getZone(state.player.x, state.player.y);
    if (newZone !== state.currentZone) {
      state.currentZone = newZone;

      if (state.floatingTexts) {
        state.floatingTexts.push({
          x: state.player.x,
          y: state.player.y - 80,
          text: (newZone === 0 ? "Hub" : "Zone " + newZone),
          time: 1.6,
        });
      }

      if (state.popups) {
        state.popups.push({
          text: (newZone === 0 ? "Entered Hub" : "Entered Zone " + newZone),
          time: 2.4,
        });
      }

      if (state.spawnSystem && typeof state.spawnSystem.onZoneChanged === "function") {
        state.spawnSystem.onZoneChanged(newZone);
      }
    }

    updateWeapons(state, dt, online);
    state.spawnSystem.update(dt);

    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    updateXPOrbs(state, dt);
    updateFloatingTexts(state, dt);
    updatePopups(state, dt);

    state.camera.update(state.player, dt);
    if (online) {
      // Online: no auto-respawn; show local death overlays and wait for respawn requests.
      maybeEnterOnlineDeathOverlay(state);
      processRespawnRequests(state);
        maybeSendPlayerState(state, dt);
        maybeSendSnapshot(state, dt);
    } else {
      checkPlayerDeath(state);
    }
  }

  // Public update: host uses a fixed 60Hz simulation step; everyone else uses frame dt.
  function update(dt) {
    const online = isOnline(state);
    const isHost = !!(online && state.net && state.net.isHost);

    // Fixed-step sim only for the authoritative host while playing.
    if (isHost && state.mode === "playing" && !state.paused) {
      const SIM_DT = 1 / 60;
      state._simAcc = (state._simAcc || 0) + dt;

      // Prevent spiral-of-death if the tab hiccups.
      const MAX_ACC = 0.25;
      if (state._simAcc > MAX_ACC) state._simAcc = MAX_ACC;

      let steps = 0;
      const MAX_STEPS = 10;
      while (state._simAcc >= SIM_DT && steps < MAX_STEPS) {
        updateSim(SIM_DT);
        state._simAcc -= SIM_DT;
        steps++;
      }

      // If we didn't step (very tiny dt), still advance popups/UI time a bit.
      if (steps === 0) {
        updateSim(Math.min(dt, SIM_DT));
      }

      return;
    }

    // Offline or joiners: use frame dt.
    updateSim(dt);
  }

function render() {
    const { canvas, ctx, player } = state;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // World space (with camera): zones + world grid live in world coordinates
    state.camera.applyTransform(ctx);

    renderWorldBackground(state, ctx);
    renderXPOrbs(state, ctx);
    renderEnemies(state, ctx);
    renderProjectiles(state, ctx);
    renderPlayers(state, ctx);
    renderHPBarsWorld(state, ctx);
    renderBuffAuras(state, ctx);

    state.camera.resetTransform(ctx);

    renderFloatingTexts(ctx, state);

    // HUD only during gameplay
    if (state.mode === "playing") {
      renderHUD(ctx, state);
    }

    renderPopups(ctx, state);

    // Online overlays (death screens) that must not stop the host simulation.
    if (state.overlayMode === "resurrection") {
      renderResurrectionScreen(ctx, state);
      return;
    }
    if (state.overlayMode === "upgrade") {
      renderUpgradeMenu(ctx, state);
      return;
    }

    if (state.mode === "resurrection") {
      renderResurrectionScreen(ctx, state);
    } else if (state.mode === "upgrade" || state.mode === "stats") {
      renderUpgradeMenu(ctx, state);
    } else if (state.mode === "startMenu") {
      renderStartMenu(ctx, state);
    } else if (state.mode === "settings") {
      renderSettingsMenu(ctx, state);
    }
  }

  function handlePointerDown(x, y) {
    // Online overlays (death screens) have priority.
    if (state.overlayMode === "resurrection") {
      const a = handleResurrectionClick(x, y, state);
      if (a === "resurrect") {
        applyResurrection(state.progression);
        try { saveProgression(state.progression); } catch {}
        if (isOnline(state) && state.net && state.net.status === "connected" && !state.net.isHost) {
          state.net.sendMeta(getNetMetaPayload(state.progression));
        }
        state.overlayMode = "upgrade";
      } else if (a === "skip") {
        state.overlayMode = "upgrade";
      }
      return;
    }
    if (state.overlayMode === "upgrade") {
      const a = handleUpgradeClick(x, y, state);
      if (a === "upgrade") {
        // After any upgrade spend, sync meta to host so stats match.
        if (isOnline(state) && state.net && state.net.status === "connected" && !state.net.isHost) {
          state.net.sendMeta(getNetMetaPayload(state.progression));
        }
      } else if (a === "start") {
        if (isOnline(state)) {
          // In co-op, "start" means respawn (world continues).
          const meta = getNetMetaPayload(state.progression);
          // Apply immediately locally for responsiveness
          if (state.player) {
            applyNetMetaToPlayer(state, state.player, meta);
            // Host can instantly apply the respawn locally; joiners wait for snapshot.
            if (state.net && state.net.isHost) {
              state.player.hp = state.player.maxHP;
              state.player.x = 0;
              state.player.y = 0;
              state.player.vx = 0;
              state.player.vy = 0;
            }
          }
          // If joiner: ask host to respawn us. If host: mark our own respawn request.
          if (state.net && state.net.status === "connected") {
            if (state.net.isHost) {
              if (state.player) state.player._netRespawnRequested = true;
            } else {
              state.net.requestRespawn(meta);
            }
          }
          state._waitingRespawnAck = true;
          state._deathHandled = true;
          state.overlayMode = null;
        } else {
          // Offline: start a new run as before.
          startNewRun(state);
        }
      } else if (a === "menu") {
        // Return to menu/lobby UI (keep connection / keep host sim running).
        state.overlayMode = null;
        state.mode = "startMenu";
      }
      return;
    }

    // Start menu: begin drag for portrait scroll; actual clicks happen on pointer up.
    if (state.mode === "startMenu") {
      handleStartMenuPointerDown(x, y, state);
      return;
    }

    // Settings screen
    if (state.mode === "settings") {
      const a = handleSettingsClick(x, y, state);
      if (a === "back") {
        state.mode = "startMenu";
      }
      return;
    }

    // Stats & Up screen
    if (state.mode === "stats") {
      const a = handleUpgradeClick(x, y, state);
      if (a === "back") {
        state.mode = "startMenu";
      } else if (a === "start") {
        startNewRun(state);
      }
      return;
    }

    // Resurrection screen clicks
    if (state.mode === "resurrection") {
      var resAction = handleResurrectionClick(x, y, state);
      if (resAction === "resurrect" || resAction === "skip") {
        state.mode = "upgrade";
      }
      return;
    }

    // Upgrade menu clicks
    if (state.mode === "upgrade") {
      var action = handleUpgradeClick(x, y, state);
      if (action === "start") {
        startNewRun(state);
      } else if (action === "menu") {
        state.mode = "startMenu";
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
    // Control-mode toggle buttons in pause menu
    if (state.mode === "playing" && state.paused) {
      var rectClassic = state._controlModeClassicRect;
      var rectAuto = state._controlModePortraitAutoRect;

      if (rectClassic &&
          x >= rectClassic.x &&
          x <= rectClassic.x + rectClassic.w &&
          y >= rectClassic.y &&
          y <= rectClassic.y + rectClassic.h) {
        setControlMode("oneHand");
        return;
      }

      if (rectAuto &&
          x >= rectAuto.x &&
          x <= rectAuto.x + rectAuto.w &&
          y >= rectAuto.y &&
          y <= rectAuto.y + rectAuto.h) {
        setControlMode("twoHand");
        return;
      }
    }

  }

  function handlePointerMove(x, y) {
    if (state.mode === "startMenu") {
      handleStartMenuPointerMove(x, y, state);
    }
  }

  function handlePointerUp(x, y) {
    if (state.mode !== "startMenu") return;

    const a = handleStartMenuPointerUp(x, y, state);
    if (!a) return;

    if (a === "start") {
      startNewRun(state);
      if (isOnline(state) && state.net.isHost) {
        state.net.startRun();
      }
      return;
    }
    if (a === "startCorner") {
      // Bottom-right action:
      // - Offline: Start solo run
      // - Online Host: Start Run for everyone
      // - Online Joiner: Ready / Unready (wait for host to start)
      if (isOnline(state) && state.net && state.net.status === "connected") {
        if (state.net.isHost) {
          startNewRun(state);
          state.net.startRun();
        } else {
          if (typeof state.net.setReady === "function") {
            state.net.setReady(!state.net.ready);
          }
        }
      } else {
        startNewRun(state);
      }
      return;
    }
    if (a === "applyProfile") {
      // persist profile and update server if connected
      try { saveProgression(state.progression); } catch {}
      if (state.net && state.net.status === "connected") {
        const nickname = state.progression?.nickname || "Player";
        const avatarIndex = state.progression?.avatarIndex || 0;
        state.net.setProfile(nickname, avatarIndex);
        // Also sync our meta/limits to host (so stats match).
        if (!state.net.isHost) state.net.sendMeta(getNetMetaPayload(state.progression));
      }
      return;
    }
    if (a === "copyLink") {
      const room = state.net?.roomCode || state.progression?.roomCode || "";
      const url = `${location.origin}/?code=${encodeURIComponent(room)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {
          prompt("Invite link", url);
        });
      } else {
        prompt("Invite link", url);
      }
      return;
    }
    if (a === "host" || a === "join" || a === "fastJoin") {
      // Co-op: connect and request room action
      state.net.connect(getDefaultWsUrl());

      const nickname = state.progression?.nickname || "Player";
      const avatarIndex = state.progression?.avatarIndex || 0;
      const roomCode = state.progression?.roomCode || "";

      // If WS isn't open yet, queue the action after open
      const doAction = () => {
        if (a === "host") state.net.host(roomCode, nickname, avatarIndex);
        else if (a === "join") state.net.join(roomCode, nickname, avatarIndex);
        else state.net.fastJoin(nickname, avatarIndex);
      };

      if (state.net.ws && state.net.ws.readyState === 1) {
        doAction();
      } else {
        const ws = state.net.ws;
        if (ws) {
          const prev = ws.onopen;
          ws.onopen = () => {
            if (typeof prev === "function") prev();
            doAction();
          };
        }
      }
      return;
    }
    if (a === "stats") {
      state.mode = "stats";
      return;
    }
    if (a === "settings") {
      state.mode = "settings";
      return;
    }
    if (a === "disconnect") {
      state.net.disconnect();
      return;
    }
  }

  return {
    state,
    get player() {
      return state.player;
    },
    // Used by the DOM-based lobby (fallback Start button): start an offline run.
    startOfflineRun() {
      try { state.net?.disconnect?.(); } catch {}
      startNewRun(state);
      state.mode = "playing";
      state.overlayMode = null;
      state.paused = false;
    },
    update,
    render,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

function startNewRun(state) {
  const startLevel = getStartLevel(state.progression);

  if (state.flags) {
    state.flags.resGuardianKilledThisRun = false;
  }
  const startPos = { x: 0, y: 0 };

  const player = new Player(startPos, startLevel);
  // Ensure local player has a stable id for offline + net-host mode.
  if (!player.id) player.id = state.net?.playerId ? String(state.net.playerId) : "local";
  player.nickname = state.progression?.nickname || "Player";
  player.avatarIndex = state.progression?.avatarIndex || 0;
  const meta = applyLimitsToPlayer(player, state.progression.limits);

  state.player = player;
  state.players = [player];
  state.meta = {
    xpGainMult: meta?.xpGainMult ?? 1,
    scoreMult: meta?.scoreMult ?? 1,
    pickupBonusRadius: meta?.pickupBonusRadius ?? 0,
  };
  state.camera = new Camera(state.canvas);
  state.currentZone = getZone(player.x, player.y);

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
  // Per-player weapon visuals (co-op): avoids overwriting when multiple players use laser/chain.
  state._laserVisuals = new Map();
  state._lightningVisuals = new Map();

  state.spawnSystem = new SpawnSystem(state);
  state.mode = "playing";

  // If we're the host in an online room, re-add remote players after reset.
  if (isOnline(state) && state.net.isHost) {
    syncHostPlayersFromRoomInfo(state);
  }
}

function isOnline(state) {
  return !!(state.net && state.net.status === "connected" && state.net.roomCode);
}

function getPlayersArr(state) {
  return state.players && state.players.length ? state.players : (state.player ? [state.player] : []);
}

function getPlayerById(state, id) {
  if (!id) return null;
  const sid = String(id);
  for (const p of getPlayersArr(state)) {
    if (p && String(p.id) === sid) return p;
  }
  return null;
}

function pickColorForId(id) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 80%, 65%)`;
}

function getNetMetaPayload(prog) {
  if (!prog) return null;
  return {
    nickname: prog.nickname || "Player",
    avatarIndex: prog.avatarIndex || 0,
    resurrectedTier: prog.resurrectedTier || 1,
    totalScore: prog.totalScore || 0,
    upgradePoints: prog.upgradePoints || 0,
    limits: prog.limits || {},
  };
}

function applyNetMetaToPlayer(state, player, meta) {
  if (!player || !meta) return;
  if (typeof meta.nickname === "string") player.nickname = meta.nickname;
  if (typeof meta.avatarIndex === "number") player.avatarIndex = meta.avatarIndex | 0;
  if (meta.limits) {
    // Apply permanent meta bonuses directly (affects crit, damage mult, maxHP, etc.).
    applyLimitsToPlayer(player, meta.limits);
  }
}

function syncHostPlayersFromRoomInfo(state) {
  // Host keeps authoritative simulation; add/remove player entities to match room list.
  const netPlayers = Array.isArray(state.net.roomPlayers) ? state.net.roomPlayers : [];
  const wantedIds = new Set(netPlayers.map((p) => String(p.id)));

  // Ensure local player id matches
  if (state.player && state.net.playerId) {
    state.player.id = String(state.net.playerId);
    wantedIds.add(String(state.player.id));
  }

  // Add missing
  for (const meta of netPlayers) {
    const id = String(meta.id);
    if (!getPlayerById(state, id)) {
      const p = new Player({ x: 0, y: 0 }, getStartLevel(state.progression));
      p.id = id;
      p.nickname = meta.nickname || `P${id}`;
      p.avatarIndex = meta.avatarIndex || 0;
      p.color = pickColorForId(id);
      // Apply per-player meta (if we have it), otherwise fall back to host meta.
      const stored = state._netMetaById?.get(id) || null;
      if (stored) applyNetMetaToPlayer(state, p, stored);
      else applyLimitsToPlayer(p, state.progression.limits);
      state.players.push(p);
    } else {
      const p = getPlayerById(state, id);
      if (p && meta.nickname) p.nickname = meta.nickname;
      if (p && typeof meta.avatarIndex === "number") p.avatarIndex = meta.avatarIndex | 0;
    }
  }

  // Remove unknown (except local)
  const localId = state.player ? String(state.player.id) : null;
  state.players = state.players.filter((p) => {
    if (!p) return false;
    const id = String(p.id);
    if (localId && id === localId) return true;
    return wantedIds.has(id);
  });
}

function updatePlayerFromInput(player, input, dt, state) {
  if (!player || player.hp <= 0) return;
  const mx = Math.max(-1, Math.min(1, input?.mx ?? 0));
  const my = Math.max(-1, Math.min(1, input?.my ?? 0));
  const len = Math.hypot(mx, my);
  const dirX = len > 1e-3 ? mx / len : 0;
  const dirY = len > 1e-3 ? my / len : 0;

  const speed = player.moveSpeed || player.baseMoveSpeed || 220;
  player.vx = dirX * speed;
  player.vy = dirY * speed;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // World bounds
  const bounds = state.spawnSystem?.getWorldBounds ? state.spawnSystem.getWorldBounds() : null;
  // fallback: square bounds using mapGenerator constants
  const minX = (bounds?.minX ?? -WORLD_WIDTH / 2) + player.radius;
  const maxX = (bounds?.maxX ?? WORLD_WIDTH / 2) - player.radius;
  const minY = (bounds?.minY ?? -WORLD_HEIGHT / 2) + player.radius;
  const maxY = (bounds?.maxY ?? WORLD_HEIGHT / 2) - player.radius;
  if (player.x < minX) player.x = minX;
  if (player.x > maxX) player.x = maxX;
  if (player.y < minY) player.y = minY;
  if (player.y > maxY) player.y = maxY;

  if (player.attackCooldown > 0) {
    player.attackCooldown -= dt;
  }
}

function updatePlayers(state, dt, online) {
  const players = getPlayersArr(state);
  // Make sure local player's id is aligned if online
  if (online && state.player && state.net.playerId) {
    state.player.id = String(state.net.playerId);
  }

  // Local update
  if (state.player && typeof state.player.update === "function") {
    const blockedByOverlay = !!(online && state.overlayMode);
    if (state.player.hp > 0 && !blockedByOverlay) {
      state.player.update(dt, state);
    }
  }

  if (!online) {
    // Offline = single player
    state.players = [state.player];
    return;
  }

  // Host: update remote players from net inputs
  if (state.net.isHost) {
    for (const p of players) {
      if (!p || String(p.id) === String(state.player.id)) continue;
      const input = state.net.remoteInputs.get(String(p.id)) || {};
      updatePlayerFromInput(p, input, dt, state);
    }
  }
}

function updateWeapons(state, dt, online) {
  // Local (always)
  if (state.player) {
    const blockedByOverlay = !!(online && state.overlayMode);
    if (state.player.hp > 0 && !blockedByOverlay) {
      updateWeapon(state.player, state, dt);
    }
  }
  if (!online) return;
  if (!state.net.isHost) return;

  // Remote players (host only)
  for (const p of getPlayersArr(state)) {
    if (!p || String(p.id) === String(state.player.id)) continue;
    if (p.hp <= 0) continue;
    const input = state.net.remoteInputs.get(String(p.id)) || {};
    const aim = input?.aim;
    const aimDir = aim && typeof aim.x === "number" && typeof aim.y === "number" ? aim : null;
    const firing = typeof input?.fire === "boolean" ? input.fire : undefined;
    updateWeaponNet(p, state, dt, { aimDir, firing });
  }
}

function sendLocalInputToHost(state) {
  if (state.mode !== "playing") return;
  // throttle
  const now = state.time;
  if (now - (state._netLastInputSendAt || 0) < 0.05) return;
  state._netLastInputSendAt = now;

  const p = state.player;
  if (!p) return;
  if (p.hp <= 0) return;
  if (state.overlayMode) return;
  if (state.mode !== "playing") return;

  // movement: pointer/joystick -> fallback to keyboard
  const mv = getMoveVectorFromPointer();
  let mx = mv.x;
  let my = mv.y;
  if (Math.hypot(mx, my) < 0.01) {
    const kb = getKeyboardVector();
    mx = kb.x;
    my = kb.y;
  }

  const aim = getAimDirectionForPlayer(
    p,
    state.camera,
    state.canvas,
    state.enemies,
    getAttackRangeForPlayer(p),
    state.time
  );

  const input = {
    mx,
    my,
    aim: aim ? { x: aim.x, y: aim.y } : { x: 0, y: 0 },
    fire: isFiringActive(),
  };

  state.net.sendInput(input);
}

function serializePlayerState(state) {
  const q = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
  const ps = getPlayersArr(state);
  return {
    t: state.time,
    players: ps.map((p) => ({
      id: String(p.id),
      x: q(p.x),
      y: q(p.y),
      vx: q(p.vx),
      vy: q(p.vy),
      hp: p.hp,
      maxHP: p.maxHP,
      level: p.level,
      // Joiners do not run weapon sim; sync these so their camera/aim feels correct.
      weaponStage: p.weaponStage || 1,
      range: q(Number.isFinite(p.range) ? p.range : getAttackRangeForPlayer(p)),
      nickname: p.nickname || "",
      avatarIndex: p.avatarIndex || 0,
      color: p.color || pickColorForId(p.id),
      aim: { x: q(p.lastAimDir?.x || 0), y: q(p.lastAimDir?.y || 0) },
    })),
  };
}

function applyPlayerStateToClient(state, pstate) {
  if (!pstate || typeof pstate !== "object") return;
  const st = (typeof pstate.t === "number") ? pstate.t : null;
  if (st != null) {
    const last = (typeof state._netLastAppliedPStateAt === "number") ? state._netLastAppliedPStateAt : -Infinity;
    if (st <= last + 1e-6) return;
    state._netLastAppliedPStateAt = st;
  }

  const myId = state.net?.playerId ? String(state.net.playerId) : (state.player?.id ? String(state.player.id) : "local");

  if (!state._netCache) {
    state._netCache = {
      players: new Map(),
      enemies: new Map(),
      projectilesById: new Map(),
      rocketsById: new Map(),
      projectiles: [],
      rockets: [],
      xpOrbs: [],
    };
  }
  const pCache = state._netCache.players;
  const players = state._netCache.playersArr || (state._netCache.playersArr = []);
  players.length = 0;

  const seenStamp = (st != null ? st : (state.time || 0));

  for (const sp of (pstate.players || [])) {
    const id = String(sp.id);
    let p = pCache.get(id);
    if (!p) {
      p = new Player({ x: sp.x || 0, y: sp.y || 0 }, sp.level || getStartLevel(state.progression));
      p.id = id;
      p.color = sp.color || pickColorForId(id);
      p.nickname = sp.nickname || `P${id}`;
      p.avatarIndex = typeof sp.avatarIndex === "number" ? (sp.avatarIndex|0) : 0;
      applyLimitsToPlayer(p, state.progression.limits);
      p._netTx = p.x;
      p._netTy = p.y;
      pCache.set(id, p);
    }

    p._netSeenAt = seenStamp;

    const tx = Number.isFinite(sp.x) ? sp.x : p.x;
    const ty = Number.isFinite(sp.y) ? sp.y : p.y;

    p._netTx = tx;
    p._netTy = ty;

    // Save velocity for light dead-reckoning
    p._netVx = Number.isFinite(sp.vx) ? sp.vx : (p._netVx || 0);
    p._netVy = Number.isFinite(sp.vy) ? sp.vy : (p._netVy || 0);

    // Big correction snap
    const dxC = tx - p.x;
    const dyC = ty - p.y;
    if ((dxC*dxC + dyC*dyC) > 500*500) {
      p.x = tx;
      p.y = ty;
    }

    p.hp = sp.hp;
    p.maxHP = sp.maxHP;
    p.level = sp.level;
    if (typeof sp.weaponStage === "number") p.weaponStage = sp.weaponStage;
    if (typeof sp.range === "number" && Number.isFinite(sp.range)) p.range = sp.range;
    p.nickname = sp.nickname || p.nickname;
    p.avatarIndex = typeof sp.avatarIndex === "number" ? (sp.avatarIndex|0) : p.avatarIndex;
    p.color = sp.color || p.color;
    if (sp.aim) {
      p.lastAimDir.x = sp.aim.x || 0;
      p.lastAimDir.y = sp.aim.y || 0;
    }

    players.push(p);
  }

  for (const [id, p] of pCache) {
    if (!p || p._netSeenAt != seenStamp) pCache.delete(id);
  }

  state.players = players;
  const me = players.find((p) => String(p.id) === myId) || players[0] || state.player;
  state.player = me;
}

function serializeSnapshot(state) {
  // Quantize floats to reduce JSON size (helps mobile joiners).
  const q = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);

  const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
  const isMobileHost = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  // Union-interest filtering (co-op):
  // Host may have enemies spawned around several players across the map.
  // If we serialize everything, JSON.stringify causes micro-freezes.
  const psAll = getPlayersArr(state);
  const psAlive = psAll.filter((p) => p && p.hp > 0);
  const refs = psAlive.length ? psAlive : psAll;

  const INTEREST_R = isMobileHost ? 15000 : 16500;
  const INTEREST_R2 = INTEREST_R * INTEREST_R;

  const minD2ToPlayers = (x, y) => {
    let best = Infinity;
    for (const p of refs) {
      if (!p) continue;
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
      if (best <= 1200 * 1200) break;
    }
    return best;
  };

  // Soft caps to avoid spikes (server will also apply per-client interest).
  const capEnemies = isMobileHost ? 260 : 420;
  const capProj = isMobileHost ? 220 : 420;
  const capRockets = isMobileHost ? 90 : 160;
  const capOrbs = isMobileHost ? 260 : 420;

  // Enemies (filtered + capped by distance to nearest player)
  const enemySrc = [];
  for (const e of (state.enemies || [])) {
    if (!e || e.dead) continue;
    const d2 = minD2ToPlayers(e.x, e.y);
    if (d2 > INTEREST_R2) continue;
    enemySrc.push({ e, d2 });
  }
  if (enemySrc.length > capEnemies) {
    enemySrc.sort((a, b) => a.d2 - b.d2);
    enemySrc.length = capEnemies;
  }

  // Projectiles
  const projSrc = [];
  for (const b of (state.projectiles || [])) {
    if (!b) continue;
    const d2 = minD2ToPlayers(b.x, b.y);
    if (d2 > INTEREST_R2) continue;
    projSrc.push({ b, d2 });
  }
  if (projSrc.length > capProj) {
    projSrc.sort((a, b) => a.d2 - b.d2);
    projSrc.length = capProj;
  }

  // Rockets
  const rocketSrc = [];
  for (const r of (state.rockets || [])) {
    if (!r) continue;
    const d2 = minD2ToPlayers(r.x, r.y);
    if (d2 > INTEREST_R2) continue;
    rocketSrc.push({ r, d2 });
  }
  if (rocketSrc.length > capRockets) {
    rocketSrc.sort((a, b) => a.d2 - b.d2);
    rocketSrc.length = capRockets;
  }

  // XP orbs
  const orbSrc = [];
  for (const o of (state.xpOrbs || [])) {
    if (!o) continue;
    const d2 = minD2ToPlayers(o.x, o.y);
    if (d2 > INTEREST_R2) continue;
    orbSrc.push({ o, d2 });
  }
  if (orbSrc.length > capOrbs) {
    orbSrc.sort((a, b) => a.d2 - b.d2);
    orbSrc.length = capOrbs;
  }

  return {
    t: state.time,
    runScore: state.runScore,
    zone: state.currentZone,
    flags: {
      resGuardianKilledThisRun: !!(state.flags && state.flags.resGuardianKilledThisRun),
    },
    players: psAll.map((p) => ({
      id: String(p.id),
      x: q(p.x),
      y: q(p.y),
      hp: p.hp,
      maxHP: p.maxHP,
      level: p.level,
      xp: p.xp,
      nextXp: p.nextLevelXp,
      nickname: p.nickname || "",
      avatarIndex: p.avatarIndex || 0,
      color: p.color || pickColorForId(p.id),
      lastAim: { x: q(p.lastAimDir?.x || 0), y: q(p.lastAimDir?.y || 0) },
    })),
    enemies: enemySrc.map(({ e }) => ({
      id: String(e.id || e._id || `${e.x.toFixed(1)}:${e.y.toFixed(1)}`),
      x: q(e.x),
      y: q(e.y),
      hp: e.hp,
      maxHp: e.maxHp ?? e.maxHP ?? 0,
      radius: e.radius || 20,
      kind: e.kind || e.type || "enemy",
      boss: !!e._isBoss || !!e.isBoss || !!e.boss,
      elite: !!e.isElite || !!e.elite,
    })),
    projectiles: projSrc.map(({ b }) => ({
      id: b.id != null ? b.id : undefined,
      ownerId: b.ownerId != null ? String(b.ownerId) : "",
      x: q(b.x),
      y: q(b.y),
      vx: q(b.vx),
      vy: q(b.vy),
      radius: b.radius || 4,
      life: q((b.range || 0) - (b.travel || 0)),
    })),
    rockets: rocketSrc.map(({ r }) => ({
      id: r.id != null ? r.id : undefined,
      ownerId: r.ownerId != null ? String(r.ownerId) : "",
      x: q(r.x),
      y: q(r.y),
      vx: q(r.vx),
      vy: q(r.vy),
      radius: r.radius || 6,
      splashRadius: r.splashRadius || 0,
      life: q((r.range || 0) - (r.travel || 0)),
    })),
    xpOrbs: orbSrc.map(({ o }) => ({
      x: q(o.x),
      y: q(o.y),
      xp: o.xp || 10,
      radius: o.radius || 8,
    })),
  };
}

function applySnapshotToClient(state, snap) {
  if (!snap || typeof snap !== "object") return;
  // Apply only when snapshot is newer (avoid re-applying the same snap every frame).
  const st = (typeof snap.t === "number") ? snap.t : null;
  if (st != null) {
    const last = (typeof state._netLastAppliedSnapshotAt === "number") ? state._netLastAppliedSnapshotAt : -Infinity;
    if (st <= last + 1e-6) return;
    state._netLastAppliedSnapshotAt = st;
  }

  // Ensure we have a player id
  const myId = state.net?.playerId
    ? String(state.net.playerId)
    : (state.player?.id ? String(state.player.id) : "local");

  // Net caches (reduce GC + allow smoothing)
  if (!state._netCache) {
    state._netCache = {
      players: new Map(),
      enemies: new Map(),
      // Visual-only projectile caches keyed by id (prevents flicker/teleport on joiners)
      projectilesById: new Map(),
      rocketsById: new Map(),
      projectiles: [],
      rockets: [],
      xpOrbs: [],
    };
  }
  const pCache = state._netCache.players;
  const eCache = state._netCache.enemies;
  if (!state._netCache.projectilesById) state._netCache.projectilesById = new Map();
  if (!state._netCache.rocketsById) state._netCache.rocketsById = new Map();
  if (!Array.isArray(state._netCache.projectiles)) state._netCache.projectiles = [];
  if (!Array.isArray(state._netCache.rockets)) state._netCache.rockets = [];
  if (!Array.isArray(state._netCache.xpOrbs)) state._netCache.xpOrbs = [];

  // Players (reuse arrays + avoid per-snapshot Set allocations)
  const players = state._netCache.playersArr || (state._netCache.playersArr = []);
  players.length = 0;
  const seenStamp = (st != null ? st : (state.time || 0));
  for (const sp of (snap.players || [])) {
    const id = String(sp.id);

    let p = pCache.get(id);
    if (!p) {
      p = new Player({ x: sp.x || 0, y: sp.y || 0 }, sp.level || getStartLevel(state.progression));
      p.id = id;
      p.color = sp.color || pickColorForId(id);
      p.nickname = sp.nickname || `P${id}`;
      if (typeof sp.avatarIndex === "number") p.avatarIndex = sp.avatarIndex | 0;
      applyLimitsToPlayer(p, state.progression.limits);
      // net smoothing targets
      p._netTx = p.x;
      p._netTy = p.y;
      pCache.set(id, p);
    }

    // mark as seen in this snapshot (for pruning)
    p._netSeenAt = seenStamp;

    const tx = Number.isFinite(sp.x) ? sp.x : p.x;
    const ty = Number.isFinite(sp.y) ? sp.y : p.y;

    // For our own player, keep current predicted position and smooth-correct.
    // For others, also smooth (less jitter on phones).
    p._netTx = tx;
    p._netTy = ty;

    // Big correction? snap instantly.
    const dxC = tx - p.x;
    const dyC = ty - p.y;
    if ((dxC * dxC + dyC * dyC) > 600 * 600) {
      p.x = tx;
      p.y = ty;
    }

    p.hp = sp.hp;
    p.maxHP = sp.maxHP;
    p.level = sp.level;
    p.xp = sp.xp;
    p.nextLevelXp = sp.nextXp;
    p.nickname = sp.nickname || p.nickname;
    if (typeof sp.avatarIndex === "number") p.avatarIndex = sp.avatarIndex | 0;
    p.color = sp.color || p.color;
    if (sp.lastAim) {
      p.lastAimDir.x = sp.lastAim.x || 0;
      p.lastAimDir.y = sp.lastAim.y || 0;
    }
    players.push(p);
  }
  // Drop missing players
  for (const [id, p] of pCache) {
    if (!p || p._netSeenAt !== seenStamp) pCache.delete(id);
  }
  state.players = players;

  // Our player ref
  const me = players.find((p) => String(p.id) === myId) || players[0] || state.player;
  state.player = me;

  // Enemies (reuse arrays + avoid per-snapshot Set allocations)
  const enemies = state._netCache.enemiesArr || (state._netCache.enemiesArr = []);
  enemies.length = 0;
  for (const se of (snap.enemies || [])) {
    const id = String(se.id);

    let e = eCache.get(id);
    if (!e) {
      e = createNetEnemy(se);
      e.x = Number.isFinite(se.x) ? se.x : 0;
      e.y = Number.isFinite(se.y) ? se.y : 0;
      e._netTx = e.x;
      e._netTy = e.y;
      eCache.set(id, e);
    }

    e._netSeenAt = seenStamp;

    const tx = Number.isFinite(se.x) ? se.x : e.x;
    const ty = Number.isFinite(se.y) ? se.y : e.y;
    e._netTx = tx;
    e._netTy = ty;

    const dxC = tx - e.x;
    const dyC = ty - e.y;
    if ((dxC * dxC + dyC * dyC) > 900 * 900) {
      e.x = tx;
      e.y = ty;
    }

    e.hp = se.hp;
    e.maxHp = se.maxHp;
    e.radius = se.radius || e.radius || 20;
    e.kind = se.kind || e.kind || "enemy";
    e._isBoss = !!se.boss;
    e.isElite = !!se.elite;
    enemies.push(e);
  }
  for (const [id, e] of eCache) {
    if (!e || e._netSeenAt !== seenStamp) eCache.delete(id);
  }
  state.enemies = enemies;

  // Visual-only entities:
  // Keep stable by id so joiners don't see bullets "teleport" or disappear between snapshots.
  // We only render them on joiners (no gameplay/collisions on the client).
  const nowLocal = state.time || 0;
  const grace = 0.30; // keep briefly when missing (snapshot cap/interest fluctuations)

  // Projectiles
  const srcB = Array.isArray(snap.projectiles) ? snap.projectiles : [];
  const bMap = state._netCache.projectilesById;
  for (const b of srcB) {
    if (!b) continue;
    const id = (b.id != null) ? String(b.id) : null;
    if (!id) continue;

    let ob = bMap.get(id);
    const tx = Number.isFinite(b.x) ? b.x : 0;
    const ty = Number.isFinite(b.y) ? b.y : 0;
    if (!ob) {
      ob = {
        id,
        x: tx,
        y: ty,
        vx: Number.isFinite(b.vx) ? b.vx : 0,
        vy: Number.isFinite(b.vy) ? b.vy : 0,
        radius: b.radius || 4,
        _netTx: tx,
        _netTy: ty,
        _netLife: Number.isFinite(b.life) ? b.life : null,
        _netLastSeenLocalTime: nowLocal,
      };
      bMap.set(id, ob);
    }

    ob._netLastSeenLocalTime = nowLocal;
    ob._netTx = tx;
    ob._netTy = ty;
    if (Number.isFinite(b.vx)) ob.vx = b.vx;
    if (Number.isFinite(b.vy)) ob.vy = b.vy;
    ob.radius = b.radius || ob.radius || 4;
    if (Number.isFinite(b.life)) ob._netLife = b.life;

    const dxC = ob._netTx - ob.x;
    const dyC = ob._netTy - ob.y;
    if ((dxC * dxC + dyC * dyC) > 1000 * 1000) {
      ob.x = ob._netTx;
      ob.y = ob._netTy;
    }
  }
  for (const [id, ob] of bMap) {
    const lastSeen = (ob && typeof ob._netLastSeenLocalTime === "number") ? ob._netLastSeenLocalTime : -Infinity;
    if (nowLocal - lastSeen > grace) bMap.delete(id);
  }
  const dstB = state._netCache.projectiles;
  dstB.length = 0;
  for (const ob of bMap.values()) dstB.push(ob);
  state.projectiles = dstB;

  // Rockets
  const srcR = Array.isArray(snap.rockets) ? snap.rockets : [];
  const rMap = state._netCache.rocketsById;
  for (const r of srcR) {
    if (!r) continue;
    const id = (r.id != null) ? String(r.id) : null;
    if (!id) continue;

    let or = rMap.get(id);
    const tx = Number.isFinite(r.x) ? r.x : 0;
    const ty = Number.isFinite(r.y) ? r.y : 0;
    if (!or) {
      or = {
        id,
        x: tx,
        y: ty,
        vx: Number.isFinite(r.vx) ? r.vx : 0,
        vy: Number.isFinite(r.vy) ? r.vy : 0,
        radius: r.radius || 6,
        splashRadius: r.splashRadius || 0,
        _netTx: tx,
        _netTy: ty,
        _netLife: Number.isFinite(r.life) ? r.life : null,
        _netLastSeenLocalTime: nowLocal,
      };
      rMap.set(id, or);
    }

    or._netLastSeenLocalTime = nowLocal;
    or._netTx = tx;
    or._netTy = ty;
    if (Number.isFinite(r.vx)) or.vx = r.vx;
    if (Number.isFinite(r.vy)) or.vy = r.vy;
    or.radius = r.radius || or.radius || 6;
    or.splashRadius = r.splashRadius || or.splashRadius || 0;
    if (Number.isFinite(r.life)) or._netLife = r.life;

    const dxC = or._netTx - or.x;
    const dyC = or._netTy - or.y;
    if ((dxC * dxC + dyC * dyC) > 1000 * 1000) {
      or.x = or._netTx;
      or.y = or._netTy;
    }
  }
  for (const [id, or] of rMap) {
    const lastSeen = (or && typeof or._netLastSeenLocalTime === "number") ? or._netLastSeenLocalTime : -Infinity;
    if (nowLocal - lastSeen > grace) rMap.delete(id);
  }
  const dstR = state._netCache.rockets;
  dstR.length = 0;
  for (const or of rMap.values()) dstR.push(or);
  state.rockets = dstR;

  const srcO = Array.isArray(snap.xpOrbs) ? snap.xpOrbs : [];
  const dstO = state._netCache.xpOrbs;
  dstO.length = srcO.length;
  for (let i = 0; i < srcO.length; i++) {
    const o = srcO[i] || {};
    let oo = dstO[i];
    if (!oo) {
      oo = dstO[i] = { x: 0, y: 0, xp: 10, radius: 8, age: 0 };
    }
    oo.x = o.x || 0;
    oo.y = o.y || 0;
    oo.xp = o.xp || 10;
    oo.radius = o.radius || 8;
    oo.age = 0;
  }
  state.xpOrbs = dstO;
  state.runScore = snap.runScore || 0;
  state.currentZone = snap.zone ?? state.currentZone;
  if (snap.flags && state.flags) {
    state.flags.resGuardianKilledThisRun = !!snap.flags.resGuardianKilledThisRun;
  }
}

function createNetEnemy(data) {
  const e = {
    id: data.id,
    x: data.x,
    y: data.y,
    hp: data.hp,
    maxHp: data.maxHp,
    radius: data.radius || 20,
    kind: data.kind || "enemy",
    _isBoss: !!data.boss,
    isElite: !!data.elite,
    update: null,
    render(self, ctx) {
      ctx.save();
      ctx.beginPath();
      // Make remote enemies readable (avoid "gray blobs" on clients)
      let col = "#ff5f6f"; // basic
      if (self.isElite) col = "#ffdd57";
      if (self._isBoss) col = "#ff4b7a";
      // better special-case colors
      if (self.kind === "zoneBoss") col = "#9b5bff";
      if (self.kind === "roamingBoss") col = "#ff3cbe";
      if (self.kind === "resurrectionGuardian") col = "#ffdd44";
      if (self.kind === "zone6SuperBoss") col = "#1be7ff";
      ctx.fillStyle = col;
      ctx.globalAlpha = 1.0;
      ctx.arc(self.x, self.y, self.radius, 0, Math.PI * 2);
      ctx.fill();

      // Small HP ring for elites/bosses (helps orientation)
      if (self._isBoss || self.isElite) {
        const ratio = self.maxHp > 0 ? (self.hp / self.maxHp) : 1;
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = self._isBoss ? 3 : 2;
        ctx.beginPath();
        ctx.arc(
          self.x,
          self.y,
          self.radius + (self._isBoss ? 7 : 5),
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ratio))
        );
        ctx.stroke();
      }
      ctx.restore();
    },
  };
  return e;
}

function smoothNetEntities(state, dt) {
  // Exponential smoothing factor: stable across FPS differences
  const k = 1 - Math.exp(-dt * 12);
  const kMe = 1 - Math.exp(-dt * 5);

  const ps = state.players || [];
  const myId = state.player ? String(state.player.id) : null;
  const lookahead = 0.05; // small extrapolation helps hide low tickrate
  for (const p of ps) {
    if (!p || p._netTx == null || p._netTy == null) continue;
    const isMe = myId && String(p.id) === myId;
    const tx = p._netTx + (isMe ? 0 : (p._netVx || 0) * lookahead);
    const ty = p._netTy + (isMe ? 0 : (p._netVy || 0) * lookahead);
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (dx * dx + dy * dy < 0.0001) continue;
    const kk = isMe ? kMe : k;
    p.x += dx * kk;
    p.y += dy * kk;
  }

  const es = state.enemies || [];
  for (const e of es) {
    if (!e || e._netTx == null || e._netTy == null) continue;
    const dx = e._netTx - e.x;
    const dy = e._netTy - e.y;
    if (dx * dx + dy * dy < 0.0001) continue;
    e.x += dx * k;
    e.y += dy * k;
  }
}

function updateNetVisualProjectiles(state, dt) {
  // Joiners only: advance projectiles between low-frequency snapshots for visual continuity.
  if (!isOnline(state) || !state.net || state.net.isHost) return;

  const k = 1 - Math.exp(-dt * 10);

  const bs = state.projectiles || [];
  for (const b of bs) {
    if (!b) continue;
    const vx = Number.isFinite(b.vx) ? b.vx : 0;
    const vy = Number.isFinite(b.vy) ? b.vy : 0;
    b.x += vx * dt;
    b.y += vy * dt;

    if (b._netTx != null && b._netTy != null) {
      b.x += (b._netTx - b.x) * k;
      b.y += (b._netTy - b.y) * k;
    }
    if (typeof b._netLife === "number") b._netLife -= dt;
  }

  const rs = state.rockets || [];
  for (const r of rs) {
    if (!r) continue;
    const vx = Number.isFinite(r.vx) ? r.vx : 0;
    const vy = Number.isFinite(r.vy) ? r.vy : 0;
    r.x += vx * dt;
    r.y += vy * dt;

    if (r._netTx != null && r._netTy != null) {
      r.x += (r._netTx - r.x) * k;
      r.y += (r._netTy - r.y) * k;
    }
    if (typeof r._netLife === "number") r._netLife -= dt;
  }
}

function maybeSendPlayerState(state, dt = 0) {
  if (!state.net || !state.net.isHost) return;
  const now = state.time;

  // 40 Hz players-only state (small payload). Helps joiners keep camera & movement smooth.
  const PSTATE_DT = 1 / 40;
  state._netPStateAcc = (state._netPStateAcc || 0) + (Number.isFinite(dt) ? dt : 0);

  // Prevent huge catch-up spikes if the tab hiccups.
  if (state._netPStateAcc > 0.25) state._netPStateAcc = 0.25;
  if (state._netPStateAcc < PSTATE_DT) return;

  // At most one send per updateSim call to avoid bursts.
  state._netPStateAcc -= PSTATE_DT;
  state._netLastPlayerStateSentAt = now;
  if (typeof state.net.sendPlayerState === "function") {
    state.net.sendPlayerState(serializePlayerState(state));
  }
}

function maybeSendSnapshot(state, dt = 0) {
  if (!state.net || !state.net.isHost) return;
  const now = state.time;

  // Requested net cadence:
  // - 60 Hz authoritative sim (host)
  // - 40 Hz snapshots (SNAP_DT = 1/40)
  const SNAP_DT = 1 / 40;
  state._netSnapAcc = (state._netSnapAcc || 0) + (Number.isFinite(dt) ? dt : 0);

  // Prevent huge catch-up spikes if the tab hiccups.
  if (state._netSnapAcc > 0.25) state._netSnapAcc = 0.25;
  if (state._netSnapAcc < SNAP_DT) return;

  // At most one snapshot per updateSim call to avoid bursts.
  state._netSnapAcc -= SNAP_DT;
  state._netLastSnapshotSendAt = now;
  state.net.sendSnapshot(serializeSnapshot(state));
}

function maybeEnterOnlineDeathOverlay(state) {
  if (!isOnline(state)) return;
  if (state.mode !== "playing") return;
  if (!state.player) return;

  // If we already requested a respawn, don't re-open death UI until host revives us.
  if (state._waitingRespawnAck) {
    if (state.player.hp > 0) {
      state._waitingRespawnAck = false;
      state._deathHandled = false;
    } else {
      return;
    }
  }

  // reset when alive
  if (state.player.hp > 0) {
    state._deathHandled = false;
    return;
  }

  if (state._deathHandled || state.overlayMode) return;

  // Award score/points since last life (delta runScore)
  const nowScore = Math.floor(state.runScore || 0);
  const prev = Math.floor(state._lastDeathAwardScore || 0);
  const delta = Math.max(0, nowScore - prev);
  state._lastDeathAwardScore = nowScore;

  state.progression.totalScore = Math.max(0, (state.progression.totalScore || 0) + delta);
  const gainedPoints = Math.max(0, Math.floor(delta / 400));
  state.progression.upgradePoints = Math.max(0, (state.progression.upgradePoints || 0) + gainedPoints);

  state.lastRunSummary = {
    runScore: delta,
    gainedPoints,
    startLevel: state.player.level || getStartLevel(state.progression),
  };
  try { saveProgression(state.progression); } catch {}

  // Show resurrection screen if available, otherwise upgrade screen.
  state.overlayMode = state.flags?.resGuardianKilledThisRun ? "resurrection" : "upgrade";
  state._deathHandled = true;
}

function respawnPlayerToHub(state, p, meta) {
  if (!p) return;
  if (meta) applyNetMetaToPlayer(state, p, meta);
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.hp = p.maxHP;
  // Keep level/xp as-is (co-op world continues)
}

function processRespawnRequests(state) {
  if (!isOnline(state)) return;
  if (!state.net?.isHost) {
    // Joiner respawn is applied by host; locally we only clear overlays.
    return;
  }

  for (const p of getPlayersArr(state)) {
    if (!p) continue;
    if (!p._netRespawnRequested) continue;
    p._netRespawnRequested = false;
    const id = String(p.id);
    const meta = state._netMetaById?.get(id) || null;
    respawnPlayerToHub(state, p, meta);
  }
}

function updateEnemies(state, dt) {
  const { enemies } = state;

  // Zone 0 (Hub) is a safe green area. Enemies must never enter it.
  // Enforce it centrally (covers all enemy types, co-op + solo).
  const HUB_R = (ZONE_RADII && ZONE_RADII[0]) ? ZONE_RADII[0] : 0;
  const HUB_PAD = 6; // small padding so enemies don't visually overlap the hub edge

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.update) {
      e.update(e, dt, state);
    }

    // Keep enemies outside of the Hub radius.
    if (HUB_R > 0 && e && !e._ignoreHub) {
      const er = (e.radius || 20);
      const minR = HUB_R + er + HUB_PAD;
      const r = Math.hypot(e.x || 0, e.y || 0);
      if (r < minR) {
        // Push out along radial direction.
        let nx = (e.x || 0);
        let ny = (e.y || 0);
        if (r < 0.0001) {
          // If exactly at center, choose a deterministic direction.
          const a = (typeof e._hubPushAng === 'number') ? e._hubPushAng : (e._hubPushAng = Math.random() * Math.PI * 2);
          nx = Math.cos(a);
          ny = Math.sin(a);
        } else {
          nx /= r;
          ny /= r;
        }
        e.x = nx * minR;
        e.y = ny * minR;
      }
    }

    if (e.hp <= 0 || e._remove) {
      if (!e._noScore) {
        const baseScore = e.scoreValue || 10;
        const scoreMult = state.meta?.scoreMult || 1;
        state.runScore += baseScore * scoreMult;
      }
      if (e.onDeath) {
        e.onDeath(e, state);
      }
      if (state.spawnSystem && typeof state.spawnSystem.onEnemyRemoved === "function") {
        state.spawnSystem.onEnemyRemoved(e, state);
      }
      enemies.splice(i, 1);
    }
  }
}

function updateProjectiles(state, dt) {
  const { projectiles, rockets, enemies } = state;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    if (b && b.id == null) {
      b.id = (state._nextProjectileId = (state._nextProjectileId || 0) + 1);
    }
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
        const owner = getPlayerById(state, b.ownerId) || state.player;
        const dmg = applyCritToDamage(owner, b.damage);
        e.hp -= dmg;
        applyLifeSteal(owner, dmg);
        // Targeting 2.0 memory + aggro
        owner.lastPlayerTarget = e;
        owner.lastPlayerTargetAt = state.time;
        e._lastHitAt = state.time;
        e._lastHitBy = owner.id || "local";
        e.aggroed = true;
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
    if (rkt && rkt.id == null) {
      rkt.id = (state._nextRocketId = (state._nextRocketId || 0) + 1);
    }
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

  const owner = getPlayerById(state, rocket.ownerId) || state.player;

  for (const e of enemies) {
    const dx = e.x - rocket.x;
    const dy = e.y - rocket.y;
    if (dx * dx + dy * dy <= r2) {
      const dmg = applyCritToDamage(owner, rocket.damage);
      e.hp -= dmg;
      applyLifeSteal(owner, dmg);
      // Targeting 2.0 memory + aggro
      owner.lastPlayerTarget = e;
      owner.lastPlayerTargetAt = state.time;
      e._lastHitAt = state.time;
      e._lastHitBy = owner.id || "local";
      e.aggroed = true;
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
  const { xpOrbs } = state;
  const players = state.players && state.players.length ? state.players : (state.player ? [state.player] : []);

  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    orb.age = (orb.age || 0) + dt;

    orb.y += Math.sin(orb.age * 5) * 2 * dt;

    for (const player of players) {
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const baseRadius = (player.radius || 18) + (orb.radius || 8);
      const pickupBonus = state.meta?.pickupBonusRadius || 0;
      const r = baseRadius + pickupBonus;

      if (dx * dx + dy * dy <= r * r) {
        const baseXp = orb.xp || 10;
        const metaMult = state.meta?.xpGainMult || 1;
        const buffMult = 1 + (state.tempXpGainBoost || 0);
        const xpMult = metaMult * buffMult;
        if (typeof player.gainXP === "function") {
          player.gainXP(baseXp * xpMult, state);
        }
        xpOrbs.splice(i, 1);
        break;
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


function renderWorldBackground(state, ctx) {
  // World 2.0 background: readable radial zones + parallax fog + biome textures.
  // Goal: make it instantly clear which zone you're in, without heavy GPU cost.
  const zoneBase = {
    0: "#0d3a1f", // Hub (safe green)
    1: "#0b101b", // Dust / outskirts
    2: "#0e1821", // Moss
    3: "#0d1426", // Crystals
    4: "#19121e", // Ash
    5: "#0d0b1f", // Space
    6: "#0a0714", // Anomaly
  };

  const zoneTint = {
    0: "rgba(46, 210, 120, 0.20)",
    1: "rgba(210, 195, 130, 0.12)",
    2: "rgba(95, 210, 165, 0.12)",
    3: "rgba(120, 190, 255, 0.12)",
    4: "rgba(255, 120, 120, 0.10)",
    5: "rgba(210, 145, 255, 0.10)",
    6: "rgba(255, 80, 220, 0.10)",
  };

  ctx.save();

  // ---------- helpers (lazy patterns) ----------
  const patterns = (state._bgPatterns ||= {});
  function ensurePattern(name) {
    if (patterns[name]) return patterns[name];
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const p = c.getContext("2d");
    if (!p) return null;

    // Clear
    p.clearRect(0, 0, c.width, c.height);

		// A few cheap procedural patterns per zone.
		// IMPORTANT: keep these SUBTLE. Background should never overpower gameplay.
		if (name === "hub") {
			// soft pollen dots (reduced density)
			p.fillStyle = "rgba(180,255,210,0.08)";
			for (let i = 0; i < 22; i++) {
        const x = (i * 73) % 256;
        const y = (i * 131) % 256;
        const r = 1 + ((i * 37) % 3);
        p.beginPath();
        p.arc(x, y, r, 0, Math.PI * 2);
        p.fill();
      }
    }

		if (name === "dust") {
			// speckles + faint streaks (reduced density)
			p.fillStyle = "rgba(220,200,140,0.07)";
			for (let i = 0; i < 35; i++) {
        const x = (i * 29) % 256;
        const y = (i * 97) % 256;
        p.fillRect(x, y, 1, 1);
      }
			p.strokeStyle = "rgba(220,200,140,0.04)";
      p.lineWidth = 1;
			for (let i = 0; i < 5; i++) {
        p.beginPath();
        p.moveTo(0, (i * 23) % 256);
        p.lineTo(256, (i * 23 + 70) % 256);
        p.stroke();
      }
    }

		if (name === "moss") {
			// soft blobs (reduced density)
			for (let i = 0; i < 8; i++) {
        const x = (i * 41) % 256;
        const y = (i * 83) % 256;
        const r = 16 + ((i * 13) % 18);
        const g = p.createRadialGradient(x, y, 0, x, y, r);
				g.addColorStop(0, "rgba(120,255,200,0.08)");
        g.addColorStop(1, "rgba(120,255,200,0.00)");
        p.fillStyle = g;
        p.beginPath();
        p.arc(x, y, r, 0, Math.PI * 2);
        p.fill();
      }
    }

		if (name === "crystal") {
			// shard lines (reduced density)
			p.strokeStyle = "rgba(150,220,255,0.08)";
      p.lineWidth = 1;
			for (let i = 0; i < 10; i++) {
        const x = (i * 47) % 256;
        const y = (i * 59) % 256;
        p.beginPath();
        p.moveTo(x, y);
        p.lineTo(x + 30, y - 18);
        p.stroke();
      }
    }

		if (name === "ash") {
			// smoky arcs (reduced density)
			p.strokeStyle = "rgba(255,150,150,0.06)";
			p.lineWidth = 2;
			for (let i = 0; i < 5; i++) {
        const x = (i * 61) % 256;
        const y = (i * 89) % 256;
        p.beginPath();
        p.arc(x, y, 22 + ((i * 7) % 16), 0, Math.PI);
        p.stroke();
      }
    }

		if (name === "space") {
			// star dust (reduced density)
			p.fillStyle = "rgba(235,225,255,0.10)";
			for (let i = 0; i < 24; i++) {
        const x = (i * 53) % 256;
        const y = (i * 101) % 256;
        const s = (i % 7 === 0) ? 2 : 1;
        p.fillRect(x, y, s, s);
      }
			p.fillStyle = "rgba(200,160,255,0.05)";
			for (let i = 0; i < 3; i++) {
        const x = (i * 97) % 256;
        const y = (i * 37) % 256;
        p.beginPath();
				p.arc(x, y, 16, 0, Math.PI * 2);
        p.fill();
      }
    }

		if (name === "anomaly") {
			// concentric waves (less busy)
			p.strokeStyle = "rgba(255,80,220,0.08)";
      p.lineWidth = 1;
			for (let r = 28; r < 256; r += 40) {
        p.beginPath();
        p.arc(128, 128, r, 0, Math.PI * 2);
        p.stroke();
      }
    }

    patterns[name] = ctx.createPattern(c, "repeat");
    return patterns[name];
  }

  function fillRing(innerR, outerR, style) {
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = style;
    ctx.fill("evenodd");
  }

  function clipRing(innerR, outerR) {
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
    ctx.clip("evenodd");
  }

  // ---------- visible bounds (world) ----------
  const cam = state.camera;
  const player = state.player;
  const zoom = cam?.zoom || 1;
  const halfW = (state.canvas?.width || 800) / (2 * zoom);
  const halfH = (state.canvas?.height || 600) / (2 * zoom);

  const viewMinX = player.x - halfW;
  const viewMaxX = player.x + halfW;
  const viewMinY = player.y - halfH;
  const viewMaxY = player.y + halfH;

  // Perf knobs: mobile joiners can be tight.
  const isJoiner = !!(state.net && state.net.roomCode && !state.net.isHost);
  const w = typeof window !== "undefined" ? (window.innerWidth || 0) : 0;
  const h = typeof window !== "undefined" ? (window.innerHeight || 0) : 0;
  const isSmallMobile = isJoiner && h > w && Math.max(w, h) < 900;

  // ---------- base fills (rings + square) ----------
  // Zone 6 outer square fill (so corners are Zone 6)
  ctx.fillStyle = zoneBase[6];
  ctx.fillRect(-ZONE6_SQUARE_HALF, -ZONE6_SQUARE_HALF, ZONE6_SQUARE_HALF * 2, ZONE6_SQUARE_HALF * 2);

  // Fill Zone 5 → Zone 1 as rings (even-odd)
  const r0 = ZONE_RADII[0];
  const r1 = ZONE_RADII[1];
  const r2 = ZONE_RADII[2];
  const r3 = ZONE_RADII[3];
  const r4 = ZONE_RADII[4];
  const r5 = ZONE_RADII[5];

  // Gradient ring fills for depth.
  function ringGradient(innerR, outerR, baseHex, tintRgba) {
    const g = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
    g.addColorStop(0, baseHex);
    g.addColorStop(0.55, baseHex);
    g.addColorStop(1, tintRgba);
    return g;
  }

  fillRing(r4, r5, ringGradient(r4, r5, zoneBase[5], zoneTint[5]));
  fillRing(r3, r4, ringGradient(r3, r4, zoneBase[4], zoneTint[4]));
  fillRing(r2, r3, ringGradient(r2, r3, zoneBase[3], zoneTint[3]));
  fillRing(r1, r2, ringGradient(r1, r2, zoneBase[2], zoneTint[2]));
  fillRing(r0, r1, ringGradient(r0, r1, zoneBase[1], zoneTint[1]));

  // Hub
  ctx.beginPath();
  ctx.arc(0, 0, r0, 0, Math.PI * 2);
  {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r0);
    g.addColorStop(0, "#135a30");
    g.addColorStop(1, zoneBase[0]);
    ctx.fillStyle = g;
  }
  ctx.fill();

  // ---------- biome textures (combo 4) ----------
  // Draw subtle, repeating patterns clipped to each ring. Cheap and world-anchored.
  function fillPatternInRing(innerR, outerR, patName, alpha) {
    const pat = ensurePattern(patName);
    if (!pat) return;
    ctx.save();
    clipRing(innerR, outerR);
    ctx.globalAlpha = alpha;
    // Nudge so patterns don't perfectly align between zones.
    ctx.translate((patName.length * 37) % 53, (patName.length * 91) % 67);
    ctx.fillStyle = pat;
    ctx.fillRect(viewMinX - 400, viewMinY - 400, (viewMaxX - viewMinX) + 800, (viewMaxY - viewMinY) + 800);
    ctx.restore();
  }

	// Patterns were intentionally reduced: too many FX makes gameplay unclear.
	const patAlpha = isSmallMobile ? 0.18 : 0.28;
	fillPatternInRing(0, r0, "hub", 0.30 * patAlpha);
	fillPatternInRing(r0, r1, "dust", 0.32 * patAlpha);
	fillPatternInRing(r1, r2, "moss", 0.35 * patAlpha);
	fillPatternInRing(r2, r3, "crystal", 0.30 * patAlpha);
	fillPatternInRing(r3, r4, "ash", 0.26 * patAlpha);
	fillPatternInRing(r4, r5, "space", 0.30 * patAlpha);
  // Zone 6 square: anomaly pattern (not clipped to a ring).
  {
    const pat = ensurePattern("anomaly");
    if (pat) {
      ctx.save();
			ctx.globalAlpha = isSmallMobile ? 0.05 : 0.07;
      ctx.fillStyle = pat;
      ctx.fillRect(viewMinX - 500, viewMinY - 500, (viewMaxX - viewMinX) + 1000, (viewMaxY - viewMinY) + 1000);
      ctx.restore();
    }
  }

  // ---------- parallax fog (combo 2) ----------
  // Draw two sparse fog layers that move slower than the world.
  function hash2(ix, iy, seed) {
    // cheap integer hash -> [0,1)
    let x = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
    x = (x ^ (x >>> 13)) | 0;
    x = (x * 1274126177) | 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  function drawFogLayer(factor, cell, alpha, color) {
    const minX = Math.floor(viewMinX / cell) * cell;
    const maxX = Math.floor(viewMaxX / cell) * cell;
    const minY = Math.floor(viewMinY / cell) * cell;
    const maxY = Math.floor(viewMaxY / cell) * cell;

    ctx.save();
    // Parallax transform around player.
    ctx.translate(player.x, player.y);
    ctx.scale(factor, factor);
    ctx.translate(-player.x, -player.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    const t = state.time || 0;
    const animX = (t * 8) % cell;
    const animY = (t * 6) % cell;

		const step = isSmallMobile ? 3 : 2;
    for (let y = minY; y <= maxY; y += cell * step) {
      for (let x = minX; x <= maxX; x += cell * step) {
        const r = hash2((x / cell) | 0, (y / cell) | 0, (factor * 100) | 0);
				// higher threshold => fewer blobs
				if (r < 0.82) continue;
        const ox = (hash2((x / cell) | 0, (y / cell) | 0, 11) - 0.5) * cell + animX;
        const oy = (hash2((x / cell) | 0, (y / cell) | 0, 17) - 0.5) * cell + animY;
        const rad = (0.22 + r * 0.38) * cell;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // far fog
	// Keep only ONE subtle layer; two layers felt too "effect-heavy".
	drawFogLayer(0.28, 720, isSmallMobile ? 0.018 : 0.026, "rgba(255,255,255,0.16)");

	// NOTE: Removed the world grid overlay — it added visual noise.

	// Emphasize ring borders with a soft glow (reduced)
	ctx.lineWidth = 4;
	ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.beginPath();
  for (const rr of [r0, r1, r2, r3, r4, r5]) {
    ctx.moveTo(rr, 0);
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
  }
  ctx.stroke();

	ctx.lineWidth = 1.5;
	ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  for (const rr of [r0, r1, r2, r3, r4, r5]) {
    ctx.moveTo(rr, 0);
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
  }
  ctx.stroke();

	// Emphasize outer square border (reduced)
	ctx.strokeStyle = "rgba(255,255,255,0.10)";
	ctx.lineWidth = 1.5;
  ctx.strokeRect(-ZONE6_SQUARE_HALF, -ZONE6_SQUARE_HALF, ZONE6_SQUARE_HALF * 2, ZONE6_SQUARE_HALF * 2);

  ctx.restore();
}

function renderEnemies(state, ctx) {
  const isJoiner = !!(state.net && state.net.roomCode && !state.net.isHost);
  const w = typeof window !== "undefined" ? (window.innerWidth || 0) : 0;
  const h = typeof window !== "undefined" ? (window.innerHeight || 0) : 0;
  const isSmallMobile = isJoiner && h > w && Math.max(w, h) < 900;

  if (isSmallMobile) {
    // Mobile joiners: keep logic identical, but avoid "square" fallback visuals.
    // If a net-proxy enemy has a renderer, use it; otherwise draw a simple circle.
    for (const e of state.enemies) {
      if (!e) continue;
      if (typeof e.render === "function") {
        e.render(e, ctx);
        continue;
      }
      ctx.save();
      ctx.beginPath();
      let col = "#ff5f6f";
      if (e.isElite) col = "#ffdd57";
      if (e.kind === "zoneBoss") col = "#9b5bff";
      if (e.kind === "roamingBoss") col = "#ff3cbe";
      if (e.kind === "resurrectionGuardian") col = "#ffdd44";
      if (e.kind === "zone6SuperBoss") col = "#1be7ff";
      ctx.fillStyle = col;
      ctx.arc(e.x, e.y, e.radius || 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  for (const e of state.enemies) {
    if (e && e.render) e.render(e, ctx);
  }
}

function renderProjectiles(state, ctx) {
  const { projectiles, rockets, _laserVisual, _lightningVisual, _laserVisuals, _lightningVisuals } = state;

  const isJoiner = !!(state.net && state.net.roomCode && !state.net.isHost);
  const w = typeof window !== "undefined" ? (window.innerWidth || 0) : 0;
  const h = typeof window !== "undefined" ? (window.innerHeight || 0) : 0;
  const isSmallMobile = isJoiner && h > w && Math.max(w, h) < 900;

  ctx.save();

  // On small mobile joiners, rendering thousands of arcs can stutter.
  // Use cheaper rectangles + cap the count.
  if (isSmallMobile) {
    const maxBullets = 220;
    const stepB = projectiles.length > maxBullets ? Math.ceil(projectiles.length / maxBullets) : 1;
    ctx.fillStyle = "#f4e9a3";
    for (let i = 0; i < projectiles.length; i += stepB) {
      const b = projectiles[i];
      if (!b) continue;
      ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    }
    const maxRockets = 80;
    const stepR = rockets.length > maxRockets ? Math.ceil(rockets.length / maxRockets) : 1;
    ctx.fillStyle = "#ff7a3c";
    for (let i = 0; i < rockets.length; i += stepR) {
      const rkt = rockets[i];
      if (!rkt) continue;
      ctx.fillRect(rkt.x - 2, rkt.y - 2, 4, 4);
    }
  } else {
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
  }

  // Laser visuals (supports multiple players in co-op)
  const laserList = [];
  if (_laserVisuals && typeof _laserVisuals.forEach === "function") {
    _laserVisuals.forEach((v) => {
      if (v) laserList.push(v);
    });
  } else if (_laserVisual) {
    laserList.push(_laserVisual);
  }
  for (const v of laserList) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(173,246,255,0.9)";
    ctx.lineWidth = 6;
    ctx.moveTo(v.x1, v.y1);
    ctx.lineTo(v.x2, v.y2);
    ctx.stroke();
  }

  // Lightning visuals (supports multiple players in co-op)
  const lightningList = [];
  if (_lightningVisuals && typeof _lightningVisuals.forEach === "function") {
    _lightningVisuals.forEach((pts) => {
      if (pts && pts.length > 1) lightningList.push(pts);
    });
  } else if (_lightningVisual && _lightningVisual.length > 1) {
    lightningList.push(_lightningVisual);
  }
  for (const pts of lightningList) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(220,245,255,0.95)";
    ctx.lineWidth = 3;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
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

function renderPlayers(state, ctx) {
  const players = state.players && state.players.length ? state.players : (state.player ? [state.player] : []);
  for (const p of players) {
    if (!p) continue;
    if (typeof p.render === "function") {
      p.render(ctx);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = p.id === state.player?.id ? "#8fe3ff" : "#7fb0ff";
      ctx.arc(p.x, p.y, p.radius || 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // nicknames
  ctx.save();
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const p of players) {
    if (!p) continue;
    const name = (p.nickname || "").toString().slice(0, 16);
    if (!name) continue;
    ctx.fillText(name, p.x, p.y - (p.radius || 18) - 22);
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

  // Players
  const players = state.players && state.players.length ? state.players : (state.player ? [state.player] : []);
  for (const p of players) {
    if (!p) continue;
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
      ctx.fillStyle = p.id === state.player?.id ? "#00ff7a" : "#4aa3ff";
      ctx.fillRect(x, y, fullWidth * ratio, h);
    }
  }

  ctx.restore();
}

function renderBuffAuras(state, ctx) {
  const { buffs } = state;
  if (!buffs || !buffs.length) return;

  ctx.save();
  ctx.globalAlpha = 0.35;

  const players = state.players && state.players.length ? state.players : (state.player ? [state.player] : []);

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

    for (const p of players) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.arc(p.x, p.y, (p.radius || 18) + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function renderPopups(ctx, state) {
  const { canvas, popups } = state;
  const w = canvas.width;

  ctx.save();
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";

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

  const runScore = Math.floor(state.runScore);
  const gainedPoints = Math.max(1, Math.floor(runScore / 400));

  progression.totalScore += runScore;
  progression.upgradePoints += gainedPoints;

  if (state.flags && state.flags.resGuardianKilledThisRun) {
    state.mode = "resurrection";
  } else {
    state.mode = "upgrade";
  }

  state.lastRunSummary = {
    runScore,
    totalScore: progression.totalScore,
    gainedPoints,
  };

  saveProgression(progression);
}