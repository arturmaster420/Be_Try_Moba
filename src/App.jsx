import React, { useEffect, useRef, useState } from 'react'

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// ------------ CONFIG -------------

const WORLD_SIZE = 6000
const HALF_WORLD = WORLD_SIZE / 2

const BASE_PLAYER = {
  hp: 100,
  maxHp: 100,
  speed: 220,
  radius: 18,
  magnetRadius: 120,
  baseDamageMul: 1,
  baseFireRateMul: 1,
  baseRangeMul: 1,
  baseBulletSpeedMul: 1,
  critChance: 0.01, // 1%
  critMult: 1.5,
}

const WEAPONS = {
  pistol: {
    name: 'Pistol',
    levelRequired: 1,
    baseDamage: 6,
    baseFireRate: 1.3,
    baseRange: 800,
    bulletSpeed: 700,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
    type: 'bullet',
  },
  rifle: {
    name: 'Rifle',
    levelRequired: 5,
    baseDamage: 5,
    baseFireRate: 4,
    baseRange: 900,
    bulletSpeed: 900,
    pellets: 1,
    spreadDeg: 6,
    splashRadius: 0,
    splashDamage: 0,
    type: 'bullet',
  },
  shotgun: {
    name: 'Shotgun',
    levelRequired: 10,
    baseDamage: 3,
    baseFireRate: 1.4,
    baseRange: 600,
    bulletSpeed: 750,
    pellets: 7,
    spreadDeg: 25,
    splashRadius: 0,
    splashDamage: 0,
    type: 'bullet',
  },
  rocket: {
    name: 'Rocket',
    levelRequired: 15,
    baseDamage: 20,
    baseFireRate: 0.8,
    baseRange: 1000,
    bulletSpeed: 500,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 60,
    splashDamage: 15,
    type: 'rocket',
  },
  laser: {
    name: 'Laser',
    levelRequired: 20,
    baseDamage: 6, // используется как baseDamage, но наносится всем на луче*0.5
    baseFireRate: 2, // 2 "тиков" в секунду
    baseRange: 800,
    bulletSpeed: 0,
    pellets: 1,
    spreadDeg: 0,
    splashRadius: 0,
    splashDamage: 0,
    type: 'laser',
  },
}

const ENEMY_TYPES = {
  normal: {
    radius: 16,
    baseHp: (wave) => 4 + wave * 0.8,
    speed: (wave) => 70 + wave * 1.8,
    dps: 10,
    color: '#f97373',
  },
  fast: {
    radius: 13,
    baseHp: (wave) => 3 + wave * 0.5,
    speed: (wave) => 120 + wave * 2.5,
    dps: 14,
    color: '#fb7185',
  },
  tank: {
    radius: 22,
    baseHp: (wave) => 12 + wave * 2,
    speed: (wave) => 50 + wave * 1.2,
    dps: 18,
    color: '#facc15',
  },
  shooter: {
    radius: 16,
    baseHp: (wave) => 5 + wave * 1.0,
    speed: (wave) => 60 + wave * 1.5,
    dps: 8,
    color: '#a5b4fc',
  },
  shadow: {
    radius: 18,
    baseHp: (wave) => 8 + wave * 0.3,
    speed: (wave) => 140 + wave * 3,
    dps: 14,
    color: '#020617',
    isShadow: true,
  },
}

const BOSS_TYPES = {
  boss1: {
    radius: 40,
    hp: (wave) => 300 + (wave - 5) * 20,
    color: '#f97316',
    drops: { min: 1, max: 1, permanent: true },
  },
  boss2: {
    radius: 42,
    hp: (wave) => 500 + (wave - 10) * 30,
    color: '#22c55e',
    drops: { min: 2, max: 3, permanent: true },
  },
  boss3: {
    radius: 38,
    hp: (wave) => 800 + (wave - 15) * 40,
    color: '#ec4899',
    drops: { min: 3, max: 5, permanent: true },
    isSummoner: true,
  },
  boss4: {
    radius: 46,
    hp: (wave) => 1000 + Math.max(0, wave - 20) * 100,
    color: '#eab308',
    drops: { min: 0, max: 0, permanent: true, mega: true },
    isFinal: true,
  },
  bossXp: {
    radius: 30,
    hp: (wave) => 200 + wave * 20,
    color: '#22c55e',
    xpBoostBoss: true,
  },
  bossTemp: {
    radius: 30,
    hp: (wave) => 220 + wave * 25,
    color: '#0ea5e9',
    tempBuffBoss: true,
  },
}

