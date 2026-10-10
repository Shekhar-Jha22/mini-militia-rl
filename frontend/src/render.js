const INK = "#1b1f3b";
const TEAMS = [
  { hi: "#7cb6ff", base: "#3b8cff", lo: "#1d5fd0" },
  { hi: "#ff8a96", base: "#ff4d5e", lo: "#c9233c" },
];
const WRECK = { hi: "#9aa1c2", base: "#6c769c", lo: "#4a5276" };
const PLAYER_RADIUS = 18;
const BULLET_RADIUS = 5;

export const MAX_STEPS = 1200;

export function fitArena(arena, maxW = 760, maxH = 560) {
  const w = arena?.w || 800, h = arena?.h || 500;
  const scale = Math.min(maxW / w, maxH / h);
  return { scale, cw: Math.round(w * scale), ch: Math.round(h * scale), w, h };
}

export function newView(seat) {
  return { seat, hulls: [0, Math.PI], prevHp: null, effects: [], decor: null };
}

// Called once per server snapshot (not per frame): hull headings and hit/explosion effects.
export function ingest(view, state, now = performance.now()) {
  const players = state?.players || [];
  players.forEach((p, i) => {
    if (Math.hypot(p.vx, p.vy) > 0.4) view.hulls[i] = Math.atan2(p.vy, p.vx);
    if (view.prevHp && p.health < view.prevHp[i]) {
      view.effects.push({ x: p.x, y: p.y, born: now, life: p.alive ? 320 : 720, kind: p.alive ? "hit" : "boom", rot: Math.random() * 3 });
    }
  });
  view.prevHp = players.map(p => p.health);
}

// Blend two snapshots for smooth 60 fps motion between 12.5 Hz server ticks.
export function interpolate(a, b, alpha) {
  if (!a || !b || alpha >= 1) return b || a;
  const lerp = (u, v) => u + (v - u) * alpha;
  return {
    ...b,
    players: b.players.map((p, i) => {
      const q = a.players[i];
      return q && q.alive && p.alive ? { ...p, x: lerp(q.x, p.x), y: lerp(q.y, p.y) } : p;
    }),
    bullets: b.bullets.map(bl => ({ ...bl, x: bl.x - bl.vx * (1 - alpha), y: bl.y - bl.vy * (1 - alpha) })),
  };
}

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function inkStroke(ctx, lw) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function buildDecor(theme, w, h) {
  const r = rand(theme === "sand" ? 7 : 3);
  const items = [];
  const n = Math.round((w * h) / (theme === "sand" ? 26000 : 18000));
  for (let i = 0; i < n; i++) items.push({ x: r() * w, y: r() * h, s: 0.6 + r() * 0.8, k: r() });
  return items;
}

