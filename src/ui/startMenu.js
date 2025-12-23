import { saveProgression, getStartLevel } from "../core/progression.js";
import { getControlMode, setControlMode } from "../core/mouseController.js";

let lastButtons = [];

function hit(btn, x, y) {
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.strokeRect(x, y, w, h);
}

function drawButton(ctx, btn, label, subLabel) {
  ctx.fillStyle = btn.fill || "#3cff9f";
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = btn.font || "18px sans-serif";
  ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + (subLabel ? -8 : 0));
  if (subLabel) {
    ctx.font = "12px sans-serif";
    ctx.fillText(subLabel, btn.x + btn.w / 2, btn.y + btn.h / 2 + 14);
  }
}

export function renderStartMenu(ctx, state) {
  const w = state.canvas.width;
  const h = state.canvas.height;
  const maxDim = Math.max(w, h);
  const isMobile = maxDim < 900;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dim overlay
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, h);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = (isMobile ? 34 : 44) + "px sans-serif";
  ctx.fillText("Try to Be", w / 2, h * 0.08);
  ctx.font = (isMobile ? 13 : 15) + "px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Be_Try_Moba NEXT SOLO", w / 2, h * 0.08 + (isMobile ? 40 : 50));

  const panelW = Math.min(w * 0.82, 520);
  const panelH = Math.min(h * 0.58, 420);
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.18;

  drawPanel(ctx, panelX, panelY, panelW, panelH);

  // Character window (simple)
  const charX = panelX + 20;
  const charY = panelY + 20;
  const charW = panelW * 0.38;
  const charH = 150;
  drawPanel(ctx, charX, charY, charW, charH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Character", charX + 10, charY + 10);

  // Draw a simple "player" avatar
  const cx = charX + charW / 2;
  const cy = charY + 90;
  ctx.beginPath();
  ctx.fillStyle = "#8fe3ff";
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 36, cy - 8);
  ctx.stroke();

  // Nickname panel
  const nickX = charX;
  const nickY = charY + charH + 14;
  const nickW = charW;
  const nickH = 92;
  drawPanel(ctx, nickX, nickY, nickW, nickH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.fillText("Nickname", nickX + 10, nickY + 10);

  const nick = (state.progression && typeof state.progression.nickname === "string" && state.progression.nickname.trim().length)
    ? state.progression.nickname.trim().slice(0, 16)
    : "Player";
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#3cff9f";
  ctx.fillText(nick, nickX + 10, nickY + 36);

  // Edit nick button
  lastButtons = [];
  const editBtn = {
    type: "editNick",
    x: nickX + 10,
    y: nickY + 58,
    w: nickW - 20,
    h: 26,
    fill: "#ffdd57",
    font: "14px sans-serif",
  };
  drawButton(ctx, editBtn, "Edit", "");
  lastButtons.push(editBtn);

  // Info panel (right side)
  const infoX = panelX + panelW * 0.44;
  const infoY = panelY + 20;
  const infoW = panelW * 0.52 - 20;
  const infoH = 140;
  drawPanel(ctx, infoX, infoY, infoW, infoH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.fillText("Profile", infoX + 10, infoY + 10);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const rTier = state.progression?.resurrectedTier || 1;
  const startLevel = getStartLevel(state.progression);
  const mode = getControlMode ? getControlMode() : "oneHand";
  const lines = [
    `R-Tier: ${rTier} / 15`,
    `Start level: ${startLevel}`,
    `Control: ${mode === "oneHand" ? "1-Hand" : "2-Hand"}`,
  ];
  let ty = infoY + 44;
  for (const s of lines) {
    ctx.fillText(s, infoX + 10, ty);
    ty += 20;
  }

  // Main buttons
  const btnW = infoW;
  const btnH = isMobile ? 50 : 56;
  const btnX = infoX;
  const btnY0 = infoY + infoH + 16;
  const gap = 12;

  const btnStart = { type: "start", x: btnX, y: btnY0, w: btnW, h: btnH, fill: "#3cff9f" };
  const btnStats = { type: "stats", x: btnX, y: btnY0 + btnH + gap, w: btnW, h: btnH, fill: "#8fe3ff" };
  const btnSettings = { type: "settings", x: btnX, y: btnY0 + (btnH + gap) * 2, w: btnW, h: btnH, fill: "#ffdd57" };

  drawButton(ctx, btnStart, "Start", "Try to Be");
  drawButton(ctx, btnStats, "Stats & Up", "");
  drawButton(ctx, btnSettings, "Settings", "");

  lastButtons.push(btnStart, btnStats, btnSettings);

  ctx.restore();
}

export function handleStartMenuClick(x, y, state) {
  const btn = lastButtons.find((b) => hit(b, x, y));
  if (!btn) return null;

  if (btn.type === "editNick") {
    const cur = (state.progression && typeof state.progression.nickname === "string")
      ? state.progression.nickname
      : "Player";
    const v = prompt("Enter nickname (max 16)", cur);
    if (typeof v === "string") {
      const next = v.trim().slice(0, 16) || "Player";
      state.progression.nickname = next;
      saveProgression(state.progression);
    }
    return "editNick";
  }

  if (btn.type === "start") return "start";
  if (btn.type === "stats") return "stats";
  if (btn.type === "settings") return "settings";

  return null;
}

export function renderSettingsMenu(ctx, state) {
  const w = state.canvas.width;
  const h = state.canvas.height;
  const maxDim = Math.max(w, h);
  const isMobile = maxDim < 900;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.min(w * 0.82, 560);
  const panelH = Math.min(h * 0.55, 360);
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.22;
  drawPanel(ctx, panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = (isMobile ? 28 : 34) + "px sans-serif";
  ctx.fillText("Settings", w / 2, panelY - (isMobile ? 48 : 60));

  // Control system (same idea as pause overlay)
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Control System", panelX + panelW / 2, panelY + 16);

  const btnW = panelW * 0.42;
  const btnH = 44;
  const gap = 14;
  const btnY = panelY + 70;
  const btnX1 = panelX + panelW * 0.5 - btnW - gap * 0.5;
  const btnX2 = panelX + panelW * 0.5 + gap * 0.5;

  const currentMode = getControlMode ? getControlMode() : "oneHand";
  function modeBtn(x, mode, label) {
    const isActive = currentMode === mode;
    return {
      type: "mode",
      mode,
      x,
      y: btnY,
      w: btnW,
      h: btnH,
      fill: isActive ? "#3cff9f" : "#777777",
      font: "18px sans-serif",
    };
  }

  lastButtons = [];
  const b1 = modeBtn(btnX1, "oneHand", "1-Hand");
  const b2 = modeBtn(btnX2, "twoHand", "2-Hand");
  drawButton(ctx, b1, "1-Hand", "");
  drawButton(ctx, b2, "2-Hand", "");
  lastButtons.push(b1, b2);

  // Back
  const backBtn = {
    type: "back",
    x: panelX + panelW * 0.3,
    y: panelY + panelH - 70,
    w: panelW * 0.4,
    h: 52,
    fill: "#ffdd57",
  };
  drawButton(ctx, backBtn, "Back", "");
  lastButtons.push(backBtn);

  ctx.restore();
}

export function handleSettingsClick(x, y, state) {
  const btn = lastButtons.find((b) => hit(b, x, y));
  if (!btn) return null;

  if (btn.type === "mode") {
    setControlMode(btn.mode);
    return "mode";
  }
  if (btn.type === "back") return "back";
  return null;
}
