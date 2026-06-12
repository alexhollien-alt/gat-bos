"use client";

// Marketing / Campaigns / Materials. Port of .prototype marketing.jsx onto
// live material_requests + design_assets (production board) and campaigns +
// enrollments (campaigns view). The 8-stage pipeline is bucketed from the
// 4 live statuses (derive-first); Proof / Approval fills when that stage
// lands in schema.

import * as React from "react";
import { C, Icon, Card, Tag } from "@/components/gatbos/ui";
import { useGatbosCampaigns, useGatbosMaterials, type MaterialVM } from "@/components/gatbos/queries";

const BUCKETS = ["Requested", "In Design", "Proof / Approval", "Produced & Delivered", "Live & Results"];

function MaterialCard({ m }: { m: MaterialVM }) {
  return (
    <div className="rounded-xl bg-white p-3" style={{ border: "1px solid rgba(177,183,171,0.5)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Tag tone="sage">{m.type}</Tag>
        <span className="text-[11px] font-bold ml-auto" style={{ color: m.due === "Today" || m.due === "Overdue" ? C.forest : "var(--gatbos-ink-6)" }}>
          {m.due}
        </span>
      </div>
      <p className="text-[13.5px] font-bold leading-snug" style={{ color: C.forest }}>
        {m.title}
      </p>
      {m.personName && (
        <p className="text-[12px] mt-1 inline-flex items-center gap-1" style={{ color: "var(--gatbos-ink-4)" }}>
          <Icon name="people" size={12} /> {m.personName}
        </p>
      )}
      {/* The conversion principle: every piece creates a follow-up */}
      <div className="mt-2.5 rounded-lg p-2 flex items-start gap-2" style={{ background: "rgba(39,97,82,0.08)" }}>
        <span className="mt-0.5 shrink-0" style={{ color: C.pine }}>
          <Icon name="arrow" size={13} />
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: C.pine }}>
            Creates follow-up
          </p>
          <p className="text-[12px] font-semibold leading-snug" style={{ color: C.forest }}>
            {m.followup}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MarketingScreen() {
  const [view, setView] = React.useState<"board" | "campaigns">("board");
  const { data: materials, isLoading: materialsLoading } = useGatbosMaterials();
  const { data: campaigns, isLoading: campaignsLoading } = useGatbosCampaigns();
  const views: Array<[typeof view, string]> = [
    ["board", "Production"],
    ["campaigns", "Campaigns"],
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-newsreader font-medium text-[30px] leading-tight" style={{ color: C.forest }}>
            Marketing
          </h1>
          <p className="text-[13.5px] mt-0.5" style={{ color: "var(--gatbos-ink-3)" }}>
            Campaigns, materials &amp; production. Every piece is a reason to follow up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(177,183,171,0.22)" }}>
            {views.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition"
                style={view === k ? { background: "white", color: C.forest, boxShadow: "0 1px 2px rgba(13,58,53,0.1)" } : { color: "var(--gatbos-ink-2)" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {BUCKETS.map((b) => {
            const items = (materials ?? []).filter((m) => m.bucket === b);
            return (
              <div key={b} className="shrink-0 w-[256px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h3 className="text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gatbos-ink-2)" }}>
                    {b}
                  </h3>
                  <span className="text-[11.5px] font-bold rounded-full px-1.5" style={{ background: "rgba(177,183,171,0.3)", color: C.forest }}>
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {items.map((m) => (
                    <MaterialCard key={m.id} m={m} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl py-6 text-center text-[12px]" style={{ border: "1px dashed rgba(177,183,171,0.6)", color: "var(--gatbos-ink-6)" }}>
                      {materialsLoading ? "Loading…" : "Empty"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "campaigns" && (
        <div className="grid md:grid-cols-2 gap-3.5">
          {(campaigns ?? []).map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold leading-snug" style={{ color: C.forest }}>
                    {c.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Tag tone={c.status === "Active" ? "pine" : "sage"}>{c.status}</Tag>
                    <Tag tone="sage">{c.channel}</Tag>
                  </div>
                </div>
                <span className="text-[12.5px] font-bold shrink-0" style={{ color: C.pine }}>
                  {c.touch}
                </span>
              </div>
              <div className="mt-3">
                <div className="w-full rounded-full" style={{ height: 6, background: "rgba(177,183,171,0.4)" }}>
                  <div className="rounded-full h-full" style={{ width: c.pct + "%", background: C.pine }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gatbos-ink-6)" }}>
                    Next touch
                  </p>
                  <p className="text-[12.5px] font-semibold" style={{ color: C.forest }}>
                    {c.next}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gatbos-ink-6)" }}>
                    Result so far
                  </p>
                  <p className="text-[12.5px] font-semibold" style={{ color: C.forest }}>
                    {c.result}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {!campaignsLoading && (campaigns ?? []).length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
              No campaigns yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
