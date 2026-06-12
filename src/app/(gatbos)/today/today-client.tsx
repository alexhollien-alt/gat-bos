"use client";

// Today / Command Center. Port of .prototype today.jsx onto live data:
// tasks (open/snoozed), derived people warmth, events, captures pipeline.

import * as React from "react";
import Link from "next/link";
import { C, Icon, Card, SectionTitle, Avatar, Tag, WarmthDot, WarmthTag, PRIORITY, MiniRow } from "@/components/gatbos/ui";
import { todayHeading } from "@/components/gatbos/derive";
import {
  useGatbosCaptures,
  useGatbosMeetings,
  useGatbosPeople,
  useGatbosTasks,
  useQuickCapture,
  useToggleTaskDone,
  type PersonVM,
  type TaskVM,
} from "@/components/gatbos/queries";

function GlanceStat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[22px] font-extrabold leading-none" style={{ color: tone || C.forest }}>
        {n}
      </span>
      <span className="text-[12.5px] font-medium" style={{ color: "var(--gatbos-ink-3)" }}>
        {label}
      </span>
    </div>
  );
}

const CAPTURE_TYPES = ["Task", "Follow-up", "Note", "Person", "Project"];

function QuickCapture() {
  const [type, setType] = React.useState("Task");
  const [val, setVal] = React.useState("");
  const capture = useQuickCapture();
  const submit = () => {
    if (!val.trim() || capture.isPending) return;
    capture.mutate({ text: val.trim(), type });
    setVal("");
  };
  return (
    <Card className="p-2.5" accent>
      <div className="flex items-center gap-2">
        <span className="shrink-0 ml-1" style={{ color: C.pine }}>
          <Icon name="plus" size={18} />
        </span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Quick capture: drop a task, follow-up, note, person, or idea"
          className="flex-1 bg-transparent outline-none text-[14.5px] font-medium placeholder:font-normal"
          style={{ color: C.forest }}
        />
        <div className="hidden md:flex items-center gap-1 pr-1">
          {CAPTURE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="px-2.5 py-1 rounded-lg text-[12px] font-semibold transition"
              style={
                type === t
                  ? { background: C.forest, color: C.cream }
                  : { background: "rgba(177,183,171,0.22)", color: "var(--gatbos-ink-2)" }
              }
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={capture.isPending}
          className="shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: C.forest, color: C.cream }}
        >
          {capture.isPending ? "Capturing" : "Capture"} <Icon name="arrow" size={15} />
        </button>
      </div>
    </Card>
  );
}

function NextBestMove({ task, person }: { task: TaskVM | null; person: PersonVM | null }) {
  if (!task) return null;
  return (
    <Card accent className="overflow-hidden" style={{ background: C.forest }}>
      <div className="p-5 md:p-6" style={{ color: C.cream }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: C.mint }}>
            <Icon name="bolt" size={16} />
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: C.mint }}>
            Next Best Move
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-[22px] md:text-[26px] font-extrabold leading-snug tracking-tight" style={{ color: C.cream }}>
              {task.title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(251,246,240,0.78)" }}>
              {task.why ??
                "Highest-leverage item on the board right now. Knock it out before the day takes over."}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {person && (
                <span
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-2.5 py-1"
                  style={{ background: "rgba(159,230,206,0.16)", color: "var(--gatbos-mint-soft)" }}
                >
                  <Icon name="people" size={13} /> {person.name} · {person.company}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-2.5 py-1"
                style={{ background: "rgba(159,230,206,0.16)", color: "var(--gatbos-mint-soft)" }}
              >
                <Icon name="flame" size={13} /> Could create business
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/new/tasks"
              className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold flex items-center gap-1.5"
              style={{ background: C.cream, color: C.forest }}
            >
              Do it now <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PriorityRow({ t, onToggle }: { t: TaskVM; onToggle: (t: TaskVM) => void }) {
  const pr = PRIORITY[t.priority];
  return (
    <div className="flex items-start gap-3 py-3 group">
      <button
        onClick={() => onToggle(t)}
        className="mt-0.5 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-[rgba(39,97,82,0.08)]"
        style={{ width: 22, height: 22, border: `1.75px solid ${C.sage}` }}
        title="Mark done"
      >
        <Icon name="check" size={13} className="opacity-0 group-hover:opacity-40" style={{ color: C.pine }} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14.5px] font-semibold leading-snug" style={{ color: C.forest }}>
            {t.title}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12.5px]" style={{ color: "var(--gatbos-ink-3)" }}>
          <Tag tone={pr.tone}>{pr.label}</Tag>
          {t.personName && (
            <span className="inline-flex items-center gap-1">
              <Icon name="people" size={12} /> {t.personName}
            </span>
          )}
          {t.why && (
            <span className="inline-flex items-center gap-1">
              <Icon name="hand" size={12} /> {t.why}
            </span>
          )}
        </div>
      </div>
      <span className="text-[12px] font-bold shrink-0 mt-0.5" style={{ color: t.overdue ? C.forest : "var(--gatbos-ink-5)" }}>
        {t.due}
      </span>
    </div>
  );
}

const dividerStyle = { borderColor: "rgba(177,183,171,0.4)" };

export function TodayScreen() {
  const { data: taskData, isLoading: tasksLoading } = useGatbosTasks();
  const { data: people } = useGatbosPeople();
  const { data: meetings } = useGatbosMeetings();
  const { data: captures } = useGatbosCaptures();
  const toggle = useToggleTaskDone();

  const tasks = React.useMemo(() => (taskData?.tasks ?? []).filter((t) => !t.done), [taskData]);
  const overdue = tasks.filter((t) => t.overdue);
  const dueToday = tasks.filter((t) => t.dueToday);
  const waiting = tasks.filter((t) => t.column === "Waiting");
  const top3 = [...tasks]
    .sort((a, b) => a.priority - b.priority || (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0))
    .slice(0, 3);
  const hot = (people ?? []).filter((p) => p.warmth === "hot");
  const warmUp = (people ?? [])
    .filter((p) => ["needs", "cooling", "atrisk", "dormant"].includes(p.warmth))
    .slice(0, 6);

  const nbm = [...overdue, ...dueToday, ...tasks].sort((a, b) => a.priority - b.priority)[0] ?? null;
  const nbmPerson = nbm?.personId ? ((people ?? []).find((p) => p.id === nbm.personId) ?? null) : null;

  const onToggle = (t: TaskVM) => toggle.mutate({ taskId: t.id, completed: true });

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[13px] font-semibold tracking-wide" style={{ color: C.pine }}>
            {todayHeading()}
          </p>
          <h1 className="font-newsreader font-medium text-[30px] md:text-[34px] leading-tight mt-0.5" style={{ color: C.forest }}>
            Good morning. Here&apos;s what matters.
          </h1>
        </div>
        <div className="flex items-center gap-5 md:gap-6">
          <GlanceStat n={overdue.length} label="overdue" />
          <GlanceStat n={dueToday.length} label="due today" tone={C.pine} />
          <GlanceStat n={waiting.length} label="waiting" />
          <GlanceStat n={hot.length} label="hot" tone={C.pine} />
        </div>
      </div>

      <div className="mb-5">
        <QuickCapture />
      </div>
      <div className="mb-6">
        <NextBestMove task={nbm} person={nbmPerson} />
      </div>

      {/* Two column cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
        {/* LEFT: action stream */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle
              icon="flag"
              count={top3.length}
              action={
                <span className="text-[12px] font-bold" style={{ color: "var(--gatbos-ink-6)" }}>
                  L1 · Create business / prevent damage
                </span>
              }
            >
              Top 3 priorities today
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {top3.map((t) => (
                <PriorityRow key={t.id} t={t} onToggle={onToggle} />
              ))}
              {!tasksLoading && top3.length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Nothing open. Capture something above.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="clock" count={overdue.length}>
              Overdue follow-ups
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {overdue.map((t) => (
                <MiniRow
                  key={t.id}
                  icon={
                    <span className="shrink-0" style={{ color: C.forest }}>
                      <Icon name="alert" size={16} />
                    </span>
                  }
                  title={t.title}
                  sub={t.personName ? `${t.personName}${t.why ? " · " + t.why : ""}` : (t.why ?? undefined)}
                  right="Overdue"
                  rightTone={C.forest}
                />
              ))}
              {overdue.length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Nothing overdue. Clean slate.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="tasks" count={dueToday.length}>
              Due today
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {dueToday.map((t) => (
                <MiniRow
                  key={t.id}
                  icon={
                    <span
                      className="mt-0.5 shrink-0 rounded-md"
                      style={{ width: 18, height: 18, border: `1.75px solid ${C.sage}`, display: "inline-block" }}
                    />
                  }
                  title={t.title}
                  sub={t.personName ?? t.projectName ?? undefined}
                />
              ))}
              {dueToday.length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Nothing due today.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              icon="hand"
              count={waiting.length}
              action={
                <span className="text-[12px] font-bold" style={{ color: "var(--gatbos-ink-6)" }}>
                  Promises in flight
                </span>
              }
            >
              Waiting on someone
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {waiting.map((t) => (
                <MiniRow
                  key={t.id}
                  icon={
                    <span className="shrink-0" style={{ color: C.sage }}>
                      <Icon name="clock" size={16} />
                    </span>
                  }
                  title={t.title}
                  sub={t.waiting ?? undefined}
                  right={t.due}
                />
              ))}
              {waiting.length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Nothing snoozed or blocked.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT: relationships + signals */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle
              icon="flame"
              count={hot.length}
              action={
                <span className="text-[12px] font-bold" style={{ color: "var(--gatbos-ink-6)" }}>
                  L2 · Opportunity
                </span>
              }
            >
              Hot relationship opportunities
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {hot.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-start gap-3 py-3">
                  <Avatar name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold" style={{ color: C.forest }}>
                        {p.name}
                      </p>
                      <WarmthDot k={p.warmth} />
                    </div>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "var(--gatbos-ink-3)" }}>
                      {p.opportunity}
                    </p>
                    <p className="text-[12.5px] font-semibold mt-1 inline-flex items-center gap-1" style={{ color: C.pine }}>
                      <Icon name="arrow" size={12} /> {p.nextBest}
                    </p>
                  </div>
                </div>
              ))}
              {hot.length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  No hot relationships right now. Check the warm-up list below.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon="calendar" count={meetings?.length ?? 0}>
              Today &amp; upcoming
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {(meetings ?? []).map((m) => (
                <MiniRow
                  key={m.id}
                  icon={
                    <span className="shrink-0" style={{ color: C.pine }}>
                      <Icon name="calendar" size={16} />
                    </span>
                  }
                  title={m.title}
                  sub={(m.personName ? m.personName + " · " : "") + m.where}
                  right={m.when.split("·").pop()?.trim()}
                />
              ))}
              {(meetings ?? []).length === 0 && (
                <p className="py-3 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Nothing on the calendar.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              icon="pin"
              count={warmUp.length}
              action={
                <span className="text-[12px] font-bold" style={{ color: "var(--gatbos-ink-6)" }}>
                  L4 · Warm up
                </span>
              }
            >
              Haven&apos;t touched, but should
            </SectionTitle>
            <div className="divide-y" style={dividerStyle}>
              {warmUp.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={p.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold whitespace-nowrap" style={{ color: C.forest }}>
                      {p.name}
                    </p>
                    <p className="text-[12px] truncate" style={{ color: "var(--gatbos-ink-4)" }}>
                      {p.nextBest}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <WarmthTag k={p.warmth} />
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--gatbos-ink-6)" }}>
                      {p.lastTouch}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              icon="inbox"
              count={captures?.length ?? 0}
              action={
                <Link href="/captures" className="text-[12px] font-bold" style={{ color: C.pine }}>
                  Process
                </Link>
              }
            >
              Captured, needs processing
            </SectionTitle>
            <div className="space-y-2">
              {(captures ?? []).map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{ background: "rgba(177,183,171,0.16)" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: C.sage }}>
                    <Icon name="sparkle" size={14} />
                  </span>
                  <p className="flex-1 text-[12.5px] leading-snug" style={{ color: "var(--gatbos-ink-1)" }}>
                    {c.text}
                  </p>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--gatbos-ink-6)" }}>
                    {c.when}
                  </span>
                </div>
              ))}
              {(captures ?? []).length === 0 && (
                <p className="py-1 text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
                  Inbox zero. Nice.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
