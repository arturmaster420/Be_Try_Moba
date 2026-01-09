// DOM-based Lobby UI (Pixel PVP style) for Pixel PVE.
// Keeps existing gameplay/net systems intact; this only drives the menu overlay.

import { saveProgression, getStartLevel } from "../core/progression.js";
import { AVATARS, getUnlockedAvatarCount, isAvatarUnlocked } from "../core/avatars.js";
import { getDefaultWsUrl } from "../net/netClient.js";

let _inited = false;
let _game = null;
let el = {};
let _lastUnlockedCount = -1;

function $(id) {
  return document.getElementById(id);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function fmtRoom(v) {
  return (v || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function setTab(tab) {
  const isProfile = tab === "profile";
  el.tabProfileBtn?.classList.toggle("sel", isProfile);
  el.tabRecordsBtn?.classList.toggle("sel", !isProfile);
  if (el.profileTabProfile) el.profileTabProfile.style.display = isProfile ? "block" : "none";
  if (el.profileTabRecords) el.profileTabRecords.style.display = isProfile ? "none" : "block";
}

function buildAvatarButtons(state) {
  if (!el.avatarButtons) return;
  el.avatarButtons.innerHTML = "";

  const unlockedCount = getUnlockedAvatarCount(state.progression);
  _lastUnlockedCount = unlockedCount;

  for (let i = 0; i < AVATARS.length; i++) {
    const emoji = AVATARS[i];
    const unlocked = isAvatarUnlocked(state.progression, i);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn avbtn" + (unlocked ? "" : " locked") + ((state.progression.avatarIndex|0) === i ? " sel" : "");
    b.textContent = emoji;
    b.title = unlocked ? `Avatar ${i + 1}` : `Locked (${unlockedCount}/${AVATARS.length})`;
    b.addEventListener("click", () => {
      if (!unlocked) return;
      state.progression.avatarIndex = i;
      try { saveProgression(state.progression); } catch {}
      // reflect selection
      const kids = el.avatarButtons.querySelectorAll(".avbtn");
      kids.forEach((k) => k.classList.remove("sel"));
      b.classList.add("sel");
      if (el.profileAvatarPreview) el.profileAvatarPreview.textContent = AVATARS[i] || "🙂";
    });
    el.avatarButtons.appendChild(b);
  }
}

function connectAndDo(state, action) {
  const net = state.net;
  if (!net) return;

  // Pull latest values from UI (so user doesn't have to press Apply).
  try {
    if (state.progression) {
      state.progression.nickname = (el.nameInput?.value || state.progression.nickname || "Player")
        .toString()
        .trim()
        .slice(0, 16) || "Player";
      state.progression.roomCode = fmtRoom(el.roomCodeInput?.value || state.progression.roomCode || "");
      if (el.roomCodeInput) el.roomCodeInput.value = state.progression.roomCode;
      if (el.nameInput) el.nameInput.value = state.progression.nickname;
      try { saveProgression(state.progression); } catch {}
    }
  } catch {}

  net.connect(getDefaultWsUrl());

  const nickname = (state.progression?.nickname || "Player").toString().slice(0, 16);
  const avatarIndex = state.progression?.avatarIndex || 0;
  const roomCode = state.progression?.roomCode || "";

  const doAction = () => {
    try {
      if (action === "host") net.host(roomCode, nickname, avatarIndex);
      else if (action === "join") net.join(roomCode, nickname, avatarIndex);
      else net.fastJoin(nickname, avatarIndex);
    } catch {}
  };

  if (net.ws && net.ws.readyState === 1) {
    doAction();
  } else {
    const ws = net.ws;
    if (ws) {
      const prev = ws.onopen;
      ws.onopen = () => {
        if (typeof prev === "function") prev();
        doAction();
      };
    }
  }
}

export function initLobbyDom(game) {
  if (_inited) return;
  _inited = true;
  _game = game;

  el.lobby = $("lobby");
  el.lobbyPingMini = $("lobbyPingMini");
  el.btnMenuFullscreen = $("btnMenuFullscreen");
  el.btnMenuHelp = $("btnMenuHelp");

  el.tabProfileBtn = $("tabProfileBtn");
  el.tabRecordsBtn = $("tabRecordsBtn");
  el.profileTabProfile = $("profileTabProfile");
  el.profileTabRecords = $("profileTabRecords");

  el.profileAvatarPreview = $("profileAvatarPreview");
  el.nameInput = $("nameInput");
  el.profLevel = $("profLevel");
  el.profXp = $("profXp");
  el.profAv = $("profAv");
  el.profXpBar = $("profXpBar");
  el.profNext = $("profNext");
  el.profAvatarHint = $("profAvatarHint");
  el.avatarButtons = $("avatarButtons");
  el.btnJoinLeft = $("btnJoinLeft");

  el.recTotalScore = $("recTotalScore");
  el.recRTier = $("recRTier");
  el.recUp = $("recUp");

  el.roomCodeInput = $("roomCodeInput");
  el.btnRoomApply = $("btnRoomApply");
  el.btnCopyInvite = $("btnCopyInvite");
  el.roomCodeStatus = $("roomCodeStatus");
  el.joinError = $("joinError");
  el.lobbyPlayers = $("lobbyPlayers");
  el.lobbyInfo = $("lobbyInfo");

  el.btnHost = $("btnHost");
  el.btnJoinRun = $("btnJoinRun");
  el.btnFastJoin = $("btnFastJoin");
  el.btnStart = $("btnStart");
  el.btnDisconnect = $("btnDisconnect");

  el.netStatus = $("netStatus");
  el.netRoom = $("netRoom");
  el.netPlayers = $("netPlayers");

  // Tabs
  el.tabProfileBtn?.addEventListener("click", () => setTab("profile"));
  el.tabRecordsBtn?.addEventListener("click", () => setTab("records"));

  // Fullscreen
  el.btnMenuFullscreen?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {}
  });

  // Help
  el.btnMenuHelp?.addEventListener("click", () => {
    alert(
      "Pixel PVE\n\nHost / Join / Fast-Join: подключение к кооп-серверу (ws relay 8080).\nStart: оффлайн запуск (fallback).\n\nMobile: 1-Hand (вертикально), PC: 2-Hand."
    );
  });

  // Profile input
  if (el.nameInput) {
    el.nameInput.addEventListener("input", () => {
      const s = (el.nameInput.value || "").toString().trim().slice(0, 16);
      if (_game?.state?.progression) _game.state.progression.nickname = s || "Player";
    });
  }

  // Apply profile
  el.btnJoinLeft?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state || !state.progression) return;
    // sanitize
    state.progression.nickname = (state.progression.nickname || "Player").toString().trim().slice(0, 16) || "Player";
    state.progression.avatarIndex = state.progression.avatarIndex | 0;
    try { saveProgression(state.progression); } catch {}

    // update server profile if connected
    try {
      if (state.net && state.net.status === "connected") {
        state.net.setProfile(state.progression.nickname, state.progression.avatarIndex);
      }
    } catch {}
  });

  // Room code apply (just save; actual Join/Host buttons will connect)
  el.btnRoomApply?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state || !state.progression) return;
    state.progression.roomCode = fmtRoom(el.roomCodeInput?.value || "");
    if (el.roomCodeInput) el.roomCodeInput.value = state.progression.roomCode;
    try { saveProgression(state.progression); } catch {}
  });

  // Invite link
  el.btnCopyInvite?.addEventListener("click", async () => {
    const state = _game?.state;
    const room = (state?.net?.roomCode || state?.progression?.roomCode || "").toString();
    const url = `${location.origin}/?code=${encodeURIComponent(room)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        prompt("Invite link", url);
      }
    } catch {
      prompt("Invite link", url);
    }
  });

  // Network actions
  el.btnHost?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state) return;
    connectAndDo(state, "host");
  });
  el.btnJoinRun?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state) return;
    connectAndDo(state, "join");
  });
  el.btnFastJoin?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state) return;
    connectAndDo(state, "fastJoin");
  });

  // Fallback start (offline)
  el.btnStart?.addEventListener("click", () => {
    const state = _game?.state;
    if (!state) return;
    try { state.net?.disconnect?.(); } catch {}
    if (typeof _game?.startOfflineRun === "function") {
      _game.startOfflineRun();
    } else {
      // worst-case fallback: just enter playing on the preview run
      state.mode = "playing";
    }
  });

  el.btnDisconnect?.addEventListener("click", () => {
    const state = _game?.state;
    try { state?.net?.disconnect?.(); } catch {}
  });
}

export function tickLobbyDom(state) {
  if (!_inited || !state) return;

  const show = state.mode === "startMenu";
  if (el.lobby) el.lobby.style.display = show ? "flex" : "none";
  if (!show) return;

  // Ensure progression defaults
  if (!state.progression) return;
  if (!state.progression.nickname) state.progression.nickname = "Player";
  if (typeof state.progression.avatarIndex !== "number") state.progression.avatarIndex = 0;
  if (typeof state.progression.roomCode !== "string") state.progression.roomCode = "";

  // Keep inputs in sync (but don't fight user while typing)
  if (el.nameInput && document.activeElement !== el.nameInput) {
    el.nameInput.value = state.progression.nickname;
  }
  if (el.roomCodeInput && document.activeElement !== el.roomCodeInput) {
    el.roomCodeInput.value = state.progression.roomCode;
  }

  // Profile preview
  if (el.profileAvatarPreview) {
    el.profileAvatarPreview.textContent = AVATARS[state.progression.avatarIndex] || "🙂";
  }

  // Level/XP computed from totalScore (same logic as game progression start level)
  const totalScore = state.progression.totalScore || 0;
  const lvl = Math.max(1, (getStartLevel(state.progression) || 0) + 1);
  const xpInLevel = ((totalScore % 1000) + 1000) % 1000;
  const xpToNext = 1000 - xpInLevel;
  const xpPct = xpInLevel / 1000;
  if (el.profLevel) el.profLevel.textContent = String(lvl);
  if (el.profXp) el.profXp.textContent = String(xpInLevel);
  if (el.profNext) el.profNext.textContent = `Next: ${xpToNext}`;
  if (el.profXpBar) el.profXpBar.style.width = `${Math.round(clamp(xpPct, 0, 1) * 100)}%`;

  const unlocked = getUnlockedAvatarCount(state.progression);
  if (el.profAv) el.profAv.textContent = `${unlocked}/${AVATARS.length}`;
  if (el.profAvatarHint) el.profAvatarHint.textContent = `(unlocked ${unlocked}/${AVATARS.length})`;

  // Records summary
  if (el.recTotalScore) el.recTotalScore.textContent = String(totalScore);
  if (el.recRTier) el.recRTier.textContent = String(state.progression.resurrectedTier || 1);
  if (el.recUp) el.recUp.textContent = String(state.progression.upgradePoints || 0);

  // Build avatars once, and rebuild if unlock count changes
  if (el.avatarButtons && (_lastUnlockedCount < 0 || _lastUnlockedCount !== unlocked)) {
    buildAvatarButtons(state);
  }

  // Net info
  const net = state.net;
  const players = Array.isArray(net?.roomPlayers) ? net.roomPlayers : [];
  const count = players.length || (net?.status === "connected" ? 1 : 0);
  const max = net?.maxPlayers || 7;
  const room = (net?.roomCode || state.progression.roomCode || "").toString();

  if (el.netStatus) el.netStatus.textContent = net?.status || "offline";
  if (el.netRoom) el.netRoom.textContent = room ? room : "—";
  if (el.netPlayers) el.netPlayers.textContent = `${count}/${max}`;

  if (el.lobbyPlayers) {
    el.lobbyPlayers.textContent = `Players on map: ${count}/${max}`;
  }

  if (el.roomCodeStatus) {
    el.roomCodeStatus.textContent = room ? `Room ${room}` : "Public lobby";
  }

  if (el.joinError) {
    el.joinError.textContent = net?.error ? String(net.error) : "";
  }

  if (el.lobbyInfo) {
    if (!net || net.status === "offline") {
      el.lobbyInfo.textContent = "Offline. Press Start or connect via Host/Join/Fast-Join.";
    } else if (net.status === "connecting") {
      el.lobbyInfo.textContent = "Connecting...";
    } else if (net.status === "connected") {
      el.lobbyInfo.textContent = net.isHost ? "Connected (Host)." : "Connected (Join).";
    } else {
      el.lobbyInfo.textContent = net.status;
    }
  }

  // Ping mini (only show if we have a value)
  if (el.lobbyPingMini) {
    const pm = net?.pingMs;
    if (typeof pm === "number" && pm > 0) {
      el.lobbyPingMini.style.display = "inline-flex";
      el.lobbyPingMini.textContent = `Ping: ${pm}`;
    } else {
      el.lobbyPingMini.style.display = "none";
    }
  }
}
