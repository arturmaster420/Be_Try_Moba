import { getKeyboardVector } from "./input.js";
import { getMoveVectorFromPointer } from "./mouseController.js";

export class Player {
  constructor(startPos, startLevel) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;

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
  }

  xpToNext() {
    return 20 + this.level * 5;
  }

  gainXP(amount, state) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      leveled = true;

      // Full heal on level up
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

    const minY = 0;
    const maxY = 50000;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
  }

  render(ctx) {
    ctx.save();

    ctx.beginPath();
    ctx.fillStyle = "#8fe3ff";
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    const len = Math.hypot(this.lastAimDir.x, this.lastAimDir.y) || 1;
    const nx = this.lastAimDir.x / len;
    const ny = this.lastAimDir.y / len;

    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + nx * (this.radius + 10),
      this.y + ny * (this.radius + 10)
    );
    ctx.stroke();

    ctx.restore();
  }
}