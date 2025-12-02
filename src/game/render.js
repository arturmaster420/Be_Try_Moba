import { PICKUP_TYPES } from "./pickups";

export function renderGame(state, ctx) {
  const { w, h, cam, player: p } = state;
  ctx.clearRect(0, 0, w, h);

  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#020617");
  grd.addColorStop(1, "#020617");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // сетка
  ctx.save();
  const gridSize = 80;
  const parallax = 0.3;
  const offsetX =
    ((-cam.x * parallax) % gridSize) + ((w / 2) % gridSize);
  const offsetY =
    ((-cam.y * parallax) % gridSize) + ((h * 0.6) % gridSize);
  ctx.strokeStyle = "rgba(148,163,184,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -gridSize; x < w + gridSize; x += gridSize) {
    ctx.moveTo(x + offsetX, 0);
    ctx.lineTo(x + offsetX, h);
  }
  for (let y = -gridSize; y < h + gridSize; y += gridSize) {
    ctx.moveTo(0, y + offsetY);
    ctx.lineTo(w, y + offsetY);
  }
  ctx.stroke();
  ctx.restore();

  function worldToScreen(wx, wy) {
    return {
      x: wx - cam.x + w / 2,
      // игрок чуть ниже центра (чтобы "видеть вперёд")
      y: wy - cam.y + h * 0.6,
    };
  }

  // пикапы
  for (const pk of state.pickups) {
    const pos = worldToScreen(pk.x, pk.y);
    const def = PICKUP_TYPES[pk.type];
    ctx.beginPath();
    ctx.fillStyle = def ? def.color : "#e5e7eb";
    ctx.arc(pos.x, pos.y, pk.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // враги
  for (const e of state.enemies) {
    const pos = worldToScreen(e.x, e.y);
    const color = e.bossType ? "#f97316" : "#f97373";
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.arc(pos.x, pos.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // пули врагов
  for (const b of state.enemyBullets) {
    const pos = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.fillStyle = "#f97373";
    ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // пули игрока
  for (const b of state.bullets) {
    const pos = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.fillStyle = "#e5e7eb";
    ctx.shadowColor = "#e5e7eb";
    ctx.shadowBlur = 8;
    ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // игрок
  const pPos = worldToScreen(p.x, p.y);
  ctx.beginPath();
  ctx.fillStyle = "#38bdf8";
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;
  ctx.arc(pPos.x, pPos.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // HUD слева
  ctx.fillStyle = "#e5e7eb";
  ctx.font =
    "14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "left";

  ctx.fillText(`HP: ${p.hp.toFixed(0)} / ${p.maxHp}`, 16, 24);
  ctx.fillText(
    `XP: ${state.xp.toFixed(0)} / ${state.xpToNext}`,
    16,
    44
  );
  ctx.fillText(`LVL: ${state.level}`, 16, 64);
  ctx.fillText(`Wave: ${state.wave}`, 16, 84);
  ctx.fillText(`Time: ${state.elapsed.toFixed(1)}s`, 16, 104);
  ctx.fillText(`Weapon: ${state.weaponName}`, 16, 124);

  // HUD справа (бонусы)
  ctx.textAlign = "right";
  ctx.fillStyle = "#e5e7eb";
  let ry = 24;

  ctx.fillText(`DMG x${p.damageMul.toFixed(2)}`, w - 16, ry);
  ry += 18;
  ctx.fillText(`FIRE x${p.fireRateMul.toFixed(2)}`, w - 16, ry);
  ry += 18;
  ctx.fillText(`RANGE x${p.rangeMul.toFixed(2)}`, w - 16, ry);
  ry += 18;
  ctx.fillText(
    `CRIT ${Math.round(p.critChance * 100)}%`,
    w - 16,
    ry
  );
  ry += 18;
  ctx.fillText(
    `C.MULT x${p.critMult.toFixed(2)}`,
    w - 16,
    ry
  );
  ry += 18;
  ctx.fillText(
    `MAGNET ${Math.round(p.magnetRadius)}`,
    w - 16,
    ry
  );
  ry += 18;
  ctx.fillText(`SPD ${Math.round(p.speed)}`, w - 16, ry);
  ry += 18;

  if (state.tempBuffs.xpBoost > 0) {
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`XP BOOST x200%`, w - 16, ry);
    ry += 18;
  }

  // DMG/SPD BUFF + n%
  const dmgBuff =
    state.tempBuffs.tempDamage > 0
      ? Math.round((1.5 - 1) * 100)
      : 0;
  const spdBuff =
    state.tempBuffs.tempFireRate > 0
      ? Math.round((1.6 - 1) * 100)
      : 0;

  if (dmgBuff > 0) {
    ctx.fillStyle = "#e11d48";
    ctx.fillText(`DMG BUFF +${dmgBuff}%`, w - 16, ry);
    ry += 18;
  }
  if (spdBuff > 0) {
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`SPD BUFF +${spdBuff}%`, w - 16, ry);
    ry += 18;
  }

  ctx.textAlign = "left";
}
