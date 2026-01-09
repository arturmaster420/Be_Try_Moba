import { saveProgression, getStartLevel } from "../core/progression.js";
import { getControlMode, setControlMode } from "../core/mouseController.js";
import { AVATARS, getUnlockedAvatarCount, isAvatarUnlocked } from "../core/avatars.js";

// =========================================================
// Start Menu / Lobby UI (Canvas)
// Target style: user's screenshots (dark glass panels + pills + clean layout).
// Adds: portrait scroll with inertia, click-on-release (prevents accidental taps).
// =========================================================

let lastButtons = [];
let avatarPage = 0; // used for landscape compact grid

const uiState = {
  tab: "profile", // profile | records
  // UI scaling (mostly for mobile). Updated each render.
  scale: 1,
  // portrait scroll
  scrollY: 0,
  velY: 0,
  maxScroll: 0,
  contentTop: 0,
  scrollEnabled: false,
  _lastPortrait: null,
  // drag
  dragging: false,
  moved: false,
  downX: 0,
  downY: 0,
  lastY: 0,
  lastT: 0,
  // for velocity estimate
  v: 0,
  startScrollY: 0,

  // Avatars inner-scroll (separate from page scroll)
  avatarsScrollY: 0,
  avatarsVelY: 0,
  avatarsMaxScroll: 0,
  avatarsRect: null, // {x,y,w,h} in screen coords, set each render when visible

  // drag target: 'page' | 'avatars'
  dragTarget: null,
};

