import React, { useEffect, useRef, useState } from "react";
import { createInitialState } from "./game/state";
import { updateGame } from "./game/logic";
import { renderGame } from "./game/render";

export default function App() {
  const canvasRef = useRef(null);

  const leftJoy = useRef({ active: false, id: null, x: 0, y: 0 });
  const rightJoy = useRef({ active: false, id: null, x: 0, y: 0 });

  const keyboardRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const mouseAimRef = useRef({ x: 0, y: 0, active: false });
  const mouseShootRef = useRef(false);

  const pausedRef = useRef(false);
  const gameOverRef = useRef(false);
  const stateRef = useRef(null);

  const [view, setView] = useState({
    w:
      typeof window !== "undefined" ? window.innerWidth : 800,
    h:
      typeof window !== "undefined" ? window.innerHeight : 600,
  });
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const onResize = () => {
      setView({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = view.w;
    canvas.height = view.h;

    if (!stateRef.current) {
      stateRef.current = createInitialState(view.w, view.h);
    } else {
      stateRef.current.w = view.w;
      stateRef.current.h = view.h;
    }

    let last = performance.now();
    let rafId;

    function loop(now) {
      let dt = (now - last) / 1000;
      last = now;

      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const state = stateRef.current;
      if (!state) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const kb = keyboardRef.current;
      let moveX =
        (kb.right ? 1 : 0) - (kb.left ? 1 : 0);
      let moveY =
        (kb.down ? 1 : 0) - (kb.up ? 1 : 0);

      if (
        Math.hypot(leftJoy.current.x, leftJoy.current.y) > 0.05 &&
        leftJoy.current.active
      ) {
        moveX = leftJoy.current.x;
        moveY = leftJoy.current.y;
      }

      let aimX = rightJoy.current.x;
      let aimY = rightJoy.current.y;
      let shooting = false;

      if (
        Math.hypot(aimX, aimY) > 0.25 &&
        rightJoy.current.active
      ) {
        shooting = true;
      } else {
        const m = mouseAimRef.current;
        if (m.active) {
          aimX = m.x;
          aimY = m.y;
        }
        if (
          Math.hypot(aimX, aimY) > 0.25 &&
          mouseShootRef.current
        ) {
          shooting = true;
        }
      }

      const input = {
        moveX,
        moveY,
        aimX,
        aimY,
        shooting,
        paused: pausedRef.current,
        gameOver: gameOverRef.current,
      };

      updateGame(state, input, dt);

      renderGame(state, ctx);

      if (
        state.player.hp <= 0 &&
        !gameOverRef.current
      ) {
        gameOverRef.current = true;
        pausedRef.current = true;
        setGameOver(true);
        setPaused(true);
      }

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [view.w, view.h]);

  useEffect(() => {
    function setKey(key, isDown) {
      const k = keyboardRef.current;
      if (key === "w" || key === "ArrowUp") k.up = isDown;
      if (key === "s" || key === "ArrowDown") k.down = isDown;
      if (key === "a" || key === "ArrowLeft") k.left = isDown;
      if (key === "d" || key === "ArrowRight") k.right = isDown;
    }

    function handleKeyDown(e) {
      setKey(e.key, true);
    }
    function handleKeyUp(e) {
      setKey(e.key, false);
    }

    function handleMouseMove(e) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.6;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const radius = Math.max(rect.width, rect.height) * 0.4;
      let nx = dx / radius;
      let ny = dy / radius;
      const len = Math.hypot(nx, ny);
      if (len > 0.05) {
        if (len > 1) {
          nx /= len;
          ny /= len;
        }
        mouseAimRef.current.x = nx;
        mouseAimRef.current.y = ny;
        mouseAimRef.current.active = true;
      } else {
        mouseAimRef.current.active = false;
      }
    }

    function handleMouseDown(e) {
      if (e.button === 0) {
        mouseShootRef.current = true;
        handleMouseMove(e);
      }
    }

    function handleMouseUp(e) {
      if (e.button === 0) {
        mouseShootRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function updateJoystickVector(e, joyRef) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width * 0.4;
    let nx = dx / radius;
    let ny = dy / radius;
    const len = Math.hypot(nx, ny);
    if (len > 1) {
      nx /= len;
      ny /= len;
    }
    joyRef.current.x = nx;
    joyRef.current.y = ny;
  }

  function makeHandlers(joyRef) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        joyRef.current.active = true;
        joyRef.current.id = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateJoystickVector(e, joyRef);
      },
      onPointerMove: (e) => {
        if (
          !joyRef.current.active ||
          joyRef.current.id !== e.pointerId
        )
          return;
        e.preventDefault();
        updateJoystickVector(e, joyRef);
      },
      onPointerUp: (e) => {
        if (joyRef.current.id !== e.pointerId) return;
        e.preventDefault();
        joyRef.current.active = false;
        joyRef.current.id = null;
        joyRef.current.x = 0;
        joyRef.current.y = 0;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
      },
      onPointerCancel: (e) => {
        e.preventDefault();
        joyRef.current.active = false;
        joyRef.current.id = null;
        joyRef.current.x = 0;
        joyRef.current.y = 0;
      },
    };
  }

  const leftHandlers = makeHandlers(leftJoy);
  const rightHandlers = makeHandlers(rightJoy);

  function togglePause() {
    if (gameOverRef.current) return;
    const newVal = !pausedRef.current;
    pausedRef.current = newVal;
    setPaused(newVal);
  }

  function restartGame() {
    window.location.reload();
  }

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

      <button className="pause-btn" onClick={togglePause}>
        {paused ? "▶" : "II"}
      </button>

      {gameOver && (
        <div className="game-over-box">
          <div className="game-over-title">GAME OVER</div>
          <button className="restart-btn" onClick={restartGame}>
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
