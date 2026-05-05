"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/screen";
import { CYPHER_BRANCHES, TICKET_STATUSES, type TicketStatus } from "@/lib/cypher-constants";
import { Plus, Ticket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TicketRow = {
  id: string;
  ticket_title: string;
  status: TicketStatus;
  priority: string;
  branch_association: string;
  due_date: string | null;
  cypher_id: string | null;
  created_at: string;
  contact_id: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  awaiting_reply: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  in_progress: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  done: "bg-green-500/15 text-green-600 dark:text-green-400",
  blocked: "bg-red-500/15 text-red-600 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_reply: "Awaiting Reply",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const PRIORITY_STYLES: Record<string, string> = {
  Low: "text-muted-foreground",
  Normal: "text-foreground",
  High: "text-amber-600 dark:text-amber-400 font-medium",
  Urgent: "text-destructive font-semibold",
};

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TicketList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const statusFilter = searchParams.get("status") as TicketStatus | null;
  const branchFilter = searchParams.get("branch");
  const rangeFilter = searchParams.get("range");

  const queryKey = useMemo(
    () => ["tickets", { status: statusFilter, branch: branchFilter, range: rangeFilter }],
    [statusFilter, branchFilter, rangeFilter],
  );

  const { data: tickets = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (branchFilter) params.set("branch", branchFilter);
      if (rangeFilter === "this_week") {
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay() + 1);
        monday.setHours(0, 0, 0, 0);
        params.set("created_after", monday.toISOString());
      }
      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      const json = await res.json();
      return (json.tickets ?? []) as TicketRow[];
    },
    staleTime: 30 * 1000,
  });

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel("tickets:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/tickets?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={!statusFilter}
          onClick={() => setFilter("status", null)}
        >
          All
        </FilterPill>
        {TICKET_STATUSES.map((s) => (
          <FilterPill
            key={s}
            active={statusFilter === s}
            onClick={() => setFilter("status", statusFilter === s ? null : s)}
          >
            {STATUS_LABELS[s]}
          </FilterPill>
        ))}

        <div className="ml-auto flex gap-2">
          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground h-8"
            value={branchFilter ?? ""}
            onChange={(e) => setFilter("branch", e.target.value || null)}
            aria-label="Filter by branch"
          >
            <option value="">All Branches</option>
            {CYPHER_BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground h-8"
            value={rangeFilter ?? ""}
            onChange={(e) => setFilter("range", e.target.value || null)}
            aria-label="Filter by date range"
          >
            <option value="">Any Time</option>
            <option value="this_week">This Week</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <Ticket className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">No tickets yet.</p>
            <p className="text-sm text-muted-foreground">Create your first one to get started.</p>
          </div>
          <Button asChild size="sm">
            <Link href="/tickets/new" className="gap-2">
              <Plus className="h-4 w-4" />
              New Ticket
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm" role="grid" aria-label="Tickets">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Agent</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Priority</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Branch</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Due</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Cypher ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Age</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {ticket.ticket_title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {ticket.client_first_name && ticket.client_last_name
                      ? `${ticket.client_first_name} ${ticket.client_last_name}`
                      : <span className="text-muted-foreground/50">--</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={ticket.status} />
                  </td>
                  <td className={`px-4 py-3 hidden lg:table-cell ${PRIORITY_STYLES[ticket.priority] ?? ""}`}>
                    {ticket.priority}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[140px]">
                    {ticket.branch_association}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
                    {ticket.due_date ?? <span className="opacity-40">--</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell font-mono text-xs">
                    {ticket.cypher_id ?? <span className="opacity-40">--</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
