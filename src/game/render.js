
import { HALF_WORLD } from "./enemies";
import { PICKUP_TYPES } from "./pickups";
import { WEAPONS } from "./weapons";

export function renderGame(ctx, state, viewW, viewH) {
  if (!ctx) return;

  const cam = state.cam || { x: 0, y: 0 };
  const aspect = viewW / viewH;
  const scale = aspect > 1 ? 0.7 : 1.0;

  function worldToScreen(x, y) {
    return {
      x: (x - cam.x) * scale + viewW / 2,
      y: (y - cam.y) * scale + viewH / 2,
    };
  }

  ctx.clearRect(0, 0, viewW, viewH);

  // фон + сетка
  ctx.save();
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  const gridStep = 200;
  const startX = cam.x - (viewW / scale) / 2 - gridStep;
  const endX = cam.x + (viewW / scale) / 2 + gridStep;
  const startY = cam.y - (viewH / scale) / 2 - gridStep;
  const endY = cam.y + (viewH / scale) / 2 + gridStep;

  for (let gx = Math.floor(startX / gridStep) * gridStep; gx <= endX; gx += gridStep) {
    const s1 = worldToScreen(gx, startY);
    const s2 = worldToScreen(gx, endY);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }
  for (let gy = Math.floor(startY / gridStep) * gridStep; gy <= endY; gy += gridStep) {
    const s1 = worldToScreen(startX, gy);
    const s2 = worldToScreen(endX, gy);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }

  // границы мира
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;
  const corners = [
    worldToScreen(-HALF_WORLD, -HALF_WORLD),
    worldToScreen(HALF_WORLD, -HALF_WORLD),
    worldToScreen(HALF_WORLD, HALF_WORLD),
    worldToScreen(-HALF_WORLD, HALF_WORLD),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // пикапы
  for (const p of state.pickups) {
    const def = PICKUP_TYPES[p.type];
    if (!def) continue;
    const s = worldToScreen(p.x, p.y);
    ctx.beginPath();
    ctx.fillStyle = def.color || "#facc15";
    ctx.arc(s.x, s.y, def.radius || 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // враги
  for (const enemy of state.enemies) {
    const s = worldToScreen(enemy.x, enemy.y);
    ctx.beginPath();
    ctx.fillStyle = enemy.color || "#22c55e";
    ctx.arc(s.x, s.y, enemy.radius * scale, 0, Math.PI * 2);
    ctx.fill();

    // полоска HP
    const hpRatio = enemy.hp / enemy.maxHp;
    const barW = enemy.radius * 2 * scale;
    const barH = 4;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(s.x - barW / 2, s.y - enemy.radius * scale - 8, barW, barH);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(s.x - barW / 2, s.y - enemy.radius * scale - 8, barW * hpRatio, barH);
  }

  // пули
  for (const b of state.bullets) {
    const s = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.fillStyle = b.color || "#e5e7eb";
    const r = Math.max(3, (b.radius || 4) * scale); // чтобы не превращались в точки
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // лазерные лучи
  if (state.beams && state.beams.length > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (const beam of state.beams) {
      const s1 = worldToScreen(beam.x1, beam.y1);
      const s2 = worldToScreen(beam.x2, beam.y2);
      const alpha = Math.max(0, Math.min(1, beam.life / beam.maxLife));
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.lineWidth = 6 * scale;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // игрок
  const p = state.player;
  const ps = worldToScreen(p.x, p.y);
  ctx.beginPath();
  ctx.fillStyle = "#60a5fa";
  ctx.arc(ps.x, ps.y, p.radius * scale, 0, Math.PI * 2);
  ctx.fill();

  // радиус магнита
  ctx.beginPath();
  ctx.strokeStyle = "rgba(59,130,246,0.25)";
  ctx.lineWidth = 1.5;
  ctx.arc(ps.x, ps.y, p.magnetRadius * scale, 0, Math.PI * 2);
  ctx.stroke();

  // прицел по направлению стрельбы (если есть aim)
  const aim = state.lastAimDir;
  if (aim && (aim.x !== 0 || aim.y !== 0)) {
    const len = p.radius * 2;
    const ax = ps.x + aim.x * len;
    const ay = ps.y + aim.y * len;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ps.x, ps.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }

  ctx.restore();

  // --- UI поверх (полоски HP/XP, волна, уровень, оружие) ---

  // HP
  const uiPad = 16;
  const hpBarW = Math.min(260, viewW - uiPad * 2);
  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(uiPad, uiPad, hpBarW, 14);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(uiPad, uiPad, hpBarW * hpRatio, 14);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "10px system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText(`HP ${Math.round(p.hp)}/${p.maxHp}`, uiPad + 6, uiPad + 7);

  // XP
  const xpY = uiPad + 20;
  const xpBarW = hpBarW;
  const xpRatio = p.xp / p.xpToNext;
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(uiPad, xpY, xpBarW, 10);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(uiPad, xpY, xpBarW * xpRatio, 10);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "10px system-ui";
  ctx.fillText(`Lv.${p.level}`, uiPad + 6, xpY + 5);

  // волна
  ctx.textAlign = "right";
  ctx.fillText(`Wave ${state.wave}`, viewW - uiPad, uiPad + 7);
  ctx.textAlign = "left";

  // активное оружие
  const weapon = WEAPONS[state.currentWeapon] || WEAPONS.pistol;
  ctx.fillText(`Weapon: ${weapon.name}`, uiPad, xpY + 16);

  // сообщения (level up / unlock)
  if (state.messages && state.messages.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "bold 16px system-ui";
    let y = uiPad + 60;
    for (const msg of state.messages) {
      const alpha = Math.max(0, Math.min(1, msg.ttl / msg.maxTtl));
      ctx.fillStyle = `rgba(244,244,245,${alpha})`;
      ctx.fillText(msg.text, viewW / 2, y);
      y += 20;
    }
    ctx.textAlign = "left";
  }
}