const PICKUP_TYPES = {
  hp: { color: '#f97373' },
  radius: { color: '#22c55e' },
  fireRate: { color: '#0ea5e9' },
  damage: { color: '#eab308' },
  critChance: { color: '#f472b6' },
  critDamage: { color: '#f97316' },
  range: { color: '#a5b4fc' },
  xpBoost: { color: '#22c55e' },
  immortal: { color: '#64748b' },
  tempDamage: { color: '#e11d48' },
  tempFireRate: { color: '#38bdf8' },
  tempRange: { color: '#6366f1' },
  tempCrit: { color: '#facc15' },
}

const TEMP_BUFF_DURATIONS = {
  tempDamage: 25,
  tempFireRate: 25,
  tempRange: 25,
  tempCrit: 25,
  xpBoost: 60,
  immortal: 10,
}

function randRange(a, b) {
  return a + Math.random() * (b - a)
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1))
}

function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ------------ APP -------------

export default function App() {
  const canvasRef = useRef(null)
  const leftJoy = useRef({ active: false, id: null, x: 0, y: 0 })
  const rightJoy = useRef({ active: false, id: null, x: 0, y: 0 })

  const [size, setSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight : 600,
  })

  useEffect(() => {
    const onResize = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.w
    canvas.height = size.h

    const state = {
      w: canvas.width,
      h: canvas.height,
      time: 0,
      elapsed: 0,
      player: {
        x: 0,
        y: 0,
        ...BASE_PLAYER,
        damageMul: 1,
        fireRateMul: 1,
        rangeMul: 1,
        bulletSpeedMul: 1,
        hp: BASE_PLAYER.hp,
        maxHp: BASE_PLAYER.maxHp,
        magnetRadius: BASE_PLAYER.magnetRadius,
        immortalTimer: 0,
        xpBoostTimer: 0,
      },
      weaponKey: 'pistol',
      bullets: [],
      enemyBullets: [],
      enemies: [],
      pickups: [],
      wave: 1,
      waveInProgress: false,
      xp: 0,
      level: 1,
      xpToNext: 10,
      tempBuffs: {
        tempDamage: 0,
        tempFireRate: 0,
        tempRange: 0,
        tempCrit: 0,
        xpBoost: 0,
        immortal: 0,
      },
      cam: { x: 0, y: 0 },
      fireCooldown: 0,
      enemySpawnTimer: 0,
    }

    function getCurrentWeapon() {
      const lvl = state.level
      if (lvl >= WEAPONS.laser.levelRequired) return WEAPONS.laser
      if (lvl >= WEAPONS.rocket.levelRequired) return WEAPONS.rocket
      if (lvl >= WEAPONS.shotgun.levelRequired) return WEAPONS.shotgun
      if (lvl >= WEAPONS.rifle.levelRequired) return WEAPONS.rifle
      return WEAPONS.pistol
    }

    function applyPermanentPickup(type) {
      const p = state.player
      switch (type) {
        case 'hp':
          p.maxHp += 10
          p.hp = Math.min(p.hp + 10, p.maxHp)
          break
        case 'radius':
          p.magnetRadius *= 1.1
          break
        case 'fireRate':
          p.fireRateMul *= 1.01
          break
        case 'damage':
          p.damageMul *= 1.01
          break
        case 'critChance':
          p.critChance = Math.min(p.critChance + 0.01, 0.5)
          break
        case 'critDamage':
          // +1% = множитель * 1.01
          p.critMult *= 1.01
          break
        case 'range':
          p.rangeMul *= 1.01
          break
        default:
          break
      }
    }

    function applyTempPickup(type) {
      const dur = TEMP_BUFF_DURATIONS[type] || 20
      state.tempBuffs[type] = Math.max(state.tempBuffs[type], dur)
      if (type === 'xpBoost') state.player.xpBoostTimer = state.tempBuffs[type]
      if (type === 'immortal') state.player.immortalTimer = state.tempBuffs[type]
    }

    function addPickup(type, x, y) {
      if (!PICKUP_TYPES[type]) return
      state.pickups.push({
        type,
        x,
        y,
        r: 9,
      })
    }

    function spawnEnemiesForWave() {
      const wave = state.wave
      const count = 5 + wave * 2

      for (let i = 0; i < count; i++) {
        const dist = randRange(1600, 2000)
        const ang = Math.random() * Math.PI * 2
        const ex = state.player.x + Math.cos(ang) * dist
        const ey = state.player.y + Math.sin(ang) * dist

        // тип врага по волне
        let typeKey = 'normal'
        if (wave >= 7 && Math.random() < 0.15) typeKey = 'shooter'
        else if (wave >= 5 && Math.random() < 0.2) typeKey = 'fast'
        else if (wave >= 3 && Math.random() < 0.15) typeKey = 'tank'

        const def = ENEMY_TYPES[typeKey]
        state.enemies.push({
          typeKey,
          bossType: null,
          x: clamp(ex, -HALF_WORLD, HALF_WORLD),
          y: clamp(ey, -HALF_WORLD, HALF_WORLD),
          r: def.radius,
          hp: def.baseHp(wave),
          maxHp: def.baseHp(wave),
        })
      }

      // Shadow каждый 3-й волна начиная с 3
      if (wave >= 3 && wave % 3 === 0) {
        const dist = randRange(1600, 2000)
        const ang = Math.random() * Math.PI * 2
        const ex = state.player.x + Math.cos(ang) * dist
        const ey = state.player.y + Math.sin(ang) * dist
        const def = ENEMY_TYPES.shadow
        state.enemies.push({
          typeKey: 'shadow',
          bossType: 'shadow',
          x: clamp(ex, -HALF_WORLD, HALF_WORLD),
          y: clamp(ey, -HALF_WORLD, HALF_WORLD),
          r: def.radius,
          hp: def.baseHp(wave),
          maxHp: def.baseHp(wave),
        })
      }

      // боссы по схемам
      const bossesToSpawn = []

      // boss1
      if (wave >= 5) {
        const num = clamp(1 + Math.floor((wave - 5) / 5), 1, 4)
        for (let i = 0; i < num; i++) bossesToSpawn.push('boss1')
      }
      // boss2
      if (wave >= 10) {
        const num = clamp(1 + Math.floor((wave - 10) / 5), 1, 3)
        for (let i = 0; i < num; i++) bossesToSpawn.push('boss2')
      }
      // boss3
      if (wave >= 15) {
        const num = clamp(1 + Math.floor((wave - 15) / 5), 1, 2)
        for (let i = 0; i < num; i++) bossesToSpawn.push('boss3')
      }
      // boss4
      if (wave >= 20 && (wave - 20) % 5 === 0) {
        bossesToSpawn.push('boss4')
      }
      // xp boss
      if (wave >= 10 && wave % 2 === 0) {
        bossesToSpawn.push('bossXp')
      }
      // temp buff boss
      if (wave >= 8 && wave % 4 === 0) {
        bossesToSpawn.push('bossTemp')
      }

      for (const bKey of bossesToSpawn) {
        const dist = randRange(1600, 2000)
        const ang = Math.random() * Math.PI * 2
        const ex = state.player.x + Math.cos(ang) * dist
        const ey = state.player.y + Math.sin(ang) * dist
        const def = BOSS_TYPES[bKey]
        state.enemies.push({
          typeKey: 'boss',
          bossType: bKey,
          x: clamp(ex, -HALF_WORLD, HALF_WORLD),
          y: clamp(ey, -HALF_WORLD, HALF_WORLD),
          r: def.radius,
          hp: def.hp(wave),
          maxHp: def.hp(wave),
        })
      }

      state.waveInProgress = true
    }

    function levelUp() {
      state.level += 1
      const p = state.player
      // +5% ко всем базовым статам, кроме критов и HP
      p.damageMul *= 1.05
      p.fireRateMul *= 1.05
      p.rangeMul *= 1.05
      p.bulletSpeedMul *= 1.05
      p.magnetRadius *= 1.05
      // HP полностью восстановить
      p.hp = p.maxHp
      // новая цель XP
      state.xpToNext = Math.floor(10 + state.level * 3)
    }

    function addXp(amount) {
      let gain = amount
      if (state.tempBuffs.xpBoost > 0) gain *= 2
      state.xp += gain
      while (state.xp >= state.xpToNext) {
        state.xp -= state.xpToNext
        levelUp()
      }
    }

    function enemyDef(e, wave) {
      if (e.bossType) {
        return BOSS_TYPES[e.bossType]
      }
      return ENEMY_TYPES[e.typeKey]
    }

    function spawnSummonsAround(boss, wave) {
      const count = 5 + Math.floor(wave / 2)
      for (let i = 0; i < count; i++) {
        const dist = randRange(120, 240)
        const ang = Math.random() * Math.PI * 2
        const ex = boss.x + Math.cos(ang) * dist
        const ey = boss.y + Math.sin(ang) * dist
        const def = ENEMY_TYPES.fast
        state.enemies.push({
          typeKey: 'fast',
          bossType: null,
          x: clamp(ex, -HALF_WORLD, HALF_WORLD),
          y: clamp(ey, -HALF_WORLD, HALF_WORLD),
          r: def.radius,
          hp: def.baseHp(wave),
          maxHp: def.baseHp(wave),
        })
      }
    }

    function onEnemyKilled(e) {
      const wave = state.wave
      addXp(1 + (e.bossType ? 4 : 0))

      const def = enemyDef(e, wave)

      // специальные боссы
      if (e.bossType === 'bossXp') {
        addPickup('xpBoost', e.x, e.y)
        return
      }
      if (e.bossType === 'bossTemp') {
        const tempTypes = ['tempDamage', 'tempFireRate', 'tempRange', 'tempCrit']
        const num = randInt(2, 4)
        for (let i = 0; i < num; i++) {
          addPickup(choose(tempTypes), e.x + randRange(-40, 40), e.y + randRange(-40, 40))
        }
        return
      }
      if (e.bossType === 'shadow') {
        addPickup('immortal', e.x, e.y)
        return
      }

      // обычные враги: шанс пикапов
      if (!e.bossType) {
        if (Math.random() < 0.1) {
          const baseTypes = ['hp', 'radius', 'fireRate', 'damage', 'critChance', 'critDamage', 'range']
          addPickup(choose(baseTypes), e.x, e.y)
        }
        if (Math.random() < 0.02) {
          const tempTypes = ['tempDamage', 'tempFireRate', 'tempRange', 'tempCrit']
          addPickup(choose(tempTypes), e.x, e.y)
        }
        return
      }

      // обычные боссы 1–4
      const dropInfo = def.drops
      if (!dropInfo) return

      if (dropInfo.mega) {
        // финальный — +50% к постоянным статам (кроме критов и движения)
        const p = state.player
        p.damageMul *= 1.5
        p.fireRateMul *= 1.5
        p.rangeMul *= 1.5
        p.bulletSpeedMul *= 1.5
        p.magnetRadius *= 1.5
        return
      }

      const baseTypes = ['hp', 'radius', 'fireRate', 'damage', 'critChance', 'critDamage', 'range']
      const num = randInt(dropInfo.min, dropInfo.max)
      for (let i = 0; i < num; i++) {
        addPickup(choose(baseTypes), e.x + randRange(-40, 40), e.y + randRange(-40, 40))
      }

      if (def.isSummoner) {
        spawnSummonsAround(e, wave)
      }
    }

    function damagePlayer(amount, dtBased = false) {
      const p = state.player
      if (state.tempBuffs.immortal > 0) return
      const dmg = dtBased ? amount : amount
      p.hp -= dmg
      if (p.hp < 0) p.hp = 0
    }

    let last = performance.now()
    let rafId

    function loop(now) {
      const dt = (now - last) / 1000
      last = now
      update(dt)
      draw()
      rafId = requestAnimationFrame(loop)
    }

    function update(dt) {
      const { player } = state
      state.time += dt
      state.elapsed += dt

      // таймеры бафов
      for (const key of Object.keys(state.tempBuffs)) {
        if (state.tempBuffs[key] > 0) {
          state.tempBuffs[key] -= dt
          if (state.tempBuffs[key] < 0) state.tempBuffs[key] = 0
        }
      }
      player.immortalTimer = state.tempBuffs.immortal
      player.xpBoostTimer = state.tempBuffs.xpBoost

      // движение игрока
      const mv = { x: leftJoy.current.x, y: leftJoy.current.y }
      const mvLen = Math.hypot(mv.x, mv.y)
      if (mvLen > 0.05) {
        const nx = mv.x / mvLen
        const ny = mv.y / mvLen
        player.x += nx * player.speed * dt
        player.y += ny * player.speed * dt
      }

      player.x = clamp(player.x, -HALF_WORLD + player.radius, HALF_WORLD - player.radius)
      player.y = clamp(player.y, -HALF_WORLD + player.radius, HALF_WORLD - player.radius)

      // выбор оружия по уровню
      const weapon = getCurrentWeapon()
      state.weaponKey = weapon.name

      // стрельба
      if (state.fireCooldown > 0) state.fireCooldown -= dt
      const sh = { x: rightJoy.current.x, y: rightJoy.current.y }
      const aimLen = Math.hypot(sh.x, sh.y)

      if (weapon.type === 'laser') {
        // лазер — частые тики урона вдоль луча
        const baseCd = 1 / weapon.baseFireRate
        const rateMul =
          player.fireRateMul *
          player.baseFireRateMul *
          (state.tempBuffs.tempFireRate > 0 ? 1.6 : 1)
        const cd = baseCd / rateMul
        if (aimLen > 0.25 && state.fireCooldown <= 0) {
          state.fireCooldown = cd
          const nx = sh.x / aimLen
          const ny = sh.y / aimLen
          const range = weapon.baseRange * player.rangeMul * (state.tempBuffs.tempRange > 0 ? 1.5 : 1)
          const dmgBase = weapon.baseDamage * 0.5
          const dmgMul =
            player.damageMul *
            player.baseDamageMul *
            (state.tempBuffs.tempDamage > 0 ? 1.5 : 1)
          const totalBase = dmgBase * dmgMul

          // луч — просто проверяем врагов на расстоянии до range
          for (const e of state.enemies) {
            const dx = e.x - player.x
            const dy = e.y - player.y
            const proj = dx * nx + dy * ny
            if (proj <= 0 || proj > range) continue
            const px = player.x + nx * proj
            const py = player.y + ny * proj
            const dist2 = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py)
            const rr = e.r * e.r + 36
            if (dist2 <= rr) {
              let dmg = totalBase
              // криты
              let chance =
                player.critChance +
                (state.tempBuffs.tempCrit > 0 ? 0.2 : 0) // временный +20%
              chance = clamp(chance, 0, 0.75)
              let mult = player.critMult
              if (Math.random() < chance) {
                mult *= 1.5
              }
              dmg *= mult
              e.hp -= dmg
            }
          }
        }
      } else {
        const baseCd = 1 / weapon.baseFireRate
        const rateMul =
          player.fireRateMul *
          player.baseFireRateMul *
          (state.tempBuffs.tempFireRate > 0 ? 1.6 : 1)
        const cd = baseCd / rateMul

        if (aimLen > 0.25 && state.fireCooldown <= 0) {
          state.fireCooldown = cd
          const nx = sh.x / aimLen
          const ny = sh.y / aimLen

          const spreadRad = (weapon.spreadDeg * Math.PI) / 180
          const pellets = weapon.pellets

          const range =
            weapon.baseRange *
            player.rangeMul *
            (state.tempBuffs.tempRange > 0 ? 1.5 : 1)
          const speed =
            weapon.bulletSpeed *
            player.bulletSpeedMul *
            (state.tempBuffs.tempRange > 0 ? 1.0 : 1.0)
          const dmgBase = weapon.baseDamage
          const dmgMul =
            player.damageMul *
            player.baseDamageMul *
            (state.tempBuffs.tempDamage > 0 ? 1.5 : 1)

          for (let i = 0; i < pellets; i++) {
            const angOffset = pellets === 1 ? 0 : randRange(-spreadRad, spreadRad)
            const ax = Math.cos(Math.atan2(ny, nx) + angOffset)
            const ay = Math.sin(Math.atan2(ny, nx) + angOffset)
            state.bullets.push({
              x: player.x + ax * (player.radius + 8),
              y: player.y + ay * (player.radius + 8),
              vx: ax * speed,
              vy: ay * speed,
              r: 4,
              life: range / speed,
              dmgBase,
              dmgMul,
              weaponType: weapon.type,
              splashRadius: weapon.splashRadius,
              splashDamage: weapon.splashDamage,
            })
          }
        }
      }

      // обновление пуль игрока
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i]
        if (b.weaponType === 'laser') continue
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.life -= dt
        if (b.life <= 0) {
          state.bullets.splice(i, 1)
        }
      }

      // враги движутся к игроку
      for (const e of state.enemies) {
        const def = enemyDef(e, state.wave)
        const dx = player.x - e.x
        const dy = player.y - e.y
        const dist = Math.hypot(dx, dy)
        if (dist > 1) {
          const nx = dx / dist
          const ny = dy / dist
          const speed = def.speed ? def.speed(state.wave) : 60
          e.x += nx * speed * dt
          e.y += ny * speed * dt
        }
      }

      // враги-стрелки стреляют
      for (const e of state.enemies) {
        if (e.bossType || e.typeKey !== 'shooter') continue
        // простая автострельба: по таймеру в enemy
        if (!e.shootCd) e.shootCd = randRange(0, 1)
        e.shootCd -= dt
        if (e.shootCd <= 0) {
          e.shootCd = 1
          const dx = player.x - e.x
          const dy = player.y - e.y
          const dist = Math.hypot(dx, dy)
          if (dist < 1200) {
            const nx = dx / dist
            const ny = dy / dist
            const speed = 550
            state.enemyBullets.push({
              x: e.x + nx * (e.r + 4),
              y: e.y + ny * (e.r + 4),
              vx: nx * speed,
              vy: ny * speed,
              r: 4,
              dmg: def.dps || 8,
              life: 2,
            })
          }
        }
      }

      // обновление вражеских пуль
      for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const b = state.enemyBullets[i]
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.life -= dt
        if (b.life <= 0) {
          state.enemyBullets.splice(i, 1)
          continue
        }
        const dx = b.x - player.x
        const dy = b.y - player.y
        const rr = (b.r + player.radius) * (b.r + player.radius)
        if (dx * dx + dy * dy <= rr) {
          damagePlayer(b.dmg)
          state.enemyBullets.splice(i, 1)
        }
      }

      // столкновения врагов с игроком
      for (const e of state.enemies) {
        const def = enemyDef(e, state.wave)
        const dx = e.x - player.x
        const dy = e.y - player.y
        const rr = (e.r + player.radius) * (e.r + player.radius)
        if (dx * dx + dy * dy <= rr) {
          damagePlayer(def.dps * dt, true)
        }
      }

      // столкновения пуль игрока с врагами
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i]
        let hit = false
        for (const e of state.enemies) {
          const dx = e.x - b.x
          const dy = e.y - b.y
          const rr = (e.r + b.r) * (e.r + b.r)
          if (dx * dx + dy * dy <= rr) {
            hit = true
            // рассчёт урона
            const p = state.player
            let dmg = b.dmgBase * b.dmgMul
            let chance =
              p.critChance + (state.tempBuffs.tempCrit > 0 ? 0.2 : 0)
            chance = clamp(chance, 0, 0.75)
            let mult = p.critMult
            if (Math.random() < chance) {
              mult *= 1.5
            }
            dmg *= mult
            e.hp -= dmg

            if (b.splashRadius > 0) {
              for (const e2 of state.enemies) {
                if (e2 === e) continue
                const dx2 = e2.x - b.x
                const dy2 = e2.y - b.y
                const dist2 = Math.hypot(dx2, dy2)
                if (dist2 <= b.splashRadius + e2.r) {
                  e2.hp -= b.splashDamage * b.dmgMul
                }
              }
            }
            break
          }
        }
        if (hit) {
          state.bullets.splice(i, 1)
        }
      }

      // смерть врагов
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i]
        if (e.hp <= 0) {
          onEnemyKilled(e)
          state.enemies.splice(i, 1)
        }
      }

      // пикапы / магнит
      for (let i = state.pickups.length - 1; i >= 0; i--) {
        const pck = state.pickups[i]
        const dx = pck.x - player.x
        const dy = pck.y - player.y
        const dist = Math.hypot(dx, dy)
        if (dist <= player.magnetRadius) {
          const nx = dx / dist
          const ny = dy / dist
          pck.x -= nx * 400 * dt
          pck.y -= ny * 400 * dt
        }
        const rr = (pck.r + player.radius) * (pck.r + player.radius)
        if (dx * dx + dy * dy <= rr) {
          // забираем
          if (pck.type === 'xpBoost' || pck.type === 'immortal' || pck.type.startsWith('temp')) {
            applyTempPickup(pck.type)
          } else {
            applyPermanentPickup(pck.type)
          }
          state.pickups.splice(i, 1)
        }
      }

      // волны: если врагов нет и waveInProgress было true — старт новой
      if (state.waveInProgress && state.enemies.length === 0) {
        state.waveInProgress = false
      }
      if (!state.waveInProgress && state.enemies.length === 0) {
        state.wave += 1
        spawnEnemiesForWave()
      }

      // камера следует за игроком
      const speedFactor = 1 + (player.speed - BASE_PLAYER.speed) / BASE_PLAYER.speed * 0.05
      const targetX = player.x
      const targetY = player.y
      state.cam.x = lerp(state.cam.x, targetX, 0.15)
      state.cam.y = lerp(state.cam.y, targetY, 0.15)

      // смерть игрока — можно просто стопать движение/стрельбу
      if (player.hp <= 0) {
        // Ничего не делаем особого, можно добавить рестарт
      }
    }

    function draw() {
      const { w, h, cam, player } = state
      ctx.clearRect(0, 0, w, h)

      // фон: мягкий градиент
      const grd = ctx.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, '#020617')
      grd.addColorStop(1, '#020617')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      // сетка с параллаксом
      ctx.save()
      const gridSize = 80
      const parallax = 0.3
      const offsetX = ((-cam.x * parallax) % gridSize) + (w / 2) % gridSize
      const offsetY = ((-cam.y * parallax) % gridSize) + (h / 2) % gridSize
      ctx.strokeStyle = 'rgba(148,163,184,0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = -gridSize; x < w + gridSize; x += gridSize) {
        ctx.moveTo(x + offsetX, 0)
        ctx.lineTo(x + offsetX, h)
      }
      for (let y = -gridSize; y < h + gridSize; y += gridSize) {
        ctx.moveTo(0, y + offsetY)
        ctx.lineTo(w, y + offsetY)
      }
      ctx.stroke()
      ctx.restore()

      function worldToScreen(wx, wy) {
        const sx = (wx - cam.x) + w / 2
        const sy = (wy - cam.y) + h / 2
        return { x: sx, y: sy }
      }

      // пикапы
      for (const pck of state.pickups) {
        const pos = worldToScreen(pck.x, pck.y)
        const def = PICKUP_TYPES[pck.type]
        ctx.beginPath()
        ctx.fillStyle = def ? def.color : '#e5e7eb'
        ctx.arc(pos.x, pos.y, pck.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // враги
      for (const e of state.enemies) {
        const pos = worldToScreen(e.x, e.y)
        const def = enemyDef(e, state.wave)
        const color = def.color || '#f97373'
        // glow
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 12
        ctx.arc(pos.x, pos.y, e.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // пули врагов
      for (const b of state.enemyBullets) {
        const pos = worldToScreen(b.x, b.y)
        ctx.beginPath()
        ctx.fillStyle = '#f97373'
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // пули игрока
      for (const b of state.bullets) {
        const pos = worldToScreen(b.x, b.y)
        ctx.beginPath()
        ctx.fillStyle = '#e5e7eb'
        ctx.shadowColor = '#e5e7eb'
        ctx.shadowBlur = 8
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // игрок
      const pPos = worldToScreen(player.x, player.y)
      ctx.beginPath()
      ctx.fillStyle = '#38bdf8'
      ctx.shadowColor = '#38bdf8'
      ctx.shadowBlur = 12
      ctx.arc(pPos.x, pPos.y, player.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // HUD
      ctx.fillStyle = '#e5e7eb'
      ctx.font = '14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'left'

      ctx.fillText(`HP: ${player.hp.toFixed(0)} / ${player.maxHp}`, 16, 24)
      ctx.fillText(`XP: ${state.xp.toFixed(0)} / ${state.xpToNext}`, 16, 44)
      ctx.fillText(`LVL: ${state.level}`, 16, 64)
      ctx.fillText(`Wave: ${state.wave}`, 16, 84)
      ctx.fillText(`Time: ${state.elapsed.toFixed(1)}s`, 16, 104)
      ctx.fillText(`Weapon: ${state.weaponKey}`, 16, 124)

      let y = 148
      if (state.tempBuffs.xpBoost > 0) {
        ctx.fillStyle = '#22c55e'
        ctx.fillText(`XP x2: ${state.tempBuffs.xpBoost.toFixed(0)}s`, 16, y)
        y += 18
      }
      if (state.tempBuffs.immortal > 0) {
        ctx.fillStyle = '#64748b'
        ctx.fillText(`IMMORTAL: ${state.tempBuffs.immortal.toFixed(0)}s`, 16, y)
        y += 18
      }
      if (state.tempBuffs.tempDamage > 0) {
        ctx.fillStyle = '#e11d48'
        ctx.fillText(`DMG buff: ${state.tempBuffs.tempDamage.toFixed(0)}s`, 16, y)
        y += 18
      }
      if (state.tempBuffs.tempFireRate > 0) {
        ctx.fillStyle = '#38bdf8'
        ctx.fillText(`FIRE buff: ${state.tempBuffs.tempFireRate.toFixed(0)}s`, 16, y)
        y += 18
      }
      if (state.tempBuffs.tempRange > 0) {
        ctx.fillStyle = '#6366f1'
        ctx.fillText(`RANGE buff: ${state.tempBuffs.tempRange.toFixed(0)}s`, 16, y)
        y += 18
      }
      if (state.tempBuffs.tempCrit > 0) {
        ctx.fillStyle = '#facc15'
        ctx.fillText(`CRIT buff: ${state.tempBuffs.tempCrit.toFixed(0)}s`, 16, y)
        y += 18
      }
    }

    // старт
    spawnEnemiesForWave()
    let raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [size.w, size.h])

  function updateJoystickVector(e, joyRef) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width * 0.5
    const cy = rect.top + rect.height * 0.5
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const radius = rect.width * 0.4
    let nx = dx / radius
    let ny = dy / radius
    const len = Math.hypot(nx, ny)
    if (len > 1) {
      nx /= len
      ny /= len
    }
    joyRef.current.x = nx
    joyRef.current.y = ny
  }

  function makeHandlers(joyRef) {
    return {
      onPointerDown: (e) => {
        e.preventDefault()
        joyRef.current.active = true
        joyRef.current.id = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        updateJoystickVector(e, joyRef)
      },
      onPointerMove: (e) => {
        if (!joyRef.current.active || joyRef.current.id !== e.pointerId) return
        e.preventDefault()
        updateJoystickVector(e, joyRef)
      },
      onPointerUp: (e) => {
        if (joyRef.current.id !== e.pointerId) return
        e.preventDefault()
        joyRef.current.active = false
        joyRef.current.id = null
        joyRef.current.x = 0
        joyRef.current.y = 0
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {}
      },
      onPointerCancel: (e) => {
        e.preventDefault()
        joyRef.current.active = false
        joyRef.current.id = null
        joyRef.current.x = 0
        joyRef.current.y = 0
      },
    }
  }

  const leftHandlers = makeHandlers(leftJoy)
  const rightHandlers = makeHandlers(rightJoy)

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="joystick-layer">
        <div className="joystick-zone left" {...leftHandlers}>
          <div className="joystick-circle" />
        </div>
        <div className="joystick-zone right" {...rightHandlers}>
          <div className="joystick-circle" />
        </div>
      </div>
    </div>
  )
                          }
