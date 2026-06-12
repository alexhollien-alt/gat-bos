"use client";

// GAT-BOS redesign sidebar. Port of .prototype app.jsx Sidebar: 4 primary tabs
// + a collapsible "More" group carrying every legacy route (decision locked
// 2026-06-11: nothing becomes unreachable; legacy entries retire at cutover).

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { C, Icon, Avatar } from "./ui";
import { useGatbosCaptures, useGatbosTasks } from "./queries";

const NAV = [
  { id: "today", href: "/new/today", label: "Today", icon: "today", sub: "Command Center" },
  { id: "tasks", href: "/new/tasks", label: "Tasks", icon: "tasks", sub: "Projects & to-dos" },
  { id: "people", href: "/new/people", label: "People", icon: "people", sub: "Relationship nurture" },
  { id: "marketing", href: "/new/marketing", label: "Marketing", icon: "marketing", sub: "Campaigns & materials" },
];

// Legacy routes (mirrors src/components/sidebar.tsx navItems). Retire rows as
// screens are absorbed.
const LEGACY = [
  { href: "/dashboard", label: "Daily Brief" },
  { href: "/captures", label: "Captures" },
  { href: "/inbox", label: "Inbox" },
  { href: "/actions", label: "Actions" },
  { href: "/analytics", label: "Analytics" },
  { href: "/contacts", label: "Contacts" },
  { href: "/opportunities", label: "Pipeline" },
  { href: "/tasks", label: "Tasks (classic)" },
  { href: "/campaigns", label: "Campaigns (classic)" },
  { href: "/material-requests", label: "Material Requests" },
  { href: "/tickets", label: "Tickets" },
];

export function GatbosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { data: taskData } = useGatbosTasks();
  const { data: captures } = useGatbosCaptures();

  const todayBadge =
    taskData?.tasks.filter((t) => !t.done && (t.overdue || t.dueToday)).length ?? 0;
  const badges: Record<string, number> = { today: todayBadge };

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto" style={{ width: 248, background: C.forest }}>
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "rgba(159,230,206,0.18)" }}>
            <Icon name="bolt" size={18} style={{ color: C.mint }} />
          </div>
          <div>
            <p className="text-[16px] font-extrabold leading-none tracking-tight" style={{ color: C.cream }}>
              GAT-BOS
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(251,246,240,0.55)" }}>
              Relationship OS
            </p>
          </div>
        </div>
      </div>

      <nav className="px-3 flex-1 space-y-1">
        {NAV.map((n) => {
          const on = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.id}
              href={n.href}
              className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition"
              style={on ? { background: "rgba(251,246,240,0.12)" } : {}}
            >
              <span style={{ color: on ? C.mint : "rgba(251,246,240,0.6)" }}>
                <Icon name={n.icon} size={19} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold leading-tight" style={{ color: on ? C.cream : "rgba(251,246,240,0.82)" }}>
                  {n.label}
                </p>
                <p className="text-[11px] leading-tight" style={{ color: on ? "rgba(159,230,206,0.85)" : "rgba(251,246,240,0.42)" }}>
                  {n.sub}
                </p>
              </div>
              {(badges[n.id] ?? 0) > 0 && (
                <span
                  className="text-[11px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                  style={{ background: on ? C.mint : "rgba(251,246,240,0.18)", color: on ? C.forest : C.cream }}
                >
                  {badges[n.id]}
                </span>
              )}
            </Link>
          );
        })}

        {/* More: legacy routes, untouched until each screen is absorbed */}
        <div className="pt-2">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className="w-full text-left rounded-xl px-3 py-2 flex items-center gap-2"
          >
            <span
              className={"inline-block transition-transform " + (moreOpen ? "rotate-90" : "")}
              style={{ color: "rgba(251,246,240,0.45)" }}
            >
              <Icon name="chevron" size={14} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(251,246,240,0.45)" }}>
              More
            </span>
          </button>
          {moreOpen && (
            <div className="space-y-0.5 pb-2">
              {LEGACY.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-3 py-1.5 ml-6 text-[12.5px] font-medium transition hover:bg-[rgba(251,246,240,0.08)]"
                  style={{ color: "rgba(251,246,240,0.62)" }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(251,246,240,0.08)" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "rgba(159,230,206,0.85)" }}>
            Captures · Inbox
          </p>
          <p className="text-[12px] leading-snug" style={{ color: "rgba(251,246,240,0.7)" }}>
            {captures?.length ?? 0} notes waiting in Today to process.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: "rgba(251,246,240,0.1)" }}
          title="Sign out"
        >
          <Avatar name="Alex Hollien" size={32} />
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: C.cream }}>
              Alex Hollien
            </p>
            <p className="text-[11px] truncate" style={{ color: "rgba(251,246,240,0.5)" }}>
              Title & Escrow Marketing
            </p>
          </div>
          <span style={{ color: "rgba(251,246,240,0.5)" }}>
            <Icon name="arrow" size={14} />
          </span>
        </button>
      </div>
    </aside>
  );
}
