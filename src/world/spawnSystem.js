import { getZone, zoneTargetCounts } from "./zoneController.js";
import { createBasicMob } from "../enemies/mobBasic.js";
import { createEliteMob } from "../enemies/mobElite.js";
import { createZoneSpecialEnemy } from "../enemies/zoneSpecials.js";
import { createZoneBossGateEncounter } from "../enemies/zoneBoss.js";
import { createRoamingBoss } from "../enemies/roamingBoss.js";
import { createResurrectionGuardian } from "../enemies/resurrectionGuardian.js";
import { createZone6SuperBoss } from "../enemies/zone6SuperBoss.js";
import { hasReachedResurrectionThreshold } from "../core/progression.js";

export class SpawnSystem {
  constructor(state) {
    this.state = state;

    this.spawnTimer = 0;
    this.spawnInterval = 0.5;

    this.roamingTimer = 0;

    this.guardianSpawned = false;
    this.superBossSpawned = false;

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
    this.guardianSpawned = false;
    this.superBossSpawned = false;
    this.gateCleared = { 1: false, 2: false, 3: false, 4: false };
  }

  onZoneChanged(newZone) {
    // Soft zones: reset roaming boss timer on zone change
    this.roamingTimer = 0;
  }

  
  update(dt) {
    const state = this.state;
    const { player, enemies } = state;

    const zone = getZone(player.y);

    // Zone 6 Super Boss spawn (once per run)
    if (zone === 6 && !this.superBossSpawned) {
      const alreadySuper = enemies.some((e) => e.isZone6SuperBoss);
      if (!alreadySuper) {
        const angleS = Math.random() * Math.PI * 2;
        const distS = 900 + Math.random() * 400;
        const sx = player.x + Math.cos(angleS) * distS;
        const sy = player.y + Math.sin(angleS) * distS;
        enemies.push(createZone6SuperBoss(6, { x: sx, y: sy }));
        this.superBossSpawned = true;
      }
    }

    // Resurrection Guardian spawn (zone 5, once per run, 70% meta usage rule)
    if (
      zone === 5 &&
      !this.guardianSpawned &&
      hasReachedResurrectionThreshold(state.progression)
    ) {
      const already = enemies.some((e) => e.isResGuardian);
      if (!already) {
        const angleG = Math.random() * Math.PI * 2;
        const distG = 700 + Math.random() * 300;
        const gx = player.x + Math.cos(angleG) * distG;
        const gy = player.y + Math.sin(angleG) * distG;
        enemies.push(createResurrectionGuardian(zone, { x: gx, y: gy }));
        this.guardianSpawned = true;
      }
    }

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

        if (zone === 6) {
          // Zone 6: no basic mobs, only elites and special enemies
          if (r < 0.5) {
            this.spawnElite(zone);
          } else {
            this.spawnSpecial(zone);
          }
        } else {
          // 10% elite, 10% zone-special, 80% basic
          if (r < 0.1) {
            this.spawnElite(zone);
          } else if (r < 0.2) {
            this.spawnSpecial(zone);
          } else {
            this.spawnBasic(zone);
          }
        }
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


  spawnSpecial(zone) {
    const { player, enemies } = this.state;
    const angle = Math.random() * Math.PI * 2;
    const dist = 650 + Math.random() * 300;

    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    enemies.push(createZoneSpecialEnemy(zone, { x, y }));
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