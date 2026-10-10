import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar, BrokenShield, DrawBadge, Emblem, Logo, MapThumb, ModeArt, ShellIcon, TankArt, Trophy, botInfo,
} from "./art.jsx";
import { MAX_STEPS, drawScene, fitArena, ingest, interpolate, newView } from "./render.js";

// Vite dev server runs on 5173 with the API on 5000; in production the API is same-origin.
const API = window.location.port === "5173"
  ? `${window.location.protocol}//${window.location.hostname}:5000/api`
  : "/api";
const WS_BASE = API.startsWith("/")
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${API}`
  : API.replace(/^http/, "ws");
const TICK_MS = 80;

const MAPS = [
  { id: "map1", name: "Grassy Plains", desc: "Open field. Nowhere to hide." },
  { id: "map2", name: "Rubble Fort", desc: "Walls and boulders for cover." },
];
const MAP_BOTS = { map1: ["random", "chaser", "circler"], map2: ["random", "hider", "mobile"] };
const themeOf = (mapId) => (mapId === "map2" ? "sand" : "grass");

// ── API + auth ─────────────────────────────────────────────────────────
const AUTH_KEY = "iron_duel_auth";

function loadAuth() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); } catch { return null; }
}

function saveAuth(auth) {
  try {
    if (auth) sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else sessionStorage.removeItem(AUTH_KEY);
  } catch { /* storage unavailable: session lasts until reload */ }
}

async function api(path, { token, method = "GET", body, keepalive } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    keepalive,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Leave on unmount or tab close. React StrictMode (dev) unmounts and immediately
// remounts every component, so the leave is deferred and cancelled by a remount.
function useLeaveOnExit(leaveRef) {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    const onHide = () => leaveRef.current?.(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", onHide);
      setTimeout(() => { if (!mountedRef.current) leaveRef.current?.(false); }, 0);
    };
  }, []);
}

// ── Layout ─────────────────────────────────────────────────────────────
function TopBar({ user, onLogout, onHome }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      padding: "14px 22px", background: "linear-gradient(180deg, rgba(27,31,59,.55), rgba(27,31,59,.25))",
      borderBottom: "3px solid var(--ink)",
    }}>
      <div onClick={onHome} style={{ cursor: onHome ? "pointer" : "default" }}>
        <Logo size={44} tagline={false} />
      </div>
      {user && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="panel" style={{ padding: "6px 14px 6px 8px", display: "flex", alignItems: "center", gap: 10, borderRadius: 14 }}>
            <Avatar name={user.name} team="blue" size={34} />
            <div>
              <div className="display" style={{ fontSize: 17, lineHeight: 1.1 }}>{user.name}</div>
              <div style={{ fontSize: 12, color: "#cfe0ff" }}>{user.guest ? "Guest" : "Commander"}</div>
            </div>
          </div>
          <button className="btn gray small" onClick={onLogout}>Log out</button>
        </div>
      )}
    </header>
  );
}

function Page({ children, width = 1100 }) {
  return <main style={{ maxWidth: width, margin: "0 auto", padding: "26px 18px 60px" }}>{children}</main>;
}

// ── Login ──────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      onAuth(await api(path, { method: "POST", body }));
    } catch (e) {
      setError(e.status ? e.message : "Can't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter a username and password.");
      return;
    }
    run(`/auth/${mode}`, { username: username.trim(), password });
  };

  return (
    <Page width={980}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 30, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="bob" style={{ display: "inline-block" }}><Emblem size={150} /></div>
          <h1 className="outlined" style={{ fontSize: 64, margin: "6px 0 0", lineHeight: 1 }}>
            IRON <span style={{ color: "var(--gold)" }}>DUEL</span>
          </h1>
          <p className="display" style={{ fontSize: 20, color: "#dbe8ff", textShadow: "0 2px 0 rgba(0,0,0,.35)", margin: "10px 0 18px" }}>
            1v1 tank battles against bots, a trained AI, or your friends.
          </p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <TankArt team="blue" variant="human" size={150} />
            <TankArt team="red" variant="chaser" flip size={150} />
          </div>
        </div>

        <form onSubmit={submit} className="panel" style={{ padding: 26 }}>
          <div style={{ textAlign: "center", marginTop: -46, marginBottom: 18 }}>
            <span className="ribbon">{mode === "login" ? "Welcome back!" : "Join the battle"}</span>
          </div>
          <div className="segmented" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Log in</button>
            <button type="button" className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Sign up</button>
          </div>
          <input className="field" placeholder="Username" autoComplete="username" style={{ marginBottom: 12 }}
            value={username} onChange={e => { setUsername(e.target.value); setError(""); }} />
          <input className="field" type="password" placeholder="Password" style={{ marginBottom: 8 }}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password} onChange={e => { setPassword(e.target.value); setError(""); }} />
          {mode === "register" && (
            <div style={{ fontSize: 13, color: "#cfe0ff", marginBottom: 8 }}>
              3-20 letters, numbers or _ · password at least 6 characters
            </div>
          )}
          {error && <div className="error-note" style={{ margin: "6px 0 4px" }}>{error}</div>}
          <button type="submit" className="btn green big block" disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Loading…" : mode === "login" ? "Battle!" : "Create account"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px", color: "#cfe0ff" }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(27,31,59,.6)" }} />
            <span className="display">or</span>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(27,31,59,.6)" }} />
          </div>
          <button type="button" className="btn blue block" disabled={busy} onClick={() => run("/auth/guest")}>
            Play as guest
          </button>
        </form>
      </div>
    </Page>
  );
}

// ── Lobby ──────────────────────────────────────────────────────────────
function AgentTiles({ options, value, onChange, team, compact }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length > 3 && compact ? 2 : options.length}, minmax(0, 1fr))`, gap: 7 }}>
      {options.map(o => {
        const info = botInfo(o);
        return (
          <button key={o} type="button" className={`tile ${value === o ? "on" : ""}`} onClick={() => onChange(o)} title={info.blurb}
            style={{ minWidth: 0 }}>
            <TankArt team={team || info.team} variant={o} size={62} style={{ width: "100%", maxWidth: 62, height: "auto" }} />
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeCard({ mode, title, ribbon, desc, children, action, color, onClick }) {
  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      <div style={{
        height: 126, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6,
        background: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,.35), rgba(255,255,255,0) 70%)",
        borderBottom: "3px solid var(--ink)",
      }}>
        <ModeArt mode={mode} />
      </div>
      <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ textAlign: "center", marginTop: -20, marginBottom: 10 }}>
          <span className={`ribbon ${ribbon}`}>{title}</span>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 15, color: "#e3ecff", textAlign: "center", lineHeight: 1.4 }}>{desc}</p>
        <div style={{ flex: 1, marginBottom: 14 }}>{children}</div>
        <button className={`btn ${color} block`} onClick={onClick}>{action}</button>
      </div>
    </section>
  );
}

