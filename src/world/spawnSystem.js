import { getZone, ZONE_RADII, ZONE6_SQUARE_HALF, ZONE6_CORNER_POINTS } from "./zoneController.js";
import { createBasicMob } from "../enemies/mobBasic.js";
import { createEliteMob } from "../enemies/mobElite.js";
import { createZoneSpecialEnemy } from "../enemies/zoneSpecials.js";
import { createRoamingBoss } from "../enemies/roamingBoss.js";
import { createResurrectionGuardian } from "../enemies/resurrectionGuardian.js";
import { createZone6SuperBoss } from "../enemies/zone6SuperBoss.js";
import { hasReachedResurrectionThreshold } from "../core/progression.js";

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function randomPointInRing(innerR, outerR) {
  const ang = Math.random() * Math.PI * 2;
  // Uniform by area
  const r = Math.sqrt(Math.random() * (outerR * outerR - innerR * innerR) + innerR * innerR);
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

function randomPointInZone(zone) {
  const r0 = ZONE_RADII[0];
  const r1 = ZONE_RADII[1];
  const r2 = ZONE_RADII[2];
  const r3 = ZONE_RADII[3];
  const r4 = ZONE_RADII[4];
  const r5 = ZONE_RADII[5];

  if (zone === 0) return { x: 0, y: 0 };
  if (zone === 1) return randomPointInRing(r0, r1);
  if (zone === 2) return randomPointInRing(r1, r2);
  if (zone === 3) return randomPointInRing(r2, r3);
  if (zone === 4) return randomPointInRing(r3, r4);
  if (zone === 5) return randomPointInRing(r4, r5);

  // Zone 6: outer ring + corners (square), reject points inside Zone 5
  for (let k = 0; k < 20; k++) {
    const useCorner = Math.random() < 0.35;
    let p;
    if (useCorner) {
      p = {
        x: randRange(-ZONE6_SQUARE_HALF, ZONE6_SQUARE_HALF),
        y: randRange(-ZONE6_SQUARE_HALF, ZONE6_SQUARE_HALF),
      };
    } else {
      p = randomPointInRing(r5, ZONE6_SQUARE_HALF);
    }
    if (Math.hypot(p.x, p.y) >= r5) return p;
  }
  // Fallback
  return randomPointInRing(r5, ZONE6_SQUARE_HALF);
}

function cellKey(cx, cy) {
  return cx + "," + cy;
}

export class SpawnSystem {
  constructor(state) {
    this.state = state;

    // World 2.0: group/camp based spawns + timed respawn
        this.cellSize = 1600; // denser cells: groups encountered more often
    this.generatedCells = new Set();
    this.groups = new Map();
    this.nextGroupId = 1;

    // Roaming boss timer (kept, but spawn is world-anchored)
    this.roamingTimer = 0;

    // Zone 6 corner bosses (4 fixed points)
    this.cornerBossNextRespawnAt = [0, 0, 0, 0];
    this.cornerBossAlive = [false, false, false, false];


    // One-per-run spawns (kept)
    this.guardianSpawned = false;
    this.superBossSpawned = false;
    this.superBossPoint = null;
  }

  reset() {
    this.generatedCells.clear();
    this.groups.clear();
    this.nextGroupId = 1;

    this.roamingTimer = 0;

    // Zone 6 corner bosses (4 fixed points)
    this.cornerBossNextRespawnAt = [0, 0, 0, 0];
    this.cornerBossAlive = [false, false, false, false];

    this.guardianSpawned = false;
    this.superBossSpawned = false;

    // Pick a fixed point for Zone 6 super boss (world-anchored)
    const p = randomPointInZone(6);
    this.superBossPoint = { x: p.x, y: p.y };
  }

  onZoneChanged(newZone) {
    // Soft zones: reset roaming timer on zone change
    this.roamingTimer = 0;

    // Zone 6 corner bosses (4 fixed points)
    this.cornerBossNextRespawnAt = [0, 0, 0, 0];
    this.cornerBossAlive = [false, false, false, false];

  }

  onEnemyRemoved(enemy, state) {
    // Zone 6 corner boss respawn scheduling
    if (enemy && enemy.isZone6CornerBoss) {
      const idx = enemy.cornerIndex | 0;
      if (idx >= 0 && idx < 4) {
        this.cornerBossAlive[idx] = false;
        this.cornerBossNextRespawnAt[idx] = state.time + 90;
      }
    }

    const gid = enemy && enemy.groupId;
    if (!gid) return;

    const g = this.groups.get(gid);
    if (!g) return;

    g.aliveCount = Math.max(0, (g.aliveCount | 0) - 1);

    if (g.aliveCount <= 0 && g.spawned && !g.isWiped) {
      g.isWiped = true;
      g.spawned = false;
      g.wipedAt = state.time;
      g.nextRespawnAt = state.time + (g.respawnDelaySec || 20);
    }
  }

  // Create a new group object (initially not spawned)
  createGroup(zone, type, center) {
    const id = "g" + (this.nextGroupId++);
    const respawnDelay = type === "camp" ? 32 : type === "patrol" ? 22 : 16;

    const g = {
      id,
      zone,
      type,
      center: { x: center.x, y: center.y },
      spawned: false,
      aliveCount: 0,
      isWiped: false,
      wipedAt: 0,
      nextRespawnAt: 0,
      respawnDelaySec: respawnDelay,
      // activation distance: spawn only when player is near the group location
            activationDist: type === "camp" ? 6800 : type === "patrol" ? 6200 : 5800,
    };

    this.groups.set(id, g);
    return g;
  }

  spawnGroup(g) {
    const { enemies } = this.state;
    const z = g.zone;
    const cx = g.center.x;
    const cy = g.center.y;

    const spawned = [];

    const pushEnemy = (e, ai) => {
      if (!e) return;
      e.zone = z;
      e.groupId = g.id;
      e.aiMode = ai;
      // defaults for AI behaviors
      e.aggroed = false;
      e.aggroRange = ai === "camp" ? 520 : ai === "patrol" ? 520 : ai === "herdPassive" ? 360 : 500;

      if (ai === "camp") {
        e.campCenter = { x: cx, y: cy };
        e.campRadius = 700;
      } else if (ai === "patrol") {
        e.patrolCenter = { x: cx, y: cy };
        e.patrolRadius = randRange(260, 520);
        e._patrolAngle = Math.random() * Math.PI * 2;
      } else if (ai === "herdPassive") {
        e.herdCenter = { x: cx, y: cy };
        e.herdRadius = randRange(280, 520);
        e._idleAngle = Math.random() * Math.PI * 2;
      }

      enemies.push(e);
      spawned.push(e);
    };

    if (g.type === "herd") {
            const count = Math.floor(randRange(7, 15));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = randRange(50, 260);
        const pos = { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist };

        if (z === 6) {
          // Zone 6: no basics
          if (Math.random() < 0.6) pushEnemy(createEliteMob(6, pos), "herdPassive");
          else pushEnemy(createZoneSpecialEnemy(6, pos), "herdPassive");
        } else {
          pushEnemy(createBasicMob(z, pos), "herdPassive");
        }
      }
    }

    if (g.type === "patrol") {
            const count = Math.floor(randRange(5, 12));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = randRange(80, 340);
        const pos = { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist };

        if (z === 6) {
          if (Math.random() < 0.75) pushEnemy(createEliteMob(6, pos), "patrol");
          else pushEnemy(createZoneSpecialEnemy(6, pos), "patrol");
        } else {
          if (Math.random() < 0.25) pushEnemy(createEliteMob(z, pos), "patrol");
          else pushEnemy(createBasicMob(z, pos), "patrol");
        }
      }
    }

    if (g.type === "camp") {
      // 1 mini-boss (elite) + minions
      const bossPos = { x: cx + randRange(-60, 60), y: cy + randRange(-60, 60) };
      const boss = createEliteMob(z === 0 ? 1 : z, bossPos);
      // Make it feel like a mini-boss without adding new entity type
      boss.isMiniBoss = true;
      boss.hp *= 2.8;
      boss.maxHp *= 2.8;
      boss.damage *= 1.35;
      boss.radius = (boss.radius || 26) + 8;
      boss.xpValue = (boss.xpValue || 20) * 2.0;
      boss.scoreValue = (boss.scoreValue || 20) * 2.5;
      pushEnemy(boss, "camp");

            const minions = Math.floor(randRange(6, 13));
      for (let i = 0; i < minions; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = randRange(120, 420);
        const pos = { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist };

        if (z === 6) {
          if (Math.random() < 0.6) pushEnemy(createEliteMob(6, pos), "camp");
          else pushEnemy(createZoneSpecialEnemy(6, pos), "camp");
        } else {
          if (Math.random() < 0.2) pushEnemy(createEliteMob(z, pos), "camp");
          else pushEnemy(createBasicMob(z, pos), "camp");
        }
      }
    }

    g.spawned = true;
    g.isWiped = false;
    g.aliveCount = spawned.length;
  }

  ensureCellsAroundPlayer() {
    const { player } = this.state;
    const cs = this.cellSize;

    const pcx = Math.floor(player.x / cs);
    const pcy = Math.floor(player.y / cs);

    // Generate a small grid around player (streaming)
        const radius = 4; // denser streaming ring (9x9 cells)
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        const key = cellKey(cx, cy);
        if (this.generatedCells.has(key)) continue;
        this.generatedCells.add(key);

        // Create 1–2 groups per cell depending on zone
        const center = {
          x: (cx + 0.5) * cs + randRange(-cs * 0.25, cs * 0.25),
          y: (cy + 0.5) * cs + randRange(-cs * 0.25, cs * 0.25),
        };

        const zone = getZone(center.x, center.y);
        if (zone === 0) continue; // Hub: no groups

        // More groups per cell so zones don't feel empty
        const baseCount = zone >= 5 ? 3 : 2;
        const extra1 = Math.random() < 0.65 ? 1 : 0;
        const extra2 = (zone >= 5 && Math.random() < 0.35) ? 1 : 0;
        const count = baseCount + extra1 + extra2;
        for (let k = 0; k < count; k++) {
          const p = {
            x: center.x + randRange(-cs * 0.25, cs * 0.25),
            y: center.y + randRange(-cs * 0.25, cs * 0.25),
          };
          const z = getZone(p.x, p.y);
          if (z === 0) continue;

          const r = Math.random();
          let type = "herd";
          if (r < 0.22) type = "camp";
          else if (r < 0.57) type = "patrol";

          this.createGroup(z, type, p);
        }
      }
    }
  }

  update(dt) {
    const state = this.state;
    const { player, enemies } = state;

    const zone = getZone(player.x, player.y);

    // Zone 0 (Hub): safe (no enemy spawning)
    if (zone !== 0) {
      // Stream new groups as the player explores
      this.ensureCellsAroundPlayer();
    }

    // Respawn timer transitions (wipe → ready)
    for (const g of this.groups.values()) {
      if (g.isWiped && state.time >= g.nextRespawnAt) {
        // Becomes dormant again (will spawn when player approaches)
        g.isWiped = false;
        g.spawned = false;
        g.aliveCount = 0;
      }
    }

    // Spawn dormant groups when player approaches
    for (const g of this.groups.values()) {
      if (g.isWiped || g.spawned) continue;

      // Only spawn if player is in same zone AND near the group center
      const pz = getZone(player.x, player.y);
      if (pz !== g.zone) continue;

      const dx = g.center.x - player.x;
      const dy = g.center.y - player.y;
      const d2 = dx * dx + dy * dy;
      const act = g.activationDist || 4500;
      if (d2 <= act * act) {
        this.spawnGroup(g);
      }
    }


    // Density helper: if the area feels empty, activate nearest dormant groups (still world-anchored)
    if (zone !== 0) {
      const pz2 = getZone(player.x, player.y);
      const nearR = 9000;
      let nearEnemies = 0;
      for (const e of enemies) {
        if (!e || e.dead) continue;
        const ex = e.x - player.x;
        const ey = e.y - player.y;
        if (ex * ex + ey * ey <= nearR * nearR) nearEnemies++;
      }

      const minByZone =
        pz2 >= 6 ? 38 :
        pz2 >= 5 ? 32 :
        pz2 >= 4 ? 26 :
        pz2 >= 3 ? 22 :
        18;

      if (nearEnemies < minByZone) {
        const candidates = [];
        const maxPickDist = 14000;
        const maxPickDist2 = maxPickDist * maxPickDist;

        for (const g of this.groups.values()) {
          if (!g || g.spawned || g.isWiped) continue;
          if (g.zone !== pz2) continue;
          const dxg = g.center.x - player.x;
          const dyg = g.center.y - player.y;
          const d2g = dxg * dxg + dyg * dyg;
          if (d2g <= maxPickDist2) candidates.push({ g, d2: d2g });
        }

        candidates.sort((a, b) => a.d2 - b.d2);

        let activated = 0;
        for (const c of candidates) {
          if (nearEnemies >= minByZone) break;
          this.spawnGroup(c.g);
          activated++;
          nearEnemies += (c.g.aliveCount || 0);
          if (activated >= 3) break; // cap per tick to avoid bursts
        }
      }
    }

    // Zone 6 Corner Bosses — spawn when player approaches a corner (and respawn after delay)
    if (zone === 6 && Array.isArray(ZONE6_CORNER_POINTS)) {
      const CORNER_ACT_DIST = 14000; // activation distance
      const RESPAWN_DELAY = 90; // seconds
      for (let i = 0; i < ZONE6_CORNER_POINTS.length; i++) {
        const cp = ZONE6_CORNER_POINTS[i];
        if (!cp) continue;

        // if alive, ensure it's still present
        const exists = enemies.some((e) => e && e.isZone6CornerBoss && e.cornerIndex === i);
        this.cornerBossAlive[i] = exists;

        if (exists) continue;
        if (state.time < (this.cornerBossNextRespawnAt[i] || 0)) continue;

        const dxC = cp.x - player.x;
        const dyC = cp.y - player.y;
        if (dxC * dxC + dyC * dyC > CORNER_ACT_DIST * CORNER_ACT_DIST) continue;

        const boss = createRoamingBoss(6, { x: cp.x, y: cp.y });
        boss.isZone6CornerBoss = true;
        boss.cornerIndex = i;
        boss.name = "Corner Boss";
        // make it significantly tougher than roaming boss
        boss.hp *= 4.8;
        boss.maxHp *= 4.8;
        boss.damage *= 2.0;
        boss.speed *= 1.05;
        boss.radius *= 1.15;
        boss.xpValue *= 3.0;

        // Slightly stronger temp reward (keep same buff system)
        const baseOnDeath = boss.onDeath;
        boss.onDeath = (self, st) => {
          if (baseOnDeath) baseOnDeath(self, st);
          // Add a second smaller buff to make corner bosses feel special
          const types2 = ["damage", "attackSpeed", "moveSpeed", "regen", "shield"];
          const t2 = types2[Math.floor(Math.random() * types2.length)];
          st.buffs.push({
            type: t2,
            timeLeft: t2 === "regen" ? 18 : t2 === "shield" ? 10 : 25,
            multiplier: 0.35,
            amount: t2 === "regen" ? 6 : 0,
          });
        };

        enemies.push(boss);
        this.cornerBossAlive[i] = true;
      }
    }


    // Zone 6 Super Boss spawn (once per run, world-anchored)
    if (zone === 6 && !this.superBossSpawned) {
      const alreadySuper = enemies.some((e) => e && e.isZone6SuperBoss);
      if (!alreadySuper) {
        const p = this.superBossPoint || randomPointInZone(6);
        enemies.push(createZone6SuperBoss(6, { x: p.x, y: p.y }));
        this.superBossSpawned = true;
      }
    }

    // Resurrection Guardian spawn (zone 5, once per run, 70% meta usage rule)
    if (
      zone === 5 &&
      !this.guardianSpawned &&
      hasReachedResurrectionThreshold(state.progression)
    ) {
      const alreadyGuardian = enemies.some((e) => e && e.isResurrectionGuardian);
      if (!alreadyGuardian) {
        // Spawn near player for reliability
        const angleG = Math.random() * Math.PI * 2;
        const distG = 900 + Math.random() * 400;
        const gx = player.x + Math.cos(angleG) * distG;
        const gy = player.y + Math.sin(angleG) * distG;
        enemies.push(createResurrectionGuardian(5, { x: gx, y: gy }));
        this.guardianSpawned = true;
      }
    }

    // Roaming bosses (kept) — spawn world-anchored in current zone
    this.roamingTimer += dt;

    const hasRoaming = enemies.some((e) => e && e.isRoamingBoss);
    if (!hasRoaming && zone !== 0) {
      const threshold = 30 + zone * 10;
      if (this.roamingTimer >= threshold) {
        this.roamingTimer = 0;

    // Zone 6 corner bosses (4 fixed points)
    this.cornerBossNextRespawnAt = [0, 0, 0, 0];
    this.cornerBossAlive = [false, false, false, false];


        // Spawn point in current zone, but avoid spawning too close
        let p = randomPointInZone(zone);
        for (let k = 0; k < 20; k++) {
          const dx = p.x - player.x;
          const dy = p.y - player.y;
          if (dx * dx + dy * dy >= 1400 * 1400) break;
          p = randomPointInZone(zone);
        }

        enemies.push(createRoamingBoss(zone, { x: p.x, y: p.y }));
      }
    }
  }
}
