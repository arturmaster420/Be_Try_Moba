export class Player {
  constructor(startPos, startLevel = 0) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;

    this.level = startLevel;
    this.xp = 0;

    this.baseMaxHP = 100;
    this.baseMoveSpeed = 220;
    this.baseDamage = 4;
    this.baseAttackSpeed = 2.0;
    this.baseRange = 700;

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

    this.permanentRegen = 0;
  }

  reset(startPos, startLevel = 0) {
    this.x = startPos.x;
    this.y = startPos.y;
    this.vx = 0;
    this.vy = 0;

    this.level = startLevel;
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

  gainXP(amount) {
    this.xp += amount;
    let levelsGained = 0;

    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      levelsGained += 1;
      this.hp = this.maxHP;
    }

    return levelsGained;
  }

  update(dt, moveVec) {
    let dirX = moveVec.x || 0;
    let dirY = moveVec.y || 0;
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
}