function drawGround(ctx, theme, fit, decor) {
  const { cw, ch, scale } = fit;
  if (theme === "sand") {
    ctx.fillStyle = "#e2b46c";
    ctx.fillRect(0, 0, cw, ch);
    for (const d of decor) {
      const x = d.x * scale, y = d.y * scale;
      if (d.k < 0.55) {
        ctx.fillStyle = "rgba(160, 110, 50, 0.22)";
        ctx.beginPath();
        ctx.ellipse(x, y, 34 * d.s * scale * 2, 18 * d.s * scale * 2, d.k * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.k < 0.8) {
        const rr = 20 * d.s * scale * 1.6;
        ctx.fillStyle = "#c8964f";
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#b07f3e";
        ctx.beginPath(); ctx.ellipse(x, y + rr * 0.08, rr * 0.62, rr * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#a9875a";
        ctx.beginPath(); ctx.arc(x, y, 5 * d.s * scale * 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = "#6cc04a";
    ctx.fillRect(0, 0, cw, ch);
    const tile = 50 * scale;
    ctx.fillStyle = "#77ca53";
    for (let i = 0; i * tile < cw; i++) {
      for (let j = 0; j * tile < ch; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * tile, j * tile, tile, tile);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.setLineDash([12 * scale, 12 * scale]);
    ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cw / 2, ch / 2, 60 * scale, 0, Math.PI * 2); ctx.stroke();
    for (const d of decor) {
      const x = d.x * scale, y = d.y * scale, s = 9 * d.s * scale * 1.4;
      if (d.k < 0.75) {
        ctx.strokeStyle = "#3f8f2c";
        ctx.lineWidth = Math.max(1.5, 2.5 * scale);
        ctx.beginPath();
        ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x - s * 0.4, y - s * 0.6);
        ctx.lineTo(x, y + s * 0.3); ctx.lineTo(x + s * 0.5, y - s * 0.7); ctx.lineTo(x + s, y + s * 0.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = d.k < 0.88 ? "#fff6c8" : "#ffd3e0";
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, s * 0.28, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#ffcf3f";
        ctx.beginPath(); ctx.arc(x, y, s * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawObstacle(ctx, o, scale) {
  const x = o.x * scale, y = o.y * scale, w = o.w * scale, h = o.h * scale;
  const lw = Math.max(2.5, 4 * scale * 1.2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(ctx, x + 6, y + 8, w, h, 8); ctx.fill();
  if (o.type === "boulder") {
    roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.38);
    ctx.fillStyle = "#8f8a80"; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = "#b3ada2";
    ctx.beginPath(); ctx.ellipse(x + w * 0.38, y + h * 0.3, w * 0.34, h * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#726d64";
    ctx.beginPath(); ctx.ellipse(x + w * 0.6, y + h * 0.95, w * 0.6, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.38); inkStroke(ctx, lw);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.62, y + h * 0.42); ctx.lineTo(x + w * 0.7, y + h * 0.55); ctx.lineTo(x + w * 0.64, y + h * 0.66);
    inkStroke(ctx, lw * 0.6);
    return;
  }
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#a9a08f"; ctx.fill();
  ctx.save(); ctx.clip();
  const bh = Math.max(10, 26 * scale), bw = bh * 2.1;
  ctx.strokeStyle = "rgba(27,31,59,0.55)";
  ctx.lineWidth = Math.max(1.5, 2.5 * scale);
  for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    for (let xx = x + (row % 2 ? bw / 2 : 0); xx < x + w; xx += bw) {
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(yy + bh, y + h)); ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x, y, w, Math.max(4, 7 * scale));
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(x, y + h - Math.max(5, 9 * scale), w, Math.max(5, 9 * scale));
  ctx.restore();
  roundRect(ctx, x, y, w, h, 6); inkStroke(ctx, lw);
}

function drawTank(ctx, x, y, r, hull, aim, c, lw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(r * 0.18, r * 0.28, r * 1.28, r * 1.12, 0, 0, Math.PI * 2); ctx.fill();

  ctx.rotate(hull);
  for (const side of [-1, 1]) {
    roundRect(ctx, -r * 1.18, side * r * 0.98 - r * 0.3, r * 2.36, r * 0.6, r * 0.24);
    ctx.fillStyle = "#3a3f5c"; ctx.fill(); inkStroke(ctx, lw);
    ctx.strokeStyle = "#626a93"; ctx.lineWidth = Math.max(1, lw * 0.5);
    for (let t = -0.95; t <= 0.96; t += 0.32) {
      ctx.beginPath(); ctx.moveTo(r * t, side * r * 0.98 - r * 0.2); ctx.lineTo(r * t, side * r * 0.98 + r * 0.2); ctx.stroke();
    }
  }
  roundRect(ctx, -r * 1.02, -r * 0.74, r * 2.04, r * 1.48, r * 0.34);
  ctx.fillStyle = c.base; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = c.hi; ctx.globalAlpha = 0.75;
  ctx.fillRect(-r * 1.02, -r * 0.74, r * 2.04, r * 0.42);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.lo;
  ctx.fillRect(-r * 1.02, r * 0.5, r * 2.04, r * 0.3);
  ctx.restore();
  roundRect(ctx, -r * 1.02, -r * 0.74, r * 2.04, r * 1.48, r * 0.34); inkStroke(ctx, lw);
  ctx.fillStyle = INK;
  for (const [px, py] of [[-0.72, -0.48], [-0.72, 0.48], [0.72, -0.48], [0.72, 0.48]]) {
    ctx.beginPath(); ctx.arc(px * r, py * r, r * 0.08, 0, Math.PI * 2); ctx.fill();
  }

  ctx.rotate(aim - hull);
  roundRect(ctx, r * 0.2, -r * 0.19, r * 1.38, r * 0.38, r * 0.1);
  ctx.fillStyle = "#5b6286"; ctx.fill(); inkStroke(ctx, lw);
  roundRect(ctx, r * 1.42, -r * 0.27, r * 0.34, r * 0.54, r * 0.1);
  ctx.fillStyle = "#5b6286"; ctx.fill(); inkStroke(ctx, lw);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = c.base; ctx.fill(); inkStroke(ctx, lw);
  ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.18, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = c.hi; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = c.lo; ctx.fill();
  ctx.restore();
}

function drawHpBar(ctx, x, y, r, hp, isMe) {
  const w = r * 2.4, h = Math.max(8, r * 0.36), top = y - r * 1.9;
  roundRect(ctx, x - w / 2, top, w, h, h / 2);
  ctx.fillStyle = INK; ctx.fill();
  const pct = Math.max(0, Math.min(1, hp / 100));
  if (pct > 0) {
    roundRect(ctx, x - w / 2 + 2, top + 2, (w - 4) * pct, h - 4, (h - 4) / 2);
    ctx.fillStyle = pct > 0.5 ? "#5ccf47" : pct > 0.25 ? "#ffcf3f" : "#ff4d5e"; ctx.fill();
  }
  if (isMe) {
    const ty = top - h * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.8, ty - h * 1.1); ctx.lineTo(x + h * 0.8, ty - h * 1.1); ctx.lineTo(x, ty);
    ctx.closePath();
    ctx.fillStyle = "#ffcf3f"; ctx.fill(); inkStroke(ctx, 2.5);
  }
}

function drawBullet(ctx, b, scale) {
  const x = b.x * scale, y = b.y * scale, sp = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / sp, uy = b.vy / sp, r = Math.max(4, BULLET_RADIUS * scale * 1.5);
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = `rgba(255,255,255,${0.16 * (4 - i)})`;
    ctx.beginPath(); ctx.arc(x - ux * r * 1.6 * i, y - uy * r * 1.6 * i, r * (1 - i * 0.18), 0, Math.PI * 2); ctx.fill();
  }
  const c = TEAMS[b.team] || TEAMS[0];
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = c.lo; ctx.fill(); inkStroke(ctx, Math.max(2, r * 0.45));
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fill();
}

function drawBurst(ctx, e, scale) {
  const k = e.t;
  const big = e.kind === "boom";
  const R = (big ? 46 : 22) * scale * 1.3 * (0.6 + (1 - k) * 0.6);
  ctx.save();
  ctx.translate(e.x * scale, e.y * scale);
  ctx.globalAlpha = Math.min(1, k * 1.6);
  const spikes = big ? 10 : 7;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + e.rot;
    const rr = i % 2 === 0 ? R : R * 0.5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = big ? "#ff9a3c" : "#ffe58a"; ctx.fill(); inkStroke(ctx, 3);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
}

export function drawScene(ctx, state, fit, view, theme, now = performance.now()) {
  const { cw, ch, scale } = fit;
  if (!view.decor) view.decor = buildDecor(theme, fit.w, fit.h);
  drawGround(ctx, theme, fit, view.decor);
  if (!state) return;

  for (const o of state.obstacles || []) drawObstacle(ctx, o, scale);

  const r = Math.max(14, PLAYER_RADIUS * scale * 1.45);
  const lw = Math.max(2, r * 0.16);
  const players = state.players || [];

  players.forEach((p, i) => {
    const x = p.x * scale, y = p.y * scale;
    if (!p.alive) {
      ctx.fillStyle = "rgba(20,20,20,0.35)";
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      drawTank(ctx, x, y, r, view.hulls[i], p.aim_angle, WRECK, lw);
      for (const [dx, dy, s] of [[-0.3, -1.1, 0.5], [0.4, -1.6, 0.42], [-0.1, -2.1, 0.34]]) {
        ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, s * r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(90,90,100,0.75)"; ctx.fill();
      }
      return;
    }
    drawTank(ctx, x, y, r, view.hulls[i], p.aim_angle, TEAMS[i], lw);
  });

  for (const b of state.bullets || []) drawBullet(ctx, b, scale);

  players.forEach((p, i) => {
    if (p.alive) drawHpBar(ctx, p.x * scale, p.y * scale, r, p.health, view.seat === i);
  });

  view.effects = view.effects.filter(e => now - e.born < e.life);
  for (const e of view.effects) drawBurst(ctx, { ...e, t: 1 - (now - e.born) / e.life }, scale);

  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeRect(3, 3, cw - 6, ch - 6);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, cw - 16, ch - 16);
}
