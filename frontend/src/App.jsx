// import { useEffect, useState } from "react";
// import GameCanvas from "./components/GameCanvas";

// const API = "http://localhost:5000";

// export default function App() {
//   const [maps, setMaps] = useState([]);
//   const [agents, setAgents] = useState([]);

//   const [mapId, setMapId] = useState("map1");
//   const [enemyAgent, setEnemyAgent] = useState("rulebased");

//   const [gameState, setGameState] = useState(null);
//   const [running, setRunning] = useState(false);

//   const [humanAction, setHumanAction] = useState([0, 0, 0]);

//   useEffect(() => {
//     fetch(`${API}/api/maps`)
//       .then(r => r.json())
//       .then(d => setMaps(d.maps));

//     fetch(`${API}/api/agents`)
//       .then(r => r.json())
//       .then(d => setAgents(d.agents));
//   }, []);

//   useEffect(() => {
//     if (!running) return;

//     const timer = setInterval(async () => {
//       const res = await fetch(`${API}/api/step`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           human_action: humanAction,
//         }),
//       });

//       const data = await res.json();

//       if (data.state) {
//         setGameState(data.state);
//       }

//       if (data.done) {
//         setRunning(false);
//         alert(`Winner: ${data.match_info.winner}`);
//       }
//     }, 50);

//     return () => clearInterval(timer);
//   }, [running, humanAction]);

//   const startGame = async () => {
//     const res = await fetch(`${API}/api/start`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         agent0: "human",
//         agent1: enemyAgent,
//         map_id: mapId,
//       }),
//     });

//     const data = await res.json();

//     setGameState(data.state);
//     setRunning(true);
//   };

//   return (
//     <div className="app">
//       <h1>Mini Militia RL</h1>

//       <div className="controls">
//         <select value={mapId} onChange={e => setMapId(e.target.value)}>
//           {maps.map(m => (
//             <option key={m.id} value={m.id}>
//               {m.name}
//             </option>
//           ))}
//         </select>

//         <select
//           value={enemyAgent}
//           onChange={e => setEnemyAgent(e.target.value)}
//         >
//           {agents.map(a => (
//             <option key={a.id} value={a.id}>
//               {a.name}
//             </option>
//           ))}
//         </select>

//         <button onClick={startGame}>
//           Start Match
//         </button>
//       </div>

//       {gameState && (
//         <GameCanvas
//           state={gameState}
//           setHumanAction={setHumanAction}
//         />
//       )}
//     </div>
//   );
// }
import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5000/api";
const TICK_MS = 80; // ~12fps simulation speed

// ── Color palette ─────────────────────────────────────────────────────────────
const COLORS = {
  bg:       "#010309",
  panel:    "#02060f",
  border:   "#0a1e35",
  accent:   "#00e5ff",
  p0:       "#0099ff",
  p1:       "#ff1155",
  bullet:   "#ffcc00",
  arena:    "#010204",
  text:     "#8ecfea",
  muted:    "#1e4a6a",
  green:    "#00ff9f",
  amber:    "#ff9900",
  red:      "#ff1155",
};

const AGENT_META = {
    human:     { label: "Human",      color: COLORS.p0,   icon: "👤" },
    random:    { label: "Random",     color: COLORS.red,  icon: "🎲" },
    rulebased: { label: "Rule-Based", color: COLORS.amber, icon: "🤖" },
    ppo:       { label: "PPO",        color: COLORS.green, icon: "🧠" },
    chaser:    { label: "Chaser",     color: COLORS.red,  icon: "🔴" },
    circler:   { label: "Circler",    color: COLORS.p0,   icon: "🔵" },
    hider:     { label: "Hider",      color: COLORS.amber, icon: "🟠" },
    mobile:    { label: "Mobile",     color: "#8b5cf6",   icon: "🟣" },
  };

// ── Tank drawing helpers ───────────────────────────────────────────────────────

