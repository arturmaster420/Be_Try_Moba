import { saveProgression, computeTotalMetaPoints, getMaxPointsForStat, META_TIERS, getMetaTierForPoints } from "../core/progression.js";

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

  
const limits = progression.limits || {};
const metaTier = progression.metaTier || 1;
const totalMetaPoints = computeTotalMetaPoints(limits);

let nextTierText = "Max Tier reached";
const tierIndex = META_TIERS.findIndex((t) => t.id === metaTier);
if (tierIndex >= 0 && tierIndex < META_TIERS.length - 1) {
  const nextTier = META_TIERS[tierIndex + 1];
  nextTierText =
    "Next Tier at: " + nextTier.unlockTotalPoints + " points";
}

ctx.fillText(
  "Meta Tier: " +
    metaTier +
    " (Total Points: " +
    totalMetaPoints +
    ")",
  w / 2,
  h / 2 - 30
);
ctx.fillText(nextTierText, w / 2, h / 2 - 10);

lastButtons = [];


  const items = [
    { key: "attackSpeed", label: "Attack Speed Bonus", step: 1 },
    { key: "damage", label: "Damage Bonus", step: 1 },
    { key: "critChance", label: "Crit Chance Bonus (Tier 5)", step: 1 },
    { key: "critDamage", label: "Crit Damage Bonus (Tier 5)", step: 1 },
    { key: "moveSpeed", label: "Move Speed Bonus", step: 1 },
    { key: "hp", label: "Max HP Bonus", step: 1 },
    { key: "range", label: "Range Bonus", step: 1 },
    { key: "hpRegen", label: "HP Regen", step: 1 },
    { key: "xpGain", label: "XP Gain Bonus", step: 1 },
    { key: "score", label: "Score Bonus", step: 1 },
    { key: "pickupRadius", label: "Pickup Radius Bonus", step: 1 },
  ];

  const startY = h / 2 - 20;
  const lineH = 28;

  ctx.textAlign = "left";
  ctx.font = "14px sans-serif";
  ctx.shadowBlur = 4;

  items.forEach((item, idx) => {
    const y = startY + idx * lineH;
    const val = limits[item.key] ?? 0;
    let textValue = "";

    if (item.key === "hpRegen") {
      const regenPerSec = (val * 0.25).toFixed(2);
      textValue = `${item.label}: ${regenPerSec} HP/s`;
    } else if (item.key === "attackSpeed") {
      const percent = (val * 2).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "damage") {
      const percent = (val * 2).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "moveSpeed") {
      const percent = (val * 1).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "range") {
      const percent = (val * 2).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "xpGain") {
      const percent = (val * 0.5).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "score") {
      const percent = (val * 2).toFixed(2);
      textValue = `${item.label}: +${percent}%`;
    } else if (item.key === "pickupRadius") {
      const radius = (val * 1).toFixed(2);
      textValue = `${item.label}: +${radius}`;
    } else if (item.key === "critChance") {
      const percent = (val * 0.1).toFixed(2);
      if (metaTier < 5) {
        textValue = `${item.label}: Locked (Tier 5 required)`;
      } else {
        textValue = `${item.label}: +${percent}%`;
      }
    } else if (item.key === "critDamage") {
      const percent = (val * 1).toFixed(2);
      if (metaTier < 5) {
        textValue = `${item.label}: Locked (Tier 5 required)`;
      } else {
        textValue = `${item.label}: +${percent}%`;
      }
    } else {
      textValue = `${item.label}: ${val.toFixed(2)}`;
    }

    const text = textValue;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, w / 2 - 220, y);

    const btn = {
      x: w / 2 + 80,
      y: y - 16,
      w: 40,
      h: 24,
      key: item.key,
      step: item.step,
      type: "upgrade",
    };

    const isCritStat = item.key === "critChance" || item.key === "critDamage";
    const tierAllowsCrit = metaTier >= 5;
    const maxForStat = getMaxPointsForStat(metaTier, item.key);
    const isCapped = Number.isFinite(maxForStat) && val >= maxForStat;
    const isLockedByTier = isCritStat && !tierAllowsCrit;

    const canUpgrade =
      progression.upgradePoints > 0 && !isCapped && !isLockedByTier;

    ctx.shadowBlur = 0;
    ctx.fillStyle = canUpgrade ? "#3cff9f" : "#555555";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("+", btn.x + btn.w / 2, btn.y + 17);

    lastButtons.push(btn);
  });

  // Place START button below all upgrade rows
  const lastItemY = startY + items.length * lineH;
  const startBtn = {
    x: w / 2 - 110,
    y: lastItemY + 40,
    w: 220,
    h: 44,
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

    const progression = state.progression;
    const limits = progression.limits || {};
    const metaTier = progression.metaTier || 1;
    const maxForStat = getMaxPointsForStat(metaTier, key);
    const isCritStat = key === "critChance" || key === "critDamage";

    // Crit stats are locked before Tier 5
    if (isCritStat && metaTier < 5) {
      return null;
    }

    const currentVal = limits[key] || 0;
    if (Number.isFinite(maxForStat) && currentVal >= maxForStat) {
      return null;
    }

    const newVal = currentVal + step;
    if (Number.isFinite(maxForStat) && newVal > maxForStat) {
      return null;
    }

    limits[key] = newVal;
    progression.limits = limits;
    progression.upgradePoints -= 1;

    // Recalculate Tier after spending a point
    const totalPoints = computeTotalMetaPoints(limits);
    progression.metaTier = getMetaTierForPoints(totalPoints);

    saveProgression(progression);
    return "upgrade";
  }

  if (btn.type === "start") {
    return "start";
  }

  return null;
}
