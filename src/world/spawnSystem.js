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

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Balance knobs by zone (0 is hub)
const ZONE_GROUPS_PER_CELL = {
  1: [1, 2],
  2: [1, 2],
  3: [2, 3],
  4: [2, 3],
  5: [3, 4],
  6: [3, 4],
};

const ZONE_TYPE_WEIGHTS = {
  1: { herd: 0.55, patrol: 0.35, camp: 0.10 },
  2: { herd: 0.50, patrol: 0.35, camp: 0.15 },
  3: { herd: 0.45, patrol: 0.35, camp: 0.20 },
  4: { herd: 0.40, patrol: 0.35, camp: 0.25 },
  5: { herd: 0.35, patrol: 0.35, camp: 0.30 },
  6: { herd: 0.30, patrol: 0.35, camp: 0.35 },
};

function pickGroupTypeByZone(zone) {
  const w = ZONE_TYPE_WEIGHTS[zone] || ZONE_TYPE_WEIGHTS[3];
  const r = Math.random();
  if (r < w.camp) return "camp";
  if (r < w.camp + w.patrol) return "patrol";
  return "herd";
}

function herdCountByZone(z) {
  if (z <= 1) return [4, 7];
  if (z === 2) return [5, 8];
  if (z === 3) return [6, 10];
  if (z === 4) return [7, 12];
  return [8, 14]; // zones 5-6
}

function patrolCountByZone(z) {
  if (z <= 1) return [3, 5];
  if (z === 2) return [4, 6];
  if (z === 3) return [5, 8];
  if (z === 4) return [6, 9];
  return [7, 11];
}