function TrainingGrounds({ token, mapId }) {
  const agents = ["ppo", ...MAP_BOTS[mapId]];
  const [a0, setA0] = useState("ppo");
  const [a1, setA1] = useState(MAP_BOTS[mapId][1]);
  const [eps, setEps] = useState(20);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agents.includes(a0)) setA0("ppo");
    if (!agents.includes(a1)) setA1(MAP_BOTS[mapId][1]);
    setRes(null);
  }, [mapId]);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setRes(await api("/benchmark", { token, method: "POST", body: { agent0: a0, agent1: a1, episodes: eps, map_id: mapId } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 26 }}>
      <div style={{ textAlign: "center", marginTop: -38, marginBottom: 14 }}>
        <span className="ribbon purple">Training Grounds</span>
      </div>
      <p style={{ textAlign: "center", margin: "0 0 16px", color: "#e3ecff" }}>
        Pit two agents against each other for many rounds and compare win rates.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div>
          <div className="display" style={{ marginBottom: 8, color: "var(--blue-hi)" }}>Blue team</div>
          <AgentTiles options={agents} value={a0} onChange={setA0} team="blue" />
        </div>
        <div>
          <div className="display" style={{ marginBottom: 8, color: "var(--red-hi)" }}>Red team</div>
          <AgentTiles options={agents} value={a1} onChange={setA1} team="red" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
        <div className="segmented" style={{ width: 260 }}>
          {[10, 20, 50].map(n => (
            <button key={n} className={eps === n ? "on" : ""} onClick={() => setEps(n)}>{n} rounds</button>
          ))}
        </div>
        <button className="btn purple" onClick={run} disabled={busy}>{busy ? "Simulating…" : "Run trials"}</button>
        {error && <div className="error-note">{error}</div>}
      </div>
      {res && (
        <div className="pop" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="outlined" style={{ fontSize: 26, color: "var(--blue-hi)" }}>{botInfo(res.agent0_name).label} {res.agent0_winrate}%</span>
            <span className="outlined" style={{ fontSize: 26, color: "var(--red-hi)" }}>{res.agent1_winrate}% {botInfo(res.agent1_name).label}</span>
          </div>
          <div style={{ display: "flex", height: 26, border: "3px solid var(--ink)", borderRadius: 10, overflow: "hidden", background: "#98a2c4" }}>
            <div style={{ width: `${res.agent0_winrate}%`, background: "linear-gradient(180deg, var(--blue-hi), var(--blue-lo))" }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: `${res.agent1_winrate}%`, background: "linear-gradient(180deg, var(--red-hi), var(--red-lo))" }} />
          </div>
          <div style={{ textAlign: "center", marginTop: 8, color: "#cfe0ff", fontSize: 14 }}>
            {res.episodes} rounds · {res.draws} draws · avg {res.avg_steps} ticks
          </div>
        </div>
      )}
    </section>
  );
}

