import { getKeyboardVector } from "./input.js";
import { getMoveVectorFromPointer } from "./mouseController.js";
import { getWorldBounds } from "../world/mapGenerator.js";
import { AVATARS } from "./avatars.js";

export class Player {
  constructor(startPos, startLevel) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.color = "#8fe3ff";

    this.nickname = "";
    this.avatarIndex = 0;

    this.level = startLevel || 0;
    this.xp = 0;

    this.baseMaxHP = 100;
    this.baseMoveSpeed = 220;
    this.baseDamage = 4;
    this.baseAttackSpeed = 2.0;
    this.baseRange = 1.0;

    this.maxHP = this.baseMaxHP;
    this.hp = this.maxHP;

    this.moveSpeed = this.baseMoveSpeed;
    this.damage = this.baseDamage;
    this.attackSpeed = this.baseAttackSpeed;
    this.range = this.baseRange;

    this.maxAttackSpeed = 4.0;
    this.maxDamage = 20.0;
    this.maxMoveSpeed = 380;
    this.rangeLimit = 1.0;

    this.laserHeat = 0;
    this.laserMaxHeat = 100;
    this.laserHeatRate = 1.0;
    this.laserOverheated = false;

    this.attackCooldown = 0;

    this.weaponStage = 1;

    this.lastAimDir = { x: 0, y: 1 };

    // Targeting 2.0 memory (1-Hand autoattack)
    this.lastPlayerTarget = null;
    this.lastPlayerTargetAt = -Infinity;
    this.lastAttacker = null;
    this.lastAttackerAt = -Infinity;
  }

  reset(startPos, startLevel) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.vx = 0;
    this.vy = 0;

    this.level = startLevel || 0;
    this.xp = 0;

    this.maxHP = this.baseMaxHP;
    this.hp = this.maxHP;

    this.moveSpeed = this.baseMoveSpeed;
    this.damage = this.baseDamage;
    this.attackSpeed = this.baseAttackSpeed;
    this.range = this.baseRange;

    this.attackCooldown = 0;
    this.weaponStage = 1;
    this.laserHeat = 0;
    this.laserOverheated = false;

    // Targeting 2.0 memory reset
    this.lastPlayerTarget = null;
    this.lastPlayerTargetAt = -Infinity;
    this.lastAttacker = null;
    this.lastAttackerAt = -Infinity;
  }

  xpToNext() {
    // Faster leveling: requirements reduced by 2x
    return Math.max(1, Math.floor((20 + this.level * 5) / 2));
  }

  gainXP(amount, state) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      leveled = true;

      // Full HP restore on each level up
      this.hp = this.maxHP;
    }

    if (leveled && state) {
      if (state.floatingTexts) {
        state.floatingTexts.push({
          x: this.x,
          y: this.y - 30,
          text: "LEVEL UP!",
          time: 1.2,
        });
      }
      if (state.popups) {
        state.popups.push({
          text: "Level Up! Lv " + this.level,
          time: 2.0,
        });
      }
    }
  }

  update(dt, state) {
    const pointerMove = getMoveVectorFromPointer();
    let dirX = pointerMove.x;
    let dirY = pointerMove.y;

    if (Math.hypot(dirX, dirY) < 0.1) {
      const kb = getKeyboardVector();
      dirX = kb.x;
      dirY = kb.y;
    }

    const len = Math.hypot(dirX, dirY);
    if (len > 0.001) {
      dirX /= len;
      dirY /= len;
    } else {
      dirX = 0;
      dirY = 0;
    }

    this.vx = dirX * this.moveSpeed;
    this.vy = dirY * this.moveSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const bounds = getWorldBounds();
    const minX = bounds.minX + this.radius;
    const maxX = bounds.maxX - this.radius;
    const minY = bounds.minY + this.radius;
    const maxY = bounds.maxY - this.radius;

    if (this.x < minX) this.x = minX;
    if (this.x > maxX) this.x = maxX;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;

    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
  }

  render(ctx) {
    ctx.save();

    // === Avatar is the emoji itself ===
    // Color is rendered as an aura: thin ring with soft falloff/glow.
    // Requirement: aura ring must start directly from the emoji (no gap).
    const col = this.color || "#8fe3ff";
    const r = this.radius || 18;

    // Emoji avatar in the center (draw first, aura will be drawn BEHIND it).
    const idx = (this.avatarIndex | 0);
    const emo = AVATARS[idx] || AVATARS[0] || "😀";

    // Use larger font so emoji visually fills the player circle.
    // Then compute aura radius from measured emoji width to avoid "offset" gaps.
    const fontSize = Math.max(12, Math.round(r * 1.95));
    ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const mw = emo ? ctx.measureText(emo).width : fontSize;
    const emojiR = Math.max(mw, fontSize) * 0.5;
    const auraR = emojiR; // ring comes straight from emoji, no extra radius

    if (emo) {
      // Subtle shadow for readability (doesn't overwrite emoji colors)
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillText(emo, this.x, this.y);
    }

    // Reset shadow so it doesn't affect aura/aim line
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Aura behind the emoji (so it "emits" from it, without painting over it)
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";

    // Soft outer glow (feathered edges)
    ctx.beginPath();
    ctx.arc(this.x, this.y, auraR, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.12;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    // Thin main ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, auraR, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.0;
    ctx.globalAlpha = 0.60;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    ctx.restore();

    // Aim indicator (outside the aura, so it doesn't cut through the emoji)
    const len = Math.hypot(this.lastAimDir.x, this.lastAimDir.y) || 1;
    const nx = this.lastAimDir.x / len;
    const ny = this.lastAimDir.y / len;
    const ax0 = this.x + nx * (auraR + 1);
    const ay0 = this.y + ny * (auraR + 1);
    const ax1 = this.x + nx * (auraR + 14);
    const ay1 = this.y + ny * (auraR + 14);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.moveTo(ax0, ay0);
    ctx.lineTo(ax1, ay1);
    ctx.stroke();

    ctx.restore();
  }
}
