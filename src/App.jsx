import React, { useEffect, useRef, useState } from 'react'

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

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
      player: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        r: 18,
        speed: 220,
        hp: 100,
        maxHp: 100,
      },
      bullets: [],
      enemies: [],
      orbs: [],
      fireCooldown: 0,
      enemySpawnTimer: 0.8,
      time: 0,
      xp: 0,
      level: 1,
      elapsed: 0,
    }

    function spawnEnemy() {
      const margin = 40
      const side = Math.floor(Math.random() * 4)
      let x, y
      if (side === 0) {
        x = -margin
        y = Math.random() * state.h
      } else if (side === 1) {
        x = state.w + margin
        y = Math.random() * state.h
      } else if (side === 2) {
        x = Math.random() * state.w
        y = -margin
      } else {
        x = Math.random() * state.w
        y = state.h + margin
      }
      const r = 14
      const hp = 4 + Math.floor(state.level * 0.8)
      state.enemies.push({ x, y, r, hp })
    }

    function spawnOrb(x, y) {
      state.orbs.push({ x, y, r: 6, value: 1 })
    }

    function tryLevelUp() {
      const need = 5 + state.level * 3
      if (state.xp >= need) {
        state.xp -= need
        state.level += 1
        state.player.maxHp += 4
        state.player.hp = state.player.maxHp
      }
    }

    let last = performance.now()
    let raf

    function loop(now) {
      const dt = (now - last) / 1000
      last = now
      update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }

    function update(dt) {
      state.time += dt
      state.elapsed += dt

      const mv = { x: leftJoy.current.x, y: leftJoy.current.y }
      const sh = { x: rightJoy.current.x, y: rightJoy.current.y }

      // movement
      const len = Math.hypot(mv.x, mv.y)
      if (len > 0.05) {
        const nx = mv.x / len
        const ny = mv.y / len
        state.player.x += nx * state.player.speed * dt
        state.player.y += ny * state.player.speed * dt
      }

      // clamp to screen
      state.player.x = clamp(state.player.x, state.player.r, state.w - state.player.r)
      state.player.y = clamp(state.player.y, state.player.r, state.h - state.player.r)

      // shooting
      if (state.fireCooldown > 0) state.fireCooldown -= dt

      const alen = Math.hypot(sh.x, sh.y)
      if (alen > 0.25 && state.fireCooldown <= 0) {
        const nx = sh.x / alen
        const ny = sh.y / alen
        const bulletSpeed = 520
        const bx = state.player.x + nx * (state.player.r + 6)
        const by = state.player.y + ny * (state.player.r + 6)
        state.bullets.push({
          x: bx,
          y: by,
          r: 4,
          vx: nx * bulletSpeed,
          vy: ny * bulletSpeed,
          life: 1.1,
          dmg: 1 + Math.floor(state.level * 0.3),
        })
        const minCd = 0.06
        const baseCd = 0.16 - state.level * 0.004
        state.fireCooldown = baseCd < minCd ? minCd : baseCd
      }

      // bullets
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i]
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.life -= dt
        if (
          b.life <= 0 ||
          b.x < -20 ||
          b.x > state.w + 20 ||
          b.y < -20 ||
          b.y > state.h + 20
        ) {
          state.bullets.splice(i, 1)
        }
      }

      // spawn enemies
      state.enemySpawnTimer -= dt
      const minSpawn = 0.2
      const baseSpawn = 0.9 - state.level * 0.03
      const targetSpawn = baseSpawn < minSpawn ? minSpawn : baseSpawn
      if (state.enemySpawnTimer <= 0) {
        const batch = 1 + Math.floor(state.level / 4)
        for (let i = 0; i < batch; i++) spawnEnemy()
        state.enemySpawnTimer = targetSpawn
      }

      // move enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i]
        const dx = state.player.x - e.x
        const dy = state.player.y - e.y
        const dist = Math.hypot(dx, dy)
        const speed = 70 + state.level * 7
        if (dist > 1) {
          const nx = dx / dist
          const ny = dy / dist
          e.x += nx * speed * dt
          e.y += ny * speed * dt
        }

        const minDist = e.r + state.player.r
        if (dist < minDist) {
          state.player.hp -= (8 + state.level * 1.2) * dt
          if (state.player.hp < 0) state.player.hp = 0
        }
      }

      // bullets vs enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i]
        let dead = false
        for (let j = state.bullets.length - 1; j >= 0; j--) {
          const b = state.bullets[j]
          const dx = e.x - b.x
          const dy = e.y - b.y
          const rr = (e.r + b.r) * (e.r + b.r)
          if (dx * dx + dy * dy <= rr) {
            state.bullets.splice(j, 1)
            e.hp -= b.dmg
            if (e.hp <= 0) {
              dead = true
              break
            }
          }
        }
        if (dead) {
          spawnOrb(e.x, e.y)
          state.enemies.splice(i, 1)
          state.xp += 1
          tryLevelUp()
        }
      }

      // pickup orbs
      for (let i = state.orbs.length - 1; i >= 0; i--) {
        const o = state.orbs[i]
        const dx = o.x - state.player.x
        const dy = o.y - state.player.y
        const dist2 = dx * dx + dy * dy
        const rr = (o.r + state.player.r) * (o.r + state.player.r)
        if (dist2 <= rr) {
          state.xp += o.value
          state.orbs.splice(i, 1)
          tryLevelUp()
        }
      }
    }

    function draw() {
      const { w, h } = state
      ctx.clearRect(0, 0, w, h)

      // background
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, w, h)

      // grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
      ctx.lineWidth = 1
      const grid = 80
      ctx.beginPath()
      const offset = (state.time * 24) % grid
      for (let x = -grid + offset; x < w + grid; x += grid) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      for (let y = -grid + offset; y < h + grid; y += grid) {
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }
      ctx.stroke()

      // orbs
      for (const o of state.orbs) {
        ctx.beginPath()
        ctx.fillStyle = '#22c55e'
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // enemies
      for (const e of state.enemies) {
        ctx.beginPath()
        ctx.fillStyle = '#ef4444'
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // bullets
      for (const b of state.bullets) {
        ctx.beginPath()
        ctx.fillStyle = '#e5e7eb'
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // player
      ctx.beginPath()
      ctx.fillStyle = '#38bdf8'
      ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2)
      ctx.fill()

      // HUD
      ctx.fillStyle = '#e5e7eb'
      ctx.font = '14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`HP: ${state.player.hp.toFixed(0)} / ${state.player.maxHp}`, 16, 24)
      ctx.fillText(`XP: ${state.xp}`, 16, 44)
      ctx.fillText(`LVL: ${state.level}`, 16, 64)
      ctx.fillText(`Time: ${state.elapsed.toFixed(1)}s`, 16, 84)
    }

    let raf = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(raf)
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
