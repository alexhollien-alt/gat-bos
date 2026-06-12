// Marketing / Campaigns / Materials — "turn production into relationship momentum"

const STAGE_BUCKET = {
  "Requested": "Requested", "Designing": "In Design",
  "Proof Sent": "Proof / Approval", "Approved": "Proof / Approval",
  "Printing": "Produced & Delivered", "Delivered": "Produced & Delivered",
  "Launched": "Live & Results", "Results In": "Live & Results",
};
const BUCKETS = ["Requested", "In Design", "Proof / Approval", "Produced & Delivered", "Live & Results"];

function MaterialCard({ m }) {
  const p = m.person ? personById(m.person) : null;
  return (
    <div className="rounded-xl bg-white p-3" style={{ border: "1px solid rgba(177,183,171,0.5)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Tag tone="sage">{m.type}</Tag>
        <span className="text-[11px] font-bold ml-auto" style={{ color: m.due === "Today" ? C.forest : "#9AA093" }}>{m.due}</span>
      </div>
      <p className="text-[13.5px] font-bold leading-snug" style={{ color: C.forest }}>{m.title}</p>
      {p && <p className="text-[12px] mt-1 inline-flex items-center gap-1" style={{ color: "#7A8076" }}><Icon name="people" size={12} /> {p.name}</p>}
      {/* The conversion principle — every piece creates a follow-up */}
      <div className="mt-2.5 rounded-lg p-2 flex items-start gap-2" style={{ background: "rgba(39,97,82,0.08)" }}>
        <span className="mt-0.5 shrink-0" style={{ color: C.pine }}><Icon name="arrow" size={13} /></span>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: C.pine }}>Creates follow-up</p>
          <p className="text-[12px] font-semibold leading-snug" style={{ color: C.forest }}>{m.followup}</p>
        </div>
      </div>
    </div>
  );
}

function MarketingScreen() {
  const [view, setView] = React.useState("board");
  const views = [["board", "Production"], ["campaigns", "Campaigns"]];

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-[30px] leading-tight" style={{ color: C.forest }}>Marketing</h1>
          <p className="text-[13.5px] mt-0.5" style={{ color: "#6B7167" }}>Campaigns, materials &amp; production — every piece is a reason to follow up.</p>
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
            <Icon name="plus" size={15} /> New request
          </button>
        </div>
      </div>

      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {BUCKETS.map(b => {
            const items = MATERIALS.filter(m => STAGE_BUCKET[m.stage] === b);
            return (
              <div key={b} className="shrink-0 w-[256px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h3 className="text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "#5A6157" }}>{b}</h3>
                  <span className="text-[11.5px] font-bold rounded-full px-1.5" style={{ background: "rgba(177,183,171,0.3)", color: C.forest }}>{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map(m => <MaterialCard key={m.id} m={m} />)}
                  {items.length === 0 && <div className="rounded-xl py-6 text-center text-[12px]" style={{ border: "1px dashed rgba(177,183,171,0.6)", color: "#9AA093" }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "campaigns" && (
        <div className="grid md:grid-cols-2 gap-3.5">
          {CAMPAIGNS.map(c => {
            const p = c.person ? personById(c.person) : null;
            const [cur, total] = (c.touch.match(/\d+/g) || []).map(Number);
            const pct = total ? Math.round((cur / total) * 100) : (c.touch === "Q2" ? 50 : 30);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-bold leading-snug" style={{ color: C.forest }}>{c.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Tag tone={c.status === "Active" ? "pine" : "sage"}>{c.status}</Tag>
                      <Tag tone="sage">{c.channel}</Tag>
                      {p && <span className="text-[12px] inline-flex items-center gap-1" style={{ color: "#7A8076" }}><Icon name="people" size={12} /> {p.name}</span>}
                    </div>
                  </div>
                  <span className="text-[12.5px] font-bold shrink-0" style={{ color: C.pine }}>{c.touch}</span>
                </div>
                <div className="mt-3"><Bar value={pct} /></div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#9AA093" }}>Next touch</p>
                    <p className="text-[12.5px] font-semibold" style={{ color: C.forest }}>{c.next}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#9AA093" }}>Result so far</p>
                    <p className="text-[12.5px] font-semibold" style={{ color: c.result === "Escrow opened" ? C.pine : C.forest }}>{c.result}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { MarketingScreen });
