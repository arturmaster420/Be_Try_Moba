import { getZone } from "../world/zoneController.js";

export function renderHUD(ctx, state) {
  const canvas = state.canvas;
  const player = state.player;
  const progression = state.progression;
  const runScore = state.runScore || 0;
  const buffs = state.buffs || [];

  const w = canvas.width;
  const h = canvas.height;

  ctx.save();

  // Simple responsive scaling: smaller HUD on small screens
  const minSide = Math.min(w, h);
  const uiScale = minSide < 700 ? 0.7 : 1.0;
  ctx.scale(uiScale, uiScale);

  const invScale = 1 / uiScale;
  const scaledW = w * invScale;
  const scaledH = h * invScale;

  // HUD panel (top-left)
  const panelX = 16;
  const panelY = 16;
  const panelW = 260;
  const panelH = 96;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // HP bar
  const hpRatio = player.hp / player.maxHP;
  const hpBarX = panelX + 8;
  const hpBarY = panelY + 8;
  const hpBarW = 200;
  const hpBarH = 16;

  ctx.fillStyle = "#ff4b6e";
  ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    "HP: " + Math.max(0, Math.round(player.hp)) + " / " + Math.round(player.maxHP),
    hpBarX,
    hpBarY - 4
  );

  // XP bar
  const xpRatio = player.xp / player.xpToNext();
  const xpBarY = hpBarY + 24;
  ctx.fillStyle = "#3bd1ff";
  ctx.fillRect(hpBarX, xpBarY, hpBarW * xpRatio, 10);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(hpBarX, xpBarY, hpBarW, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Lv " + player.level, hpBarX + 208, xpBarY + 10);

  // Zone & score & regen & weapon stage
  const zone = getZone(player.y);
  const textRow1Y = xpBarY + 20;
  const textRow2Y = textRow1Y + 16;

  ctx.fillText("Zone " + zone, hpBarX, textRow1Y);
  ctx.fillText("Weapon Stage: " + player.weaponStage, hpBarX + 120, textRow1Y);

  ctx.fillText("Score: " + Math.floor(runScore), hpBarX, textRow2Y);

  const regenPerSec = player.metaHpRegen || 0;
  if (regenPerSec > 0) {
    ctx.fillText(
      "HP Regen: " + regenPerSec.toFixed(2) + " HP/s",
      hpBarX + 120,
      textRow2Y
    );
  }

// Buff icons row (right-bottom)
  let bx = scaledW - 32;
  const by = scaledH - 40;
  for (let i = 0; i < buffs.length; i++) {
    const b = buffs[i];
    ctx.fillStyle = getBuffColor(b.type);
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fill();
    bx -= 26;
  }

  // Pause button (top-right)
  const btnSize = 40;
  const margin = 16;
  const btnX = scaledW - btnSize - margin;
  const btnY = margin;

  ctx.fillStyle = state.paused ? "rgba(255,80,80,0.9)" : "rgba(0,0,0,0.6)";
  ctx.fillRect(btnX, btnY, btnSize, btnSize);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(btnX, btnY, btnSize, btnSize);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (state.paused) {
    ctx.fillText("▶", btnX + btnSize / 2, btnY + btnSize / 2 + 1);
  } else {
    const barW = 6;
    const gap = 6;
    const centerX = btnX + btnSize / 2;
    const topY = btnY + 10;
    const bottomY = btnY + btnSize - 10;
    ctx.beginPath();
    ctx.moveTo(centerX - gap / 2 - barW, topY);
    ctx.lineTo(centerX - gap / 2 - barW, bottomY);
    ctx.moveTo(centerX + gap / 2 + barW, topY);
    ctx.lineTo(centerX + gap / 2 + barW, bottomY);
    ctx.stroke();
  }

  // Save pause button rect in original screen coordinates
  state._pauseButtonRect = {
    x: btnX * uiScale,
    y: btnY * uiScale,
    w: btnSize * uiScale,
    h: btnSize * uiScale,
  };

  ctx.restore();
}

function getBuffColor(type) {
  switch (type) {
    case "damage":
      return "#ff4b7a";
    case "attackSpeed":
      return "#ffdd57";
    case "moveSpeed":
      return "#57ff9b";
    case "regen":
      return "#57c8ff";
    case "shield":
      return "#b857ff";
    case "ghost":
      return "#ffffff";
    default:
      return "#aaaaaa";
  }
}