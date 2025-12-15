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

    // World 2.0 AI: optional group behaviors (herd/patrol/camp)
    let moveVx = (dx / dist) * self.speed;
    let moveVy = (dy / dist) * self.speed;

    const ai = self.aiMode;
    if (ai && !self.aggroed) {
      const ar = self.aggroRange || 450;
      const d2 = dx * dx + dy * dy;

      const wasHitRecently =
        typeof self._lastHitAt === "number" && state.time - self._lastHitAt <= 3.0;

      const campTriggered =
        ai === "camp" &&
        self.campCenter &&
        typeof self.campRadius === "number" &&
        d2 <= self.campRadius * self.campRadius;

      if (d2 <= ar * ar || wasHitRecently || campTriggered) {
        self.aggroed = true;
      } else {
        // Idle behavior (stay around center / patrol route)
        if (ai === "patrol" && self.patrolCenter) {
          self._patrolAngle = (self._patrolAngle || 0) + dt * 0.9;
          const pr = self.patrolRadius || 360;
          const tx = self.patrolCenter.x + Math.cos(self._patrolAngle) * pr;
          const ty = self.patrolCenter.y + Math.sin(self._patrolAngle) * pr;

          const tdx = tx - self.x;
          const tdy = ty - self.y;
          const td = Math.hypot(tdx, tdy) || 1;
          moveVx = (tdx / td) * self.speed * 0.45;
          moveVy = (tdy / td) * self.speed * 0.45;
        } else {
          const center = ai === "camp" ? self.campCenter : self.herdCenter;
          if (center) {
            self._idleAngle = (self._idleAngle || 0) + dt * 0.6;
            const rad = ai === "camp" ? (self.campRadius || 650) : (self.herdRadius || 420);
            const tx = center.x + Math.cos(self._idleAngle) * rad * 0.4;
            const ty = center.y + Math.sin(self._idleAngle) * rad * 0.4;

            const tdx = tx - self.x;
            const tdy = ty - self.y;
            const td = Math.hypot(tdx, tdy) || 1;
            moveVx = (tdx / td) * self.speed * 0.35;
            moveVy = (tdy / td) * self.speed * 0.35;
          } else {
            // No center — stand still
            moveVx = 0;
            moveVy = 0;
          }
        }
      }
    }

    self.x += moveVx * dt;
    self.y += moveVy * dt;

    const r = (player.radius || 18) + self.radius;
    if (dx * dx + dy * dy <= r * r) {
      if (!player._ghostActive) {
        const mult = player._shieldActive ? 0.25 : 1.0;
        player.hp -= self.damage * dt * mult;
        // Targeting 2.0 memory
        player.lastAttacker = self;
        player.lastAttackerAt = state.time;
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
      const types = ["damage", "attackSpeed", "moveSpeed", "regen", "shield", "xpGain"];
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
          : type === "shield"
          ? "Shield"
          : "XP Gain";

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