function drawTank(ctx, cx, cy, aimAngle, teamColor, s = 1, alive = true) {
  if (!alive) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(aimAngle + Math.PI / 2);

  const nc = teamColor.length === 4 ? teamColor + teamColor.slice(1) : teamColor;

  // ── Hover thrust pads (left & right) ──────────────────────────────────────
  const padX = 11 * s;
  [[-padX], [padX]].forEach(([tx]) => {
    // Pad body
    ctx.beginPath();
    ctx.rect(tx - 3.5 * s, -10 * s, 7 * s, 20 * s);
    ctx.fillStyle = `${nc}22`;
    ctx.fill();
    ctx.strokeStyle = nc;
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();
    // Energy cells
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.rect(tx - 3 * s, i * 3.8 * s - 1.5 * s, 6 * s, 2.5 * s);
      ctx.fillStyle = `${nc}55`;
      ctx.fill();
    }
    // Thrust glow at bottom
    const tg = ctx.createLinearGradient(tx, 10 * s, tx, 16 * s);
    tg.addColorStop(0, `${nc}66`);
    tg.addColorStop(1, `${nc}00`);
    ctx.beginPath();
    ctx.rect(tx - 3 * s, 10 * s, 6 * s, 6 * s);
    ctx.fillStyle = tg;
    ctx.fill();
  });

  // ── Octagonal hull ────────────────────────────────────────────────────────
  const hw = 9 * s, hh = 12 * s, cut = 3.5 * s;
  ctx.shadowColor = nc;
  ctx.shadowBlur = 12 * s;
  ctx.beginPath();
  ctx.moveTo(-hw + cut, -hh);
  ctx.lineTo( hw - cut, -hh);
  ctx.lineTo( hw,       -hh + cut);
  ctx.lineTo( hw,        hh - cut);
  ctx.lineTo( hw - cut,  hh);
  ctx.lineTo(-hw + cut,  hh);
  ctx.lineTo(-hw,        hh - cut);
  ctx.lineTo(-hw,       -hh + cut);
  ctx.closePath();
  ctx.fillStyle = `${nc}1a`;
  ctx.fill();
  ctx.strokeStyle = nc;
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Hull interior detail lines
  ctx.strokeStyle = `${nc}44`;
  ctx.lineWidth = 0.5 * s;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.6, -hh * 0.25); ctx.lineTo(hw * 0.6, -hh * 0.25); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-hw * 0.6,  hh * 0.2);  ctx.lineTo(hw * 0.6,  hh * 0.2);  ctx.stroke();

  // ── Energy core ──────────────────────────────────────────────────────────
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 5 * s);
  cg.addColorStop(0,   "#ffffff");
  cg.addColorStop(0.4, nc);
  cg.addColorStop(1,   `${nc}00`);
  ctx.beginPath();
  ctx.arc(0, 0, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();

  // ── Turret ring ──────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, 0, 7 * s, 0, Math.PI * 2);
  ctx.fillStyle = `${nc}22`;
  ctx.fill();
  ctx.strokeStyle = nc;
  ctx.lineWidth = 1.5 * s;
  ctx.shadowColor = nc;
  ctx.shadowBlur = 8 * s;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Barrel ────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.rect(-1.5 * s, -23 * s, 3 * s, 17 * s);
  ctx.fillStyle = nc;
  ctx.fill();
  // Rail lines
  ctx.beginPath();
  ctx.rect(-3 * s, -21 * s, 1 * s, 11 * s);
  ctx.fillStyle = `${nc}77`;
  ctx.fill();
  ctx.beginPath();
  ctx.rect(2 * s, -21 * s, 1 * s, 11 * s);
  ctx.fillStyle = `${nc}77`;
  ctx.fill();
  // Muzzle ring
  ctx.beginPath();
  ctx.arc(0, -23 * s, 3 * s, 0, Math.PI * 2);
  ctx.strokeStyle = nc;
  ctx.lineWidth = 1 * s;
  ctx.shadowColor = nc;
  ctx.shadowBlur = 6 * s;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();

  // ── Muzzle glow (world space) ─────────────────────────────────────────────
  const mx = cx + Math.cos(aimAngle) * 25 * s;
  const my = cy + Math.sin(aimAngle) * 25 * s;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 10 * s);
  glow.addColorStop(0, nc + "77");
  glow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(mx, my, 10 * s, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

function drawBullet(ctx, bx, by, vx, vy) {
  const angle = Math.atan2(vy, vx);

  // ── Plasma trail (3 layers) ───────────────────────────────────────────────
  const trailLen = 32;
  const tx0 = bx - Math.cos(angle) * trailLen;
  const ty0 = by - Math.sin(angle) * trailLen;

  // Outer diffuse trail
  const outerTrail = ctx.createLinearGradient(tx0, ty0, bx, by);
  outerTrail.addColorStop(0, "rgba(0,229,255,0)");
  outerTrail.addColorStop(1, "rgba(0,229,255,0.25)");
  ctx.beginPath();
  ctx.moveTo(tx0, ty0); ctx.lineTo(bx, by);
  ctx.strokeStyle = outerTrail;
  ctx.lineWidth = 7;
  ctx.stroke();

  // Mid trail
  const midTrail = ctx.createLinearGradient(tx0, ty0, bx, by);
  midTrail.addColorStop(0, "rgba(100,200,255,0)");
  midTrail.addColorStop(0.6, "rgba(100,200,255,0.5)");
  midTrail.addColorStop(1, "rgba(255,255,255,0.9)");
  ctx.beginPath();
  ctx.moveTo(tx0, ty0); ctx.lineTo(bx, by);
  ctx.strokeStyle = midTrail;
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── Plasma bolt (elongated ellipse) ──────────────────────────────────────
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(angle);

  const boltGrad = ctx.createLinearGradient(-7, 0, 7, 0);
  boltGrad.addColorStop(0,   "#0066ff");
  boltGrad.addColorStop(0.5, "#00e5ff");
  boltGrad.addColorStop(1,   "#0066ff");
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = boltGrad;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 16;
  ctx.fill();

  // White hot core
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();

  // ── Outer impact glow ────────────────────────────────────────────────────
  const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 14);
  glow.addColorStop(0, "rgba(0,229,255,0.35)");
  glow.addColorStop(1, "rgba(0,229,255,0)");
  ctx.beginPath();
  ctx.arc(bx, by, 14, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

// /**
//  * Draw a rock/boulder obstacle.
// */
// function drawRock(ctx, rock, sw, sh) {
//     const { x, y, w, h, type } = rock;
    
//     // Scale coordinates and dimensions to canvas size
//     const scaledX = x * sw;
//     const scaledY = y * sh;
//     const scaledW = w * sw;
//     const scaledH = h * sh;
  
//   const cx = scaledX + w / 2;
//   const cy = scaledY + h / 2;
//   const rx = scaledW / 2;
//   const ry = scaledH / 2;
  
//   const isBoulder = type === "boulder";
//   const isWall    = type === "wall_chunk";

//   ctx.save();
// //   ctx.translate(cx, cy);

// //   ctx.beginPath();
// //   ctx.ellipse(3, 5, rx, ry, 0, 0, Math.PI * 2);
// //   ctx.fillStyle = "rgba(0,0,0,0.45)";
// //   ctx.fill();
//   ctx.beginPath();
//   ctx.ellipse(scaledX + 3, scaledY + 5, rx, ry, 0, 0, Math.PI * 2);
//   ctx.fillStyle = "rgba(0,0,0,0.45)";
//   ctx.fill();
//   if (isWall) {
//     ctx.beginPath();
//     ctx.roundRect(scaledX, scaledY, scaledW, scaledH, 3);
//     const wallGrad = ctx.createLinearGradient(-rx, -ry, rx, ry);
//     wallGrad.addColorStop(0, "#c08a4a");
//     wallGrad.addColorStop(0.5, "#9d6834");
//     wallGrad.addColorStop(1, "#6f4723");
//     ctx.fillStyle = wallGrad;
//     ctx.fill();
    
//     ctx.strokeStyle = "#4a2f18";
//     ctx.lineWidth = 1;
//     ctx.beginPath();
//     ctx.moveTo(-rx * 0.3, -ry * 0.5);
//     ctx.lineTo(-rx * 0.1, ry * 0.3);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.moveTo(rx * 0.4, -ry * 0.2);
//     ctx.lineTo(rx * 0.2, ry * 0.6);
//     ctx.stroke();
    
//     ctx.strokeStyle = "#d7b07a";
//     ctx.lineWidth = 1.5;
//     ctx.beginPath();
//     ctx.roundRect(-rx, -ry, scaledW, scaledH, 3);
//     ctx.stroke();
//   }  else {
//     const sides = isBoulder ? 7 : 5;
//     ctx.beginPath();
//     for (let i = 0; i < sides; i++) {
//       const t = (i / sides) * Math.PI * 2;
//       const jitter = 0.75 + Math.sin(i * 37 + (isBoulder ? 1 : 3)) * 0.25;
//       const px = scaledX + cx + Math.cos(t) * rx * jitter;
//       const py = scaledY + cy + Math.sin(t) * ry * jitter;
//       i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
//     }
//     ctx.closePath();

//     const rockGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 0, 0, 0, Math.max(rx, ry));
//     if (isBoulder) {
//         rockGrad.addColorStop(0, "#d8a15d");
//         rockGrad.addColorStop(0.6, "#a96d37");
//         rockGrad.addColorStop(1, "#744621");
//     } else {
//         rockGrad.addColorStop(0, "#b9854a");
//         rockGrad.addColorStop(1, "#6e4320");
//     }
//     ctx.fillStyle = rockGrad;
//     ctx.fill();

//     ctx.beginPath();
//     ctx.ellipse(scaledX - rx * 0.25, scaledY - ry * 0.3, rx * 0.35, ry * 0.25, -0.5, 0, Math.PI * 2);
//     ctx.fillStyle = "rgba(255,255,255,0.07)";
//     ctx.fill();

//     ctx.strokeStyle = "#1a1a1a";
//     ctx.lineWidth = isBoulder ? 1.5 : 1;
//     ctx.stroke();
//   }

//   ctx.restore();
// }

function drawRock(ctx, rock, sw, sh) {
    const { x, y, w, h, type } = rock;
    const cx = x * sw, cy = y * sh;
    const cw = w * sw, ch = h * sh;
    const mx = cx + cw / 2, my = cy + ch / 2;
    const rx = cw / 2, ry = ch / 2;
    const isWall = type === "wall_chunk";
    const color  = isWall ? "#00e5ff" : "#ff4466";

    ctx.save();

    // ── Build shape path ──────────────────────────────────────────────────────
    const buildPath = () => {
      ctx.beginPath();
      if (isWall) {
        ctx.rect(cx, cy, cw, ch);
      } else {
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const t = (i / sides) * Math.PI * 2 - Math.PI / 6;
          const j = 0.8 + Math.sin(i * 37 + 1) * 0.2;
          const px = mx + Math.cos(t) * rx * j;
          const py = my + Math.sin(t) * ry * j;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
    };

    // Holographic fill
    buildPath();
    ctx.fillStyle = `${color}0d`;
    ctx.fill();

    // Interior tech grid (clipped inside shape)
    ctx.save();
    buildPath();
    ctx.clip();
    ctx.strokeStyle = `${color}22`;
    ctx.lineWidth = 0.5;
    const gs = 10;
    for (let gx = Math.floor(cx / gs) * gs; gx < cx + cw + gs; gx += gs) {
      ctx.beginPath(); ctx.moveTo(gx, cy); ctx.lineTo(gx, cy + ch); ctx.stroke();
    }
    for (let gy = Math.floor(cy / gs) * gs; gy < cy + ch + gs; gy += gs) {
      ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx + cw, gy); ctx.stroke();
    }
    // Diagonal cross detail
    ctx.strokeStyle = `${color}18`;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cw, cy + ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + cw, cy); ctx.lineTo(cx, cy + ch); ctx.stroke();
    ctx.restore();

    // Glowing border
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    buildPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Thinner inner border
    if (isWall) {
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx + 3, cy + 3, cw - 6, ch - 6);
    }

    // Corner node dots (wall only)
    if (isWall) {
      [[cx, cy], [cx+cw, cy], [cx, cy+ch], [cx+cw, cy+ch]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // Center pulse dot
    ctx.beginPath();
    ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
   
function drawWarzoneBg(ctx, width, height) {
    // Base
    ctx.fillStyle = "#040008";
    ctx.fillRect(0, 0, width, height);

    // Neon red grid
    ctx.strokeStyle = "rgba(255,30,60,0.07)";
    ctx.lineWidth = 1;
    const gs = 40;
    for (let gx = 0; gx < width; gx += gs) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
    }
    for (let gy = 0; gy < height; gy += gs) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
    }

    // Diagonal hazard lines (faint)
    ctx.strokeStyle = "rgba(255,30,60,0.04)";
    ctx.lineWidth = 0.5;
    for (let d = -height; d < width + height; d += 60) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + height, height);
      ctx.stroke();
    }

    // Brighter center cross
    ctx.strokeStyle = "rgba(255,30,60,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

    // EMP blast zones
    const blasts = [
      { rx: 0.15, ry: 0.18, rr: 0.08 },
      { rx: 0.82, ry: 0.78, rr: 0.07 },
      { rx: 0.50, ry: 0.50, rr: 0.05 },
      { rx: 0.20, ry: 0.75, rr: 0.05 },
      { rx: 0.75, ry: 0.25, rr: 0.05 },
    ];
    blasts.forEach(({ rx, ry, rr }) => {
      const x = rx * width, y = ry * height, r = rr * Math.min(width, height);
      // Outer blast ring
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0,   "rgba(255,20,50,0.15)");
      rg.addColorStop(0.5, "rgba(255,20,50,0.05)");
      rg.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rg;
      ctx.fill();
      // Inner ring stroke
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,40,60,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,40,60,0.2)";
      ctx.fill();
    });

    // Corner accent triangles (red)
    const triSize = 20;
    ctx.fillStyle = "rgba(255,30,60,0.18)";
    [[0,0], [width,0], [0,height], [width,height]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (cx === 0 ? triSize : -triSize), cy);
      ctx.lineTo(cx, cy + (cy === 0 ? triSize : -triSize));
      ctx.fill();
    });

    // Scanlines
    for (let y = 0; y < height; y += 4) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, y, width, 2);
    }
  }
   
