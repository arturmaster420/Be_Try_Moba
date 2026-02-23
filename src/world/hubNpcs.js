// Hub NPCs (static world objects) — used for in-hub interactions (Shop / Tier Master).
// These are purely client-side visuals + interaction triggers; they do NOT affect simulation/network.

import { isPointInHub } from "./zoneController.js";

export const HUB_NPCS = [
  {
    id: "shop",
    kind: "shop",
    name: "Merchant",
    emoji: "🛒",
    x: -150,
    y: 0,
    r: 120,
  },
  {
    id: "tier",
    kind: "tier",
    name: "Tier Master",
    emoji: "🧙",
    x: 150,
    y: 0,
    r: 120,
  },
];

export function getNearbyHubNpcForPlayer(player) {
  if (!player) return null;
  if (!isPointInHub(player.x, player.y, 10)) return null;

  let best = null;
  let bestD2 = Infinity;
  for (const n of HUB_NPCS) {
    const dx = player.x - n.x;
    const dy = player.y - n.y;
    const d2 = dx * dx + dy * dy;
    const r = n.r || 120;
    if (d2 <= r * r && d2 < bestD2) {
      best = n;
      bestD2 = d2;
    }
  }
  return best;
}

export function renderHubNpcs(ctx, state) {
  // world-space render (camera already applied)
  if (!state || state.mode !== "playing") return;
  const p = state.player;
  // Only show NPCs when near hub (prevents clutter).
  if (!p || !isPointInHub(p.x, p.y, 400)) return;

  for (const n of HUB_NPCS) {
    // Soft marker
    ctx.save();
    ctx.globalAlpha = 0.9;

    // Base sizes in WORLD units (scaled by camera transform).
    const base = 46;
    const ring = 54;

    // Ring
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 4;
    ctx.arc(n.x, n.y, ring, 0, Math.PI * 2);
    ctx.stroke();

    // Emoji
    ctx.font = base + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(n.emoji || "🙂", n.x, n.y + 2);

    // Small name label
    ctx.globalAlpha = 0.75;
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(n.name || "", n.x, n.y + 56);

    ctx.restore();
  }
}

// Convert world position to screen position for prompt placement.
export function worldToScreen(wx, wy, state) {
  const cam = state.camera;
  const canvas = state.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const z = cam.zoom || 1;
  const sx = (wx - cam.x) * z + w / 2;
  const sy = (wy - cam.y) * z + h / 2;
  return { x: sx, y: sy };
}

export function screenToWorld(sx, sy, state) {
  const cam = state.camera;
  const canvas = state.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const z = cam.zoom || 1;
  const wx = (sx - w / 2) / z + cam.x;
  const wy = (sy - h / 2) / z + cam.y;
  return { x: wx, y: wy };
}

export function findNpcAtWorldPos(wx, wy) {
  for (const n of HUB_NPCS) {
    const dx = wx - n.x;
    const dy = wy - n.y;
    const r = (n.r || 120) * 0.9;
    if (dx * dx + dy * dy <= r * r) return n;
  }
  return null;
}
