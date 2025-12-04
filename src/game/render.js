import { HALF_WORLD } from "./enemies";

export function renderGame(ctx, state, viewW, viewH) {
  ctx.clearRect(0, 0, viewW, viewH);

  const cam = state.cam;

  // Соотношение сторон и масштаб камеры:
  //  - в портрете scale = 1 (как раньше)
  //  - в горизонтали scale ~0.75, чтобы видеть больше карты вокруг игрока
  const aspect = viewW / viewH;
  const isPhone = viewW < 900;
  const scale = isPhone ? 0.6 : aspect > 1 ? 0.75 : 1.0;

  function worldToScreen(x, y) {
    return {
      x: (x - cam.x) * scale + viewW / 2,
      y: (y - cam.y) * scale + viewH / 2,
    };
  }

  // фон + сетка
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.strokeStyle = "rgba(30, 64, 175, 0.25)";
  ctx.lineWidth = 1 * scale;
  const gridStep = 80;
  const startX = -HALF_WORLD;
  const startY = -HALF_WORLD;
  for (let gx = startX; gx <= HALF_WORLD; gx += gridStep) {
    const a = worldToScreen(gx, startY);
    const b = worldToScreen(gx, HALF_WORLD);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let gy = startY; gy <= HALF_WORLD; gy += gridStep) {
    const a = worldToScreen(startX, gy);
    const b = worldToScreen(HALF_WORLD, gy);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // пикапы
  for (const pk of state.pickups) {
    const s = worldToScreen(pk.x, pk.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, pk.r * scale, 0, Math.PI * 2);
    let color = "#a3e635"; // зелёный
    if (pk.type === "hp") color = "#ef4444";
    else if (pk.type === "hpMax") color = "#f97316";
    else if (pk.type === "hpBig") color = "#fef9c3";
    else if (pk.type === "xpBoost") color = "#22c55e";
    else if (pk.type === "immortal") color = "#22d3ee";
    else if (pk.type.startsWith("temp")) color = "#eab308";
    ctx.fillStyle = color;
    ctx.fill();
  }

  // лазерные лучи
  for (const beam of state.laserBeams) {
    const a = worldToScreen(beam.x1, beam.y1);
    const b = worldToScreen(beam.x2, beam.y2);
    ctx.save();
    ctx.globalAlpha = Math.max(beam.life / 0.08, 0);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
    ctx.lineWidth = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  // враги
  for (const e of state.enemies) {
    const s = worldToScreen(e.x, e.y);
    let color = "#ef4444"; // обычный
    if (e.typeKey === "fast") color = "#a855f7";
    else if (e.typeKey === "tank") color = "#7f1d1d";
    else if (e.typeKey === "shadow") color = "#020617";

    if (e.bossType) {
      if (e.bossType === "boss1") color = "#d4d4d8";
      else if (e.bossType === "boss2") color = "#a1a1aa";
      else if (e.bossType === "boss3") color = "#71717a";
      else if (e.bossType === "boss4") color = "#52525b";
      else if (e.bossType === "boss5") color = "#f9fafb";
    }

    ctx.beginPath();
    ctx.arc(s.x, s.y, e.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // HP bar
    const hpRatio = e.hp / e.maxHp;
    const barW = e.r * 2 * scale;
    const barH = 4 * scale;
    ctx.fillStyle = "#111827";
    ctx.fillRect(s.x - barW / 2, s.y - e.r * scale - 10 * scale, barW, barH);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      s.x - barW / 2,
      s.y - e.r * scale - 10 * scale,
      barW * hpRatio,
      barH
    );
  }

  // пули врагов
  for (const b of state.enemyBullets) {
    const s = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, b.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
  }

  // пули игрока
  for (const b of state.bullets) {
    const s = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, b.r * scale, 0, Math.PI * 2);

    let color = "#e5e7eb"; // обычные белые
    if (b.weaponKey === "rifle") color = "#60a5fa";
    else if (b.weaponKey === "shotgun") color = "#fb923c";
    else if (b.weaponKey === "rocket") color = "#f97373";

    if (b.isCrit) {
      color = "#facc15"; // золотые криты
    }

    ctx.fillStyle = color;
    ctx.fill();
  }

  // игрок
  const ps = worldToScreen(state.player.x, state.player.y);
  ctx.beginPath();
  ctx.arc(ps.x, ps.y, state.player.radius * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();

  // HUD
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "left";

  const p = state.player;
  const hpText = `HP: ${Math.round(p.hp)}/${Math.round(p.maxHp)}`;
  const xpText = `XP: ${Math.round(state.xp)}/${state.xpToNext}`;
  const lvlText = `LVL: ${state.level}`;
  const waveText = `Wave: ${state.wave}`;
  const timeText = `Time: ${state.elapsed.toFixed(1)}s`;
  const weaponText = `Weapon: ${state.weaponName}`;

  let y = 20;
  ctx.fillText(hpText, 20, y);
  y += 18;
  ctx.fillText(xpText, 20, y);
  y += 18;
  ctx.fillText(lvlText, 20, y);
  y += 18;
  ctx.fillText(waveText, 20, y);
  y += 18;
  ctx.fillText(timeText, 20, y);
  y += 18;
  ctx.fillText(weaponText, 20, y);

  // правый верх — статы
  ctx.textAlign = "right";
  let ry = 20;
  const rx = viewW - 20;

  const dmgMul = p.damageMul * p.baseDamageMul;
  const fireMul = p.fireRateMul * p.baseFireRateMul;
  const rangeMul = p.rangeMul;
  const magnet = Math.round(p.magnetRadius);
  const critChance = Math.round(p.critChance * 100);
  const critMult = p.critMult.toFixed(2);

  ctx.fillText(`DMG x${dmgMul.toFixed(2)}`, rx, ry);
  ry += 16;
  ctx.fillText(`FIRE x${fireMul.toFixed(2)}`, rx, ry);
  ry += 16;
  ctx.fillText(`RANGE x${rangeMul.toFixed(2)}`, rx, ry);
  ry += 16;
  ctx.fillText(`CRIT ${critChance}%`, rx, ry);
  ry += 16;
  ctx.fillText(`C.MULT x${critMult}`, rx, ry);
  ry += 16;
  ctx.fillText(`MAGNET ${magnet}`, rx, ry);
  ry += 16;

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

  // уведомления (центр экрана)
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