function LobbyScreen({ token, onPlay }) {
  const [mapId, setMapId] = useState("map1");
  const bots = MAP_BOTS[mapId];
  const simAgents = ["ppo", ...bots];
  const [bot, setBot] = useState(bots[1]);
  const [simA, setSimA] = useState("ppo");
  const [simB, setSimB] = useState(bots[1]);

  useEffect(() => {
    if (!bots.includes(bot)) setBot(bots[1]);
    if (!simAgents.includes(simA)) setSimA("ppo");
    if (!simAgents.includes(simB)) setSimB(bots[1]);
  }, [mapId]);

  return (
    <Page>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 30 }}>
        {MAPS.map(m => (
          <button key={m.id} type="button" onClick={() => setMapId(m.id)} className={`tile ${mapId === m.id ? "on" : ""}`}
            style={{ flexDirection: "row", gap: 14, padding: 12, justifyContent: "flex-start", textAlign: "left" }}>
            <MapThumb mapId={m.id} size={130} />
            <div>
              <div style={{ fontSize: 13, opacity: .7 }}>Arena</div>
              <div style={{ fontSize: 24 }}>{m.name}</div>
              <div style={{ fontFamily: "var(--body)", fontWeight: 800, fontSize: 13, opacity: .8, marginTop: 2 }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 22 }}>
        <ModeCard mode="bot" title="Vs Bots" ribbon="" color="" desc="Warm up against a scripted tank."
          action="Battle!" onClick={() => onPlay({ mode: "bot", mapId, opponent: bot })}>
          <AgentTiles options={bots} value={bot} onChange={setBot} />
        </ModeCard>
        <ModeCard mode="rl" title="Vs Neuron" ribbon="green" color="green"
          desc="Our reinforcement-learning agent. Trained for millions of rounds to hunt you down."
          action="Challenge" onClick={() => onPlay({ mode: "rl", mapId })} />
        <ModeCard mode="human" title="Vs Player" ribbon="red" color="red"
          desc="Get matched with another commander on this arena. Real opponent, real bragging rights."
          action="Find match" onClick={() => onPlay({ mode: "human", mapId })} />
        <ModeCard mode="sim" title="Spectate" ribbon="blue" color="blue" desc="Sit back and watch two agents fight."
          action="Watch" onClick={() => onPlay({ mode: "sim", mapId, agent0: simA, agent1: simB })}>
          <AgentTiles options={simAgents} value={simA} onChange={setSimA} team="blue" compact />
          <div className="display" style={{ textAlign: "center", margin: "6px 0", color: "var(--gold)" }}>vs</div>
          <AgentTiles options={simAgents} value={simB} onChange={setSimB} team="red" compact />
        </ModeCard>
      </div>

      <TrainingGrounds token={token} mapId={mapId} />
    </Page>
  );
}

