import { saveProgression } from "../core/progression.js";

let lastButtons = [];

export function renderUpgradeMenu(ctx, state) {
  const { canvas, progression, lastRunSummary } = state;
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText("YOU DIED", w / 2, h / 2 - 140);

  ctx.font = "16px sans-serif";

  const runScore = lastRunSummary
    ? lastRunSummary.runScore
    : Math.floor(state.runScore);
  const totalScore = lastRunSummary
    ? lastRunSummary.totalScore
    : progression.totalScore;
  const gained = lastRunSummary ? lastRunSummary.gainedPoints : 0;

  ctx.fillText("Score this run: " + runScore, w / 2, h / 2 - 110);
  ctx.fillText("Total Score: " + totalScore, w / 2, h / 2 - 90);
  ctx.fillText("Upgrade Points earned: +" + gained, w / 2, h / 2 - 70);
  ctx.fillText(
    "Available Points: " + progression.upgradePoints,
    w / 2,
    h / 2 - 50
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
    { key: "hpRegen", label: "HP Regen Limit (HP/s)", step: 1 },
  ];

  const startY = h / 2 - 20;
  const lineH = 28;

  ctx.textAlign = "left";
  ctx.font = "14px sans-serif";
  ctx.shadowBlur = 4;

  items.forEach((item, idx) => {
    const y = startY + idx * lineH;
    const val = limits[item.key] || 0;

    const text =
      item.key === "laserOverheat"
        ? `${item.label}: ${val.toFixed(2)}`
        : `${item.label}: ${val.toFixed(2)}%`;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, w / 2 - 180, y);

    const btn = {
      x: w / 2 + 80,
      y: y - 16,
      w: 40,
      h: 24,
      key: item.key,
      step: item.step,
      type: "upgrade",
    };

    ctx.shadowBlur = 0;
    ctx.fillStyle =
      progression.upgradePoints > 0 ? "#3cff9f" : "#555555";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("+", btn.x + btn.w / 2, btn.y + 17);

    lastButtons.push(btn);
  });

  const startBtn = {
    x: w / 2 - 90,
    y: h / 2 + 120,
    w: 180,
    h: 40,
    type: "start",
  };

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#222222";
  ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);

  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(
    "START NEXT RUN",
    startBtn.x + startBtn.w / 2,
    startBtn.y + 25
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
