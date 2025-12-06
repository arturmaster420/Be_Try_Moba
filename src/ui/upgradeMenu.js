import { saveProgression } from "../core/progression.js";

let lastButtons = [];

export function renderUpgradeMenu(ctx, state) {
  const { canvas, progression, lastRunSummary, uiScale } = state;
  const w = canvas.width;
  const h = canvas.height;
  const s = uiScale || 1;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${28 * s}px sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText("YOU DIED", w / 2, h / 2 - 140 * s);

  ctx.font = `${16 * s}px sans-serif`;

  const runScore = lastRunSummary
    ? lastRunSummary.runScore
    : Math.floor(state.runScore);
  const totalScore = lastRunSummary
    ? lastRunSummary.totalScore
    : progression.totalScore;
  const gained = lastRunSummary ? lastRunSummary.gainedPoints : 0;

  ctx.fillText("Score this run: " + runScore, w / 2, h / 2 - 110 * s);
  ctx.fillText("Total Score: " + totalScore, w / 2, h / 2 - 90 * s);
  ctx.fillText("Upgrade Points earned: +" + gained, w / 2, h / 2 - 70 * s);
  ctx.fillText(
    "Available Points: " + progression.upgradePoints,
    w / 2,
    h / 2 - 50 * s
  );

  lastButtons = [];

  const limits = progression.limits;
  const items = [
    { key: "attackSpeed", label: "Attack Speed Limit", step: 1 },
    { key: "damage", label: "Damage Limit", step: 0.5 },
    { key: "moveSpeed", label: "Move Speed Limit", step: 1 },
    { key: "hp", label: "HP Limit", step: 0.5 },
    { key: "range", label: "Range Limit", step: 0.5 },
    { key: "laserOverheat", label: "Laser Overheat Limit", step: -0.2 },
    { key: "regen", label: "Regen Limit", step: 1 },
  ];

  const startY = h / 2 - 20 * s;
  const lineH = 28 * s;

  ctx.textAlign = "left";
  ctx.font = `${14 * s}px sans-serif`;
  ctx.shadowBlur = 4;

  items.forEach((item, idx) => {
    const y = startY + idx * lineH;
    const val = limits[item.key] || 0;

    const text =
      item.key === "laserOverheat"
        ? `${item.label}: ${val.toFixed(2)}`
        : item.key === "regen"
        ? `${item.label}: ${val.toFixed(1)} HP/s`
        : `${item.label}: ${val.toFixed(2)}%`;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, w / 2 - 180 * s, y);

    const btnW = 56 * s * (canvas.width < 768 ? 1.3 : 1.0);
    const btnH = 28 * s * (canvas.width < 768 ? 1.3 : 1.0);

    const btn = {
      x: w / 2 + 80 * s,
      y: y - btnH * 0.7,
      w: btnW,
      h: btnH,
      key: item.key,
      step: item.step,
      type: "upgrade",
    };

    ctx.shadowBlur = 0;
    ctx.fillStyle =
      progression.upgradePoints > 0 ? "#3cff9f" : "#555555";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.shadowBlur = 4;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText("+", btn.x + btn.w / 2, btn.y + btn.h * 0.7);

    lastButtons.push(btn);
  });

  const startBtnW = 220 * s * (canvas.width < 768 ? 1.2 : 1.0);
  const startBtnH = 48 * s * (canvas.width < 768 ? 1.2 : 1.0);
  const startBtn = {
    x: w / 2 - startBtnW / 2,
    y: h / 2 + 120 * s,
    w: startBtnW,
    h: startBtnH,
    type: "start",
  };

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#222222";
  ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);

  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText(
    "START NEXT RUN",
    startBtn.x + startBtn.w / 2,
    startBtn.y + startBtn.h * 0.65
  );

  lastButtons.push(startBtn);

  ctx.restore();
}

export function handleUpgradeClick(x, y, state) {
  const btn = lastButtons.find(
    (b) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  );
  if (!btn) return null;

  if (btn.type === "upgrade") {
    if (state.progression.upgradePoints <= 0) return null;

    const key = btn.key;
    const step = btn.step;

    state.progression.limits[key] =
      (state.progression.limits[key] || 0) + step;
    state.progression.upgradePoints -= 1;

    saveProgression(state.progression);
    return "upgrade";
  }

  if (btn.type === "start") {
    return "start";
  }

  return null;
}