// ── Waiting room ───────────────────────────────────────────────────────
function WaitingScreen({ token, user, mapId, onMatched, onCancel, onAuthError }) {
  const [elapsed, setElapsed] = useState(0);
  const [waitingCount, setWaitingCount] = useState(1);
  const [error, setError] = useState("");
  const matchedRef = useRef(false);
  const leaveRef = useRef(null);
  leaveRef.current = (keepalive) => {
    if (!matchedRef.current) api("/queue/leave", { token, method: "POST", keepalive }).catch(() => {});
  };
  useLeaveOnExit(leaveRef);

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    const join = () => api("/queue/join", { token, method: "POST", body: { map_id: mapId } });
    const fail = (e) => {
      if (!alive) return;
      if (e.status === 401) onAuthError();
      else setError("Connection hiccup. Retrying…");
    };
    const handle = (r) => {
      if (!alive) return;
      setError("");
      if (r.status === "matched") {
        matchedRef.current = true;
        alive = false;
        onMatched({ matchId: r.match_id, seat: r.seat });
      } else if (r.status === "idle") {
        join().then(handle).catch(fail);
      } else {
        setWaitingCount(r.players_waiting ?? 1);
      }
    };
    join().then(handle).catch(fail);
    const poll = setInterval(() => api("/queue/status", { token }).then(handle).catch(fail), 1000);
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [token, mapId]);

  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");
  const map = MAPS.find(m => m.id === mapId);

  return (
    <Page width={760}>
      <section className="panel" style={{ textAlign: "center", padding: "30px 24px" }}>
        <div style={{ marginTop: -50, marginBottom: 18 }}><span className="ribbon red">Finding opponent</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
          <div className="panel cream" style={{ padding: 14 }}>
            <TankArt team="blue" variant="human" size={140} />
            <div className="display" style={{ fontSize: 20 }}>{user.name}</div>
          </div>
          <Emblem size={96} spin />
          <div className="panel cream" style={{ padding: 14, opacity: 0.85 }}>
            <div style={{ filter: "grayscale(1) brightness(0.45)", animation: "pulse 1.4s ease-in-out infinite" }}>
              <TankArt team="gray" flip size={140} />
            </div>
            <div className="display" style={{ fontSize: 20 }}>???</div>
          </div>
        </div>
        <div className="outlined" style={{ fontSize: 52, margin: "18px 0 0" }}>{mm}:{ss}</div>
        <div className="display" style={{ fontSize: 18, color: "#dbe8ff", margin: "4px 0 6px" }}>
          {map?.name} · {waitingCount > 1 ? `${waitingCount} commanders searching` : "Waiting for a commander to join"}
        </div>
        <div style={{ fontSize: 14, color: "#cfe0ff", marginBottom: 20 }}>
          Share the game link with a friend and have them pick <b>Vs Player</b> on this arena.
        </div>
        {error && <div className="error-note" style={{ marginBottom: 14 }}>{error}</div>}
        <button className="btn red" onClick={onCancel}>Cancel</button>
      </section>
    </Page>
  );
}

