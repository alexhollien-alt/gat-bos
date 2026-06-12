"use client";

// Tasks / Projects. Port of .prototype tasks.jsx onto live tasks + projects.
// Board columns are derived (live statuses: open/done/snoozed) -- the
// prototype's In Progress / Needs Review lanes need a workflow-status
// migration, deferred per the derive-first decision.

import * as React from "react";
import { C, Icon, Card, Tag, Avatar, ProgressRing, PRIORITY, STATUS_TONE, type TagTone } from "@/components/gatbos/ui";
import {
  useGatbosTasks,
  useToggleTaskDone,
  type ProjectVM,
  type TaskVM,
} from "@/components/gatbos/queries";

function columnTone(column: string): TagTone {
  return STATUS_TONE[column] ?? "sage";
}

function TaskCard({ t, compact, onToggle }: { t: TaskVM; compact?: boolean; onToggle: (t: TaskVM) => void }) {
  const pr = PRIORITY[t.priority];
  return (
    <div className="rounded-xl bg-white p-3.5 group" style={{ border: "1px solid rgba(177,183,171,0.5)" }}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(t)}
          className="mt-0.5 shrink-0 rounded-md flex items-center justify-center transition hover:bg-[rgba(39,97,82,0.08)]"
          style={{ width: 20, height: 20, border: `1.75px solid ${C.sage}` }}
          title={t.done ? "Reopen" : "Mark done"}
        >
          <Icon
            name="check"
            size={12}
            className={t.done ? "opacity-80" : "opacity-0 group-hover:opacity-40"}
            style={{ color: C.pine }}
          />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-snug" style={{ color: C.forest }}>
            {t.title}
          </p>
          {!compact && (
            <div className="mt-2 space-y-1 text-[12.5px] leading-snug" style={{ color: "var(--gatbos-ink-3)" }}>
              {t.why && (
                <p>
                  <span className="font-semibold" style={{ color: "var(--gatbos-ink-6)" }}>
                    Why&nbsp;&nbsp;
                  </span>
                  {t.why}
                </p>
              )}
              {t.next && (
                <p>
                  <span className="font-semibold" style={{ color: "var(--gatbos-ink-6)" }}>
                    Next&nbsp;&nbsp;
                  </span>
                  <span style={{ color: C.pine, fontWeight: 600 }}>{t.next}</span>
                </p>
              )}
              {t.waiting && (
                <p>
                  <span className="font-semibold" style={{ color: "var(--gatbos-ink-6)" }}>
                    Waiting&nbsp;&nbsp;
                  </span>
                  {t.waiting}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Tag tone={columnTone(t.column)}>{t.column}</Tag>
            {t.priority <= 2 && <Tag tone={pr.tone}>{pr.label}</Tag>}
            {t.personName && (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--gatbos-ink-2)" }}>
                <Avatar name={t.personName} size={18} /> {t.personName}
              </span>
            )}
            {t.projectName && (
              <span className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: "var(--gatbos-ink-5)" }}>
                <Icon name="doc" size={12} /> {t.projectName}
              </span>
            )}
          </div>
        </div>
        <span className="text-[12px] font-bold shrink-0" style={{ color: t.overdue ? C.forest : "var(--gatbos-ink-5)" }}>
          {t.due}
        </span>
      </div>
    </div>
  );
}

function ProjectCard({
  proj,
  tasks,
  defaultOpen,
  onToggle,
}: {
  proj: ProjectVM;
  tasks: TaskVM[];
  defaultOpen?: boolean;
  onToggle: (t: TaskVM) => void;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-4 flex items-center gap-4">
        <ProgressRing value={proj.progress} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15.5px] font-bold" style={{ color: C.forest }}>
              {proj.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[12.5px]" style={{ color: "var(--gatbos-ink-3)" }}>
            <Tag tone={STATUS_TONE[proj.status] ?? "sage"}>{proj.status}</Tag>
            <Tag tone="sage">{proj.type}</Tag>
            {proj.personName && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Icon name="people" size={12} /> {proj.personName}
              </span>
            )}
            <span className="whitespace-nowrap">
              · {proj.open} of {proj.total} open
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-bold" style={{ color: proj.due === "Today" || proj.due === "Overdue" ? C.forest : "var(--gatbos-ink-5)" }}>
            {proj.due}
          </p>
          <span style={{ color: C.sage }} className={"inline-block transition-transform " + (open ? "rotate-90" : "")}>
            <Icon name="chevron" size={16} />
          </span>
        </div>
      </button>
      {open && tasks.length > 0 && (
        <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: "1px solid rgba(177,183,171,0.4)", paddingTop: 14 }}>
          {tasks.map((t) => (
            <TaskCard key={t.id} t={t} onToggle={onToggle} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Column({ status, tasks, onToggle }: { status: string; tasks: TaskVM[]; onToggle: (t: TaskVM) => void }) {
  return (
    <div className="shrink-0 w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--gatbos-ink-2)" }}>
          {status}
        </h3>
        <span className="text-[11.5px] font-bold rounded-full px-1.5" style={{ background: "rgba(177,183,171,0.3)", color: C.forest }}>
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} t={t} compact onToggle={onToggle} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-xl py-6 text-center text-[12.5px]" style={{ border: "1px dashed rgba(177,183,171,0.6)", color: "var(--gatbos-ink-6)" }}>
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

const BOARD_COLUMNS: TaskVM["column"][] = ["Today", "Next", "Waiting", "Completed"];

export function TasksScreen() {
  const [view, setView] = React.useState<"projects" | "board" | "all">("projects");
  const { data, isLoading } = useGatbosTasks();
  const toggle = useToggleTaskDone();
  const onToggle = (t: TaskVM) => toggle.mutate({ taskId: t.id, completed: !t.done });

  const tasks = data?.tasks ?? [];
  const projects = data?.projects ?? [];
  const views: Array<[typeof view, string]> = [
    ["projects", "Projects"],
    ["board", "Board"],
    ["all", "All tasks"],
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-newsreader font-medium text-[30px] leading-tight" style={{ color: C.forest }}>
            Tasks &amp; Projects
          </h1>
          <p className="text-[13.5px] mt-0.5" style={{ color: "var(--gatbos-ink-3)" }}>
            Everything you owe, grouped by the work it belongs to. Finish things.
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

      {isLoading && (
        <p className="text-[13px] py-8" style={{ color: "var(--gatbos-ink-6)" }}>
          Loading tasks…
        </p>
      )}

      {view === "projects" && (
        <div className="space-y-3.5">
          {projects.map((pr, i) => (
            <ProjectCard
              key={pr.id}
              proj={pr}
              tasks={tasks.filter((t) => t.projectId === pr.id)}
              defaultOpen={i === 0}
              onToggle={onToggle}
            />
          ))}
          {!isLoading && projects.length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--gatbos-ink-6)" }}>
              No projects yet.
            </p>
          )}
        </div>
      )}

      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {BOARD_COLUMNS.map((s) => (
            <Column key={s} status={s} tasks={tasks.filter((t) => t.column === s)} onToggle={onToggle} />
          ))}
        </div>
      )}

      {view === "all" && (
        <div className="grid md:grid-cols-2 gap-3">
          {[...tasks]
            .filter((t) => !t.done)
            .sort((a, b) => a.priority - b.priority)
            .map((t) => (
              <TaskCard key={t.id} t={t} onToggle={onToggle} />
            ))}
        </div>
      )}
    </div>
  );
}
