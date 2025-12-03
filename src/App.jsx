import React, { useEffect, useRef, useState } from "react";
import { createInitialState, resetState } from "./game/state";
import { updateGame } from "./game/logic";
import { renderGame } from "./game/render";

export default function App() {
  const canvasRef = useRef(null);
  const stateRef = useRef(createInitialState());
  const runningRef = useRef(false);
  const lastTimeRef = useRef(0);

  const [view, setView] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 800,
    h: typeof window !== "undefined" ? window.innerHeight : 600,
  });

  const [uiLevel, setUiLevel] = useState(1);
  const uiTimerRef = useRef(0);

  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const [gameOver, setGameOver] = useState(false);

  const moveRef = useRef({ x: 0, y: 0 });
  const aimRef = useRef({ x: 0, y: 0 });
  const shootingRef = useRef(false);

  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, down: false });

  const leftJoyRef = useRef({
    active: false,
    id: null,
    cx: 0,
    cy: 0,
    x: 0,
    y: 0,
  });
  const rightJoyRef = useRef({
    active: false,
    id: null,
    cx: 0,
    cy: 0,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const onResize = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    const onMouseMove = (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const onMouseDown = (e) => {
      if (e.button === 0) {
        mouseRef.current.down = true;
      }
    };
    const onMouseUp = (e) => {
      if (e.button === 0) {
        mouseRef.current.down = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let frameId;

    const loop = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      const state = stateRef.current;

      // собрать ввод
      const mv = { x: 0, y: 0 };
      const aim = { x: 0, y: 0 };
      let shooting = false;

      // WASD
      if (keysRef.current["w"] || keysRef.current["arrowup"]) mv.y -= 1;
      if (keysRef.current["s"] || keysRef.current["arrowdown"]) mv.y += 1;
      if (keysRef.current["a"] || keysRef.current["arrowleft"]) mv.x -= 1;
      if (keysRef.current["d"] || keysRef.current["arrowright"]) mv.x += 1;

      // мышь: направление от центра экрана
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const mx = mouseRef.current.x || cx;
      const my = mouseRef.current.y || cy;
      const ax = mx - cx;
      const ay = my - cy;
      aim.x = ax;
      aim.y = ay;
      shooting = mouseRef.current.down;

      // джойстики (только для тач-устройств / pointerType=touch)
      const lj = leftJoyRef.current;
      const rj = rightJoyRef.current;
      if (lj.active) {
        const dx = lj.x - lj.cx;
        const dy = lj.y - lj.cy;
        const len = Math.hypot(dx, dy);
        if (len > 8) {
          mv.x = dx / 50;
          mv.y = dy / 50;
        }
      }
      if (rj.active) {
        const dx = rj.x - rj.cx;
        const dy = rj.y - rj.cy;
        const len = Math.hypot(dx, dy);
        if (len > 8) {
          aim.x = dx;
          aim.y = dy;
          shooting = true;
        }
      }

      moveRef.current = mv;
      aimRef.current = aim;
      shootingRef.current = shooting;

      updateGame(
        state,
        {
          moveX: mv.x,
          moveY: mv.y,
          aimX: aim.x,
          aimY: aim.y,
          shooting,
          paused: pausedRef.current,
          gameOver: gameOver,
        },
        dt
      );

      if (state.player.hp <= 0 && !gameOver) {
        setGameOver(true);
      }

      // обновление UI уровня раз в 0.25с
      uiTimerRef.current += dt;
      if (uiTimerRef.current > 0.25) {
        uiTimerRef.current = 0;
        setUiLevel(state.level);
      }

      canvas.width = view.w;
      canvas.height = view.h;
      renderGame(ctx, state, view.w, view.h);

      if (runningRef.current) {
        frameId = requestAnimationFrame(loop);
      }
    };

    runningRef.current = true;
    frameId = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(frameId);
    };
  }, [view.w, view.h, gameOver]);

  const onRestart = () => {
    const st = stateRef.current;
    resetState(st);
    setGameOver(false);
    pausedRef.current = false;
    setPaused(false);
  };

  const togglePause = () => {
    const val = !pausedRef.current;
    pausedRef.current = val;
    setPaused(val);
  };

  const handleJoystickDown = (side, e) => {
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const joy = side === "left" ? leftJoyRef.current : rightJoyRef.current;
    joy.active = true;
    joy.id = e.pointerId;
    joy.cx = cx;
    joy.cy = cy;
    joy.x = e.clientX;
    joy.y = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleJoystickMove = (side, e) => {
    if (e.pointerType !== "touch") return;
    const joy = side === "left" ? leftJoyRef.current : rightJoyRef.current;
    if (!joy.active || joy.id !== e.pointerId) return;
    joy.x = e.clientX;
    joy.y = e.clientY;
  };

  const handleJoystickUp = (side, e) => {
    if (e.pointerType !== "touch") return;
    const joy = side === "left" ? leftJoyRef.current : rightJoyRef.current;
    if (joy.id !== e.pointerId) return;
    joy.active = false;
    joy.id = null;
    joy.x = joy.cx;
    joy.y = joy.cy;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleSwitchWeapon = () => {
    const st = stateRef.current;
    if (!st) return;
    if (st.level < 50) {
      return;
    }
    const order = ["laser", "pistol", "rifle", "shotgun", "rocket"];
    const currentKey = st.selectedWeaponKey || "laser";
    const idx = order.indexOf(currentKey);
    const nextKey = order[(idx + 1) % order.length];
    st.selectedWeaponKey = nextKey;
  };

  const leftJoy = leftJoyRef.current;
  const rightJoy = rightJoyRef.current;

  return (
    <div className="app-root">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="ui-layer">
        <button className="pause-btn" onClick={togglePause}>
          {paused ? "Resume" : "Pause"}
        </button>

        {uiLevel >= 50 && (
          <button className="weapon-switch-btn" onClick={handleSwitchWeapon}>
            ↻ Weapon
          </button>
        )}

        {leftJoy.cx !== 0 && (
          <div className="debug-label">
            LVL {uiLevel} {gameOver ? "— GAME OVER (tap R to restart)" : ""}
          </div>
        )}
      </div>

      {/* Джойстики — только на тач-устройствах (pointerType='touch') */}
      <div
        className="joystick joystick-left"
        onPointerDown={(e) => handleJoystickDown("left", e)}
        onPointerMove={(e) => handleJoystickMove("left", e)}
        onPointerUp={(e) => handleJoystickUp("left", e)}
        onPointerCancel={(e) => handleJoystickUp("left", e)}
      >
        <div
          className="joystick-inner"
          style={{
            left: leftJoy.cx ? leftJoy.x - (leftJoy.cx - 70) : "50%",
            top: leftJoy.cy ? leftJoy.y - (leftJoy.cy - 70) : "50%",
          }}
        />
      </div>

      <div
        className="joystick joystick-right"
        onPointerDown={(e) => handleJoystickDown("right", e)}
        onPointerMove={(e) => handleJoystickMove("right", e)}
        onPointerUp={(e) => handleJoystickUp("right", e)}
        onPointerCancel={(e) => handleJoystickUp("right", e)}
      >
        <div
          className="joystick-inner"
          style={{
            left: rightJoy.cx ? rightJoy.x - (rightJoy.cx - 70) : "50%",
            top: rightJoy.cy ? rightJoy.y - (rightJoy.cy - 70) : "50%",
          }}
        />
      </div>
    </div>
  );
}
