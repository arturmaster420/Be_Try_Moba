import { getZoneScaling } from "../world/zoneController.js";

export function createBasicMob(zone, pos) {
  const s = getZoneScaling(zone);

  const baseHP = 30;
  const baseDmg = 6;
  const baseSpeed = 90;
  const baseXP = 10;

  const enemy = {
    type: "basic",
    zone,
    x: pos.x,
    y: pos.y,
    radius: 20,
    hp: baseHP * s.hp,
    maxHp: baseHP * s.hp,
    damage: baseDmg * s.damage,
    speed: baseSpeed * s.speed,
    xpValue: baseXP * s.xp,
    scoreValue: 10 * zone,
    isBoss: false,
    isGateEnemy: false,
    isElite: false,
  };

  enemy.update = (self, dt, state) => {
    const { player } = state;
    const dx = player.x - self.x;
    const dy = player.y - self.y;
    const dist = Math.hypot(dx, dy) || 1;

    const vx = (dx / dist) * self.speed;
    const vy = (dy / dist) * self.speed;

    self.x += vx * dt;
    self.y += vy * dt;

    const r = (player.radius || 18) + self.radius;
    if (dx * dx + dy * dy <= r * r) {
      if (!player._ghostActive) {
        const mult = player._shieldActive ? 0.2 : 1.0;
        player.hp -= self.damage * dt * mult;
      }
    }
  };

  enemy.render = (self, ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#ff5f6f";
    ctx.arc(self.x, self.y, self.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  enemy.onDeath = (self, state) => {
    state.xpOrbs.push({
      x: self.x,
      y: self.y,
      radius: 8,
      xp: self.xpValue,
      age: 0,
    });
  };

  return enemy;
}