// /**
//  * Draw the warzone arena background (map2) — scarred concrete with burn marks.
//  */
// function drawWarzoneBg(ctx, width, height) {
//   // Base — cracked concrete
//   ctx.fillStyle = "#0d0f0d";
//   ctx.fillRect(0, 0, width, height);

//   // Concrete tile grid
//   const tileW = 80, tileH = 60;
//   for (let gx = 0; gx < width; gx += tileW) {
//     for (let gy = 0; gy < height; gy += tileH) {
//       const shade = 0.5 + Math.sin(gx * 0.07 + gy * 0.05) * 0.5;
//       ctx.strokeStyle = `rgba(30,35,25,${0.5 + shade * 0.3})`;
//       ctx.lineWidth = 0.5;
//       ctx.strokeRect(gx, gy, tileW, tileH);
//     }
//   }

//   // Burn scorch marks
//   const scorches = [
//     { x: 180, y: 130, r: 55 },
//     { x: 580, y: 360, r: 48 },
//     { x: 390, y: 250, r: 40 },
//     { x: 650,  y: 90, r: 35 },
//     { x: 150, y: 390, r: 38 },
//   ];
//   scorches.forEach(({ x, y, r }) => {
//     const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
//     sg.addColorStop(0,   "rgba(20,15,0,0.7)");
//     sg.addColorStop(0.5, "rgba(30,20,0,0.3)");
//     sg.addColorStop(1,   "rgba(0,0,0,0)");
//     ctx.beginPath();
//     ctx.arc(x, y, r, 0, Math.PI * 2);
//     ctx.fillStyle = sg;
//     ctx.fill();
//   });

