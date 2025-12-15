import { getZoneScaling } from "../world/zoneController.js";

export function createResurrectionGuardian(zone, pos) {
  const s = getZoneScaling(5);

  const baseHP = 400;
  const baseDmg = 35;
  const baseSpeed = 80;
  const baseXP = 200;

  const enemy = {
    type: "resurrectionGuardian",
    isResGuardian: true,
    zone,
    x: pos.x,
    y: pos.y,
    radius: 40,
    hp: baseHP * s.hp,
    maxHp: baseHP * s.hp,
    damage: baseDmg * s.damage,
    speed: baseSpeed * s.speed,
    xpValue: baseXP * s.xp,
    scoreValue: 200,
    isBoss: true,
    isGateEnemy: false,
  };

  enemy.update = (self, dt, state) => {
    const player = state.player;
    const dx = player.x - self.x;
    const dy = player.y - self.y;
    const dist = Math.hypot(dx, dy) || 1;

    const vx = (dx / dist) * self.speed;
    const vy = (dy / dist) * self.speed;

    self.x += vx * dt;
    self.y += vy * dt;
  };

  enemy.onHitPlayer = (self, player) => {
    player.hp -= self.damage;
    // Targeting 2.0 memory
    player.lastAttacker = self;
    player.lastAttackerAt = state.time;
  };

  enemy.onDeath = (self, state) => {
    if (state.flags) {
      state.flags.resGuardianKilledThisRun = true;
    }
    if (state.progression) {
      state.progression.resGuardianKills =
        (state.progression.resGuardianKills || 0) + 1;
    }

    if (state.popups) {
      state.popups.push({
        text: "Guardian of Resurrection defeated!",
        time: 3.0,
      });
    }

    if (state.floatingTexts) {
      state.floatingTexts.push({
        x: self.x,
        y: self.y - 24,
        text: "RESURECTION READY",
        time: 1.8,
      });
    }
  };

  enemy.render = (self, ctx) => {
    ctx.save();

    ctx.fillStyle = "#ffdd44";
    ctx.beginPath();
    ctx.arc(self.x, self.y, self.radius, 0, Math.PI * 2);
    ctx.fill();

    const ratio = self.hp / self.maxHp;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
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

  return enemy;
}
