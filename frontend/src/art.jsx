const INK = "#1b1f3b";

export const TEAM = {
  blue:   { hi: "#7cb6ff", base: "#3b8cff", lo: "#1d5fd0" },
  red:    { hi: "#ff8a96", base: "#ff4d5e", lo: "#c9233c" },
  green:  { hi: "#9be86f", base: "#5ccf47", lo: "#2f9a2a" },
  purple: { hi: "#c3a6ff", base: "#9a6bff", lo: "#6a3fd6" },
  gold:   { hi: "#ffe58a", base: "#ffcf3f", lo: "#f0a316" },
  gray:   { hi: "#c9d0e6", base: "#98a2c4", lo: "#6c769c" },
  orange: { hi: "#ffc48a", base: "#ff9a3c", lo: "#d9661a" },
};

const S = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round" };

// Side-view cartoon tank facing right. `variant` adds a personality accessory.
export function TankArt({ team = "blue", variant, flip, size = 140, style }) {
  const c = TEAM[team] || TEAM.blue;
  return (
    <svg viewBox="0 0 150 104" width={size} height={size * 104 / 150} style={style} aria-hidden="true">
      <g transform={flip ? "translate(150 0) scale(-1 1)" : undefined}>
        {variant === "mobile" && (
          <g stroke={INK} strokeWidth="4" strokeLinecap="round">
            <line x1="2" y1="48" x2="16" y2="48" /><line x1="6" y1="62" x2="18" y2="62" /><line x1="2" y1="76" x2="14" y2="76" />
          </g>
        )}
        {variant === "circler" && (
          <g fill="none" stroke={TEAM.gold.base} strokeWidth="6" strokeLinecap="round">
            <path d="M18 34 A60 34 0 0 1 132 30" stroke={INK} strokeWidth="11" />
            <path d="M18 34 A60 34 0 0 1 132 30" />
            <path d="M120 20 L134 29 L120 36" stroke={INK} strokeWidth="11" strokeLinejoin="round" />
            <path d="M120 20 L134 29 L120 36" strokeLinejoin="round" />
          </g>
        )}
        <ellipse cx="74" cy="97" rx="56" ry="6" fill="rgba(0,0,0,0.28)" />
        <rect x="96" y="30" width="40" height="11" rx="3" fill="#5b6286" {...S} />
        <rect x="130" y="26" width="12" height="19" rx="3" fill="#5b6286" {...S} />
        <rect x="18" y="64" width="114" height="27" rx="13.5" fill="#3a3f5c" {...S} />
        {[34, 54, 74, 94, 114].map(x => (
          <g key={x}>
            <circle cx={x} cy="77.5" r="8" fill="#9aa1c2" stroke={INK} strokeWidth="3" />
            <circle cx={x} cy="77.5" r="2.8" fill={INK} />
          </g>
        ))}
        <path d="M20 66 L31 47 H120 L131 66 Z" fill={c.base} {...S} />
        <path d="M35 51 H116 L118 55.5 H33 Z" fill={c.hi} />
        <rect x="24" y="60" width="102" height="5" fill={c.lo} />
        {[42, 62, 88, 108].map(x => <circle key={x} cx={x} cy="58" r="2.3" fill={INK} />)}
        {variant === "chaser" && (
          <g fill="#e8ecf8" {...S} strokeWidth="3">
            <path d="M131 66 L144 70 L131 74 Z" /><path d="M131 76 L144 80 L131 84 Z" />
          </g>
        )}
        {variant === "human" && (
          <g>
            <circle cx="74" cy="15" r="10" fill="#ffd2a1" stroke={INK} strokeWidth="3.5" />
            <path d="M63.5 14 A10.5 10.5 0 0 1 84.5 14 Z" fill="#6b8f3a" stroke={INK} strokeWidth="3.5" />
            <rect x="66" y="13" width="16" height="6" rx="3" fill="#7fd3ff" stroke={INK} strokeWidth="2.5" />
          </g>
        )}
        <path d="M46 47 C46 28 60 20 75 20 C91 20 104 28 104 47 Z" fill={c.base} {...S} />
        <ellipse cx="64" cy="31" rx="11" ry="5" fill={c.hi} />
        <ellipse cx="75" cy="21" rx="11" ry="4" fill={c.lo} stroke={INK} strokeWidth="3" />
        {variant === "ppo" && (
          <g>
            <line x1="92" y1="26" x2="100" y2="6" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="6" r="5" fill={TEAM.green.hi} stroke={INK} strokeWidth="3" />
            <rect x="56" y="31" width="34" height="9" rx="4.5" fill={TEAM.green.hi} stroke={INK} strokeWidth="3" />
            <path d="M62 35.5 H68 L71 33 L74 38 L77 35.5 H84" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          </g>
        )}
        {variant === "chaser" && (
          <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
            <path d="M62 31 L72 35" /><path d="M88 31 L78 35" />
            <circle cx="68" cy="38" r="3" fill={INK} /><circle cx="82" cy="38" r="3" fill={INK} />
          </g>
        )}
        {variant === "random" && (
          <g>
            <circle cx="75" cy="35" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
            <text x="75" y="41" textAnchor="middle" fontFamily="'Lilita One', sans-serif" fontSize="17" fill={INK}>?</text>
          </g>
        )}
        {variant === "mobile" && (
          <path d="M18 58 L4 54 L4 70 L18 68 Z" fill={TEAM.orange.base} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        )}
        {variant === "hider" && (
          <g>
            <rect x="90" y="52" width="56" height="44" rx="4" fill="#a9a08f" {...S} />
            <path d="M90 66 H146 M90 81 H146 M108 52 V66 M128 52 V66 M118 66 V81 M100 81 V96 M134 81 V96"
              stroke={INK} strokeWidth="3" fill="none" />
            <path d="M94 56 H104" stroke="#d6cfbf" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}

// Crest: shield with crossed cannons.
export function Emblem({ size = 96, spin }) {
  return (
    <svg viewBox="-16 0 152 130" width={size * 152 / 120} height={size * 130 / 120} aria-hidden="true">
      <g style={spin ? { transformOrigin: "60px 62px", animation: "spin 6s linear infinite" } : undefined}>
        {spin && [0, 45, 90, 135, 180, 225, 270, 315].map(a => (
          <rect key={a} x="56" y="0" width="8" height="14" rx="3" fill={TEAM.gold.base} stroke={INK} strokeWidth="3"
            transform={`rotate(${a} 60 62)`} />
        ))}
      </g>
      <g transform="rotate(-32 60 66)">
        <rect x="-8" y="58" width="128" height="14" rx="5" fill="#5b6286" stroke={INK} strokeWidth="4" />
        <rect x="114" y="53" width="16" height="24" rx="4" fill="#5b6286" stroke={INK} strokeWidth="4" />
        <rect x="-4" y="61" width="30" height="4" rx="2" fill="#8d93b0" />
      </g>
      <g transform="rotate(32 60 66)">
        <rect x="0" y="58" width="128" height="14" rx="5" fill="#5b6286" stroke={INK} strokeWidth="4" />
        <rect x="-10" y="53" width="16" height="24" rx="4" fill="#5b6286" stroke={INK} strokeWidth="4" />
        <rect x="94" y="61" width="30" height="4" rx="2" fill="#8d93b0" />
      </g>
      <path d="M60 14 L98 28 V60 C98 86 82 104 60 114 C38 104 22 86 22 60 V28 Z" fill={TEAM.gold.base} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M60 24 L88 34.5 V60 C88 80 76 94 60 102 C44 94 32 80 32 60 V34.5 Z" fill={TEAM.blue.base} />
      <path d="M60 24 L88 34.5 V48 C72 44 50 46 32 54 V34.5 Z" fill={TEAM.blue.hi} opacity="0.55" />
      <path d="M60 44 L65.5 56 L78 57 L68.5 65 L71.5 78 L60 71 L48.5 78 L51.5 65 L42 57 L54.5 56 Z"
        fill="#fff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {[[30, 32], [90, 32], [60, 108]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill={INK} />)}
    </svg>
  );
}

export function Logo({ size = 56, tagline = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Emblem size={size} />
      <div>
        <div className="outlined" style={{ fontSize: size * 0.62, lineHeight: 1 }}>
          IRON <span style={{ color: "var(--gold)" }}>DUEL</span>
        </div>
        {tagline && (
          <div className="display" style={{ fontSize: Math.max(11, size * 0.2), color: "#cfe0ff", marginTop: 4, textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>
            Tank vs tank. Bot vs brain.
          </div>
        )}
      </div>
    </div>
  );
}

export function Avatar({ name = "?", team = "blue", size = 44 }) {
  const c = TEAM[team] || TEAM.blue;
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <svg viewBox="0 0 60 66" width={size} height={size * 66 / 60} aria-hidden="true">
      <path d="M30 3 L56 12 V32 C56 48 44 58 30 63 C16 58 4 48 4 32 V12 Z" fill={c.base} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 9 L50 16 V26 C38 23 22 24 10 29 V16 Z" fill={c.hi} opacity="0.6" />
      <text x="30" y="44" textAnchor="middle" fontFamily="'Lilita One', sans-serif" fontSize="28" fill="#fff"
        stroke={INK} strokeWidth="5" paintOrder="stroke">{initial}</text>
    </svg>
  );
}

export function ShellIcon({ empty, size = 14 }) {
  return (
    <svg viewBox="0 0 12 22" width={size * 12 / 22} height={size} aria-hidden="true">
      <path d="M2 9 C2 4 4 1.5 6 1.5 C8 1.5 10 4 10 9 V20 H2 Z" fill={empty ? "#3a3f66" : TEAM.gold.base} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {!empty && <rect x="2" y="14" width="8" height="3" fill={TEAM.gold.lo} />}
    </svg>
  );
}

export function MapThumb({ mapId, size = 150 }) {
  const w = 160, h = 100;
  if (mapId === "map2") {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width={size} height={size * h / w} aria-hidden="true">
        <rect x="2" y="2" width="156" height="96" rx="12" fill="#e2b46c" stroke={INK} strokeWidth="4" />
        {[[30, 22], [120, 76], [96, 18], [44, 80], [138, 40]].map(([x, y]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx="7" ry="4" fill="#c8964f" />
        ))}
        <rect x="64" y="34" width="32" height="32" rx="4" fill="#a9a08f" stroke={INK} strokeWidth="3" />
        <path d="M64 50 H96 M80 34 V50 M72 50 V66 M88 50 V66" stroke={INK} strokeWidth="2" />
        <rect x="22" y="56" width="14" height="30" rx="3" fill="#a9a08f" stroke={INK} strokeWidth="3" />
        <rect x="124" y="14" width="14" height="30" rx="3" fill="#a9a08f" stroke={INK} strokeWidth="3" />
        <circle cx="40" cy="30" r="8" fill="#8f8a80" stroke={INK} strokeWidth="3" />
        <circle cx="120" cy="70" r="8" fill="#8f8a80" stroke={INK} strokeWidth="3" />
        <circle cx="14" cy="50" r="6" fill={TEAM.blue.base} stroke={INK} strokeWidth="3" />
        <circle cx="146" cy="50" r="6" fill={TEAM.red.base} stroke={INK} strokeWidth="3" />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={size * h / w} aria-hidden="true">
      <rect x="2" y="2" width="156" height="96" rx="12" fill="#6cc04a" stroke={INK} strokeWidth="4" />
      {Array.from({ length: 8 }).map((_, i) => Array.from({ length: 5 }).map((_, j) => (
        (i + j) % 2 === 0 ? <rect key={`${i}-${j}`} x={8 + i * 18} y={8 + j * 17.4} width="18" height="17.4" fill="#7fcf58" /> : null
      )))}
      <rect x="2" y="2" width="156" height="96" rx="12" fill="none" stroke={INK} strokeWidth="4" />
      <line x1="80" y1="6" x2="80" y2="94" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="6 6" />
      <circle cx="80" cy="50" r="14" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" />
      {[[20, 16], [140, 84], [118, 14], [36, 86]].map(([x, y]) => (
        <path key={`${x}${y}`} d={`M${x - 5} ${y + 3} L${x - 2} ${y - 4} L${x} ${y + 2} L${x + 3} ${y - 5} L${x + 5} ${y + 3}`} fill="none" stroke="#3f8f2c" strokeWidth="2.5" strokeLinejoin="round" />
      ))}
      <circle cx="34" cy="50" r="7" fill={TEAM.blue.base} stroke={INK} strokeWidth="3" />
      <circle cx="126" cy="50" r="7" fill={TEAM.red.base} stroke={INK} strokeWidth="3" />
    </svg>
  );
}

// Card header illustrations for the four modes.
export function ModeArt({ mode }) {
  if (mode === "bot") return <TankArt team="orange" variant="chaser" size={150} />;
  if (mode === "rl") return <TankArt team="green" variant="ppo" size={150} />;
  if (mode === "human") {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 0 }}>
        <TankArt team="blue" variant="human" size={92} />
        <div className="outlined" style={{ fontSize: 24, margin: "0 -6px 22px", color: "var(--gold)", position: "relative", zIndex: 1 }}>VS</div>
        <TankArt team="red" variant="human" flip size={92} />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 150 104" width={150} height={104} aria-hidden="true">
      <ellipse cx="75" cy="98" rx="48" ry="5" fill="rgba(0,0,0,.28)" />
      <rect x="62" y="80" width="26" height="12" fill="#5b6286" stroke={INK} strokeWidth="4" />
      <rect x="44" y="88" width="62" height="8" rx="4" fill="#5b6286" stroke={INK} strokeWidth="4" />
      <rect x="16" y="8" width="118" height="76" rx="10" fill="#2b3163" stroke={INK} strokeWidth="4" />
      <rect x="24" y="16" width="102" height="60" rx="6" fill="#6cc04a" />
      <rect x="24" y="16" width="102" height="60" rx="6" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M48 52 Q75 20 104 44" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="5 6" />
      <circle cx="44" cy="54" r="8" fill={TEAM.blue.base} stroke={INK} strokeWidth="3" />
      <circle cx="106" cy="42" r="8" fill={TEAM.red.base} stroke={INK} strokeWidth="3" />
      <circle cx="94" cy="36" r="3.5" fill={INK} />
      <path d="M28 20 H46" stroke="#fff" strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Trophy({ size = 120 }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      {[[16, 24, 6], [104, 20, 5], [100, 62, 4], [14, 66, 4]].map(([x, y, r]) => (
        <path key={`${x}${y}`} d={`M${x} ${y - r * 2} L${x + r * .6} ${y - r * .6} L${x + r * 2} ${y} L${x + r * .6} ${y + r * .6} L${x} ${y + r * 2} L${x - r * .6} ${y + r * .6} L${x - r * 2} ${y} L${x - r * .6} ${y - r * .6} Z`}
          fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      ))}
      <path d="M34 22 H86 V40 C86 60 74 72 60 72 C46 72 34 60 34 40 Z" fill={TEAM.gold.base} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M34 30 H22 C22 50 30 56 40 56" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M86 30 H98 C98 50 90 56 80 56" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M42 28 H54 V44 C54 52 50 58 46 60 C43 56 42 50 42 44 Z" fill={TEAM.gold.hi} />
      <rect x="52" y="72" width="16" height="16" fill={TEAM.gold.lo} stroke={INK} strokeWidth="5" />
      <rect x="36" y="88" width="48" height="16" rx="5" fill="#8b5a2b" stroke={INK} strokeWidth="5" />
      <path d="M60 32 L63.5 40 L72 40.5 L65.5 46 L67.5 54.5 L60 50 L52.5 54.5 L54.5 46 L48 40.5 L56.5 40 Z" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function BrokenShield({ size = 120 }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <g transform="rotate(-8 50 60)">
        <path d="M58 10 L22 22 V54 C22 80 38 96 56 106 L50 76 L60 58 L48 40 Z" fill="#98a2c4" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M56 18 L30 27 V40 C38 36 46 34 52 34 Z" fill="#c9d0e6" />
      </g>
      <g transform="rotate(10 70 60) translate(8 4)">
        <path d="M62 10 L98 22 V54 C98 80 82 96 64 106 L70 76 L60 58 L72 40 Z" fill="#6c769c" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      </g>
      {[[20, 104], [100, 100], [60, 112]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill="#6c769c" stroke={INK} strokeWidth="2" />)}
    </svg>
  );
}

export function DrawBadge({ size = 120 }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <g transform="rotate(-14 40 64)">
        <path d="M40 18 L64 26 V52 C64 72 54 84 40 92 C26 84 16 72 16 52 V26 Z" fill={TEAM.blue.base} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      </g>
      <g transform="rotate(14 80 64)">
        <path d="M80 18 L104 26 V52 C104 72 94 84 80 92 C66 84 56 72 56 52 V26 Z" fill={TEAM.red.base} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      </g>
      <rect x="44" y="94" width="32" height="14" rx="6" fill={TEAM.gold.base} stroke={INK} strokeWidth="4" />
    </svg>
  );
}

export function botInfo(name) {
  return {
    random:  { label: "Rookie",  team: "gray",   blurb: "Moves and fires at random." },
    chaser:  { label: "Chaser",  team: "orange", blurb: "Charges straight at you." },
    circler: { label: "Circler", team: "purple", blurb: "Orbits and strafes." },
    hider:   { label: "Hider",   team: "gray",   blurb: "Fights from behind cover." },
    mobile:  { label: "Dasher",  team: "orange", blurb: "Never stops moving." },
    ppo:     { label: "Neuron",  team: "green",  blurb: "The trained RL agent." },
  }[name] || { label: name, team: "gray", blurb: "" };
}