// ── Human controls ─────────────────────────────────────────────────────
const MOVE_DIRS = [[0,0],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
// Joystick angle sector (0=E, 1=SE, … 7=NE, screen y-down) → MOVE_DIRS index.
const SECTOR_TO_MOVE = [3, 4, 5, 6, 7, 8, 1, 2];
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const GAME_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function useHumanControls(seat, stateRef, canvasRef) {
  const keysRef = useRef({});
  const touchRef = useRef({ move: null, aim: null });
  const mouseRef = useRef({ wx: null, wy: null, fire: false });
  const lastAimRef = useRef(seat === 1 ? 8 : 0);

  useEffect(() => {
    if (seat == null) return;
    const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (GAME_KEYS.has(e.key)) e.preventDefault();
      keysRef.current[norm(e.key)] = true;
    };
    const up = (e) => { keysRef.current[norm(e.key)] = false; };
    const blur = () => { keysRef.current = {}; mouseRef.current.fire = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [seat]);

  const getAction = useCallback(() => {
    const keys = keysRef.current;
    const mouse = mouseRef.current;

    let mx = 0, my = 0;
    if (keys["w"] || keys["ArrowUp"])    my = -1;
    if (keys["s"] || keys["ArrowDown"])  my =  1;
    if (keys["a"] || keys["ArrowLeft"])  mx = -1;
    if (keys["d"] || keys["ArrowRight"]) mx =  1;
    let moveDir = 0;
    for (let i = 1; i < MOVE_DIRS.length; i++) {
      if (MOVE_DIRS[i][0] === mx && MOVE_DIRS[i][1] === my) { moveDir = i; break; }
    }
    const tm = touchRef.current.move;
    if (tm) {
      const sector = ((Math.round(Math.atan2(tm[1], tm[0]) / (Math.PI / 4)) % 8) + 8) % 8;
      moveDir = SECTOR_TO_MOVE[sector];
    }

    // AIM_ANGLES[i] = i·π/8 → 0=E, 4=S, 8=W, 12=N (y-down)
    let aimDir = lastAimRef.current;
    if (["i", "k", "j", "l", "u", "o", "n", "m"].some(k => keys[k])) {
      if (keys["i"]) aimDir = 12;
      if (keys["l"]) aimDir = 0;
      if (keys["k"]) aimDir = 4;
      if (keys["j"]) aimDir = 8;
      if (keys["u"]) aimDir = 10;
      if (keys["o"]) aimDir = 14;
      if (keys["n"]) aimDir = 6;
      if (keys["m"]) aimDir = 2;
      if (keys["i"] && keys["j"]) aimDir = 10;
      if (keys["i"] && keys["l"]) aimDir = 14;
      if (keys["k"] && keys["j"]) aimDir = 6;
      if (keys["k"] && keys["l"]) aimDir = 2;
    } else if (touchRef.current.aim) {
      const [ax, ay] = touchRef.current.aim;
      aimDir = ((Math.round(Math.atan2(ay, ax) * 8 / Math.PI) % 16) + 16) % 16;
    } else if (mouse.wx !== null) {
      const me = stateRef.current?.players?.[seat];
      if (me && Number.isFinite(me.x)) {
        const a = Math.round(Math.atan2(mouse.wy - me.y, mouse.wx - me.x) * 8 / Math.PI);
        if (Number.isFinite(a)) aimDir = ((a % 16) + 16) % 16;
      }
    }
    lastAimRef.current = aimDir;

    const shoot = keys[" "] || keys["f"] || mouse.fire || touchRef.current.aim ? 1 : 0;
    return [moveDir, aimDir, shoot];
  }, [seat, stateRef]);

  const toWorld = (e) => {
    const canvas = canvasRef.current;
    const arena = stateRef.current?.arena;
    if (!canvas || !arena) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.wx = ((e.clientX - rect.left) / rect.width) * arena.w;
    mouseRef.current.wy = ((e.clientY - rect.top) / rect.height) * arena.h;
  };

  const handlers = seat == null ? {} : {
    onMouseMove: toWorld,
    onMouseLeave: () => { mouseRef.current.wx = null; mouseRef.current.fire = false; },
    onMouseDown: (e) => { if (e.button === 0) { toWorld(e); mouseRef.current.fire = true; } },
    onMouseUp: (e) => { if (e.button === 0) mouseRef.current.fire = false; },
  };

  const setTouch = useCallback((which, vec) => { touchRef.current[which] = vec; }, []);

  return { getAction, handlers, setTouch };
}

// ── Game ───────────────────────────────────────────────────────────────
function Board({ bufRef, mapId, seat, canvasRef, handlers, children }) {
  const viewRef = useRef(null);
  if (!viewRef.current) viewRef.current = newView(seat);
  const latest = bufRef.current[bufRef.current.length - 1]?.state;
  const arena = latest?.arena || (mapId === "map2" ? { w: 1200, h: 1200 } : { w: 800, h: 500 });
  const fit = fitArena(arena, 760, 560);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => {
    let raf;
    let ingested = null;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const f = fitRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(f.cw * dpr)) {
        canvas.width = Math.round(f.cw * dpr);
        canvas.height = Math.round(f.ch * dpr);
      }
      const buf = bufRef.current;
      const now = performance.now();
      const last = buf[buf.length - 1];
      if (last && last !== ingested) {
        for (const snap of buf) if (!snap.ingested) { ingest(viewRef.current, snap.state, snap.t); snap.ingested = true; }
        ingested = last;
      }
      // Render one tick behind the newest snapshot and blend between the two around that time.
      let state = last?.state;
      if (buf.length >= 2) {
        const renderT = now - last.tick;
        let i = buf.length - 1;
        while (i > 0 && buf[i - 1].t > renderT) i--;
        const a = buf[Math.max(0, i - 1)], b = buf[i];
        const alpha = b.t === a.t ? 1 : Math.min(1, Math.max(0, (renderT - a.t) / (b.t - a.t)));
        state = interpolate(a.state, b.state, alpha);
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, state, f, viewRef.current, themeOf(mapId), now);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mapId]);

  return (
    <div style={{
      position: "relative", width: "100%", maxWidth: fit.cw + 12, margin: "0 auto",
      padding: 6, background: "linear-gradient(180deg, #8b5a2b, #5e3a1a)", border: "3px solid var(--ink)",
      borderRadius: 18, boxShadow: "inset 0 3px 0 rgba(255,255,255,.25), 0 8px 0 rgba(10,14,40,.55)",
    }}>
      <canvas ref={canvasRef} {...handlers} style={{
        display: "block", width: "100%", aspectRatio: `${fit.cw} / ${fit.ch}`, borderRadius: 12,
        cursor: seat != null ? "crosshair" : "default", touchAction: "none",
      }} />
      {children}
    </div>
  );
}

function Overlay({ children, dim = 0.55 }) {
  return (
    <div style={{
      position: "absolute", inset: 6, borderRadius: 12, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: `rgba(15,19,48,${dim})`, textAlign: "center", padding: 16,
    }}>
      {children}
    </div>
  );
}

