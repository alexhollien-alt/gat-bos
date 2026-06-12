// Today / Command Center — the morning decision screen

function GlanceStat({ n, label, tone }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[22px] font-extrabold leading-none" style={{ color: tone || C.forest }}>{n}</span>
      <span className="text-[12.5px] font-medium" style={{ color: "#6B7167" }}>{label}</span>
    </div>
  );
}

function QuickCapture({ onAdd }) {
  const types = ["Task", "Follow-up", "Note", "Person", "Project"];
  const [type, setType] = React.useState("Task");
  const [val, setVal] = React.useState("");
  const submit = () => { if (!val.trim()) return; onAdd({ type, text: val.trim() }); setVal(""); };
  return (
    <Card className="p-2.5" accent>
      <div className="flex items-center gap-2">
        <span className="shrink-0 ml-1" style={{ color: C.pine }}><Icon name="plus" size={18} /></span>
        <input
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Quick capture — drop a task, follow-up, note, person, or idea…"
          className="flex-1 bg-transparent outline-none text-[14.5px] font-medium placeholder:font-normal"
          style={{ color: C.forest }} />
        <div className="hidden md:flex items-center gap-1 pr-1">
          {types.map(t => (
            <button key={t} onClick={() => setType(t)}
              className="px-2.5 py-1 rounded-lg text-[12px] font-semibold transition"
              style={type === t
                ? { background: C.forest, color: C.cream }
                : { background: "rgba(177,183,171,0.22)", color: "#5A6157" }}>{t}</button>
          ))}
        </div>
        <button onClick={submit}
          className="shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-bold flex items-center gap-1.5"
          style={{ background: C.forest, color: C.cream }}>
          Capture <Icon name="arrow" size={15} />
        </button>
      </div>
    </Card>
  );
}

function NextBestMove() {
  const p = personById("p_dana");
  return (
    <Card accent className="overflow-hidden" style={{ background: C.forest }}>
      <div className="p-5 md:p-6 text-cream" style={{ color: C.cream }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: "#9FE6CE" }}><Icon name="bolt" size={16} /></span>
          <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "#9FE6CE" }}>Next Best Move</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-[22px] md:text-[26px] font-extrabold leading-snug tracking-tight" style={{ color: C.cream }}>
              Send Dana the welcome packet &amp; confirm the earnest-money timeline.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(251,246,240,0.78)" }}>
              First escrow with Dana ($1.2M, 88 Linden) — getting the open right is how her whole team starts sending you business. Highest-leverage 15 minutes of your day.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-2.5 py-1"
                style={{ background: "rgba(159,230,206,0.16)", color: "#C8F2E2" }}>
                <Icon name="people" size={13} /> Dana Whitfield · Coldwell Banker
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-2.5 py-1"
                style={{ background: "rgba(159,230,206,0.16)", color: "#C8F2E2" }}>
                <Icon name="flame" size={13} /> Could create business
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold flex items-center gap-1.5"
              style={{ background: C.cream, color: C.forest }}>
              Do it now <Icon name="arrow" size={15} />
            </button>
            <button className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold"
              style={{ background: "rgba(251,246,240,0.12)", color: C.cream, border: "1px solid rgba(251,246,240,0.25)" }}>
              Snooze
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PriorityRow({ t, rank }) {
  const person = t.person ? personById(t.person) : null;
  const pr = PRIORITY[t.priority];
  return (
    <div className="flex items-start gap-3 py-3 group">
      <button className="mt-0.5 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-[rgba(39,97,82,0.08)]"
        style={{ width: 22, height: 22, border: `1.75px solid ${C.sage}` }}>
        <Icon name="check" size={13} className="opacity-0 group-hover:opacity-40" style={{ color: C.pine }} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14.5px] font-semibold leading-snug" style={{ color: C.forest }}>{t.title}</p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12.5px]" style={{ color: "#6B7167" }}>
          <Tag tone={pr.tone}>{pr.label}</Tag>
          {person && <span className="inline-flex items-center gap-1"><Icon name="people" size={12} /> {person.name}</span>}
          <span className="inline-flex items-center gap-1"><Icon name="hand" size={12} /> {t.why}</span>
        </div>
      </div>
      <span className="text-[12px] font-bold shrink-0 mt-0.5" style={{ color: t.due === "Overdue" ? C.forest : "#8A8F84" }}>{t.due}</span>
    </div>
  );
}

function MiniRow({ icon, title, sub, right, rightTone, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 py-2.5 group">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold leading-snug truncate" style={{ color: C.forest }}>{title}</p>
        {sub && <p className="text-[12px] truncate" style={{ color: "#7A8076" }}>{sub}</p>}
      </div>
      {right && <span className="text-[12px] font-bold shrink-0" style={{ color: rightTone || "#8A8F84" }}>{right}</span>}
    </button>
  );
}

function Divider() { return <div style={{ height: 1, background: "rgba(177,183,171,0.4)" }} />; }

