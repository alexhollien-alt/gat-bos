// Tasks / Projects — master execution area. "Help me finish things."

function TaskCard({ t, compact }) {
  const p = t.person ? personById(t.person) : null;
  const proj = t.project ? projectById(t.project) : null;
  const pr = PRIORITY[t.priority];
  return (
    <div className="rounded-xl bg-white p-3.5 group" style={{ border: "1px solid rgba(177,183,171,0.5)" }}>
      <div className="flex items-start gap-3">
        <button className="mt-0.5 shrink-0 rounded-md flex items-center justify-center transition hover:bg-[rgba(39,97,82,0.08)]"
          style={{ width: 20, height: 20, border: `1.75px solid ${C.sage}` }}>
          <Icon name="check" size={12} className="opacity-0 group-hover:opacity-40" style={{ color: C.pine }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-snug" style={{ color: C.forest }}>{t.title}</p>
          {!compact && (
            <div className="mt-2 space-y-1 text-[12.5px] leading-snug" style={{ color: "#6B7167" }}>
              {t.why && <p><span className="font-semibold" style={{ color: "#9AA093" }}>Why&nbsp;&nbsp;</span>{t.why}</p>}
              {t.next && <p><span className="font-semibold" style={{ color: "#9AA093" }}>Next&nbsp;&nbsp;</span><span style={{ color: C.pine, fontWeight: 600 }}>{t.next}</span></p>}
              {t.waiting && <p><span className="font-semibold" style={{ color: "#9AA093" }}>Waiting&nbsp;&nbsp;</span>{t.waiting}</p>}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Tag tone={STATUS_TONE[t.status]}>{t.status}</Tag>
            {t.priority <= 2 && <Tag tone={pr.tone}>{pr.label}</Tag>}
            {p && <span className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap" style={{ color: "#5A6157" }}><Avatar name={p.name} size={18} /> {p.name}</span>}
            {proj && <span className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: "#8A8F84" }}><Icon name="doc" size={12} /> {proj.name}</span>}
          </div>
        </div>
        <span className="text-[12px] font-bold shrink-0" style={{ color: t.due === "Overdue" ? C.forest : "#8A8F84" }}>{t.due}</span>
      </div>
    </div>
  );
}

function ProjectCard({ proj }) {
  const [open, setOpen] = React.useState(proj.id === "pr_julie");
  const p = proj.person ? personById(proj.person) : null;
  const tasks = TASKS.filter(t => t.project === proj.id);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-4 flex items-center gap-4">
        <ProgressRing value={proj.progress} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15.5px] font-bold" style={{ color: C.forest }}>{proj.name}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[12.5px]" style={{ color: "#6B7167" }}>
            <Tag tone={STATUS_TONE[proj.status]}>{proj.status}</Tag>
            <Tag tone="sage">{proj.type}</Tag>
            {p && <span className="inline-flex items-center gap-1 whitespace-nowrap"><Icon name="people" size={12} /> {p.name}</span>}
            <span className="whitespace-nowrap">· {proj.open} of {proj.total} open</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-bold" style={{ color: proj.due === "Today" ? C.forest : "#8A8F84" }}>{proj.due}</p>
          <span style={{ color: C.sage }} className={"inline-block transition-transform " + (open ? "rotate-90" : "")}><Icon name="chevron" size={16} /></span>
        </div>
      </button>
      {open && tasks.length > 0 && (
        <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: "1px solid rgba(177,183,171,0.4)", paddingTop: 14 }}>
          {tasks.map(t => <TaskCard key={t.id} t={t} />)}
        </div>
      )}
    </Card>
  );
}

function Column({ status, tasks }) {
  return (
    <div className="shrink-0 w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.07em]" style={{ color: "#5A6157" }}>{status}</h3>
        <span className="text-[11.5px] font-bold rounded-full px-1.5" style={{ background: "rgba(177,183,171,0.3)", color: C.forest }}>{tasks.length}</span>
      </div>
      <div className="space-y-2.5">
        {tasks.map(t => <TaskCard key={t.id} t={t} compact />)}
        {tasks.length === 0 && <div className="rounded-xl py-6 text-center text-[12.5px]" style={{ border: "1px dashed rgba(177,183,171,0.6)", color: "#9AA093" }}>Empty</div>}
      </div>
    </div>
  );
}

function TasksScreen() {
  const [view, setView] = React.useState("projects");
  const views = [["projects", "Projects"], ["board", "Board"], ["all", "All tasks"]];
  const boardStatuses = ["Today", "Next", "In Progress", "Waiting", "Needs Review"];

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-[30px] leading-tight" style={{ color: C.forest }}>Tasks &amp; Projects</h1>
          <p className="text-[13.5px] mt-0.5" style={{ color: "#6B7167" }}>Everything you owe, grouped by the work it belongs to. Finish things.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(177,183,171,0.22)" }}>
            {views.map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition"
                style={view === k ? { background: "#fff", color: C.forest, boxShadow: "0 1px 2px rgba(13,58,53,0.1)" } : { color: "#5A6157" }}>{label}</button>
            ))}
          </div>
          <button className="rounded-xl px-3.5 py-2 text-[13px] font-bold flex items-center gap-1.5" style={{ background: C.forest, color: C.cream }}>
            <Icon name="plus" size={15} /> New task
          </button>
        </div>
      </div>

      {view === "projects" && (
        <div className="space-y-3.5">
          {PROJECTS.map(pr => <ProjectCard key={pr.id} proj={pr} />)}
        </div>
      )}

      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {boardStatuses.map(s => <Column key={s} status={s} tasks={TASKS.filter(t => t.status === s)} />)}
        </div>
      )}

      {view === "all" && (
        <div className="grid md:grid-cols-2 gap-3">
          {TASKS.slice().sort((a, b) => a.priority - b.priority).map(t => <TaskCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TasksScreen });
