import { getZoneScaling } from "../world/zoneController.js";
import { givePermanentBuffFromZone5 } from "../buffs/buffs.js";

export function createRoamingBoss(zone, pos) {
  const s = getZoneScaling(zone);
  const scale = 30;

  const baseHP = 80;
  const baseDmg = 10;
  const baseSpeed = 70;
  const baseXP = 50;

  const enemy = {
    type: "roamingBoss",
    isRoamingBoss: true,
    zone,
    x: pos.x,
    y: pos.y,
    radius: 45,
    hp: baseHP * s.hp * scale,
    maxHp: baseHP * s.hp * scale,
    damage: baseDmg * s.damage * 2,
    speed: baseSpeed * s.speed * 1.1,
    xpValue: baseXP * s.xp * 5,
    scoreValue: 300 * zone,
    isBoss: true,
    isGateEnemy: false,
  };

  enemy.update = (self, dt, state) => {
    const { player } = state;

    const dx = player.x - self.x;
    const dy = player.y - self.y;
    const dist = Math.hypot(dx, dy) || 1;

    const angleToPlayer = Math.atan2(dy, dx);
    const wanderOffset = Math.sin(state.time * 0.6) * 0.8;
    const angle = angleToPlayer + wanderOffset;

    const vx = Math.cos(angle) * self.speed;
    const vy = Math.sin(angle) * self.speed;

    self.x += vx * dt;
    self.y += vy * dt;

    const r = (player.radius || 18) + self.radius;
    if (dx * dx + dy * dy <= r * r) {
      if (!player._ghostActive) {
        const mult = player._shieldActive ? 0.4 : 1.0;
        player.hp -= self.damage * dt * mult;
      }
    }
  };

  enemy.render = (self, ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#ff3cbe";
    ctx.arc(self.x, self.y, self.radius, 0, Math.PI * 2);
    ctx.fill();

    const ratio = self.hp / self.maxHp;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      self.x,
      self.y,
      self.radius + 6,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * ratio
    );
    ctx.stroke();

    ctx.restore();
  };

  enemy.onDeath = (self, state) => {
    state.xpOrbs.push({
      x: self.x,
      y: self.y,
      radius: 18,
      xp: self.xpValue,
      age: 0,
    });

    if (self.zone === 5) {
      givePermanentBuffFromZone5(state);
      state.popups.push({
        text: "Roaming Boss defeated! Permanent upgrade",
        time: 3.0,
      });
    } else {
      const types = ["damage", "attackSpeed", "moveSpeed", "regen", "shield"];
      const type = types[Math.floor(Math.random() * types.length)];
      state.buffs.push({
        type,
        timeLeft: type === "regen" ? 20 : type === "shield" ? 10 : 30,
        multiplier: 0.6,
        amount: type === "regen" ? 8 : 0,
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
        y: self.y - 24,
        text: "BUFF: " + label,
        time: 1.2,
      });
      state.popups.push({
        text: "Roaming Boss defeated! Temp buff: " + label,
        time: 3.0,
      });
    }
  };

  return enemy;
}