//   // Crater rings
//   const craters = [
//     { x: 310, y: 180, r: 22 },
//     { x: 500, y: 320, r: 18 },
//     { x: 210, y: 400, r: 15 },
//   ];
//   craters.forEach(({ x, y, r }) => {
//     ctx.beginPath();
//     ctx.arc(x, y, r, 0, Math.PI * 2);
//     ctx.strokeStyle = "rgba(0,0,0,0.5)";
//     ctx.lineWidth = 2;
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
//     ctx.fillStyle = "rgba(0,0,0,0.35)";
//     ctx.fill();
//   });

//   // Danger zone stripe along edges
//   const stripeW = 14;
//   const stripes = [
//     [0, 0, width, stripeW],
//     [0, height - stripeW, width, stripeW],
//     [0, 0, stripeW, height],
//     [width - stripeW, 0, stripeW, height],
//   ];
//   stripes.forEach(([sx, sy, sw, sh]) => {
//     ctx.save();
//     ctx.beginPath();
//     ctx.rect(sx, sy, sw, sh);
//     ctx.clip();
//     const stripeCount = Math.ceil(Math.max(sw, sh) / 20) + 2;
//     ctx.fillStyle = "rgba(200,150,0,0.12)";
//     for (let i = 0; i < stripeCount; i++) {
//       ctx.save();
//       ctx.translate(sx, sy);
//       ctx.beginPath();
//       if (sw > sh) {
//         ctx.rect(i * 20, 0, 10, sh);
//       } else {
//         ctx.rect(0, i * 20, sw, 10);
//       }
//       ctx.fill();
//       ctx.restore();
//     }
//     ctx.restore();
//   });
// }

/**
 * Draw the map1 (classic) background — neon grid with scanlines.
 */
function drawClassicBg(ctx, width, height) {
  ctx.fillStyle = COLORS.arena;
  ctx.fillRect(0, 0, width, height);

  // Neon grid
  ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Brighter center cross
  ctx.strokeStyle = "rgba(0, 229, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

  // Corner accent triangles
  const triSize = 20;
  ctx.fillStyle = "rgba(0, 229, 255, 0.15)";
  [[0,0], [width,0], [0,height], [width,height]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (cx === 0 ? triSize : -triSize), cy);
    ctx.lineTo(cx, cy + (cy === 0 ? triSize : -triSize));
    ctx.fill();
  });

  // Scanlines
  for (let y = 0; y < height; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, y, width, 2);
  }
}