function TodayScreen() {
  const [captures, setCaptures] = React.useState(CAPTURES);
  const addCapture = ({ type, text }) => setCaptures(c => [{ id: "c" + Date.now(), text: `[${type}] ${text}`, when: "Just now" }, ...c]);

  const top3 = TASKS.filter(t => t.priority === 1).slice(0, 3);
  const overdue = TASKS.filter(t => t.due === "Overdue");
  const dueToday = TASKS.filter(t => t.due === "Today");
  const waiting = TASKS.filter(t => t.status === "Waiting");
  const hot = PEOPLE.filter(p => p.warmth === "hot");
  const warmUp = PEOPLE.filter(p => ["needs", "cooling", "atrisk", "dormant"].includes(p.warmth));

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[13px] font-semibold tracking-wide" style={{ color: C.pine }}>Thursday · June 11</p>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight mt-0.5" style={{ color: C.forest }}>
            Good morning. Here’s what matters.
          </h1>
        </div>
        <div className="flex items-center gap-5 md:gap-6">
          <GlanceStat n={overdue.length} label="overdue" />
          <GlanceStat n={dueToday.length} label="due today" tone={C.pine} />
          <GlanceStat n={waiting.length} label="waiting" />
          <GlanceStat n={hot.length} label="hot" tone={C.pine} />
        </div>
      </div>

      <div className="mb-5"><QuickCapture onAdd={addCapture} /></div>
      <div className="mb-6"><NextBestMove /></div>

      {/* Two column cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
        {/* LEFT — action stream */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle icon="flag" count={top3.length}
              action={<span className="text-[12px] font-bold" style={{ color: "#9AA093" }}>L1 · Create business / prevent damage</span>}>
              Top 3 priorities today
            </SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {top3.map((t, i) => <PriorityRow key={t.id} t={t} rank={i + 1} />)}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="clock" count={overdue.length}>Overdue follow-ups</SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {overdue.map(t => {
                const p = t.person ? personById(t.person) : null;
                return <MiniRow key={t.id}
                  icon={<span className="shrink-0" style={{ color: C.forest }}><Icon name="alert" size={16} /></span>}
                  title={t.title} sub={p ? p.name + " · " + t.why : t.why} right="Overdue" rightTone={C.forest} />;
              })}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="tasks" count={dueToday.length}>Due today</SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {dueToday.map(t => {
                const p = t.person ? personById(t.person) : null;
                return <MiniRow key={t.id}
                  icon={<span className="mt-0.5 shrink-0 rounded-md" style={{ width: 18, height: 18, border: `1.75px solid ${C.sage}` }} />}
                  title={t.title} sub={p ? p.name : (projectById(t.project)?.name || "")} />;
              })}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="hand" count={waiting.length}
              action={<span className="text-[12px] font-bold" style={{ color: "#9AA093" }}>Promises in flight</span>}>
              Waiting on someone
            </SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {waiting.map(t => (
                <MiniRow key={t.id}
                  icon={<span className="shrink-0" style={{ color: C.sage }}><Icon name="clock" size={16} /></span>}
                  title={t.title} sub={t.waiting} right={t.due} />
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT — relationships + signals */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle icon="flame" count={hot.length}
              action={<span className="text-[12px] font-bold" style={{ color: "#9AA093" }}>L2 · Opportunity</span>}>
              Hot relationship opportunities
            </SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {hot.map(p => (
                <div key={p.id} className="flex items-start gap-3 py-3">
                  <Avatar name={p.name} k={p.warmth} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold" style={{ color: C.forest }}>{p.name}</p>
                      <WarmthDot k={p.warmth} />
                    </div>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "#6B7167" }}>{p.opportunity}</p>
                    <p className="text-[12.5px] font-semibold mt-1 inline-flex items-center gap-1" style={{ color: C.pine }}>
                      <Icon name="arrow" size={12} /> {p.nextBest}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="calendar" count={MEETINGS.length}>Today &amp; upcoming</SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {MEETINGS.map(m => {
                const p = m.person ? personById(m.person) : null;
                return <MiniRow key={m.id}
                  icon={<span className="shrink-0" style={{ color: C.pine }}><Icon name="calendar" size={16} /></span>}
                  title={m.title} sub={(p ? p.name + " · " : "") + m.where} right={m.when.split("·").pop().trim()} />;
              })}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="pin" count={warmUp.length}
              action={<span className="text-[12px] font-bold" style={{ color: "#9AA093" }}>L4 · Warm up</span>}>
              Haven’t touched — but should
            </SectionTitle>
            <div className="divide-y" style={{ borderColor: "rgba(177,183,171,0.4)" }}>
              {warmUp.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={p.name} size={32} k={p.warmth} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold whitespace-nowrap" style={{ color: C.forest }}>{p.name}</p>
                    <p className="text-[12px] truncate" style={{ color: "#7A8076" }}>{p.nextBest}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <WarmthTag k={p.warmth} />
                    <p className="text-[11px] mt-0.5" style={{ color: "#9AA093" }}>{p.lastTouch}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="inbox" count={captures.length}
              action={<button className="text-[12px] font-bold" style={{ color: C.pine }}>Process</button>}>
              Captured — needs processing
            </SectionTitle>
            <div className="space-y-2">
              {captures.map(c => (
                <div key={c.id} className="flex items-start gap-2.5 rounded-xl p-2.5"
                  style={{ background: "rgba(177,183,171,0.16)" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: C.sage }}><Icon name="sparkle" size={14} /></span>
                  <p className="flex-1 text-[12.5px] leading-snug" style={{ color: "#4A5249" }}>{c.text}</p>
                  <span className="text-[11px] shrink-0" style={{ color: "#9AA093" }}>{c.when}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TodayScreen });
