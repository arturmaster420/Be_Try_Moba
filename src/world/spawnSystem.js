import { getZone, zoneTargetCounts } from "./zoneController.js";
import { createBasicMob } from "../enemies/mobBasic.js";
import { createEliteMob } from "../enemies/mobElite.js";
import { createZoneBossGateEncounter } from "../enemies/zoneBoss.js";
import { createRoamingBoss } from "../enemies/roamingBoss.js";

export class SpawnSystem {
  constructor(state) {
    this.state = state;

    this.spawnTimer = 0;
    this.spawnInterval = 0.5;

    this.roamingTimer = 0;

    this.gateCleared = {
      1: false,
      2: false,
      3: false,
      4: false,
    };
    this.activeGateZone = null;
  }

  reset() {
    this.spawnTimer = 0;
    this.spawnInterval = 0.5;
    this.roamingTimer = 0;
    this.activeGateZone = null;
    this.gateCleared = { 1: false, 2: false, 3: false, 4: false };
  }

  
  update(dt) {
    const state = this.state;
    const { player, enemies } = state;

    const zone = getZone(player.y);

    // Continuous spawning based on zone target density
    this.spawnTimer += dt;

    const cfg = zoneTargetCounts[zone] || { min: 20, max: 25 };
    const targetCount = Math.round((cfg.min + cfg.max) / 2);

    const aliveNormal = enemies.filter(
      (e) => !e.isBoss && !e.isGateEnemy
    ).length;

    const dynamicInterval = Math.max(0.2, 1.0 - state.player.level * 0.004);

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = dynamicInterval;

      if (aliveNormal < targetCount) {
        const r = Math.random();
        if (r < 0.15) this.spawnElite(zone);
        else this.spawnBasic(zone);
      }
    }

    // Roaming bosses (non-blocking)
    this.roamingTimer += dt;

    const hasRoaming = enemies.some((e) => e.isRoamingBoss);
    if (!hasRoaming) {
      const threshold = 30 + zone * 10;
      if (this.roamingTimer >= threshold) {
        this.roamingTimer = 0;
        if (Math.random() < 0.5) {
          this.spawnRoamingBoss(zone);
        }
      }
    }
  }

  spawnBasic(zone) {
    const { player, enemies } = this.state;
    const angle = Math.random() * Math.PI * 2;
    const dist = 600 + Math.random() * 400;

    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    enemies.push(createBasicMob(zone, { x, y }));
  }

  spawnElite(zone) {
    const { player, enemies } = this.state;
    const angle = Math.random() * Math.PI * 2;
    const dist = 700 + Math.random() * 400;

    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    enemies.push(createEliteMob(zone, { x, y }));
  }

  spawnRoamingBoss(zone) {
    const { player, enemies } = this.state;
    const angle = Math.random() * Math.PI * 2;
    const dist = 900 + Math.random() * 600;

    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    enemies.push(createRoamingBoss(zone, { x, y }));
  }
}
