import { getZoneScaling } from "../world/zoneController.js";
import { createBasicMob } from "./mobBasic.js";
import { createEliteMob } from "./mobElite.js";

export function createZoneBossGateEncounter(state, gateZone) {
  const { enemies, player } = state;

  const zoneForScaling = gateZone + 1;
  const s = getZoneScaling(zoneForScaling);
  const gateY = gateZone * 10000;

  const baseHP = 200;
  const baseDmg = 20;
  const baseSpeed = 70;
  const baseXP = 200;

  const boss = {
    type: "zoneBoss",
    zone: zoneForScaling,
    x: player.x,
    y: gateY - 400,
    radius: 40,
    hp: baseHP * s.hp * 10,
    maxHp: baseHP * s.hp * 10,
    damage: baseDmg * s.damage,
    speed: baseSpeed * s.speed,
    xpValue: baseXP * s.xp,
    scoreValue: 100 * zoneForScaling,
    isBoss: true,
    isGateEnemy: true,
    zoneGate: gateZone,
  };

  boss.update = (self, dt, state) => {
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
        const mult = player._shieldActive ? 0.35 : 1.0;
        player.hp -= self.damage * dt * mult;
      }
    }
  };

  boss.render = (self, ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#9b5bff";
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

  boss.onDeath = (self, state) => {
    state.xpOrbs.push({
      x: self.x,
      y: self.y,
      radius: 16,
      xp: self.xpValue,
      age: 0,
    });

    state.buffs.push({
      type: "damage",
      timeLeft: 30,
      multiplier: 0.6,
    });

    const p = state.player;
    state.floatingTexts.push({
      x: p.x,
      y: p.y - 24,
      text: "BOSS DOWN!",
      time: 1.2,
    });
    state.popups.push({
      text: "Zone Boss defeated!",
      time: 2.5,
    });
  };

  enemies.push(boss);

  const eliteCount = 10 + gateZone * 3;
  const basicCount = 20 + gateZone * 5;

  for (let i = 0; i < eliteCount; i++) {
    const offsetX = (i - eliteCount / 2) * 80;
    const m = createEliteMob(zoneForScaling, {
      x: player.x + offsetX,
      y: gateY - 600,
    });
    m.isGateEnemy = true;
    m.zoneGate = gateZone;
    enemies.push(m);
  }

  for (let i = 0; i < basicCount; i++) {
    const offsetX = (i - basicCount / 2) * 60;
    const m = createBasicMob(zoneForScaling, {
      x: player.x + offsetX,
      y: gateY - 800,
    });
    m.isGateEnemy = true;
    m.zoneGate = gateZone;
    enemies.push(m);
  }
}