// ── Arena Canvas ──────────────────────────────────────────────────────────────
function Arena({ state, width = 700, height = 437 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    const sw  = width  / (state.arena?.w || 800);
    const sh  = height / (state.arena?.h || 500);
    const mapId = state.map_id || "map1";

    // ── Background ────────────────────────────────────────────────────────────
    if (mapId === "map2") {
      drawWarzoneBg(ctx, width, height);
    } else {
      drawClassicBg(ctx, width, height);
    }

    // ── Arena border ──────────────────────────────────────────────────────────
    if (mapId === "map2") {
      ctx.shadowColor = "#ff1155";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "#ff1155";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, width - 2, height - 2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,17,85,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(5, 5, width - 10, height - 10);
    } else {
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "rgba(0,229,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, width - 2, height - 2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0,229,255,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(5, 5, width - 10, height - 10);
    }

    // ── Obstacles (map2 rocks) ─────────────────────────────────────────────
    if (state.obstacles) {
      state.obstacles.forEach(rock => drawRock(ctx, rock, sw, sh));
    }

    // ── Bullets ───────────────────────────────────────────────────────────────
    (state.bullets || []).forEach(b => {
      drawBullet(ctx, b.x * sw, b.y * sh, b.vx * sw, b.vy * sh);
    });

    // ── Players (tanks) ───────────────────────────────────────────────────────
    (state.players || []).forEach((p, i) => {
      const color = i === 0 ? COLORS.p0 : COLORS.p1;
      const px = p.x * sw, py = p.y * sh;

      if (!p.alive) {
        // Destroyed — dim ghost + explosion debris
        ctx.save();
        ctx.globalAlpha = 0.2;
        drawTank(ctx, px, py, p.aim_angle, "#334", sw, true);
        ctx.globalAlpha = 1;
        ctx.restore();
        // EMP explosion rings
        for (let r = 1; r <= 3; r++) {
          ctx.beginPath();
          ctx.arc(px, py, r * 10 * sw, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,40,80,${0.25 / r})`;
          ctx.lineWidth = 2 * sw;
          ctx.stroke();
        }
        // Sparks
        ctx.fillStyle = "rgba(255,80,80,0.5)";
        for (let sp = 0; sp < 6; sp++) {
          const sa = (sp / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(px + Math.cos(sa) * 8 * sw, py + Math.sin(sa) * 8 * sw, 1.5 * sw, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      // Ground glow (no shadow ellipse — just ambient ring)
      const groundGlow = ctx.createRadialGradient(px, py, 0, px, py, 20 * sw);
      groundGlow.addColorStop(0, `${color}18`);
      groundGlow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(px, py, 20 * sw, 0, Math.PI * 2);
      ctx.fillStyle = groundGlow;
      ctx.fill();

      // Draw tank
      drawTank(ctx, px, py, p.aim_angle, color, sw, true);

      // Player label above
      const labelY = py - 30 * sw;
      ctx.font = `700 ${9 * sw}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillText(`P${i + 1}`, px, labelY);
      ctx.shadowBlur = 0;

      // Shoot flash: plasma burst on muzzle
      if (p.shoot_flash) {
        const mx = px + Math.cos(p.aim_angle) * 25 * sw;
        const my = py + Math.sin(p.aim_angle) * 25 * sw;
        const fg = ctx.createRadialGradient(mx, my, 0, mx, my, 16 * sw);
        fg.addColorStop(0, "rgba(255,255,255,0.95)");
        fg.addColorStop(0.3, `${color}cc`);
        fg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(mx, my, 16 * sw, 0, Math.PI * 2);
        ctx.fillStyle = fg;
        ctx.fill();
      }
    });

    // ── HUD: map label ────────────────────────────────────────────────────────
    ctx.font = `700 ${8 * sw}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    const hudColor = mapId === "map2" ? "rgba(255,40,80,0.6)" : "rgba(0,229,255,0.5)";
    ctx.fillStyle = hudColor;
    ctx.shadowColor = hudColor;
    ctx.shadowBlur = 6;
    ctx.fillText(
      mapId === "map2" ? "⬡ WARZONE :: DANGER ACTIVE" : "⬡ COMBAT ARENA :: SYSTEMS ONLINE",
      8 * sw, height - 8 * sw
    );
    ctx.shadowBlur = 0;

  }, [state, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: "block",
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        imageRendering: "crisp-edges",
      }}
    />
  );
}

// ── Health Bar ─────────────────────────────────────────────────────────────────
function HealthBar({ value, max = 100, color, label, ammo, maxAmmo = 8 }) {
  const pct = Math.max(0, value / max * 100);
  const hpColor = pct > 50 ? COLORS.green : pct > 25 ? COLORS.amber : COLORS.red;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{
          color, fontWeight: 700, fontSize: 11,
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          textShadow: `0 0 8px ${color}`,
        }}>{label}</span>
        <span style={{
          color: hpColor, fontSize: 12, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          textShadow: `0 0 6px ${hpColor}`,
        }}>{Math.round(value)}<span style={{ color: COLORS.muted, fontWeight: 400 }}>/100</span></span>
      </div>
      {/* Angular HUD bar */}
      <div style={{
        height: 8, background: "rgba(0,229,255,0.05)",
        border: `1px solid rgba(0,229,255,0.1)`,
        clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))",
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${hpColor}88, ${hpColor})`,
          transition: "width 0.1s ease",
          boxShadow: `0 0 10px ${hpColor}`,
        }} />
      </div>
      {/* Ammo dots */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {Array.from({ length: maxAmmo }).map((_, i) => (
          <div key={i} style={{
            width: 7, height: 7,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            background: i < ammo ? COLORS.amber : "rgba(0,229,255,0.08)",
            boxShadow: i < ammo ? `0 0 6px ${COLORS.amber}` : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Agent Selector ─────────────────────────────────────────────────────────────
function AgentSelect({ label, value, onChange, options, color }) {
  return (
    <div>
      <div style={{
        color: COLORS.muted, fontSize: 10, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: "0.15em",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        ◈ {label}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {options.map(opt => {
          const meta = AGENT_META[opt] || {};
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: "5px 10px",
                borderRadius: 0,
                clipPath: "polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))",
                border: "none",
                outline: selected ? `1px solid ${color}` : `1px solid ${COLORS.border}`,
                outlineOffset: "-1px",
                background: selected ? `${color}18` : "transparent",
                color: selected ? color : COLORS.muted,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: selected ? 700 : 400,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.05em",
                transition: "all 0.15s",
                boxShadow: selected ? `0 0 12px ${color}44, inset 0 0 8px ${color}11` : "none",
              }}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Map Selector ───────────────────────────────────────────────────────────────
function MapSelect({ value, onChange }) {
  const maps = [
    { id: "map1", label: "⬡ COMBAT ARENA",   desc: "Open field" },
    { id: "map2", label: "⬡ WARZONE RUBBLE", desc: "Rock obstacles" },
  ];
  return (
    <div>
      <div style={{
        color: COLORS.muted, fontSize: 10, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: "0.15em",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        ◈ Map
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {maps.map(m => {
          const sel = value === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              title={m.desc}
              style={{
                padding: "5px 12px",
                borderRadius: 0,
                clipPath: "polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))",
                border: "none",
                outline: sel ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                outlineOffset: "-1px",
                background: sel ? `${COLORS.accent}15` : "transparent",
                color: sel ? COLORS.accent : COLORS.muted,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: sel ? 700 : 400,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.1em",
                transition: "all 0.15s",
                boxShadow: sel ? `0 0 12px ${COLORS.accent}44, inset 0 0 8px ${COLORS.accent}11` : "none",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Benchmark Panel ────────────────────────────────────────────────────────────
function BenchmarkPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [a0, setA0] = useState("ppo");
  const [a1, setA1] = useState("rulebased");
  const [eps, setEps] = useState(50);
  const [mapId, setMapId] = useState("map1");

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent0: a0, agent1: a1, episodes: eps, map_id: mapId }),
      });
      setResults(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "rgba(0,229,255,0.02)",
      border: `1px solid rgba(0,229,255,0.15)`,
      boxShadow: "0 0 30px rgba(0,229,255,0.04), inset 0 1px 0 rgba(0,229,255,0.08)",
      clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
      padding: 18,
    }}>
      <div style={{
        color: COLORS.accent, fontWeight: 700, fontSize: 11, marginBottom: 14,
        letterSpacing: "0.15em", textTransform: "uppercase",
        textShadow: `0 0 8px ${COLORS.accent}`,
      }}>
        ◈ AGENT BENCHMARK
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <AgentSelect 
            label="Agent A" 
            value={a0} 
            onChange={setA0} 
            options={getAgentOptions(mapId, true)}
            color={COLORS.p0} 
        />
        <AgentSelect 
            label="Agent B" 
            value={a1} 
            onChange={setA1} 
            options={getAgentOptions(mapId, false)}
            color={COLORS.p1} 
        />
        </div>

      <div style={{ marginBottom: 12 }}>
        <MapSelect value={mapId} onChange={setMapId} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span style={{ color: COLORS.muted, fontSize: 9, letterSpacing: "0.1em" }}>EPISODES:</span>
        {[20, 50, 100].map(n => (
          <button key={n} onClick={() => setEps(n)} style={{
            padding: "4px 10px", fontSize: 10,
            border: `1px solid ${eps === n ? COLORS.accent : COLORS.border}`,
            background: eps === n ? `${COLORS.accent}15` : "transparent",
            color: eps === n ? COLORS.accent : COLORS.muted,
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.05em",
            boxShadow: eps === n ? `0 0 8px ${COLORS.accent}33` : "none",
          }}>{n}</button>
        ))}
      </div>

      <button onClick={run} disabled={loading} style={{
        width: "100%", padding: "10px",
        background: loading ? "rgba(0,229,255,0.03)" : "rgba(0,229,255,0.1)",
        border: `1px solid ${loading ? "rgba(0,229,255,0.1)" : COLORS.accent}`,
        color: loading ? COLORS.muted : COLORS.accent,
        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        fontSize: 11, letterSpacing: "0.15em",
        fontFamily: "'JetBrains Mono', monospace",
        clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
        boxShadow: loading ? "none" : `0 0 15px ${COLORS.accent}33`,
      }}>
        {loading ? "PROCESSING…" : "▶ EXECUTE BENCHMARK"}
      </button>

      {results && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[
              { label: results.agent0_name, wr: results.agent0_winrate, color: COLORS.p0 },
              { label: results.agent1_name, wr: results.agent1_winrate, color: COLORS.p1 },
            ].map(r => (
              <div key={r.label} style={{
                flex: 1, background: "rgba(0,0,0,0.4)",
                padding: "10px 14px",
                border: `1px solid ${r.color}33`,
                clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                textAlign: "center",
              }}>
                <div style={{ color: r.color, fontSize: 26, fontWeight: 900, textShadow: `0 0 15px ${r.color}` }}>{r.wr}%</div>
                <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 2, letterSpacing: "0.1em" }}>
                  {((AGENT_META[r.label] || {}).label || r.label).toUpperCase()} WIN RATE
                </div>
              </div>
            ))}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 9, textAlign: "center", letterSpacing: "0.1em" }}>
            {results.episodes} EPS · AVG {results.avg_steps} TICKS
            {results.draws > 0 && ` · ${results.draws} DRAWS`}
          </div>
          <div style={{ marginTop: 10, height: 4, overflow: "hidden", display: "flex", border: `1px solid rgba(0,229,255,0.1)` }}>
            <div style={{ width: `${results.agent0_winrate}%`, background: COLORS.p0, transition: "width 0.4s", boxShadow: `0 0 8px ${COLORS.p0}` }} />
            <div style={{ width: `${results.agent1_winrate}%`, background: COLORS.p1, boxShadow: `0 0 8px ${COLORS.p1}` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent option helper ────────────────────────────────────────────────
const getAgentOptions = (mapId, isPlayer) => {
    const baseOptions = ["random", "ppo"];
    
    if (mapId === "map1") {
      return isPlayer 
        ? [...baseOptions, "chaser", "circler"]
        : ["random", "chaser", "circler", "ppo"];
    } else if (mapId === "map2") {
      return isPlayer
        ? [...baseOptions, "hider", "mobile"]
        : ["random", "hider", "mobile", "ppo"];
    }
    
    return baseOptions;
  };

  const getMapSpecificAgents = (mapId) => {
    if (mapId === "map1") {
      return ["chaser", "circler"];
    } else if (mapId === "map2") {
      return ["hider", "mobile"];
    }
    return [];
  };
// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [gameState, setGameState] = useState(null);
  const [running, setRunning]     = useState(false);
  const [done, setDone]           = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [speed, setSpeed]         = useState(80);
  const [agent0, setAgent0]       = useState("human");
  const [agent1, setAgent1]       = useState("rulebased");
  const [mapId,  setMapId]        = useState("map1");
  const [log, setLog]             = useState([]);
  const tickRef           = useRef(null);
  const keysRef           = useRef({});
  const mouseRef          = useRef({ x: null, y: null, fire: false });
  const arenaContainerRef = useRef(null);
  const gameStateRef      = useRef(null);
  const lastAimRef        = useRef(2); // persist aim between ticks

  // Keyboard tracking for human player
  useEffect(() => {
    const down = e => { keysRef.current[e.key] = true; };
    const up   = e => { keysRef.current[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup",   up);
    };
  }, []);

  const getHumanAction = useCallback(() => {
    const keys  = keysRef.current;
    const mouse = mouseRef.current;

    // ── Movement (WASD / Arrows) ──────────────────────────────────────────────
    let mx = 0, my = 0;
    if (keys["w"] || keys["ArrowUp"])    my = -1;
    if (keys["s"] || keys["ArrowDown"])  my =  1;
    if (keys["a"] || keys["ArrowLeft"])  mx = -1;
    if (keys["d"] || keys["ArrowRight"]) mx =  1;

    const DIRS = [[0,0],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
    let moveDir = 0;
    for (let i = 1; i < DIRS.length; i++) {
      if (DIRS[i][0] === mx && DIRS[i][1] === my) { moveDir = i; break; }
    }

    // ── Aim (keyboard 8-way takes priority; else mouse) ───────────────────────
    // Direct explicit mapping — no angle math, no drift
    // aimDir: 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW
    const kbAim = keys["i"] || keys["k"] || keys["j"] || keys["l"] ||
                  keys["u"] || keys["o"] || keys["n"] || keys["m"];

    let aimDir = lastAimRef.current;

    // AIM_ANGLES[i] = i * π/8  →  0=E, 4=S, 8=W, 12=N  (y-down math convention)
    if (kbAim) {
      // Cardinals
      if (keys["i"]) aimDir = 12; // N (up screen)
      if (keys["l"]) aimDir =  0; // E (right)
      if (keys["k"]) aimDir =  4; // S (down screen)
      if (keys["j"]) aimDir =  8; // W (left)
      // Dedicated diagonals override
      if (keys["u"]) aimDir = 10; // NW
      if (keys["o"]) aimDir = 14; // NE
      if (keys["n"]) aimDir =  6; // SW  (N is left of M on keyboard)
      if (keys["m"]) aimDir =  2; // SE
      // IJKL combos override dedicated diagonals
      if (keys["i"] && keys["j"]) aimDir = 10; // NW
      if (keys["i"] && keys["l"]) aimDir = 14; // NE
      if (keys["k"] && keys["j"]) aimDir =  6; // SW
      if (keys["k"] && keys["l"]) aimDir =  2; // SE
    } else if (mouse.x !== null) {
      const gs = gameStateRef.current;
      const p0 = gs?.players?.[0];
      if (p0 && Number.isFinite(p0.x) && Number.isFinite(p0.y)) {
        const arenaW = gs.arena?.w || 800;
        const arenaH = gs.arena?.h || 500;
        const sw = 700 / arenaW, sh = 437 / arenaH;
        const dx = mouse.x - p0.x * sw;
        const dy = mouse.y - p0.y * sh;
        // atan2(dy,dx) → angle in (-π,π], divide by π/8 to get aim index 0-15
        const candidate = (Math.round(Math.atan2(dy, dx) * 8 / Math.PI) % 16 + 16) % 16;
        if (Number.isFinite(candidate)) aimDir = candidate;
      }
    }

    lastAimRef.current = aimDir;

    const shoot = keys[" "] || keys["f"] || mouse.fire ? 1 : 0;
    return [moveDir, aimDir, shoot];
  }, []);

  const startGame = async () => {
    clearInterval(tickRef.current);
    try {
      const res = await fetch(`${API}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent0, agent1, map_id: mapId }),
      });
      const data = await res.json();
      if (data.done) {
        setDone(true);
        setMatchInfo(data.match_info);
        return;
      }
      gameStateRef.current = data.state;
      setGameState(data.state);
      setDone(false);
      setMatchInfo(null);
      setRunning(true);
      setLog([]);
    } catch (e) {
      addLog("⚠ Cannot connect to server. Is backend running?");
    }
  };

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 20));

  // Game loop
  useEffect(() => {
    if (!running || done) return;
    tickRef.current = setInterval(async () => {
      try {
        const humanAction = agent0 === "human" ? getHumanAction() : undefined;
        const body = humanAction ? { human_action: humanAction } : {};
        const res  = await fetch(`${API}/step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) { clearInterval(tickRef.current); return; }
        gameStateRef.current = data.state;
        setGameState(data.state);
        if (data.done) {
          clearInterval(tickRef.current);
          setDone(true);
          setRunning(false);
          setMatchInfo(data.match_info);
          const w    = data.match_info?.winner;
          const name = w === 0
            ? (AGENT_META[agent0]?.label || "P1")
            : (AGENT_META[agent1]?.label || "P2");
          addLog(`🏆 Match ended — ${name} wins in ${data.match_info?.steps} steps`);
        }
      } catch { clearInterval(tickRef.current); }
    }, speed);

    return () => clearInterval(tickRef.current);
  }, [running, done, speed, agent0, agent1, getHumanAction]);

  const p0 = gameState?.players?.[0];
  const p1 = gameState?.players?.[1];

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, #030d1a 0%, ${COLORS.bg} 60%)`,
      color: COLORS.text,
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      padding: "20px 24px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, paddingBottom: 16, borderBottom: `1px solid rgba(0,229,255,0.1)` }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 900,
            letterSpacing: "0.15em", textTransform: "uppercase",
            color: COLORS.accent,
            textShadow: `0 0 20px ${COLORS.accent}, 0 0 40px ${COLORS.accent}44`,
          }}>
            ⬡ TANK ARENA :: RL
          </h1>
          <div style={{
            color: COLORS.muted, fontSize: 10,
            letterSpacing: "0.2em", marginTop: 3,
          }}>
            1V1 COMBAT SYSTEM · REINFORCEMENT LEARNING · v1.0
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}` }} />
          <span style={{ color: COLORS.muted, fontSize: 10, letterSpacing: "0.15em" }}>SYS ONLINE</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Left: Arena + controls */}
        <div style={{ flex: "1 1 700px", minWidth: 0 }}>
          {/* Match setup */}
          <div style={{
            background: "rgba(0,229,255,0.02)",
            border: `1px solid rgba(0,229,255,0.15)`,
            boxShadow: "0 0 30px rgba(0,229,255,0.04), inset 0 1px 0 rgba(0,229,255,0.08)",
            clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
            padding: 16, marginBottom: 14,
            display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap",
          }}>
            {/* <AgentSelect
              label="Player 1 (Blue)"
              value={agent0}
              onChange={setAgent0}
              options={["human", "random", "rulebased", "ppo"]}
              color={COLORS.p0}
            />
            <div style={{ color: COLORS.muted, fontSize: 18, paddingBottom: 4 }}>vs</div>
            <AgentSelect
              label="Player 2 (Red)"
              value={agent1}
              onChange={setAgent1}
              options={["random", "rulebased", "ppo"]}
              color={COLORS.p1}
            /> */}
            <AgentSelect
                label="Player 1 (Blue)"
                value={agent0}
                onChange={setAgent0}
                options={agent0 === "human" ? ["human", "random", "ppo", ...getMapSpecificAgents(mapId)] : ["human", "random", "ppo", ...getMapSpecificAgents(mapId)]}
                color={COLORS.p0}
                />
                <div style={{ color: COLORS.muted, fontSize: 18, paddingBottom: 4 }}>vs</div>
                <AgentSelect
                label="Player 2 (Red)"
                value={agent1}
                onChange={setAgent1}
                options={getMapSpecificAgents(mapId).concat(["random", "ppo"])}
                color={COLORS.p1}
                />
            <MapSelect value={mapId} onChange={setMapId} />
            <div style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 4 }}>
              <span style={{ color: COLORS.muted, fontSize: 9, letterSpacing: "0.1em" }}>SPEED</span>
              {[150, 80, 40].map(s => (
                <button key={s} onClick={() => setSpeed(s)} style={{
                  padding: "4px 8px", fontSize: 9,
                  border: `1px solid ${speed === s ? COLORS.accent : COLORS.border}`,
                  background: speed === s ? `${COLORS.accent}15` : "transparent",
                  color: speed === s ? COLORS.accent : COLORS.muted,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.08em",
                  boxShadow: speed === s ? `0 0 8px ${COLORS.accent}33` : "none",
                }}>
                  {s === 150 ? "SLOW" : s === 80 ? "NORM" : "FAST"}
                </button>
              ))}
            </div>
            <button onClick={startGame} style={{
              padding: "9px 22px",
              background: running ? "transparent" : `${COLORS.accent}18`,
              border: `1px solid ${COLORS.accent}`,
              color: COLORS.accent,
              fontWeight: 700, cursor: "pointer", fontSize: 11,
              whiteSpace: "nowrap",
              letterSpacing: "0.15em",
              fontFamily: "'JetBrains Mono', monospace",
              clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
              boxShadow: `0 0 15px ${COLORS.accent}33`,
            }}>
              {running ? "⟳ RESTART" : gameState ? "▶ RESTART" : "▶ INITIALIZE"}
            </button>
          </div>

          {/* Health bars */}
          {gameState && (
            <div style={{
              display: "flex", gap: 16, marginBottom: 10,
              background: "rgba(0,153,255,0.03)",
              border: `1px solid rgba(0,229,255,0.1)`,
              boxShadow: "inset 0 0 20px rgba(0,229,255,0.02)",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
              padding: "12px 16px",
            }}>
              <HealthBar
                label={`P1 · ${AGENT_META[agent0]?.label}`}
                value={p0?.health ?? 100}
                color={COLORS.p0}
                ammo={p0?.ammo ?? 8}
              />
              <div style={{ width: 1, background: COLORS.border }} />
              <HealthBar
                label={`P2 · ${AGENT_META[agent1]?.label}`}
                value={p1?.health ?? 100}
                color={COLORS.p1}
                ammo={p1?.ammo ?? 8}
              />
            </div>
          )}

          {/* Arena */}
          <div
            ref={arenaContainerRef}
            style={{ position: "relative", border: `1px solid rgba(0,229,255,0.2)`, boxShadow: `0 0 40px rgba(0,229,255,0.06)`, cursor: agent0 === "human" && running ? "crosshair" : "default" }}
            onMouseMove={e => { mouseRef.current.x = e.offsetX; mouseRef.current.y = e.offsetY; }}
            onMouseLeave={() => { mouseRef.current.x = null; mouseRef.current.y = null; }}
            onMouseDown={e => { if (e.button === 0) mouseRef.current.fire = true; }}
            onMouseUp={e => { if (e.button === 0) mouseRef.current.fire = false; }}
          >
            <Arena state={gameState} width={700} height={437} />
            {!gameState && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(1,2,4,0.92)",
              }}>
                <div style={{ fontSize: 40, marginBottom: 14, filter: "drop-shadow(0 0 12px rgba(0,229,255,0.6))" }}>⬡</div>
                <div style={{ color: COLORS.accent, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 10px ${COLORS.accent}` }}>AWAITING DEPLOYMENT</div>
                <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: "0.1em", marginTop: 6 }}>SELECT AGENTS · CHOOSE MAP · INITIALIZE</div>
              </div>
            )}
            {done && matchInfo && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(1,2,4,0.93)",
              }}>
                <div style={{ fontSize: 13, color: COLORS.muted, letterSpacing: "0.2em", marginBottom: 10 }}>MATCH TERMINATED</div>
                <div style={{
                  fontSize: 28, fontWeight: 900, letterSpacing: "0.1em",
                  color: matchInfo.winner == null ? COLORS.accent : matchInfo.winner === 0 ? COLORS.p0 : COLORS.p1,
                  textShadow: `0 0 20px ${matchInfo.winner == null ? COLORS.accent : matchInfo.winner === 0 ? COLORS.p0 : COLORS.p1}`,
                }}>
                  {matchInfo.winner == null
                    ? "DRAW"
                    : `${(matchInfo.winner === 0 ? AGENT_META[agent0] : AGENT_META[agent1])?.label?.toUpperCase()} WINS`}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 10, marginTop: 8, letterSpacing: "0.15em" }}>
                  {matchInfo.steps} TICKS ELAPSED
                </div>
                <button onClick={startGame} style={{
                  marginTop: 20, padding: "10px 32px",
                  background: "transparent",
                  border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent,
                  fontWeight: 700, cursor: "pointer", fontSize: 11,
                  letterSpacing: "0.2em",
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: `0 0 20px ${COLORS.accent}44`,
                  clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                }}>
                  ▶ REINITIALIZE
                </button>
              </div>
            )}
          </div>

          {/* Controls legend */}
          {agent0 === "human" && (
            <div style={{
              marginTop: 10, padding: "8px 14px",
              background: "rgba(0,229,255,0.02)",
              border: `1px solid rgba(0,229,255,0.08)`,
              display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: COLORS.muted,
              letterSpacing: "0.08em",
            }}>
              <span>⬡ <b style={{ color: COLORS.text }}>WASD</b> MOVE</span>
              <span style={{ color: "rgba(0,229,255,0.3)" }}>|</span>
              <span>⬡ <b style={{ color: COLORS.text }}>MOUSE</b> AIM</span>
              <span>⬡ <b style={{ color: COLORS.text }}>F</b> FIRE</span>
              <span style={{ color: "rgba(0,229,255,0.3)" }}>|</span>
              <span>⬡ <b style={{ color: COLORS.text }}>IJKL</b> AIM (KB)</span>
              <span>⬡ <b style={{ color: COLORS.text }}>UONM</b> DIAG</span>
              <span>⬡ <b style={{ color: COLORS.text }}>F</b> FIRE (KB)</span>
            </div>
          )}

          {/* Event log */}
          {log.length > 0 && (
            <div style={{
              marginTop: 10, padding: "10px 14px",
              background: "rgba(0,229,255,0.02)",
              border: `1px solid rgba(0,229,255,0.08)`,
              maxHeight: 80, overflowY: "auto",
              fontSize: 10, color: COLORS.muted,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}>
              {log.map((l, i) => <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(0,229,255,0.04)" }}>{l}</div>)}
            </div>
          )}
        </div>

        {/* Right: Benchmark + Info */}
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14 }}>
          <BenchmarkPanel />

          {/* Architecture info */}
          <div style={{
            background: "rgba(0,229,255,0.02)",
            border: `1px solid rgba(0,229,255,0.12)`,
            clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
            padding: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: COLORS.accent, letterSpacing: "0.15em", textShadow: `0 0 8px ${COLORS.accent}` }}>◈ SYSTEM ARCHITECTURE</div>
            {[
              { label: "ENV",    desc: "Custom Gymnasium env, 32-dim obs, MultiDiscrete(9×16×2) actions" },
              { label: "PPO",    desc: "MLP policy (256×256), trained via stable-baselines3" },
              { label: "OBS",    desc: "Self pos/vel/HP/ammo, opponent state, 4 nearest bullets" },
              { label: "REWARD", desc: "Hit: +2, Kill: +40, Die: −30, Dodge: +0.5, Aim bonus/penalty" },
              { label: "MAPS",   desc: "Map 1: open arena. Map 2: warzone rubble (visual obstacles)" },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <span style={{
                  display: "inline-block", fontSize: 9, fontWeight: 700,
                  color: COLORS.accent, background: `${COLORS.accent}15`,
                  padding: "2px 6px", marginBottom: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.1em",
                  border: `1px solid ${COLORS.accent}33`,
                }}>
                  {r.label}
                </span>
                <div style={{ color: COLORS.muted, fontSize: 10, lineHeight: 1.6, letterSpacing: "0.02em" }}>{r.desc}</div>
              </div>
            ))}
          </div>

          {/* Training instructions */}
          <div style={{
            background: "rgba(0,229,255,0.02)",
            border: `1px solid rgba(0,229,255,0.12)`,
            clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
            padding: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10, color: COLORS.accent, letterSpacing: "0.15em", textShadow: `0 0 8px ${COLORS.accent}` }}>◈ TRAIN PPO</div>
            <div style={{ color: COLORS.muted, fontSize: 9, marginBottom: 8, letterSpacing: "0.1em" }}>
              EXECUTE FROM BACKEND DIRECTORY:
            </div>
            {["python train.py", "python train.py --opponent random", "python train.py --timesteps 300000"].map(cmd => (
              <div key={cmd} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                background: "rgba(0,255,159,0.04)", padding: "6px 10px",
                marginBottom: 5, color: COLORS.green,
                border: `1px solid rgba(0,255,159,0.15)`,
                letterSpacing: "0.02em",
              }}>
                <span style={{ color: "rgba(0,255,159,0.4)" }}>$ </span>{cmd}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}