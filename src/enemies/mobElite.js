import { getZoneScaling } from "../world/zoneController.js";

export function createEliteMob(zone, pos) {
  const s = getZoneScaling(zone);
  const scale = 2.5;

  const baseHP = 40;
  const baseDmg = 8;
  const baseSpeed = 110;
  const baseXP = 15;

  const enemy = {
    type: "elite",
    zone,
    x: pos.x,
    y: pos.y,
    radius: 26,
    hp: baseHP * s.hp * scale,
    maxHp: baseHP * s.hp * scale,
    damage: baseDmg * s.damage * scale,
    speed: baseSpeed * s.speed * 1.1,
    xpValue: baseXP * s.xp * scale,
    scoreValue: 20 * zone,
    isBoss: false,
    isGateEnemy: false,
    isElite: true,
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
        const mult = player._shieldActive ? 0.25 : 1.0;
        player.hp -= self.damage * dt * mult;
      }
    }
  };

  enemy.render = (self, ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#ffa43c";
    ctx.arc(self.x, self.y, self.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  enemy.onDeath = (self, state) => {
    state.xpOrbs.push({
      x: self.x,
      y: self.y,
      radius: 10,
      xp: self.xpValue,
      age: 0,
    });

    if (Math.random() < 0.3) {
      const types = ["damage", "attackSpeed", "moveSpeed", "regen", "shield"];
      const type = types[Math.floor(Math.random() * types.length)];

      state.buffs.push({
        type,
        timeLeft: type === "regen" ? 15 : type === "shield" ? 8 : 20,
        multiplier: 0.4,
        amount: type === "regen" ? 5 : 0,
      });

      const label =
        type === "damage"
          ? "Damage"
          : type === "attackSpeed"
          ? "Attack Speed"
          : type === "moveSpeed"
          ? "Move Speed"
          : type === "regen"
          ? "Regen"
          : "Shield";

      state.floatingTexts.push({
        x: self.x,
        y: self.y - 20,
        text: "BUFF: " + label,
        time: 1.0,
      });
      state.popups.push({
        text: "Temporary buff: " + label,
        time: 2.0,
      });
    }
  };

  return enemy;
}
