import { useEffect, useRef } from "react";

const WIDTH = 800;
const HEIGHT = 500;

export default function GameCanvas({ state, setHumanAction }) {
  const canvasRef = useRef(null);

  const keysRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
  });

  const aimDirRef = useRef(0);
  const shootRef = useRef(0);

  useEffect(() => {
    const keyDown = (e) => {
      const k = e.key.toLowerCase();

      if (k === "w") keysRef.current.w = true;
      if (k === "a") keysRef.current.a = true;
      if (k === "s") keysRef.current.s = true;
      if (k === "d") keysRef.current.d = true;

      updateAction();
    };

    const keyUp = (e) => {
      const k = e.key.toLowerCase();

      if (k === "w") keysRef.current.w = false;
      if (k === "a") keysRef.current.a = false;
      if (k === "s") keysRef.current.s = false;
      if (k === "d") keysRef.current.d = false;

      updateAction();
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const updateAction = () => {
    const k = keysRef.current;

    let moveDir = 0;

    if (k.w && !k.a && !k.d) moveDir = 1;
    else if (k.w && k.d) moveDir = 2;
    else if (k.d && !k.w && !k.s) moveDir = 3;
    else if (k.s && k.d) moveDir = 4;
    else if (k.s && !k.a && !k.d) moveDir = 5;
    else if (k.s && k.a) moveDir = 6;
    else if (k.a && !k.w && !k.s) moveDir = 7;
    else if (k.w && k.a) moveDir = 8;

    setHumanAction([
      moveDir,
      aimDirRef.current,
      shootRef.current,
    ]);
  };

  const handleMouseMove = (e) => {
    if (!state) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const me = state.players[0];

    const dx = mx - me.x;
    const dy = my - me.y;

    let angle = Math.atan2(dy, dx);

    if (angle < 0) angle += 2 * Math.PI;

    const aimDir =
      Math.round(angle / (2 * Math.PI / 16)) % 16;

    aimDirRef.current = aimDir;

    updateAction();
  };

  const handleMouseDown = () => {
    shootRef.current = 1;
    updateAction();
  };

  const handleMouseUp = () => {
    shootRef.current = 0;
    updateAction();
  };

  useEffect(() => {
    if (!state) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // obstacles
    state.obstacles.forEach((o) => {
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(
        o.x,
        o.y,
        o.w,
        o.h
      );
    });

    // bullets
    state.bullets.forEach((b) => {
      ctx.beginPath();

      ctx.fillStyle =
        b.team === 0 ? "#22c55e" : "#ef4444";

      ctx.arc(b.x, b.y, 5, 0, 2 * Math.PI);

      ctx.fill();
    });

    // players
    state.players.forEach((p) => {
      ctx.beginPath();

      ctx.fillStyle =
        p.team === 0 ? "#22c55e" : "#ef4444";

      ctx.arc(p.x, p.y, 18, 0, 2 * Math.PI);

      ctx.fill();

      const gunX =
        p.x + Math.cos(p.aim_angle) * 25;

      const gunY =
        p.y + Math.sin(p.aim_angle) * 25;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(gunX, gunY);
      ctx.stroke();

      // hp bar
      ctx.fillStyle = "red";
      ctx.fillRect(
        p.x - 20,
        p.y - 30,
        40,
        5
      );

      ctx.fillStyle = "lime";

      ctx.fillRect(
        p.x - 20,
        p.y - 30,
        (40 * p.health) / 100,
        5
      );
    });
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  );
}