function PlayerBanner({ name, team, player, isYou, align = "left" }) {
  const hp = Math.max(0, player?.health ?? 100);
  const ammo = player?.ammo ?? 8;
  const tone = hp > 50 ? "" : hp > 25 ? "mid" : "low";
  const right = align === "right";
  return (
    <div className="panel" style={{
      minWidth: 0, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
      flexDirection: right ? "row-reverse" : "row",
      background: `linear-gradient(180deg, var(--${team}-hi), var(--${team}-lo))`,
    }}>
      <Avatar name={name} team={team} size={42} />
      <div style={{ flex: 1, minWidth: 0, textAlign: right ? "right" : "left" }}>
        <div className="display" style={{ fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 2px 0 var(--ink)" }}>
          {name}{isYou && <span style={{ color: "var(--gold)" }}> (you)</span>}
        </div>
        <div className="hpbar" style={{ margin: "4px 0" }}>
          <div className={tone} style={{ width: `${hp}%`, marginLeft: right ? "auto" : 0 }} />
          <span>{hp}</span>
        </div>
        <div style={{ display: "flex", gap: 2, justifyContent: right ? "flex-end" : "flex-start" }}>
          {Array.from({ length: 8 }).map((_, i) => <ShellIcon key={i} empty={i >= ammo} size={15} />)}
        </div>
      </div>
    </div>
  );
}

function Joystick({ label, team, onChange, size = 136 }) {
  const baseRef = useRef(null);
  const pointerRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (e) => {
    const r = baseRef.current.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = e.clientX - (r.left + radius), dy = e.clientY - (r.top + radius);
    const d = Math.hypot(dx, dy);
    if (d > radius) { dx = (dx / d) * radius; dy = (dy / d) * radius; }
    setKnob({ x: dx, y: dy });
    onChange(Math.hypot(dx, dy) / radius > 0.25 ? [dx / radius, dy / radius] : null);
  };
  const release = () => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(null);
  };

  return (
    <div className="stick-wrap">
      <div ref={baseRef} className="stick" style={{ width: size, height: size }}
        onPointerDown={(e) => { pointerRef.current = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } move(e); }}
        onPointerMove={(e) => { if (e.pointerId === pointerRef.current) move(e); }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <div className={`stick-knob ${team}`} style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="display stick-label">{label}</div>
    </div>
  );
}

function TouchPad({ setTouch }) {
  return (
    <div className="touchpad">
      <Joystick label="Move" team="blue" onChange={(v) => setTouch("move", v)} />
      <Joystick label="Aim & fire" team="red" onChange={(v) => setTouch("aim", v)} />
    </div>
  );
}

function ControlsBar() {
  const Item = ({ keys, label }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {keys.map(k => <span key={k} className="keycap">{k}</span>)}
      <span style={{ marginLeft: 4 }}>{label}</span>
    </span>
  );
  return (
    <div className="panel" style={{ marginTop: 18, padding: "10px 16px", display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", fontSize: 14 }}>
      <Item keys={["W", "A", "S", "D"]} label="Move" />
      <Item keys={["Mouse"]} label="Aim" />
      <Item keys={["Click", "Space"]} label="Fire" />
      <Item keys={["I", "J", "K", "L"]} label="Keyboard aim" />
    </div>
  );
}

function GameScreen({ token, config, onExit, onRequeue, onAuthError }) {
  const isPvp = config.mode === "human";
  const seat = isPvp ? config.seat : config.mode === "sim" ? null : 0;
  const [snap, setSnap] = useState(null);
  const [matchId, setMatchId] = useState(isPvp ? config.matchId : null);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(TICK_MS);
  const [round, setRound] = useState(0);
  const stateRef = useRef(null);
  const canvasRef = useRef(null);
  const bufRef = useRef([]);
  const wsRef = useRef(null);
  const speedRef = useRef(speed);
  const liveRef = useRef({ matchId: null, done: false });
  const { getAction, handlers, setTouch } = useHumanControls(seat, stateRef, canvasRef);

  liveRef.current = { matchId, done: !!snap?.done };

  const fail = useCallback((e) => {
    if (e.status === 401) onAuthError();
    else if (e.status === 404) setError("This match has expired.");
    else setError(e.status ? e.message : "Connection hiccup. Retrying…");
  }, [onAuthError]);

  useEffect(() => {
    if (isPvp) return;
    let cancelled = false;
    setSnap(null);
    setMatchId(null);
    setError("");
    api("/match/start", {
      token, method: "POST",
      body: { mode: config.mode, map_id: config.mapId, opponent: config.opponent, agent0: config.agent0, agent1: config.agent1, tick_ms: speedRef.current },
    }).then(r => {
      if (cancelled) {
        api(`/match/${r.match_id}/leave`, { token, method: "POST" }).catch(() => {});
        return;
      }
      stateRef.current = r.state;
      bufRef.current = [{ t: performance.now(), state: r.state, tick: r.tick_ms }];
      setSnap(r);
      setMatchId(r.match_id);
    }).catch(e => { if (!cancelled) fail(e); });
    return () => { cancelled = true; };
  }, [round]);

  // Live connection: the server pushes a snapshot every tick; we send input only when it changes.
  useEffect(() => {
    if (!matchId) return;
    let ws = null;
    let stopped = false;
    let retries = 0;
    let retryTimer = null;
    let lastAction = "";
    let lastSent = 0;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/match/${matchId}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        retries = 0;
        lastAction = "";
        ws.send(JSON.stringify({ token }));
      };
      ws.onmessage = (ev) => {
        const r = JSON.parse(ev.data);
        if (r.error) {
          stopped = true;
          setError(r.error);
          ws.close();
          return;
        }
        stateRef.current = r.state;
        const buf = bufRef.current;
        buf.push({ t: performance.now(), state: r.state, tick: r.tick_ms });
        if (buf.length > 5) buf.shift();
        setSnap(r);
        setError("");
        if (r.done) {
          stopped = true;
          ws.close();
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setError("Connection lost. Reconnecting…");
        retryTimer = setTimeout(connect, Math.min(4000, 400 * 2 ** retries++));
      };
    };
    connect();

    const sender = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (seat != null) {
        const action = JSON.stringify(getAction());
        if (action !== lastAction || now - lastSent > 500) {
          ws.send(`{"action":${action}}`);
          lastAction = action;
          lastSent = now;
        }
      } else if (now - lastSent > 1000) {
        ws.send('{"ping":1}');
        lastSent = now;
      }
    }, 30);

    return () => {
      stopped = true;
      clearInterval(sender);
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [matchId]);

  const changeSpeed = (ms) => {
    speedRef.current = ms;
    setSpeed(ms);
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ tick_ms: ms }));
  };

  const leaveRef = useRef(null);
  leaveRef.current = (keepalive) => {
    const { matchId: mid, done } = liveRef.current;
    if (mid && !done) api(`/match/${mid}/leave`, { token, method: "POST", keepalive }).catch(() => {});
  };
  useLeaveOnExit(leaveRef);

  const leave = () => {
    leaveRef.current(false);
    liveRef.current = { matchId: null, done: true };
    onExit();
  };

  const state = snap?.state;
  const players = snap?.players || [];
  const nameFor = (i) => {
    const n = players[i];
    if (n == null) return i === 0 ? "Blue" : "Red";
    if (isPvp || i === seat) return n;
    return botInfo(n).label;
  };

  const info = snap?.done ? snap.match_info : null;
  let result = null;
  if (info) {
    const w = info.winner;
    if (w == null) result = { kind: "draw", text: "Draw!", ribbon: "blue" };
    else if (seat == null) result = { kind: "win", text: `${nameFor(w)} wins!`, ribbon: w === 0 ? "blue" : "red" };
    else if (w === seat) result = { kind: "win", text: "Victory!", ribbon: "" };
    else result = { kind: "loss", text: "Defeat", ribbon: "red" };
    result.sub = info.reason === "disconnect" ? (w === seat ? "Your opponent disconnected." : "You lost connection.")
      : info.reason === "left" ? (w === seat ? "Your opponent fled the battle!" : "You left the battle.")
      : info.steps >= MAX_STEPS ? "Time ran out." : `Battle lasted ${(info.steps * TICK_MS / 1000).toFixed(0)} seconds.`;
  }
  const countdown = isPvp && snap && !snap.done && snap.starts_in > 0 ? Math.ceil(snap.starts_in) : null;
  const secondsLeft = Math.max(0, Math.ceil(((MAX_STEPS - (state?.step || 0)) * TICK_MS) / 1000));
  const map = MAPS.find(m => m.id === config.mapId);

  return (
    <Page width={900}>
      <div className="hud">
        <PlayerBanner name={nameFor(0)} team="blue" player={state?.players?.[0]} isYou={seat === 0} />
        <div className="panel cream clock" style={{ padding: "8px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 110 }}>
          <div style={{ fontSize: 12, opacity: .7 }}>{map?.name}</div>
          <div className="display" style={{ fontSize: 30, lineHeight: 1, color: secondsLeft <= 10 ? "var(--red-lo)" : "var(--ink)" }}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </div>
        </div>
        <PlayerBanner name={nameFor(1)} team="red" player={state?.players?.[1]} isYou={seat === 1} align="right" />
      </div>

      <Board bufRef={bufRef} mapId={config.mapId} seat={seat} canvasRef={canvasRef} handlers={handlers}>
        {!state && (
          <Overlay dim={0.7}>
            <Emblem size={80} spin />
            <div className="outlined" style={{ fontSize: 26, marginTop: 10 }}>Loading arena…</div>
          </Overlay>
        )}
        {countdown != null && (
          <Overlay>
            <div className="outlined" style={{ fontSize: 26 }}>{nameFor(0)} <span style={{ color: "var(--gold)" }}>vs</span> {nameFor(1)}</div>
            <div key={countdown} className="outlined pop" style={{ fontSize: 120, lineHeight: 1.1, color: "var(--gold)" }}>{countdown}</div>
          </Overlay>
        )}
        {result && (
          <Overlay dim={0.7}>
            <div className="result">
              <div className="pop result-art">
                {result.kind === "win" ? <Trophy /> : result.kind === "loss" ? <BrokenShield /> : <DrawBadge />}
              </div>
              <div className="pop" style={{ animationDelay: ".1s" }}>
                <span className={`ribbon result-title ${result.ribbon}`}>{result.text}</span>
              </div>
              <div className="display result-sub">{result.sub}</div>
              <div className="result-actions">
                <button className="btn green" onClick={() => (isPvp ? onRequeue(config.mapId) : setRound(r => r + 1))}>
                  {isPvp ? "New opponent" : "Play again"}
                </button>
                <button className="btn gray" onClick={leave}>Back to lobby</button>
              </div>
            </div>
          </Overlay>
        )}
        {error && !result && (
          <div className="error-note" style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
            {error}
          </div>
        )}
      </Board>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        {config.mode === "sim" && (
          <div className="segmented" style={{ width: 300 }}>
            {[[150, "Slow"], [80, "Normal"], [40, "Fast"]].map(([s, label]) => (
              <button key={s} className={speed === s ? "on" : ""} onClick={() => changeSpeed(s)}>{label}</button>
            ))}
          </div>
        )}
        {!result && <button className="btn red small" onClick={leave}>{seat == null ? "Stop watching" : "Surrender"}</button>}
      </div>

      {seat != null && !result && (IS_TOUCH ? <TouchPad setTouch={setTouch} /> : <ControlsBar />)}
    </Page>
  );
}

// ── App ────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(loadAuth);
  const [screen, setScreen] = useState(() => ({ name: loadAuth() ? "lobby" : "login" }));

  const logout = useCallback(() => {
    saveAuth(null);
    setAuth(null);
    setScreen({ name: "login" });
  }, []);

  useEffect(() => {
    if (!auth) return;
    api("/auth/me", { token: auth.token }).catch(e => { if (e.status === 401) logout(); });
  }, []);

  const login = (a) => {
    saveAuth(a);
    setAuth(a);
    setScreen({ name: "lobby" });
  };

  const toLobby = () => setScreen({ name: "lobby" });
  const play = (cfg) => setScreen(cfg.mode === "human"
    ? { name: "waiting", mapId: cfg.mapId, key: Date.now() }
    : { name: "game", config: cfg, key: Date.now() });

  let body;
  if (!auth || screen.name === "login") {
    body = <LoginScreen onAuth={login} />;
  } else if (screen.name === "waiting") {
    body = (
      <WaitingScreen key={screen.key} token={auth.token} user={auth.user} mapId={screen.mapId}
        onCancel={toLobby} onAuthError={logout}
        onMatched={({ matchId, seat }) => setScreen({
          name: "game", key: matchId, config: { mode: "human", mapId: screen.mapId, matchId, seat },
        })} />
    );
  } else if (screen.name === "game") {
    body = (
      <GameScreen key={screen.key} token={auth.token} config={screen.config}
        onExit={toLobby} onAuthError={logout}
        onRequeue={(mapId) => setScreen({ name: "waiting", mapId, key: Date.now() })} />
    );
  } else {
    body = <LobbyScreen token={auth.token} onPlay={play} />;
  }

  return (
    <>
      <TopBar user={auth?.user} onLogout={logout} onHome={auth && screen.name !== "lobby" ? toLobby : undefined} />
      {body}
    </>
  );
}
