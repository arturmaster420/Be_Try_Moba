import { getZone } from "../world/zoneController.js";

export function renderHUD(ctx, state) {
  const { canvas, player, progression, runScore, buffs } = state;
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(16, h - 96, 260, 80);

  const hpRatio = player.hp / player.maxHP;
  ctx.fillStyle = "#ff4b6e";
  ctx.fillRect(24, h - 88, 200 * hpRatio, 16);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(24, h - 88, 200, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    "HP " + Math.round(player.hp) + "/" + Math.round(player.maxHP),
    28,
    h - 76
  );

  const xpRatio = Math.min(1, player.xp / player.xpToNext());
  ctx.fillStyle = "#4bd0ff";
  ctx.fillRect(24, h - 64, 200 * xpRatio, 10);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(24, h - 64, 200, 10);

  ctx.fillStyle = "#ffffff";
  ctx.fillText("LVL " + player.level, 24, h - 50);

  const zone = getZone(player.y);
  ctx.fillText("Zone " + zone, 24, h - 34);

  const stageName =
    player.weaponStage === 1
      ? "Bullets"
      : player.weaponStage === 2
      ? "Rockets"
      : player.weaponStage === 3
      ? "Laser"
      : "Chain Lightning";

  ctx.fillText("Weapon: " + stageName, 24, 32);

  ctx.textAlign = "right";
  ctx.fillText("Score: " + Math.floor(runScore), w - 24, 32);
  ctx.fillText("Total: " + (progression.totalScore || 0), w - 24, 48);

  ctx.textAlign = "left";
  let bx = 24;
  const by = 44;
  for (const b of buffs || []) {
    ctx.fillStyle = buffColor(b.type);
    ctx.fillRect(bx, by, 12, 12);
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(bx, by, 12, 12);
    bx += 16;
  }

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
