"use client";

// People / Relationship Nurture. Port of .prototype people.jsx onto live
// contacts with derived warmth + journey mapping (derive.ts).

import * as React from "react";
import Link from "next/link";
import { C, Icon, Card, SectionTitle, Avatar, Tag, WarmthDot, WarmthTag, WARMTH, type WarmthKey } from "@/components/gatbos/ui";
import { JOURNEY, OFF_TRACK } from "@/components/gatbos/derive";
import { useGatbosPeople, type PersonVM } from "@/components/gatbos/queries";

function Journey({ stage }: { stage: string }) {
  const idx = JOURNEY.indexOf(stage as (typeof JOURNEY)[number]);
  const off = OFF_TRACK[stage];
  // milestone: Deal Sent (index 5)
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {JOURNEY.map((s, i) => {
        const done = !off && i < idx;
        const cur = !off && i === idx;
        const milestone = i === 5;
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className="flex flex-col items-center" style={{ width: 84 }}>
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: cur ? 26 : 20,
                  height: cur ? 26 : 20,
                  background: cur ? C.forest : done ? C.pine : "rgba(177,183,171,0.3)",
                  color: "white",
                  border: milestone && !done && !cur ? `2px solid ${C.pine}` : "none",
                }}
              >
                {done ? (
                  <Icon name="check" size={11} />
                ) : milestone ? (
                  <Icon name="flame" size={11} style={{ color: cur || done ? "white" : C.pine }} />
                ) : null}
              </div>
              <span
                className="text-[10px] text-center leading-tight mt-1"
                style={{ color: cur ? C.forest : "var(--gatbos-ink-6)", fontWeight: cur ? 700 : 500 }}
              >
                {s}
              </span>
            </div>
            {i < JOURNEY.length - 1 && (
              <div style={{ width: 14, height: 2, background: done ? C.pine : "rgba(177,183,171,0.4)", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function HealthStrip({ counts }: { counts: Partial<Record<WarmthKey, number>> }) {
  const order: WarmthKey[] = ["hot", "warm", "needs", "cooling", "atrisk", "dormant"];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {order.map((k) => (
        <div key={k} className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 bg-white" style={{ border: "1px solid rgba(177,183,171,0.5)" }}>
          <WarmthDot k={k} />
          <span className="text-[12.5px] font-semibold" style={{ color: C.forest }}>
            {counts[k] || 0}
          </span>
          <span className="text-[12px]" style={{ color: "var(--gatbos-ink-4)" }}>
            {WARMTH[k].label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-0.5" style={{ color: "var(--gatbos-ink-6)" }}>
        {label}
      </p>
      <p className="text-[13.5px] font-medium leading-snug" style={{ color: C.forest }}>
        {children}
      </p>
    </div>
  );
}

function PersonDetail({ p }: { p: PersonVM }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Avatar name={p.name} size={56} />
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[22px] font-extrabold leading-none" style={{ color: C.forest }}>
              {p.name}
            </h2>
            <WarmthTag k={p.warmth} />
          </div>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--gatbos-ink-3)" }}>
            {p.role} · {p.company}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Tag tone={OFF_TRACK[p.stage] ? "forest" : "pine"}>{p.stage}</Tag>
            <Tag tone="sage">Value: {p.value}</Tag>
            <Tag tone="sage">{p.touches} touches</Tag>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/contacts/${p.id}`}
            className="rounded-xl h-9 px-3 flex items-center gap-1.5 text-[12.5px] font-bold"
            style={{ background: "rgba(39,97,82,0.1)", color: C.pine }}
            title="Open full contact record"
          >
            <Icon name="doc" size={15} /> Record
          </Link>
        </div>
      </div>

      {/* Next best action */}
      <Card accent className="p-4" style={{ background: "rgba(39,97,82,0.06)" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ color: C.pine }}>
            <Icon name="bolt" size={15} />
          </span>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: C.pine }}>
            Next best action
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-bold" style={{ color: C.forest }}>
            {p.nextBest}
          </p>
        </div>
      </Card>

      {/* Journey */}
      <Card className="p-4">
        <SectionTitle icon="people">Relationship journey</SectionTitle>
        <Journey stage={p.stage} />
        {OFF_TRACK[p.stage] && (
          <div className="mt-3 rounded-xl p-3 flex items-center gap-2.5" style={{ background: "rgba(13,58,53,0.06)", border: `1px solid rgba(13,58,53,0.18)` }}>
            <span style={{ color: C.forest }}>
              <Icon name="alert" size={16} />
            </span>
            <p className="text-[12.5px] font-semibold" style={{ color: C.forest }}>
              {p.stage === "At-risk / Reactivation"
                ? "Off the main track. Needs a personal, no-ask reactivation touch."
                : "Parked in long-term nurture. Keep present with light awareness touches."}
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Last touch">{p.lastTouch}</Field>
          <Field label="Next touch">{p.nextTouch}</Field>
          <Field label="Current opportunity">{p.opportunity}</Field>
          <Field label="Current project">{p.project}</Field>
          <Field label="Comm style">{p.comms}</Field>
          <Field label="Event status">{p.events}</Field>
          <Field label="Escrow officer">{p.escrowOfficer}</Field>
          <Field label="Partners">{p.partners}</Field>
        </div>
        {p.note && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(177,183,171,0.4)" }}>
            <Field label="Notes">{p.note}</Field>
          </div>
        )}
      </Card>
    </div>
  );
}

const FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["hot", "Hot"],
  ["needs", "Needs touch"],
  ["atrisk", "At risk"],
  ["dormant", "Dormant"],
];

export function PeopleScreen() {
  const { data: people, isLoading } = useGatbosPeople();
  const [sel, setSel] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("all");

  const list = (people ?? []).filter((p) => filter === "all" || p.warmth === filter);
  const counts = (people ?? []).reduce<Partial<Record<WarmthKey, number>>>((a, p) => {
    a[p.warmth] = (a[p.warmth] ?? 0) + 1;
    return a;
  }, {});
  const person = (people ?? []).find((p) => p.id === sel) ?? list[0] ?? null;

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="font-newsreader font-medium text-[30px] leading-tight" style={{ color: C.forest }}>
            People
          </h1>
          <p className="text-[13.5px] mt-0.5" style={{ color: "var(--gatbos-ink-3)" }}>
            Your world of agents, partners &amp; clients, kept warm on purpose, forever.
          </p>
        </div>
      </div>
      <div className="mb-5">
        <HealthStrip counts={counts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-5">
        {/* List */}
        <div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className="px-2.5 py-1 rounded-full text-[12px] font-semibold transition"
                style={filter === k ? { background: C.forest, color: C.cream } : { background: "rgba(177,183,171,0.22)", color: "var(--gatbos-ink-2)" }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {isLoading && (
              <p className="text-[13px] py-4" style={{ color: "var(--gatbos-ink-6)" }}>
                Loading people…
              </p>
            )}
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p.id)}
                className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition"
                style={
                  person?.id === p.id
                    ? { background: "white", border: `1px solid rgba(13,58,53,0.25)`, boxShadow: "0 6px 20px -14px rgba(13,58,53,0.4)" }
                    : { background: "rgba(255,255,255,0.55)", border: "1px solid rgba(177,183,171,0.45)" }
                }
              >
                <Avatar name={p.name} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-bold whitespace-nowrap" style={{ color: C.forest }}>
                      {p.name}
                    </p>
                    <WarmthDot k={p.warmth} />
                  </div>
                  <p className="text-[12px] truncate" style={{ color: "var(--gatbos-ink-4)" }}>
                    {p.company} · {p.touches} touches
                  </p>
                </div>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: p.nextTouch === "Overdue" ? C.forest : "var(--gatbos-ink-6)" }}>
                  {p.nextTouch}
                </span>
              </button>
            ))}
            {!isLoading && list.length === 0 && (
              <p className="text-[13px] py-4" style={{ color: "var(--gatbos-ink-6)" }}>
                No people match this filter.
              </p>
            )}
          </div>
        </div>

        {/* Detail */}
        <div>{person && <PersonDetail p={person} />}</div>
      </div>
    </div>
  );
}
