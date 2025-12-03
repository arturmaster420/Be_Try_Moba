
import React, { useEffect, useRef, useState } from "react";
import { createInitialState, resetState } from "./game/state";
import { updateGame } from "./game/logic";
import { renderGame } from "./game/render";
import { WEAPONS } from "./game/weapons";

const isClient = typeof window !== "undefined";

export default function App() {
  const canvasRef = useRef(null);
  const stateRef = useRef(createInitialState());
  const runningRef = useRef(false);
  const lastTimeRef = useRef(0);

  const [view, setView] = useState({
    w: isClient ? window.innerWidth : 800,
    h: isClient ? window.innerHeight : 600,
  });
  const [uiTick, setUiTick] = useState(0);
  const [isMobile, setIsMobile] = useState(
    isClient ? window.innerWidth < 900 || "ontouchstart" in window : false
  );

  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, down: false });

  const leftJoyRef = useRef({
    active: false,
    id: null,
    sx: 0,
    sy: 0,
    x: 0,
    y: 0,
  });
  const rightJoyRef = useRef({
    active: false,
    id: null,
    sx: 0,
    sy: 0,
    x: 0,
    y: 0,
  });

  // resize / mobile detection
  useEffect(() => {
    if (!isClient) return;
    const onResize = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
      setIsMobile(window.innerWidth < 900 || "ontouchstart" in window);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // простая перерисовка UI (hp/xp/бар оружия) раз в 100мс
  useEffect(() => {
    const id = setInterval(() => setUiTick((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);

  // клавиатура
  useEffect(() => {
    if (!isClient) return;
    const onKeyDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;

      // restart
      if (e.key === "r" || e.key === "R") {
        handleRestart();
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleRestart = () => {
    const s = stateRef.current;
    resetState(s);
  };

  // основной игровой цикл
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    runningRef.current = true;
    lastTimeRef.current = performance.now();

    function frame(now) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const state = stateRef.current;

      const input = computeInput(state);
      updateGame(state, dt, view.w, view.h, input);
      renderGame(ctx, state, view.w, view.h);

      if (runningRef.current) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);

    return () => {
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.w, view.h]);

  function computeInput(state) {
    const width = view.w;
    const height = view.h;

    let moveX = 0;
    let moveY = 0;
    let aimX = 0;
    let aimY = 0;
    let shooting = false;

    if (isMobile) {
      // движение
      const left = leftJoyRef.current;
      if (left.active) {
        const dx = left.x - left.sx;
        const dy = left.y - left.sy;
        moveX = dx;
        moveY = dy;
      }

      // прицел
      const right = rightJoyRef.current;
      if (right.active) {
        const dx = right.x - right.sx;
        const dy = right.y - right.sy;
        aimX = dx;
        aimY = dy;
        shooting = Math.hypot(dx, dy) > 8;
      }
    } else {
      // WASD
      if (keysRef.current["w"] || keysRef.current["arrowup"]) moveY -= 1;
      if (keysRef.current["s"] || keysRef.current["arrowdown"]) moveY += 1;
      if (keysRef.current["a"] || keysRef.current["arrowleft"]) moveX -= 1;
      if (keysRef.current["d"] || keysRef.current["arrowright"]) moveX += 1;

      // прицел — мышь от центра экрана
      const cx = width / 2;
      const cy = height / 2;
      aimX = mouseRef.current.x - cx;
      aimY = mouseRef.current.y - cy;

      shooting = mouseRef.current.down;
    }

    return { moveX, moveY, aimX, aimY, shooting };
  }

  function handlePointerDown(e) {
    if (!isMobile) {
      mouseRef.current.down = true;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      return;
    }

    const half = view.w / 2;
    const isLeft = e.clientX < half;
    const joy = isLeft ? leftJoyRef.current : rightJoyRef.current;

    joy.active = true;
    joy.id = e.pointerId;
    joy.sx = e.clientX;
    joy.sy = e.clientY;
    joy.x = e.clientX;
    joy.y = e.clientY;
  }

  function handlePointerMove(e) {
    if (!isMobile) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      return;
    }

    const left = leftJoyRef.current;
    const right = rightJoyRef.current;

    if (left.active && left.id === e.pointerId) {
      left.x = e.clientX;
      left.y = e.clientY;
    } else if (right.active && right.id === e.pointerId) {
      right.x = e.clientX;
      right.y = e.clientY;
    }
  }

  function handlePointerUp(e) {
    if (!isMobile) {
      mouseRef.current.down = false;
      return;
    }

    const left = leftJoyRef.current;
    const right = rightJoyRef.current;

    if (left.active && left.id === e.pointerId) {
      left.active = false;
      left.id = null;
    } else if (right.active && right.id === e.pointerId) {
      right.active = false;
      right.id = null;
    }
  }

  const state = stateRef.current;
  const currentWeaponKey = state.currentWeapon;
  const unlocked = state.unlockedWeapons || ["pistol"];

  return (
    <div className="app-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={view.w}
        height={view.h}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Всегда видимый бар оружия, отдельный от уровней */}
      <div className="top-ui">
        <div className="weapon-bar">
          {Object.keys(WEAPONS).map((key) => {
            const w = WEAPONS[key];
            const isUnlocked = unlocked.includes(key);
            const isActive = key === currentWeaponKey;
            return (
              <button
                key={key}
                className={
                  "weapon-btn" +
                  (isActive ? " weapon-btn-active" : "") +
                  (!isUnlocked ? " weapon-btn-locked" : "")
                }
                disabled={!isUnlocked}
                onClick={() => {
                  stateRef.current.currentWeapon = key;
                }}
              >
                <span className="weapon-short">{w.shortLabel}</span>
                <span className="weapon-name">
                  {w.name}
                  {w.levelRequired > 1 ? ` (Lv ${w.levelRequired})` : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="top-right">
          <button className="restart-btn" onClick={handleRestart}>
            Restart (R)
          </button>
        </div>
      </div>

      {/* Мобильные джойстики */}
      {isMobile && (
        <>
          <div className="joystick left-joy">
            {leftJoyRef.current.active && (
              <div
                className="joystick-inner"
                style={{
                  left: leftJoyRef.current.x - leftJoyRef.current.sx + 40,
                  top: leftJoyRef.current.y - leftJoyRef.current.sy + 40,
                }}
              />
            )}
          </div>
          <div className="joystick right-joy">
            {rightJoyRef.current.active && (
              <div
                className="joystick-inner"
                style={{
                  left: rightJoyRef.current.x - rightJoyRef.current.sx + 40,
                  top: rightJoyRef.current.y - rightJoyRef.current.sy + 40,
                }}
              />
            )}
          </div>
        </>
      )}

      <div className="debug-label">
        WASD + Mouse (PC), dual-stick (mobile). R — restart.
      </div>
    </div>
  );
}