function campMinionsByZone(z) {
  if (z <= 1) return [3, 5];
  if (z === 2) return [4, 6];
  if (z === 3) return [5, 8];
  if (z === 4) return [6, 10];
  return [7, 12];
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Balance layer for the long 1–500 weapon curve:
// we scale newly spawned enemies a bit with player level so that
// late stages (laser/chain) still have something to chew on.
function applyLevelZoneBalance(enemy, zone, playerLevel) {
  if (!enemy) return;
  const z = clamp(zone | 0, 1, 6);
  const lvl = clamp(playerLevel | 0, 1, 500);
  const t = (lvl - 1) / 499; // 0..1

  // Level-based multipliers (zone-aware): HP grows more than damage.
  const hpCoef = [0, 0.7, 0.9, 1.4, 2.0, 2.7, 3.4][z];
  const dmgCoef = [0, 0.20, 0.26, 0.38, 0.52, 0.66, 0.82][z];
  const xpCoef = [0, 0.18, 0.20, 0.24, 0.30, 0.36, 0.42][z];

  const hpMul = 1 + t * hpCoef;
  const dmgMul = 1 + t * dmgCoef;
  const xpMul = 1 + t * xpCoef;

  if (Number.isFinite(enemy.hp)) enemy.hp *= hpMul;
  if (Number.isFinite(enemy.maxHp)) enemy.maxHp *= hpMul;
  if (Number.isFinite(enemy.damage)) enemy.damage *= dmgMul;
  if (Number.isFinite(enemy.xpValue)) enemy.xpValue *= xpMul;
  if (Number.isFinite(enemy.scoreValue)) enemy.scoreValue *= xpMul;
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
    // Balanced density: not too large groups in early zones, still not empty overall.
    this.cellSize = 1800;
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
    // Respawn pacing: slightly faster early, slightly slower late
    const z = Math.max(0, Math.min(6, zone | 0));
    const baseRespawn = z <= 2 ? 14 : z === 3 ? 16 : z === 4 ? 18 : 20;
    const respawnDelay = type === "camp" ? baseRespawn + 14 : type === "patrol" ? baseRespawn + 6 : baseRespawn;

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
      // Early zones spawn a bit closer (so it doesn't feel like "a giant pack appears"),
      // later zones spawn earlier.
      activationDist: (type === "camp" ? 5400 : type === "patrol" ? 5200 : 4800) + z * 220,
    };

    this.groups.set(id, g);
    return g;
  }

  spawnGroup(g) {
    const { enemies, player } = this.state;
    const z = g.zone;
    const cx = g.center.x;
    const cy = g.center.y;
    const pLevel = (player && player.level) || 1;

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

      // Global balance layer (level-aware)
      applyLevelZoneBalance(e, z, pLevel);

      enemies.push(e);
      spawned.push(e);
    };

    if (g.type === "herd") {
      const [minH, maxH] = herdCountByZone(z);
      const count = randInt(minH, maxH);
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
      const [minP, maxP] = patrolCountByZone(z);
      const count = randInt(minP, maxP);
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
      const zf = Math.max(1, z | 0);
      const hpMul = zf <= 1 ? 2.0 : zf === 2 ? 2.3 : zf === 3 ? 2.6 : 2.8;
      const dmgMul = zf <= 1 ? 1.2 : zf === 2 ? 1.25 : 1.35;
      boss.hp *= hpMul;
      boss.maxHp *= hpMul;
      boss.damage *= dmgMul;
      boss.radius = (boss.radius || 26) + (zf <= 2 ? 6 : 8);
      boss.xpValue = (boss.xpValue || 20) * 2.0;
      boss.scoreValue = (boss.scoreValue || 20) * 2.5;
      pushEnemy(boss, "camp");

      const [minM, maxM] = campMinionsByZone(z);
      const minions = randInt(minM, maxM);
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

    // Generate a grid around player (streaming)
    const radius = 4; // 9x9 cells
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        const key = cellKey(cx, cy);
        if (this.generatedCells.has(key)) continue;
        this.generatedCells.add(key);

        // Create groups per cell depending on zone
        const center = {
          x: (cx + 0.5) * cs + randRange(-cs * 0.25, cs * 0.25),
          y: (cy + 0.5) * cs + randRange(-cs * 0.25, cs * 0.25),
        };

        const zone = getZone(center.x, center.y);
        if (zone === 0) continue; // Hub: no groups

        const [gMin, gMax] = ZONE_GROUPS_PER_CELL[zone] || [2, 3];
        const count = randInt(gMin, gMax);
        for (let k = 0; k < count; k++) {
          const p = {
            x: center.x + randRange(-cs * 0.25, cs * 0.25),
            y: center.y + randRange(-cs * 0.25, cs * 0.25),
          };
          const z = getZone(p.x, p.y);
          if (z === 0) continue;

          const type = pickGroupTypeByZone(z);

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

    // Spawn dormant groups when player approaches (budgeted per tick to avoid huge bursts)
    let spawnBudget =
      zone >= 6 ? 5 :
      zone >= 5 ? 4 :
      zone >= 4 ? 3 :
      zone >= 3 ? 3 :
      zone >= 2 ? 2 :
      2;

    for (const g of this.groups.values()) {
      if (spawnBudget <= 0) break;
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
        spawnBudget--;
      }
    }


    // Density helper: if the area feels empty, activate nearest dormant groups (still world-anchored)
    if (zone !== 0) {
      const pz2 = getZone(player.x, player.y);
      const nearR = 8200;
      let nearEnemies = 0;
      for (const e of enemies) {
        if (!e || e.dead) continue;
        const ex = e.x - player.x;
        const ey = e.y - player.y;
        if (ex * ex + ey * ey <= nearR * nearR) nearEnemies++;
      }

      const minByZone =
        pz2 >= 6 ? 32 :
        pz2 >= 5 ? 28 :
        pz2 >= 4 ? 24 :
        pz2 >= 3 ? 20 :
        pz2 >= 2 ? 16 :
        12;

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
        const capActivated = pz2 <= 2 ? 1 : pz2 <= 4 ? 2 : 3;
        for (const c of candidates) {
          if (nearEnemies >= minByZone) break;
          this.spawnGroup(c.g);
          activated++;
          nearEnemies += (c.g.aliveCount || 0);
          if (activated >= capActivated) break; // cap per tick to avoid bursts
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

        applyLevelZoneBalance(boss, 6, (player && player.level) || 1);
        enemies.push(boss);
        this.cornerBossAlive[i] = true;
      }
    }


    // Zone 6 Super Boss spawn (once per run, world-anchored)
    if (zone === 6 && !this.superBossSpawned) {
      const alreadySuper = enemies.some((e) => e && e.isZone6SuperBoss);
      if (!alreadySuper) {
        const p = this.superBossPoint || randomPointInZone(6);
        const sb = createZone6SuperBoss(6, { x: p.x, y: p.y });
        applyLevelZoneBalance(sb, 6, (player && player.level) || 1);
        enemies.push(sb);
        this.superBossSpawned = true;
      }
    }

    // Resurrection Guardian spawn (zone varies by R-Tier, once per run, 70% meta usage rule)
    // RT1 -> Zone2, RT2 -> Zone3, RT3 -> Zone4, RT4+ -> Zone5
    const rTier = (state.progression && state.progression.resurrectedTier) || 1;
    const guardianZone = Math.min(5, (rTier | 0) + 1);
    if (
      zone === guardianZone &&
      !this.guardianSpawned &&
      hasReachedResurrectionThreshold(state.progression)
    ) {
      const alreadyGuardian = enemies.some(
        (e) => e && (e.isResGuardian || e.isResurrectionGuardian || e.type === "resurrectionGuardian")
      );
      if (!alreadyGuardian) {
        // Spawn near player for reliability
        const angleG = Math.random() * Math.PI * 2;
        const distG = 900 + Math.random() * 400;
        const gx = player.x + Math.cos(angleG) * distG;
        const gy = player.y + Math.sin(angleG) * distG;
        const g = createResurrectionGuardian(guardianZone, { x: gx, y: gy });
        applyLevelZoneBalance(g, guardianZone, (player && player.level) || 1);
        enemies.push(g);
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

        // Spawn point in current zone, but avoid spawning too close
        let p = randomPointInZone(zone);
        for (let k = 0; k < 20; k++) {
          const dx = p.x - player.x;
          const dy = p.y - player.y;
          if (dx * dx + dy * dy >= 1400 * 1400) break;
          p = randomPointInZone(zone);
        }

        const rb = createRoamingBoss(zone, { x: p.x, y: p.y });
        applyLevelZoneBalance(rb, zone, (player && player.level) || 1);
        enemies.push(rb);
      }
    }
  }
}
