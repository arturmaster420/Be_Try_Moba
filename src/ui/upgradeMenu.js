import {
  saveProgression,
  computeTotalMetaPoints,
  getMaxPointsForStat,
  UPGRADE_CATEGORIES_BY_RTIER,
  getTotalMaxPointsForTier,
} from "../core/progression.js";

let lastButtons = [];

const ALL_ITEMS = [
  { key: "attackSpeed", label: "Attack Speed Bonus", step: 1 },
  { key: "damage", label: "Damage Bonus", step: 1 },
  { key: "moveSpeed", label: "Move Speed Bonus", step: 1 },
  { key: "hp", label: "Max HP Bonus", step: 1 },
  { key: "hpRegen", label: "HP Regen", step: 1 },
  { key: "range", label: "Range Bonus", step: 1 },
  { key: "pickupRadius", label: "Pickup Radius Bonus", step: 1 },
  { key: "score", label: "Score Bonus", step: 1 },
  { key: "xpGain", label: "XP Gain Bonus", step: 1 },
  { key: "critChance", label: "Crit Chance Bonus", step: 1 },
  { key: "critDamage", label: "Crit Damage Bonus", step: 1 },
];

function getItemsForRTier(rTier) {
  // R-Tier: показываем все статы, которые уже открыты на этом или более раннем тире.
  // Проверяем по капам: если maxPoints > 0 для текущего R-Tier, значит стат доступен.
  return ALL_ITEMS.filter((it) => {
    const maxForStat = getMaxPointsForStat(rTier, it.key);
    return Number.isFinite(maxForStat) && maxForStat > 0;
  });
}


export function renderUpgradeMenu(ctx, state) {
  const { canvas, progression, lastRunSummary } = state;
  const w = canvas.width;
  const h = canvas.height;

  const maxDim = Math.max(w, h);
  const isMobile = maxDim < 900;

  const titleFontSize = isMobile ? 22 : 28;
  const headerFontSize = isMobile ? 13 : 16;
  const listFontSize = isMobile ? 12 : 14;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.font = titleFontSize + "px sans-serif";
  ctx.textAlign = "center";

  ctx.fillText("YOU DIED", w / 2, h / 2 - 140);

  ctx.font = headerFontSize + "px sans-serif";

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
  const rTier = progression.resurrectedTier || 1;
  const usedPoints = computeTotalMetaPoints(limits);
  const totalMax = getTotalMaxPointsForTier(rTier);

  ctx.fillText(
    "R-Tier: " +
      rTier +
      " (Used Points: " +
      usedPoints +
      " / " +
      totalMax +
      ")",
    w / 2,
    h / 2 - 30
  );

  lastButtons = [];

  const items = getItemsForRTier(rTier);
  const startY = isMobile ? h * 0.3 : h / 2 - 20;
  const lineH = isMobile ? 24 : 28;
  let y = startY;

  const xText = w * 0.15;
  const xBtn = w * 0.65; // button center-ish column

  ctx.textAlign = "left";
  ctx.font = listFontSize + "px sans-serif";

  for (const item of items) {
    const val = limits[item.key] ?? 0;

    let textValue = "";
    if (item.key === "hpRegen") {
      const regenPerSec = (val * 0.25).toFixed(2);
      textValue = `${item.label}: ${regenPerSec} HP/s`;
    } else if (item.key === "attackSpeed" || item.key === "damage" || item.key === "range") {
      const perc = (val * 2).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else if (item.key === "moveSpeed") {
      const perc = (val * 1).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else if (item.key === "xpGain") {
      const perc = (val * 0.5).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else if (item.key === "score") {
      const perc = (val * 2).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else if (item.key === "hp") {
      const bonus = (val * 5).toFixed(0);
      textValue = `${item.label}: +${bonus} HP`;
    } else if (item.key === "pickupRadius") {
      const bonus = (val * 1).toFixed(0);
      textValue = `${item.label}: +${bonus} radius`;
    } else if (item.key === "critChance") {
      const perc = (val * 0.1).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else if (item.key === "critDamage") {
      const perc = (val * 1).toFixed(2);
      textValue = `${item.label}: +${perc}%`;
    } else {
      textValue = `${item.label}: ${val}`;
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(textValue, xText, y);

    const btn = {
      x: xBtn,
      y: y - 16,
      w: 40,
      h: 24,
      key: item.key,
      step: item.step,
      type: "upgrade",
    };

    const rTierNow = progression.resurrectedTier || 1;
    const maxForStat = getMaxPointsForStat(rTierNow, item.key);
    const isCapped = Number.isFinite(maxForStat) && val >= maxForStat;

    const canUpgrade =
      progression.upgradePoints > 0 && !isCapped;

    ctx.fillStyle = canUpgrade ? "#3cff9f" : "#555555";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("+", btn.x + btn.w / 2, btn.y + 17);

    lastButtons.push(btn);

    y += lineH;
  }

  const lastItemY = startY + items.length * lineH;

  let startBtnY = lastItemY + 40;
  const btnH = 40;
  const minBottomMargin = isMobile ? 20 : 40;
  if (startBtnY + btnH > h - minBottomMargin) {
    startBtnY = h - minBottomMargin - btnH;
  }

  const startBtn = {
    x: w / 2 - 110,
    y: startBtnY,
    w: 220,
    h: btnH,
    type: "start",
  };

  ctx.fillStyle = "#333333";
  ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(
    "START NEXT RUN",
    startBtn.x + startBtn.w / 2,
    startBtn.y + 26
  );

  lastButtons.push(startBtn);

  ctx.restore();
}

export function handleUpgradeClick(x, y, state) {
  const btn = lastButtons.find(
    (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  );
  if (!btn) return null;

  if (btn.type === "upgrade") {
    const progression = state.progression;
    const limits = progression.limits || {};

    if (progression.upgradePoints <= 0) return null;

    const key = btn.key;
    const step = btn.step;

    const rTier = progression.resurrectedTier || 1;
    const maxForStat = getMaxPointsForStat(rTier, key);
    const current = limits[key] ?? 0;
    const next = current + step;

    if (Number.isFinite(maxForStat) && next > maxForStat) {
      return null;
    }

    limits[key] = next;
    progression.limits = limits;
    progression.upgradePoints -= 1;


    saveProgression(progression);
    return "upgrade";
  }

  if (btn.type === "start") {
    return "start";
  }

  return null;
}