import { HALF_WORLD } from "./enemies";

export function renderGame(ctx, state, viewW, viewH) {
  ctx.clearRect(0, 0, viewW, viewH);

  const cam = state.cam;

  // Масштаб камеры
  const aspect = viewW / viewH;
  const scale = aspect > 1 ? 0.75 : 1.0;

  function worldToScreen(x, y) {
    return {
      x: (x - cam.x) * scale + viewW / 2,
      y: (y - cam.y) * scale + viewH / 2,
    };
  }

  // === Пули ===
  for (const b of state.bullets) {
    const p = worldToScreen(b.x, b.y);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }

  // === Лазерные лучи (если есть) ===
  if (state.laserBeams && state.laserBeams.length) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6 * scale;

    for (const beam of state.laserBeams) {
      const a = worldToScreen(beam.x1, beam.y1);
      const b = worldToScreen(beam.x2, beam.y2);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // === Враги ===
  for (const e of state.enemies) {
    const p = worldToScreen(e.x, e.y);
    ctx.fillStyle = e.isBoss ? "#ccc" : "#e74c3c";

    const r = (e.radius || 14) * scale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    if (e.maxHp > 0) {
      const w = 28 * scale;
      const h = 4 * scale;
      ctx.fillStyle = "#2ecc71";
      const ratio = e.hp / e.maxHp;
      ctx.fillRect(p.x - w / 2, p.y - r - 8, w * ratio, h);
    }
  }

  // === Игрок ===
  const pc = worldToScreen(state.player.x, state.player.y);
  ctx.fillStyle = "#5bc0ff";
  ctx.beginPath();
  ctx.arc(pc.x, pc.y, 20 * scale, 0, Math.PI * 2);
  ctx.fill();

  // === UI ===
  ctx.textAlign = "left";
  ctx.font = "16px system-ui, sans-serif";
  let rx = 20;
  let ry = 40;

  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`HP: ${Math.floor(state.player.hp)}/${state.player.maxHp}`, rx, ry);
  ry += 16;

  ctx.fillText(`XP: ${state.xp}`, rx, ry);
  ry += 16;

  ctx.fillText(`LVL: ${state.level}`, rx, ry);
  ry += 16;

  ctx.fillText(`Wave: ${state.wave}`, rx, ry);
  ry += 16;

  ctx.fillText(`Time: ${state.time.toFixed(1)}`, rx, ry);
  ry += 16;

  ctx.fillText(`Weapon: ${state.weaponName}`, rx, ry);
  ry += 20;

  // === TEMP BUFFS ===
  if (state.tempBuffs.xpBoost > 0) {
    ctx.fillText(
      `XP BOOST x200% (${Math.ceil(state.tempBuffs.xpBoost)}s)`,
      rx,
      ry
    );
    ry += 16;
  }

  if (state.tempBuffs.tempDamage > 0) {
    ctx.fillText(`DMG BUFF +n%`, rx, ry);
    ry += 16;
  }

  if (state.tempBuffs.tempFireRate > 0) {
    ctx.fillText(`FIRE BUFF +n%`, rx, ry);
    ry += 16;
  }

  if (state.tempBuffs.tempRange > 0) {
    ctx.fillText(`RANGE BUFF +n%`, rx, ry);
    ry += 16;
  }

  // === Уведомления (центр экрана) ===
  if (state.notifications && state.notifications.length) {
    ctx.textAlign = "center";
    ctx.font = "18px system-ui, sans-serif";

    let ny = 60;
    for (const n of state.notifications) {
      const alpha = Math.max(Math.min(n.t / 2, 1), 0);
      ctx.fillStyle = `rgba(248, 250, 252, ${alpha})`;
      ctx.fillText(n.text, viewW / 2, ny);
      ny += 22;
    }
  }
}
