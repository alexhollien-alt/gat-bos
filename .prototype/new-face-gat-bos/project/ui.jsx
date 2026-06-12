// Shared UI primitives + GAT-BOS priority / warmth / stage system

const C = { forest: "#0D3A35", pine: "#276152", sage: "#B1B7AB", cream: "#FBF6F0" };

// --- Icons (simple stroke set) ---
const PATHS = {
  today: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  tasks: "M9 11l3 3 8-8M3 12l3 3M3 6h11M3 18h7",
  people: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM22 19v-1a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87",
  marketing: "M3 11l14-6v14L3 13v-2zM3 11v2M7 12.5V18a2 2 0 002 2h1M17 8a3 3 0 010 6",
  bolt: "M13 2L4.5 13.5H11l-1 8.5L18.5 10H12l1-8z",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  inbox: "M3 12h5l2 3h4l2-3h5M3 12V7a2 2 0 012-2h14a2 2 0 012 2v5M3 12v5a2 2 0 002 2h14a2 2 0 002-2v-5",
  phone: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.4-1.2a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z",
  mail: "M3 7l9 6 9-6M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z",
  calendar: "M3 9h18M7 3v3M17 3v3M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  check: "M5 12l5 5L20 6",
  chevron: "M9 6l6 6-6 6",
  flame: "M12 22a7 7 0 007-7c0-3-2-5-3-7-1.5 1-2 2-2.5 3-.5-2-1.5-4-3.5-6-.5 3-3 4.5-3 9a7 7 0 006 8z",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  doc: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  sparkle: "M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3L12 3z",
  pin: "M12 21s-6-5.7-6-10a6 6 0 1112 0c0 4.3-6 10-6 10zM12 11a2 2 0 100-4 2 2 0 000 4z",
  hand: "M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V6a1.5 1.5 0 013 0v6c0 4-2.5 7-6 7s-6-2.5-6-6v-1a1.5 1.5 0 013 0",
};
function Icon({ name, size = 18, stroke = 2, className = "", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

// --- Warmth system (green-only, no red/orange) ---
const WARMTH = {
  hot:     { label: "Hot",         dot: C.forest, ring: false, faded: false },
  warm:    { label: "Warm",        dot: C.pine,   ring: false, faded: false },
  needs:   { label: "Needs touch", dot: "#7E9A66", ring: false, faded: false },
  cooling: { label: "Cooling off", dot: C.sage,   ring: false, faded: false },
  atrisk:  { label: "At risk",     dot: C.forest, ring: true,  faded: false },
  dormant: { label: "Dormant",     dot: "#C9CdC3", ring: false, faded: true },
};
function WarmthDot({ k, size = 9 }) {
  const w = WARMTH[k] || WARMTH.warm;
  return (
    <span className="inline-flex items-center justify-center" style={{ width: size + 6, height: size + 6 }}>
      <span style={{
        width: size, height: size, borderRadius: 99, background: w.faded ? "transparent" : w.dot,
        border: w.faded ? `1.5px solid ${w.dot}` : "none",
        boxShadow: w.ring ? `0 0 0 2px ${C.cream}, 0 0 0 3.5px ${C.forest}` : "none",
      }} />
    </span>
  );
}
function WarmthTag({ k }) {
  const w = WARMTH[k] || WARMTH.warm;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: w.faded ? "#8A8F84" : C.forest }}>
      <WarmthDot k={k} /> {w.label}
    </span>
  );
}

// --- Badge / tag ---
function Tag({ children, tone = "sage", className = "" }) {
  const tones = {
    forest: { bg: C.forest, fg: "#FBF6F0", bd: C.forest },
    pine:   { bg: "rgba(39,97,82,0.12)", fg: C.pine, bd: "rgba(39,97,82,0.22)" },
    sage:   { bg: "rgba(177,183,171,0.22)", fg: "#4A5249", bd: "rgba(177,183,171,0.55)" },
    outline:{ bg: "transparent", fg: C.forest, bd: "rgba(13,58,53,0.35)" },
  };
  const t = tones[tone] || tones.sage;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold tracking-tight whitespace-nowrap " + className}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>
      {children}
    </span>
  );
}

// Priority level chip (1 critical → 4 nurture)
const PRIORITY = {
  1: { label: "Critical", tone: "forest" },
  2: { label: "Opportunity", tone: "pine" },
  3: { label: "Promise / Project", tone: "sage" },
  4: { label: "Nurture", tone: "outline" },
};

// Task status chip
const STATUS_TONE = {
  "Inbox": "sage", "Today": "forest", "Next": "pine", "Waiting": "outline",
  "In Progress": "pine", "Needs Review": "forest", "Completed": "sage",
  "Someday": "sage", "Archived": "sage",
};

// --- Card ---
function Card({ children, className = "", accent = false, style }) {
  return (
    <div className={"rounded-2xl bg-white " + className}
      style={{
        border: `1px solid ${accent ? "rgba(13,58,53,0.18)" : "rgba(177,183,171,0.5)"}`,
        boxShadow: "0 1px 2px rgba(13,58,53,0.04), 0 8px 24px -18px rgba(13,58,53,0.22)",
        ...style,
      }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children, count, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: C.pine }}><Icon name={icon} size={16} /></span>}
        <h3 className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "#5A6157" }}>{children}</h3>
        {count != null && (
          <span className="text-[12px] font-bold rounded-full px-2 py-0.5"
            style={{ background: "rgba(177,183,171,0.28)", color: C.forest }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

function Avatar({ name, size = 36, k }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("");
  const w = k ? WARMTH[k] : null;
  return (
    <span className="inline-flex items-center justify-center font-bold shrink-0"
      style={{
        width: size, height: size, borderRadius: 12, fontSize: size * 0.36,
        background: "rgba(39,97,82,0.10)", color: C.forest,
        border: `1px solid rgba(39,97,82,0.18)`,
      }}>
      {initials}
    </span>
  );
}

function ProgressRing({ value, size = 40 }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(177,183,171,0.45)" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.pine} strokeWidth="4"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size*0.28} fontWeight="700" fill={C.forest}>{value}</text>
    </svg>
  );
}

function Bar({ value, h = 6 }) {
  return (
    <div className="w-full rounded-full" style={{ height: h, background: "rgba(177,183,171,0.4)" }}>
      <div className="rounded-full h-full" style={{ width: value + "%", background: C.pine }} />
    </div>
  );
}

const personById = id => PEOPLE.find(p => p.id === id);
const projectById = id => PROJECTS.find(p => p.id === id);

Object.assign(window, {
  C, Icon, WARMTH, WarmthDot, WarmthTag, Tag, PRIORITY, STATUS_TONE,
  Card, SectionTitle, Avatar, ProgressRing, Bar, personById, projectById,
});
