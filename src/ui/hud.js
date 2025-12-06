import { getZone } from "../world/zoneController.js";

export function renderHUD(ctx, state) {
  const { canvas, player, progression, runScore, buffs, uiScale } = state;
  const w = canvas.width;
  const h = canvas.height;
  const s = uiScale || 1;

  ctx.save();

  const panelX = 16 * s;
  const panelY = h - 96 * s;
  const panelW = 260 * s;
  const panelH = 80 * s;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(panelX, panelY, panelW, panelH);

  const hpRatio = player.hp / player.maxHP;
  const hpX = 24 * s;
  const hpY = h - 88 * s;
  const hpW = 200 * s;
  const hpH = 16 * s;

  ctx.fillStyle = "#ff4b6e";
  ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(hpX, hpY, hpW, hpH);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${12 * s}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(
    "HP " + Math.round(player.hp) + "/" + Math.round(player.maxHP),
    hpX + 4 * s,
    hpY + 12 * s
  );

  const xpRatio = Math.min(1, player.xp / player.xpToNext());
  const xpX = 24 * s;
  const xpY = h - 64 * s;
  const xpW = 200 * s;
  const xpH = 10 * s;

  ctx.fillStyle = "#4bd0ff";
  ctx.fillRect(xpX, xpY, xpW * xpRatio, xpH);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(xpX, xpY, xpW, xpH);

  ctx.fillStyle = "#ffffff";
  ctx.fillText("LVL " + player.level, 24 * s, h - 50 * s);

  const zone = getZone(player.y);
  ctx.fillText("Zone " + zone, 24 * s, h - 34 * s);

  const stageName =
    player.weaponStage === 1
      ? "Bullets"
      : player.weaponStage === 2
      ? "Rockets"
      : player.weaponStage === 3
      ? "Laser"
      : "Chain Lightning";

  ctx.fillText("Weapon: " + stageName, 24 * s, 32 * s);

  ctx.textAlign = "right";
  ctx.fillText("Score: " + Math.floor(runScore), w - 24 * s, 32 * s);
  ctx.fillText("Total: " + (progression.totalScore || 0), w - 24 * s, 48 * s);

  ctx.textAlign = "left";
  let bx = 24 * s;
  const by = 44 * s;
  for (const b of buffs || []) {
    ctx.fillStyle = buffColor(b.type);
    ctx.fillRect(bx, by, 12 * s, 12 * s);
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(bx, by, 12 * s, 12 * s);
    bx += 16 * s;
  }

  const mobileBoost = canvas.width < 768 ? 1.3 : 1.0;
  const btnSize = 32 * s * mobileBoost;
  const margin = 16 * s;
  const px = w - margin - btnSize;
  const py = margin;
  state.pauseButtonRect = { x: px, y: py, w: btnSize, h: btnSize };

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(px, py, btnSize, btnSize);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, btnSize, btnSize);

  ctx.fillStyle = "#ffffff";
  const barW = btnSize * 0.22;
  const barH = btnSize * 0.6;
  const gap = btnSize * 0.16;
  const barY = py + (btnSize - barH) / 2;
  ctx.fillRect(px + gap, barY, barW, barH);
  ctx.fillRect(px + gap + barW + gap, barY, barW, barH);

  ctx.restore();
}

function buffColor(type) {
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
