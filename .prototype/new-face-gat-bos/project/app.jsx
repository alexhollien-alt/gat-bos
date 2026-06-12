// App shell — sidebar (4 tabs) + screen routing

const NAV = [
  { id: "today", label: "Today", icon: "today", sub: "Command Center" },
  { id: "tasks", label: "Tasks", icon: "tasks", sub: "Projects & to-dos" },
  { id: "people", label: "People", icon: "people", sub: "Relationship nurture" },
  { id: "marketing", label: "Marketing", icon: "marketing", sub: "Campaigns & materials" },
];

function Sidebar({ active, setActive }) {
  const overdue = TASKS.filter(t => t.due === "Overdue").length;
  const today = TASKS.filter(t => t.due === "Today").length;
  const badges = { today: overdue + today };
  return (
    <aside className="shrink-0 flex flex-col h-screen sticky top-0" style={{ width: 248, background: C.forest }}>
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "rgba(159,230,206,0.18)" }}>
            <Icon name="bolt" size={18} style={{ color: "#9FE6CE" }} />
          </div>
          <div>
            <p className="text-[16px] font-extrabold leading-none tracking-tight" style={{ color: C.cream }}>GAT-BOS</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(251,246,240,0.55)" }}>Relationship OS</p>
          </div>
        </div>
      </div>

      <nav className="px-3 flex-1 space-y-1">
        {NAV.map(n => {
          const on = active === n.id;
          return (
            <button key={n.id} onClick={() => setActive(n.id)}
              className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition"
              style={on ? { background: "rgba(251,246,240,0.12)" } : {}}>
              <span style={{ color: on ? "#9FE6CE" : "rgba(251,246,240,0.6)" }}><Icon name={n.icon} size={19} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold leading-tight" style={{ color: on ? C.cream : "rgba(251,246,240,0.82)" }}>{n.label}</p>
                <p className="text-[11px] leading-tight" style={{ color: on ? "rgba(159,230,206,0.85)" : "rgba(251,246,240,0.42)" }}>{n.sub}</p>
              </div>
              {badges[n.id] > 0 && (
                <span className="text-[11px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                  style={{ background: on ? "#9FE6CE" : "rgba(251,246,240,0.18)", color: on ? C.forest : C.cream }}>{badges[n.id]}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(251,246,240,0.08)" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "rgba(159,230,206,0.85)" }}>Captures · Inbox</p>
          <p className="text-[12px] leading-snug" style={{ color: "rgba(251,246,240,0.7)" }}>{CAPTURES.length} notes waiting in Today to process.</p>
        </div>
        <button className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: "rgba(251,246,240,0.1)" }}>
          <Avatar name="Alex Rivera" size={32} />
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: C.cream }}>Alex Rivera</p>
            <p className="text-[11px] truncate" style={{ color: "rgba(251,246,240,0.5)" }}>Title & Escrow Marketing</p>
          </div>
        </button>
      </div>
    </aside>
  );
}

function App() {
  const [active, setActive] = React.useState(() => localStorage.getItem("gatbos_tab") || "today");
  React.useEffect(() => { localStorage.setItem("gatbos_tab", active); }, [active]);
  const Screen = { today: TodayScreen, tasks: TasksScreen, people: PeopleScreen, marketing: MarketingScreen }[active];
  return (
    <div className="flex min-h-screen" style={{ background: C.cream }}>
      <Sidebar active={active} setActive={setActive} />
      <main className="flex-1 min-w-0">
        <Screen />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
