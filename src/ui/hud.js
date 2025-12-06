import { getZone } from "../world/zoneController.js";

export function renderHUD(ctx, state) {
  const { canvas, player, progression, runScore, buffs } = state;
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();

  // Simple responsive scaling: smaller UI on small screens (mobile)
  const minSide = Math.min(w, h);
  const uiScale = minSide < 700 ? 0.8 : 1.0;

  ctx.scale(uiScale, uiScale);

  const invScale = 1 / uiScale;
  const scaledW = w * invScale;
  const scaledH = h * invScale;

  // Main HUD container (bottom-left)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(16, scaledH - 96, 260, 80);

  const hpRatio = player.hp / player.maxHP;
  ctx.fillStyle = "#ff4b6e";
  ctx.fillRect(24, scaledH - 88, 200 * hpRatio, 16);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(24, scaledH - 88, 200, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.fillText(
    "HP: " + Math.max(0, Math.round(player.hp)) + " / " + Math.round(player.maxHP),
    24,
    scaledH - 92
  );

  // XP bar
  const xpRatio = player.xp / player.xpToNext();
  ctx.fillStyle = "#3bd1ff";
  ctx.fillRect(24, scaledH - 64, 200 * xpRatio, 10);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(24, scaledH - 64, 200, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Lv " + player.level, 232, scaledH - 55);

  // Zone + score
  const zone = getZone(player.y);
  ctx.fillText("Zone " + zone, 24, scaledH - 40);
  ctx.fillText("Score: " + Math.floor(runScore || 0), 24, scaledH - 24);

  // Weapon stage indicator
  ctx.fillText("Weapon Stage: " + player.weaponStage, 160, scaledH - 40);

  // Active buffs row
  let bx = scaledW - 32;
  const by = scaledH - 40;
  for (const b of buffs) {
    ctx.fillStyle = getBuffColor(b.type);
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fill();
    bx -= 26;
  }

  // === Pause button (top-right corner, screen-space) ===
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
    // Pause icon (two bars)
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