function hasTouch() {
  try {
    if (typeof navigator !== "undefined") {
      if ((navigator.maxTouchPoints || 0) > 0) return true;
      // @ts-ignore
      if ((navigator.msMaxTouchPoints || 0) > 0) return true;
    }
    if (typeof window !== "undefined" && "ontouchstart" in window) return true;
  } catch {}
  return false;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function isNetConnected(net) {
  return !!(net && net.status === "connected");
}

function fmtRoom(v) {
  return (v || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function hit(btn, x, y) {
  const m = btn.hitMargin != null ? btn.hitMargin : 12;
  return x >= btn.x - m && x <= btn.x + btn.w + m && y >= btn.y - m && y <= btn.y + btn.h + m;
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorFromId(id) {
  const h = (hashStr(String(id || "")) % 360 + 360) % 360;
  return `hsla(${h}, 85%, 60%, 1)`;
}

function drawBackdrop(ctx, w, h) {
  // NOTE: renderStartMenu() handles orientation-change reset.
  // This helper must be pure and must not depend on render-local variables.

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // dark base
  ctx.fillStyle = "rgba(0,0,0,0.80)";
  ctx.fillRect(0, 0, w, h);

  // soft vignette
  const g = ctx.createRadialGradient(w * 0.5, h * 0.15, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
  g.addColorStop(0, "rgba(40,50,70,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function drawGlassPanel(ctx, x, y, w, h, r = 18) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(30,34,44,0.78)");
  g.addColorStop(1, "rgba(10,12,16,0.78)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // inner highlight
  rr(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.stroke();
  ctx.restore();
}

function drawButton(ctx, btn, label, opts = {}) {
  const r = opts.r ?? 16;
  rr(ctx, btn.x, btn.y, btn.w, btn.h, r);
  ctx.fillStyle = opts.fill ?? "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.strokeStyle = opts.stroke ?? "rgba(255,255,255,0.16)";
  ctx.stroke();

  ctx.fillStyle = opts.text ?? "rgba(255,255,255,0.90)";
  ctx.font = opts.font ?? "15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + (opts.dy ?? 0));
}

function drawPill(ctx, x, y, text) {
  ctx.save();
  ctx.font = "13px sans-serif";
  const padX = 10;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = 24;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  return w;
}

function drawProgressBar(ctx, x, y, w, h, t) {
  ctx.save();
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  rr(ctx, x, y, w * clamp(t, 0, 1), h, h / 2);
  ctx.fillStyle = "rgba(143,227,255,0.55)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();
  ctx.restore();
}

function drawEmojiAvatar(ctx, cx, cy, radius, emoji, auraColor) {
  ctx.save();

  // avatar bg
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();

  // aura: thin ring with soft glow, no gap
  if (auraColor) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.strokeStyle = auraColor.replace(")", ",0.55)").replace("hsla", "rgba");
    // fallback if replace fails
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = Math.max(2, radius * 0.10);
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = Math.max(10, radius * 0.55);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // emoji
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = Math.floor(radius * 1.2) + "px sans-serif";
  ctx.fillText(emoji || "🙂", cx, cy + 1);
  ctx.restore();
}

function ensureProgression(state) {
  state.progression = state.progression || { nickname: "Player", avatarIndex: 0, roomCode: "" };
}

function getLobbyPlayers(state) {
  const net = state.net;
  const players = net?.roomPlayers;
  if (Array.isArray(players) && players.length) return players;
  // offline fallback
  return [{ id: "local", nickname: state.progression?.nickname || "Player", avatarIndex: state.progression?.avatarIndex || 0, ready: true }];
}

function pushBtn(btn) {
  lastButtons.push(btn);
}

function drawTabs(ctx, x, y, w, isMobile, offsetY = 0) {
  const S = uiState.scale || 1;
  const h = Math.round((isMobile ? 36 : 40) * S);
  const pad = Math.round(8 * S);
  const bw = Math.floor((w - pad * 3) / 2);

  const bProfile = { a: "tabProfile", x: x + pad, y: y + offsetY, w: bw, h, hitMargin: 10 };
  const bRecords = { a: "tabRecords", x: x + pad * 2 + bw, y: y + offsetY, w: bw, h, hitMargin: 10 };

  drawButton(ctx, bProfile, "Profile", {
    fill: uiState.tab === "profile" ? "rgba(143,227,255,0.18)" : "rgba(255,255,255,0.08)",
    font: Math.round((isMobile ? 14 : 15) * S) + "px sans-serif",
    r: Math.round(14 * S),
  });
  drawButton(ctx, bRecords, "Records", {
    fill: uiState.tab === "records" ? "rgba(143,227,255,0.18)" : "rgba(255,255,255,0.08)",
    font: Math.round((isMobile ? 14 : 15) * S) + "px sans-serif",
    r: Math.round(14 * S),
  });

  pushBtn(bProfile);
  pushBtn(bRecords);

  return h + pad;
}

function drawProfileBlock(ctx, x, y, w, state, screenOffsetY, isMobile, isPortrait, viewTop, viewBottom) {
  const S = uiState.scale || 1;
  const p = state.progression;
  const startLevel = getStartLevel(p) || 0;
  const totalScore = p?.totalScore || 0;
  const unlocked = getUnlockedAvatarCount(startLevel);
  const selected = p?.avatarIndex | 0;

  const pad = Math.round((isMobile ? 12 : 14) * S);

  // Tabs
  let yy = y;
  const tabsH = drawTabs(ctx, x, yy, w, isMobile, screenOffsetY);
  yy += tabsH;

  // If records tab: show a simple panel + button to open Stats & Up.
  if (uiState.tab === "records") {
    const ph = isMobile ? 160 : 180;
    drawGlassPanel(ctx, x, yy + screenOffsetY, w, ph, 18);

    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = (isMobile ? 18 : 20) + "px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Records", x + pad, yy + screenOffsetY + pad);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = (isMobile ? 13 : 14) + "px sans-serif";
    ctx.fillText(`Total Score: ${totalScore}`, x + pad, yy + screenOffsetY + pad + 32);
    ctx.fillText(`R-Tier: ${p?.resurrectedTier || 1}`, x + pad, yy + screenOffsetY + pad + 54);

    const bOpen = { a: "stats", x: x + pad, y: yy + screenOffsetY + ph - pad - 44, w: w - pad * 2, h: 44, hitMargin: 12 };
    drawButton(ctx, bOpen, "Open Stats & Up", { fill: "rgba(255,255,255,0.10)", r: 16 });
    pushBtn(bOpen);

    return tabsH + ph + (isMobile ? 10 : 12);
  }

  // Profile card
  const cardHBase = Math.round((isMobile ? 140 : 160) * S);
  drawGlassPanel(ctx, x, yy + screenOffsetY, w, cardHBase, 18);

  // Avatar + name
  const avatarR = Math.round((isMobile ? 24 : 28) * S);
  const cx = x + pad + avatarR + 2;
  const cy = yy + screenOffsetY + pad + avatarR + 4;
  const emoji = AVATARS[selected] || "🙂";

  // Aura from nickname (stable before connect)
  const aura = colorFromId(p?.nickname || "Player");
  drawEmojiAvatar(ctx, cx, cy, avatarR, emoji, aura);

  const nameX = cx + avatarR + 12;
  const nameY = yy + screenOffsetY + pad + 6;
  const nameW = w - (nameX - x) - pad;
  const nameH = Math.round(40 * S);

  // name input look
  rr(ctx, nameX, nameY, nameW, nameH, 16);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = Math.round((isMobile ? 15 : 18) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText((p?.nickname || "Player").slice(0, 16), nameX + 14, nameY + nameH / 2 + 1);

  pushBtn({ a: "editNick", x: nameX, y: nameY, w: nameW, h: nameH, hitMargin: 14 });

  // pills row
  const pillsY = nameY + nameH + Math.round(8 * S);
  let px = nameX;
  px += drawPill(ctx, px, pillsY, `L ${startLevel}`) + 10;
  px += drawPill(ctx, px, pillsY, `XP ${totalScore}`) + 10;
  drawPill(ctx, px, pillsY, `Av ${unlocked}/${AVATARS.length}`);

  // progress bar + text
  const nextLevelTarget = (startLevel + 1) * 1000;
  const rem = Math.max(0, nextLevelTarget - totalScore);
  const frac = 1 - rem / 1000;
  const barY = pillsY + Math.round(32 * S);
  drawProgressBar(ctx, nameX, barY, nameW, 10, frac);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = Math.round(12 * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Next level: ${rem} XP • Next avatar at L${startLevel + 1}`, nameX, barY + 16);

  yy += cardHBase + Math.round((isMobile ? 10 : 12) * S);

  // Avatars title
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = Math.round((isMobile ? 17 : 20) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Avatars ${unlocked}/${AVATARS.length}`, x + pad, yy + screenOffsetY + 2);

  yy += Math.round((isMobile ? 30 : 36) * S);

  // Avatar grid
  const gridX = x + pad;
  const gridW = w - pad * 2;
  const gap = Math.round(8 * S);
  const approxCell = Math.round((isMobile ? 46 : 50) * S);
  let cols = clamp(Math.floor((gridW + gap) / approxCell), isMobile ? 6 : 5, isMobile ? 10 : 7);
  let cell = Math.floor((gridW - gap * (cols - 1)) / cols);

  // On mobile (both portrait + landscape) we want the full avatar list and rely on menu scrolling.
  // On desktop we keep the compact paged grid.
  const fullMode = !!isMobile;
  const rowsPerPage = 2;
  const perPage = cols * rowsPerPage;

  const drawCell = (i, bx, by, locked, sel, virtTop = viewTop, virtBottom = viewBottom) => {
    const screenY = by + screenOffsetY;
    const screenBottom = screenY + cell;
    // simple virtualization for portrait: draw only visible
    if (isMobile && (screenBottom < virtTop - 60 || screenY > virtBottom + 60)) {
      return;
    }

    // circular avatar
    const r = cell * 0.42;
    const ccx = bx + cell / 2;
    const ccy = by + cell / 2;

    ctx.beginPath();
    ctx.arc(ccx, ccy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = locked ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
    ctx.fill();

    if (sel) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(143,227,255,0.85)";
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = locked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)";
    }
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = locked ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.95)";
    ctx.font = Math.floor(cell * 0.58) + "px sans-serif";
    ctx.fillText(AVATARS[i], ccx, ccy + 2);

    if (locked) {
      ctx.font = Math.floor(cell * 0.26) + "px sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillText("🔒", bx + cell * 0.76, by + cell * 0.76);
    }

    pushBtn({ a: "avatar", avatarIndex: i, locked, x: bx, y: by + screenOffsetY, w: cell, h: cell, hitMargin: 6 });
  };

  let gridH = 0;
  if (fullMode) {
    // Mobile/touch: avatars scroll INSIDE their own panel (user request)
    const panelH = Math.round((isPortrait ? 270 : 220) * S);
    drawGlassPanel(ctx, gridX, yy + screenOffsetY, gridW, panelH, 18);

    // Register scroll hit rect in screen coords
    uiState.avatarsRect = { x: gridX, y: yy + screenOffsetY, w: gridW, h: panelH };

    const innerPad = Math.round(10 * S);
    const listX = gridX + innerPad;
    const listW = gridW - innerPad * 2;
    const listY0 = yy + innerPad;
    const clipY = yy + screenOffsetY + innerPad;
    const clipH = Math.max(10, panelH - innerPad * 2);

    // Re-fit grid into inner area
    cols = clamp(Math.floor((listW + gap) / approxCell), 6, 11);
    cell = Math.floor((listW - gap * (cols - 1)) / cols);

    const rows = Math.ceil(AVATARS.length / cols);
    gridH = rows * cell + Math.max(0, rows - 1) * gap;

    uiState.avatarsMaxScroll = Math.max(0, gridH - clipH);
    uiState.avatarsScrollY = clamp(uiState.avatarsScrollY, 0, uiState.avatarsMaxScroll);

    // Clip to the panel interior and draw scrolled content
    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, clipY, listW, clipH);
    ctx.clip();

    const virtTop = clipY;
    const virtBottom = clipY + clipH;

    for (let i = 0; i < AVATARS.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = listX + col * (cell + gap);
      const by = listY0 + row * (cell + gap) - uiState.avatarsScrollY;
      const locked = i >= unlocked;
      const sel = i === selected;
      drawCell(i, bx, by, locked, sel, virtTop, virtBottom);
    }

    ctx.restore();

    // inner scrollbar (only if scrollable)
    if (uiState.avatarsMaxScroll > 4) {
      const trackH = clipH;
      const thumbH = Math.max(26, trackH * (trackH / (trackH + uiState.avatarsMaxScroll)));
      const t = uiState.avatarsScrollY / uiState.avatarsMaxScroll;
      const thumbY = clipY + (trackH - thumbH) * t;
      rr(ctx, gridX + gridW - Math.round(6 * S), thumbY, Math.max(3, Math.round(3 * S)), thumbH, 2);
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fill();
    }

    // Move cursor by panel height (not by grid height)
    yy += panelH + Math.round(12 * S);
    // we already advanced yy, so skip the generic yy += gridH below
    gridH = 0;
  } else {
    // Compact paged grid
    const totalPages = Math.max(1, Math.ceil(AVATARS.length / perPage));
    avatarPage = clamp(avatarPage, 0, totalPages - 1);
    const start = avatarPage * perPage;
    const end = Math.min(AVATARS.length, start + perPage);

    // page controls
    const ctrlW = 32;
    const ctrlH = 24;
    const cy2 = yy + screenOffsetY - 28;
    const prev = { a: "avatarPrev", x: x + w - pad * 2 - ctrlW * 2 - 8, y: cy2, w: ctrlW, h: ctrlH, hitMargin: 8 };
    const next = { a: "avatarNext", x: x + w - pad - ctrlW, y: cy2, w: ctrlW, h: ctrlH, hitMargin: 8 };

    drawButton(ctx, prev, "‹", { fill: avatarPage > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", font: "16px sans-serif", r: 10, dy: 1 });
    drawButton(ctx, next, "›", { fill: avatarPage < totalPages - 1 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", font: "16px sans-serif", r: 10, dy: 1 });
    pushBtn(prev);
    pushBtn(next);

    for (let i = start; i < end; i++) {
      const local = i - start;
      const col = local % cols;
      const row = Math.floor(local / cols);
      const bx = gridX + col * (cell + gap);
      const by = yy + row * (cell + gap);
      const locked = i >= unlocked;
      const sel = i === selected;
      drawCell(i, bx, by, locked, sel);
    }

    gridH = rowsPerPage * cell + Math.max(0, rowsPerPage - 1) * gap;
  }

  yy += gridH + (isMobile ? 14 : 16);

  const bApply = { a: "applyProfile", x: x + pad, y: yy + screenOffsetY, w: w - pad * 2, h: Math.round((isMobile ? 48 : 56) * S), hitMargin: 14 };
  drawButton(ctx, bApply, "Apply", { fill: "rgba(255,255,255,0.10)", font: Math.round((isMobile ? 15 : 17) * S) + "px sans-serif", r: Math.round(18 * S) });
  pushBtn(bApply);

  yy += Math.round((isMobile ? 48 : 56) * S) + Math.round((isMobile ? 12 : 14) * S);

  return yy - y;
}

function drawRoomAndPlayersBlock(ctx, x, y, w, state, screenOffsetY, isMobile) {
  const S = uiState.scale || 1;
  const pad = Math.round((isMobile ? 12 : 14) * S);
  const net = state.net;
  const room = fmtRoom(state.progression?.roomCode);
  const players = getLobbyPlayers(state);
  const readyCount = players.reduce((a, p) => a + (p.ready ? 1 : 0), 0);

  // Room code panel
  const topH = Math.round((isMobile ? 160 : 182) * S);
  drawGlassPanel(ctx, x, y + screenOffsetY, w, topH, 18);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = Math.round((isMobile ? 17 : 20) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Room Code", x + pad, y + screenOffsetY + pad);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = Math.round(12 * S) + "px sans-serif";
  ctx.fillText("(optional)", x + pad + 110, y + screenOffsetY + pad + 5);

  const inputY = y + pad + Math.round(30 * S);
  const inputH = Math.round(44 * S);
  const applyW = Math.round((isMobile ? 90 : 110) * S);
  const gap = Math.round(10 * S);
  const inputW = w - pad * 2 - applyW - gap;

  rr(ctx, x + pad, inputY + screenOffsetY, inputW, inputH, Math.round(16 * S));
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = Math.round(15 * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(room || "", x + pad + 14, inputY + screenOffsetY + inputH / 2 + 1);

  pushBtn({ a: "editRoom", x: x + pad, y: inputY + screenOffsetY, w: inputW, h: inputH, hitMargin: 14 });

  const bApply = { a: "applyRoom", x: x + pad + inputW + gap, y: inputY + screenOffsetY + 2, w: applyW, h: inputH - 4, hitMargin: 14 };
  drawButton(ctx, bApply, "Apply", { fill: "rgba(255,255,255,0.10)", font: Math.round(14 * S) + "px sans-serif", r: Math.round(16 * S) });
  pushBtn(bApply);

  const bCopy = { a: "copyLink", x: x + pad, y: inputY + screenOffsetY + inputH + Math.round(12 * S), w: Math.min(Math.round(220 * S), w - pad * 2), h: Math.round(38 * S), hitMargin: 14 };
  drawButton(ctx, bCopy, "Copy invite link", { fill: "rgba(143,227,255,0.14)", font: Math.round(13 * S) + "px sans-serif", r: Math.round(16 * S) });
  pushBtn(bCopy);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = Math.round(12 * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const codeShown = net?.roomCode || room || "";
  ctx.fillText(codeShown ? `Public lobby` : `Public lobby`, x + pad, y + screenOffsetY + topH - pad - 18);

  let yy = y + topH + Math.round((isMobile ? 12 : 14) * S);

  // Players panel
  const listH = Math.round((isMobile ? 200 : 260) * S);
  drawGlassPanel(ctx, x, yy + screenOffsetY, w, listH, 18);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = Math.round((isMobile ? 17 : 20) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Players", x + pad, yy + screenOffsetY + pad);

  const rowY0 = yy + pad + 38;
  const rowH = Math.round(32 * S);
  const maxRows = Math.floor((listH - (pad + 38) - pad - 64) / rowH);
  const shown = players.slice(0, Math.max(1, maxRows));

  for (let i = 0; i < shown.length; i++) {
    const pl = shown[i];
    const ry = rowY0 + i * rowH;

    const pid = String(pl.id || "");
    const em = AVATARS[(pl.avatarIndex | 0) % AVATARS.length] || "🙂";
    const col = colorFromId(pid || pl.nickname || "p");

    // small emoji
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = Math.round(17 * S) + "px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(em, x + pad, ry + screenOffsetY + Math.round(14 * S));

    // aura dot
    ctx.beginPath();
    ctx.arc(x + pad + Math.round(26 * S), ry + screenOffsetY + Math.round(14 * S), Math.max(3, Math.round(5 * S)), 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.65;
    ctx.fill();
    ctx.globalAlpha = 1;

    // name
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = Math.round(14 * S) + "px sans-serif";
    const name = String(pl.nickname || "Player").slice(0, 16);
    const isYou = state.net?.playerId && String(state.net.playerId) === pid;
    ctx.fillText(name + (isYou ? "   YOU" : ""), x + pad + Math.round(40 * S), ry + screenOffsetY + Math.round(14 * S));
  }

  const btnY = yy + screenOffsetY + listH - pad - Math.round(42 * S);
  const g = Math.round(12 * S);
  const bw = Math.floor((w - pad * 2 - g * 2) / 3);

  const bHost = { a: "host", x: x + pad, y: btnY, w: bw, h: Math.round(42 * S), hitMargin: 14 };
  const bJoin = { a: "join", x: x + pad + bw + g, y: btnY, w: bw, h: Math.round(42 * S), hitMargin: 14 };
  const bFast = { a: "fastJoin", x: x + pad + (bw + g) * 2, y: btnY, w: bw, h: Math.round(42 * S), hitMargin: 14 };

  drawButton(ctx, bHost, "Host", { fill: "rgba(143,227,255,0.18)", r: Math.round(16 * S), font: Math.round(14 * S) + "px sans-serif" });
  drawButton(ctx, bJoin, "Join", { fill: "rgba(164,255,153,0.16)", r: Math.round(16 * S), font: Math.round(14 * S) + "px sans-serif" });
  drawButton(ctx, bFast, "Fast", { fill: "rgba(255,255,255,0.10)", r: Math.round(16 * S), font: Math.round(14 * S) + "px sans-serif" });
  pushBtn(bHost);
  pushBtn(bJoin);
  pushBtn(bFast);

  // ready line
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = Math.round(12 * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Ready ${readyCount}/${players.length}`, x + pad, btnY - 26);

  yy += listH + Math.round((isMobile ? 12 : 14) * S);

  return yy - y;
}

function drawRightSettingsBlock(ctx, x, y, w, state, screenOffsetY, isMobile) {
  const S = uiState.scale || 1;
  const pad = Math.round((isMobile ? 12 : 14) * S);
  const h = Math.round((isMobile ? 190 : 230) * S);
  drawGlassPanel(ctx, x, y + screenOffsetY, w, h, 18);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = Math.round((isMobile ? 17 : 20) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Settings", x + pad, y + screenOffsetY + pad);

  // Control system
  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = Math.round(12 * S) + "px sans-serif";
  ctx.fillText("Control System", x + pad, y + screenOffsetY + pad + 34);

  const mode = getControlMode();
  const g = Math.round(10 * S);
  const bw = Math.floor((w - pad * 2 - g) / 2);
  const by = y + screenOffsetY + pad + Math.round(52 * S);

  const b1 = { a: "controlOne", x: x + pad, y: by, w: bw, h: Math.round(38 * S), hitMargin: 14 };
  const b2 = { a: "controlTwo", x: x + pad + bw + g, y: by, w: bw, h: Math.round(38 * S), hitMargin: 14 };

  drawButton(ctx, b1, "1-Hand", { fill: mode === "oneHand" ? "rgba(164,255,153,0.22)" : "rgba(255,255,255,0.08)", r: Math.round(14 * S), font: Math.round(14 * S) + "px sans-serif" });
  drawButton(ctx, b2, "2-Hand", { fill: mode === "twoHand" ? "rgba(164,255,153,0.22)" : "rgba(255,255,255,0.08)", r: Math.round(14 * S), font: Math.round(14 * S) + "px sans-serif" });
  pushBtn(b1);
  pushBtn(b2);

  const bDisc = { a: "disconnect", x: x + pad, y: by + Math.round(52 * S), w: w - pad * 2, h: Math.round(42 * S), hitMargin: 14 };
  drawButton(ctx, bDisc, isNetConnected(state.net) ? "Disconnect" : "Offline", {
    fill: isNetConnected(state.net) ? "rgba(255,107,107,0.18)" : "rgba(255,255,255,0.06)",
    r: Math.round(16 * S),
  });
  pushBtn(bDisc);

  return h + Math.round((isMobile ? 12 : 14) * S);
}

export function renderStartMenu(ctx, state) {
  ensureProgression(state);

  const w = state.canvas.width;
  const h = state.canvas.height;
  const isMobile = Math.min(w, h) < 720;
  const isPortrait = h > w * 1.12;
  const isTouch = hasTouch();
  const allowScroll = isTouch; // allow scroll on touch devices (phones/tablets), both portrait+landscape

  // Slightly denser UI on mobile (user feedback: menu looked too large).
  uiState.scale = isMobile ? 0.84 : 1;
  // reset per-frame hit rects
  uiState.avatarsRect = null;
  // reset per-frame scroll range (will be recomputed if avatars box is rendered)
  uiState.avatarsMaxScroll = 0;

  // Reset scroll when orientation changes (prevents "stuck" scroll on rotate)
  if (uiState._lastPortrait == null) uiState._lastPortrait = isPortrait;
  if (uiState._lastPortrait !== isPortrait) {
    uiState._lastPortrait = isPortrait;
    uiState.scrollY = 0;
    uiState.velY = 0;
    uiState.v = 0;
    uiState.avatarsScrollY = 0;
    uiState.avatarsVelY = 0;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  lastButtons = [];

  drawBackdrop(ctx, w, h);

  const S = uiState.scale || 1;
  const pad = Math.round((isMobile ? 12 : 16) * S);

  // Reserve space so bottom-right fallback button doesn't hide the last items.
  const cornerMargin = Math.round((isMobile ? 10 : 14) * S);
  const cornerBtnH = Math.round((isMobile ? 52 : 56) * S);
  // Reserve space for the bottom-right fallback button on touch devices so it doesn't hide scrolled content.
  const reservedBottom = allowScroll ? cornerBtnH + cornerMargin + 8 : 0;

  // Status line (top)
  const net = state.net;
  const players = getLobbyPlayers(state);
  const ping = net?.pingMs != null ? net.pingMs : 0;
  const codeShown = net?.roomCode || fmtRoom(state.progression?.roomCode) || "";
  const readyCount = players.reduce((a, p) => a + (p.ready ? 1 : 0), 0);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = Math.round((isMobile ? 12 : 13) * S) + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    `${codeShown ? "Public lobby" : "Public lobby"} • Players: ${players.length}/7 • Ready ${readyCount}/${players.length} • Ping: ${ping}ms`,
    w / 2,
    pad
  );

  // Show connection error (if any)
  if (net && net.error) {
    ctx.fillStyle = "rgba(255,120,120,0.85)";
    ctx.font = Math.round((isMobile ? 12 : 13) * S) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(net.error), w / 2, pad + (isMobile ? 14 : 16));
  }

  // Title row + buttons
  const titleY = pad + Math.round(20 * S);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = Math.round((isMobile ? 24 : 34) * S) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Lobby", pad, titleY);

  const topBtnH = Math.round((isMobile ? 40 : 44) * S);
  const topBtnW = Math.round((isMobile ? 112 : 136) * S);
  const topBtnGap = Math.round(10 * S);
  const by = titleY + 2;

  const bFull = { a: "fullscreen", x: w - pad - topBtnW * 2 - topBtnGap, y: by, w: topBtnW, h: topBtnH, hitMargin: 14 };
  const bHelp = { a: "help", x: w - pad - topBtnW, y: by, w: topBtnW, h: topBtnH, hitMargin: 14 };
  drawButton(ctx, bFull, "Fullscreen", { fill: "rgba(255,255,255,0.08)", r: Math.round(16 * S), font: Math.round(14 * S) + "px sans-serif" });
  drawButton(ctx, bHelp, "Help", { fill: "rgba(255,255,255,0.08)", r: Math.round(16 * S), font: Math.round(14 * S) + "px sans-serif" });
  pushBtn(bFull);
  pushBtn(bHelp);

  const contentTop = pad + Math.round((isMobile ? 66 : 78) * S);
  uiState.contentTop = contentTop;

  if (allowScroll && isPortrait) {
    // Portrait: scrollable stacked layout
    const viewTop = contentTop;
    const viewBottom = h - reservedBottom;

    // clamp scroll
    uiState.scrollY = clamp(uiState.scrollY, 0, Math.max(0, uiState.maxScroll || 0));

    // clip content
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, w, Math.max(0, h - contentTop - reservedBottom));
    ctx.clip();

    const screenOffsetY = contentTop - uiState.scrollY;

    let yy = 0;
    const colW = w - pad * 2;

    yy += drawProfileBlock(ctx, pad, yy, colW, state, screenOffsetY, true, true, viewTop, viewBottom);
    yy += drawRoomAndPlayersBlock(ctx, pad, yy, colW, state, screenOffsetY, true);
    yy += drawRightSettingsBlock(ctx, pad, yy, colW, state, screenOffsetY, true);

    // total content height
    uiState.maxScroll = Math.max(0, yy - ((h - reservedBottom) - contentTop));
    uiState.scrollY = clamp(uiState.scrollY, 0, uiState.maxScroll);
    uiState.scrollEnabled = allowScroll && uiState.maxScroll > 0;

    // scroll indicator
    if (uiState.maxScroll > 4) {
      const trackH = Math.max(20, (h - reservedBottom) - contentTop - 10);
      const thumbH = Math.max(36, trackH * (trackH / (trackH + uiState.maxScroll)));
      const t = uiState.scrollY / uiState.maxScroll;
      const thumbY = contentTop + 5 + (trackH - thumbH) * t;
      rr(ctx, w - 6, thumbY, 3, thumbH, 2);
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fill();
    }

    ctx.restore();
  } else {
    // Landscape / PC: 3-column layout
    // On mobile landscape we still allow vertical scrolling for content that doesn't fit.
    const gap = isMobile ? 10 : 14;
    const topY = contentTop;
    const viewportBottom = allowScroll ? (h - reservedBottom) : h;
    const viewportH = Math.max(0, viewportBottom - topY);
    const contentH = Math.max(0, viewportH - pad);
    const colW = Math.floor((w - pad * 2 - gap * 2) / 3);

    // clamp scroll (mobile landscape)
    if (allowScroll) {
      uiState.scrollY = clamp(uiState.scrollY, 0, Math.max(0, uiState.maxScroll || 0));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, topY, w, viewportH);
      ctx.clip();
    }

    const scrollOffsetY = allowScroll ? -uiState.scrollY : 0;

    const left = { x: pad, y: topY + scrollOffsetY, w: colW, h: contentH };
    const mid = { x: pad + colW + gap, y: topY + scrollOffsetY, w: colW, h: contentH };
    const right = { x: pad + (colW + gap) * 2, y: topY + scrollOffsetY, w: colW, h: contentH };

    // left column
    let yyL = 0;
    yyL += drawProfileBlock(ctx, left.x, left.y + yyL, left.w, state, 0, isMobile, false, topY, viewportBottom);

    // middle column
    let yyM = 0;
    yyM += drawRoomAndPlayersBlock(ctx, mid.x, mid.y + yyM, mid.w, state, 0, isMobile);

    // right column
    const yyR = drawRightSettingsBlock(ctx, right.x, right.y, right.w, state, 0, isMobile);

    // compute max scroll for mobile landscape
    if (allowScroll) {
      const maxContent = Math.max(yyL, yyM, yyR);
      uiState.maxScroll = Math.max(0, maxContent - viewportH);
      uiState.scrollY = clamp(uiState.scrollY, 0, uiState.maxScroll);
      uiState.scrollEnabled = allowScroll && uiState.maxScroll > 0;

      // scroll indicator
      if (uiState.maxScroll > 4) {
        const trackH = Math.max(20, viewportH - 10);
        const thumbH = Math.max(36, trackH * (trackH / (trackH + uiState.maxScroll)));
        const t = uiState.scrollY / uiState.maxScroll;
        const thumbY = topY + 5 + (trackH - thumbH) * t;
        rr(ctx, w - 6, thumbY, 3, thumbH, 2);
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Non-scroll layouts
  if (!allowScroll) uiState.scrollEnabled = false;

  // Bottom-right fallback button (as requested earlier)
  const btnW = Math.round((isMobile ? 150 : 170) * S);
  const btnH = cornerBtnH;
  const bx = w - cornerMargin - btnW;
  const by2 = h - cornerMargin - btnH;

  const connected = !!(net && net.status === "connected" && net.roomCode);
  const hostOnline = connected && !!net.isHost;
  const joinOnline = connected && !net.isHost;
  const joinReady = !!(net && net.ready);

  let label = "Start";
  if (hostOnline) label = "Start Run";
  else if (joinOnline) label = joinReady ? "Unready" : "Ready";

  const bCorner = { a: "startCorner", x: bx, y: by2, w: btnW, h: btnH, hitMargin: 18 };
  drawButton(ctx, bCorner, label, {
    fill: hostOnline
      ? "rgba(143,227,255,0.24)"
      : joinOnline
        ? (joinReady ? "rgba(164,255,153,0.26)" : "rgba(255,255,255,0.10)")
        : "rgba(164,255,153,0.20)",
    r: Math.round(18 * S),
    font: Math.round((isMobile ? 15 : 17) * S) + "px sans-serif",
  });
  pushBtn(bCorner);

  ctx.restore();
}

// =========================================================
// Pointer handling for scroll (menu only)
// =========================================================

export function tickStartMenu(dt, state) {
  // Inertia for page-scroll and for avatar-box-scroll.
  if (uiState.dragging) return;

  // page inertia
  if (uiState.scrollEnabled && (uiState.maxScroll || 0) > 0) {
    if (Math.abs(uiState.velY) > 0.1) {
      uiState.scrollY = clamp(uiState.scrollY + uiState.velY * dt, 0, uiState.maxScroll || 0);

      const fr = 14;
      const s = Math.max(0, 1 - fr * dt);
      uiState.velY *= s;
      if (Math.abs(uiState.velY) < 6) uiState.velY = 0;
    }
  } else {
    uiState.velY = 0;
  }

  // avatars inertia
  if ((uiState.avatarsMaxScroll || 0) > 0) {
    if (Math.abs(uiState.avatarsVelY) > 0.1) {
      uiState.avatarsScrollY = clamp(uiState.avatarsScrollY + uiState.avatarsVelY * dt, 0, uiState.avatarsMaxScroll || 0);

      const fr = 14;
      const s = Math.max(0, 1 - fr * dt);
      uiState.avatarsVelY *= s;
      if (Math.abs(uiState.avatarsVelY) < 6) uiState.avatarsVelY = 0;
    }
  } else {
    uiState.avatarsVelY = 0;
  }
}

export function handleStartMenuPointerDown(x, y, state) {
  const contentTop = uiState.contentTop || 0;
  const pageScrollable = uiState.scrollEnabled && (uiState.maxScroll || 0) > 0;
  const ar = uiState.avatarsRect;
  const inAvatars = !!(ar && x >= ar.x && x <= ar.x + ar.w && y >= ar.y && y <= ar.y + ar.h);
  const avatarsScrollable = inAvatars && (uiState.avatarsMaxScroll || 0) > 0;

  // Prefer avatars scroll if touch started inside the avatars box.
  if (avatarsScrollable) {
    uiState.dragTarget = "avatars";
  } else if (pageScrollable && y >= contentTop) {
    uiState.dragTarget = "page";
  } else {
    uiState.dragTarget = null;
    uiState.dragging = false;
    return;
  }

  uiState.dragging = true;
  uiState.moved = false;
  uiState.startScrollY = uiState.dragTarget === "avatars" ? uiState.avatarsScrollY : uiState.scrollY;
  uiState.downX = x;
  uiState.downY = y;
  uiState.lastY = y;
  uiState.lastT = performance.now();
  uiState.v = 0;
  // stop inertia when grab
  if (uiState.dragTarget === "avatars") uiState.avatarsVelY = 0;
  else uiState.velY = 0;
}

export function handleStartMenuPointerMove(x, y, state) {
  if (!uiState.dragging) return;

  const now = performance.now();
  const dy = y - uiState.lastY;
  const dt = Math.max(0.001, (now - uiState.lastT) / 1000);

  // detect move
  if (!uiState.moved) {
    const mdx = x - uiState.downX;
    const mdy = y - uiState.downY;
    if (Math.abs(mdy) > 6 || Math.abs(mdx) > 6) uiState.moved = true;
  }

  // scroll
  if (uiState.dragTarget === "avatars") {
    uiState.avatarsScrollY = clamp(uiState.avatarsScrollY - dy, 0, uiState.avatarsMaxScroll || 0);
    if (!uiState.moved && Math.abs(uiState.avatarsScrollY - uiState.startScrollY) > 3) uiState.moved = true;
  } else {
    uiState.scrollY = clamp(uiState.scrollY - dy, 0, uiState.maxScroll || 0);
    if (!uiState.moved && Math.abs(uiState.scrollY - uiState.startScrollY) > 3) uiState.moved = true;
  }

  // velocity estimate (px/s)
  const inst = (-dy) / dt;
  uiState.v = uiState.v * 0.7 + inst * 0.3;

  uiState.lastY = y;
  uiState.lastT = now;
}

export function handleStartMenuPointerUp(x, y, state) {
  // end drag + apply inertia
  if (uiState.dragging) {
    uiState.dragging = false;
    if (uiState.moved) {
      const vv = clamp(uiState.v, -2500, 2500);
      if (uiState.dragTarget === "avatars") uiState.avatarsVelY = vv;
      else uiState.velY = vv;
      uiState.dragTarget = null;
      return null;
    }
  }
  uiState.dragTarget = null;

  // Click (tap) handling
  let btn = null;
  for (let i = lastButtons.length - 1; i >= 0; i--) {
    const b = lastButtons[i];
    if (hit(b, x, y)) {
      btn = b;
      break;
    }
  }
  if (!btn) return null;

  ensureProgression(state);

  // local-only actions
  if (btn.a === "tabProfile") {
    uiState.tab = "profile";
    return null;
  }
  if (btn.a === "tabRecords") {
    uiState.tab = "records";
    return null;
  }

  if (btn.a === "fullscreen") {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.();
    } catch {}
    return null;
  }

  if (btn.a === "help") {
    try {
      alert(
        "Controls:\n- 1-Hand: move + auto-aim\n- 2-Hand: move + aim\n\nCo-op:\n- Host / Join / Fast\n- Start Run button in bottom-right (fallback)"
      );
    } catch {}
    return null;
  }

  if (btn.a === "editNick") {
    const cur = state.progression.nickname || "Player";
    const v = prompt("Enter nickname (max 16)", cur);
    if (typeof v === "string") {
      const next = v.trim().slice(0, 16) || "Player";
      state.progression.nickname = next;
      saveProgression(state.progression);
      if (isNetConnected(state.net)) state.net.setProfile(next, state.progression.avatarIndex | 0);
    }
    return null;
  }

  if (btn.a === "editRoom") {
    const cur = state.progression.roomCode || "";
    const v = prompt("Enter room code (up to 8 chars)", cur);
    if (typeof v === "string") {
      state.progression.roomCode = fmtRoom(v);
      saveProgression(state.progression);
    }
    return null;
  }

  // "Apply" next to Room Code behaves as a commit action; since we use prompt-based input,
  // treat it as editing the room code.
  if (btn.a === "applyRoom") {
    const cur = state.progression.roomCode || "";
    const v = prompt("Enter room code (up to 8 chars)", cur);
    if (typeof v === "string") {
      state.progression.roomCode = fmtRoom(v);
      saveProgression(state.progression);
    }
    return null;
  }

  if (btn.a === "avatarPrev") {
    avatarPage = Math.max(0, (avatarPage | 0) - 1);
    return null;
  }
  if (btn.a === "avatarNext") {
    avatarPage = (avatarPage | 0) + 1;
    return null;
  }

  if (btn.a === "avatar") {
    const idx = btn.avatarIndex | 0;
    const startLevel = getStartLevel(state.progression) || 0;
    if (!isAvatarUnlocked(startLevel, idx)) return null;

    state.progression.avatarIndex = idx;
    saveProgression(state.progression);
    if (isNetConnected(state.net)) {
      const nickname = state.progression.nickname || "Player";
      state.net.setProfile(nickname, idx);
    }
    return null;
  }

  if (btn.a === "controlOne") {
    setControlMode("oneHand");
    return null;
  }
  if (btn.a === "controlTwo") {
    setControlMode("twoHand");
    return null;
  }

  // delegate to gameLoop
  if (btn.a === "applyProfile") return "applyProfile";
  if (btn.a === "copyLink") return "copyLink";
  if (btn.a === "host") return "host";
  if (btn.a === "join") return "join";
  if (btn.a === "fastJoin") return "fastJoin";
  if (btn.a === "disconnect") return "disconnect";
  if (btn.a === "startCorner") return "startCorner";
  if (btn.a === "stats") return "stats";

  return null;
}

// =========================================================
// Settings menu (kept from previous version)
// =========================================================

export function renderSettingsMenu(ctx, state) {
  const w = state.canvas.width;
  const h = state.canvas.height;
  const isMobile = Math.min(w, h) < 720;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  lastButtons = [];

  drawBackdrop(ctx, w, h);

  const panelW = Math.min(w * 0.82, 560);
  const panelH = Math.min(h * 0.55, 360);
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.22;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 18);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = (isMobile ? 28 : 34) + "px sans-serif";
  ctx.fillText("Settings", w / 2, panelY - (isMobile ? 48 : 60));

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "20px sans-serif";
  ctx.fillText("Control System", w / 2, panelY + 26);

  const mode = getControlMode();
  const btnW = Math.min(panelW * 0.6, 320);
  const btnH = 48;
  const gap = 14;
  const bx = panelX + (panelW - btnW) / 2;
  const by = panelY + 70;

  const btnOne = { a: "modeOne", x: bx, y: by, w: btnW, h: btnH, hitMargin: 14 };
  const btnTwo = { a: "modeTwo", x: bx, y: by + btnH + gap, w: btnW, h: btnH, hitMargin: 14 };

  drawButton(ctx, btnOne, "1-Hand", { fill: mode === "oneHand" ? "rgba(164,255,153,0.25)" : "rgba(255,255,255,0.10)", r: 16 });
  drawButton(ctx, btnTwo, "2-Hand", { fill: mode === "twoHand" ? "rgba(164,255,153,0.25)" : "rgba(255,255,255,0.10)", r: 16 });
  pushBtn(btnOne);
  pushBtn(btnTwo);

  const btnBack = { a: "back", x: bx, y: by + (btnH + gap) * 2 + 18, w: btnW, h: 44, hitMargin: 14 };
  drawButton(ctx, btnBack, "Back", { fill: "rgba(255,255,255,0.10)", r: 16 });
  pushBtn(btnBack);

  ctx.restore();
}

export function handleSettingsClick(x, y, state) {
  let btn = null;
  for (let i = lastButtons.length - 1; i >= 0; i--) {
    const b = lastButtons[i];
    if (hit(b, x, y)) {
      btn = b;
      break;
    }
  }
  if (!btn) return null;

  if (btn.a === "modeOne") {
    setControlMode("oneHand");
    return "mode";
  }
  if (btn.a === "modeTwo") {
    setControlMode("twoHand");
    return "mode";
  }
  if (btn.a === "back") return "back";
  return null;
}
