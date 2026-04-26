"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MaterialRequestStatus, ContactTier } from "@/lib/types";
import { PRODUCT_TYPE_CONFIG } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow, differenceInDays, subDays } from "date-fns";
import { AccentRule, MonoNumeral, PageHeader, SectionShell } from "@/components/screen";

function NewIntakeBadge({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-red)]/40 bg-[color:var(--accent-red)]/10 px-3 py-1.5 text-[var(--accent-red)]">
      <Inbox className="h-3.5 w-3.5" />
      <span className="font-mono uppercase text-micro tracking-label font-medium">
        {count} new intake{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function PreviewLink() {
  return (
    <Link
      href="/weekly-edge/preview"
      className="font-mono uppercase text-micro tracking-label font-medium text-muted-foreground transition-colors hover:text-[var(--accent-red)]"
    >
      Preview this week →
    </Link>
  );
}

// ---------------------
// Types
// ---------------------

interface TicketContact {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  tier: ContactTier | null;
  phone: string | null;
  email: string | null;
  brand_colors: Record<string, string> | null;
  palette: string | null;
}

interface TicketItem {
  id: string;
  request_id: string;
  product_type: string;
  quantity: number;
  design_url: string | null;
  description: string | null;
  created_at: string;
}

interface Ticket {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  title: string;
  request_type: string;
  status: MaterialRequestStatus;
  priority: string;
  notes: string | null;
  source: string;
  listing_data: Record<string, unknown> | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  contacts: TicketContact | null;
  items: TicketItem[];
}

// ---------------------
// Column config
// ---------------------

const COLUMNS: { status: MaterialRequestStatus; label: string }[] = [
  { status: "submitted", label: "New" },
  { status: "in_production", label: "In Production" },
  { status: "complete", label: "Done" },
  { status: "draft", label: "Drafts" },
];

// ---------------------
// Tier badge colors (matching action queue)
// ---------------------

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-[color:var(--brand-red)]/10", text: "text-[var(--brand-red)]" },
  B: { bg: "bg-[color:var(--brand-blue)]/10", text: "text-[var(--brand-blue)]" },
  C: { bg: "bg-[color:var(--muted-text)]/10", text: "text-[var(--muted-text)]" },
  P: { bg: "bg-[var(--rule-gray)]", text: "text-[var(--muted-text)]" },
};

// ---------------------
// Metrics helpers
// ---------------------

function computeMetrics(tickets: Ticket[]) {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);

  const pending = tickets.filter((t) => t.status === "submitted").length;

  const completedThisWeek = tickets.filter((t) => {
    if (t.status !== "complete" || !t.completed_at) return false;
    return new Date(t.completed_at) >= sevenDaysAgo;
  }).length;

  // Average turnaround: completed in last 30 days with both dates
  const recentCompleted = tickets.filter((t) => {
    if (t.status !== "complete" || !t.completed_at || !t.submitted_at) return false;
    return new Date(t.completed_at) >= thirtyDaysAgo;
  });

  let avgTurnaround = "N/A";
  if (recentCompleted.length > 0) {
    const totalDays = recentCompleted.reduce((sum, t) => {
      return sum + differenceInDays(new Date(t.completed_at!), new Date(t.submitted_at!));
    }, 0);
    const avg = Math.round(totalDays / recentCompleted.length);
    avgTurnaround = `${avg}d`;
  }

  return { pending, completedThisWeek, avgTurnaround };
}

// ---------------------
// Ticket Card
// ---------------------

function TicketCard({
  ticket,
  onStatusChange,
}: {
  ticket: Ticket;
  onStatusChange: (id: string, newStatus: MaterialRequestStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRush = ticket.priority === "rush";
  const contact = ticket.contacts;
  const agentName =
    ticket.submitter_name ||
    (contact ? `${contact.first_name} ${contact.last_name}` : null);

  const productPills = (ticket.items || []).map((item) => {
    const config = PRODUCT_TYPE_CONFIG[item.product_type as keyof typeof PRODUCT_TYPE_CONFIG];
    const label = config?.label || item.product_type;
    return item.quantity > 1 ? `${item.quantity}x ${label}` : label;
  });

  const tierBadge = contact?.tier ? TIER_COLORS[contact.tier] : null;

  return (
    <div
      className="bg-card rounded-lg border border-border p-3 mb-2 cursor-pointer shadow-sm hover:shadow transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Rush badge */}
      {isRush && (
        <span className="inline-block text-[9px] uppercase font-bold text-[var(--brand-red)] bg-[color:var(--brand-red)]/10 px-1.5 py-0.5 rounded mb-1.5">
          RUSH
        </span>
      )}

      {/* Title */}
      <p className="text-[13px] font-semibold text-[var(--brand-black)] leading-tight mb-1.5 line-clamp-2">
        {ticket.title}
      </p>

      {/* Agent name + tier */}
      {agentName && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] text-[var(--muted-text)] truncate">{agentName}</span>
          {tierBadge && contact?.tier && (
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${tierBadge.bg} ${tierBadge.text}`}
            >
              {contact.tier}
            </span>
          )}
        </div>
      )}

      {/* Product pills */}
      {productPills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {productPills.map((pill, i) => (
            <span
              key={i}
              className="text-[10px] bg-[var(--off-white)] text-[var(--muted-text)] px-2 py-0.5 rounded-full"
            >
              {pill}
            </span>
          ))}
        </div>
      )}

      {/* Time + status select */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--ghost-text)]">
          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={ticket.status}
            onValueChange={(val) =>
              onStatusChange(ticket.id, val as MaterialRequestStatus)
            }
          >
            <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px] border-[var(--rule-gray)] bg-[var(--off-white)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">New</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="complete">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expanded agent context */}
      {expanded && contact && (
        <div className="mt-3 pt-3 border-t border-[var(--rule-gray)]">
          <div className="space-y-1.5 text-[11px] text-[var(--muted-text)]">
            {contact.company && (
              <p>
                <span className="text-[var(--ghost-text)]">Company:</span> {contact.company}
              </p>
            )}
            {contact.phone && (
              <p>
                <span className="text-[var(--ghost-text)]">Phone:</span>{" "}
                <a
                  href={`tel:${contact.phone}`}
                  className="hover:text-[var(--brand-blue)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contact.phone}
                </a>
              </p>
            )}
            {contact.email && (
              <p>
                <span className="text-[var(--ghost-text)]">Email:</span>{" "}
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-[var(--brand-blue)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contact.email}
                </a>
              </p>
            )}
            {contact.palette && (
              <p>
                <span className="text-[var(--ghost-text)]">Palette:</span> {contact.palette}
              </p>
            )}
            {/* Brand color swatches */}
            {contact.brand_colors &&
              Object.keys(contact.brand_colors).length > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[var(--ghost-text)]">Brand:</span>
                  {Object.entries(contact.brand_colors).map(([key, hex]) => (
                    <span
                      key={key}
                      className="inline-block w-4 h-4 rounded-full border border-[var(--rule-gray)]"
                      style={{ backgroundColor: hex }}
                      title={`${key}: ${hex}`}
                    />
                  ))}
                </div>
              )}
            <Link
              href={`/contacts/${contact.id}`}
              className="inline-block mt-1.5 text-[11px] font-medium text-[var(--brand-blue)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Contact
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------
// Page
// ---------------------

export default function TicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [intakeCount, setIntakeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select(
        "*, contacts(id, first_name, last_name, company, tier, phone, email, brand_colors, palette), items:ticket_items(*)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTickets(data as unknown as Ticket[]);
    }
    setLoading(false);
  }, [supabase]);

  const fetchIntakeCount = useCallback(async () => {
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("source", "intake")
      .eq("status", "submitted")
      .is("deleted_at", null);
    setIntakeCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    fetchTickets();
    fetchIntakeCount();
  }, [fetchTickets, fetchIntakeCount]);

  const handleStatusChange = async (
    requestId: string,
    newStatus: MaterialRequestStatus
  ) => {
    // Optimistic update
    setTickets((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: newStatus,
              ...(newStatus === "complete"
                ? { completed_at: new Date().toISOString() }
                : {}),
            }
          : r
      )
    );

    await supabase
      .from("tickets")
      .update({
        status: newStatus,
        ...(newStatus === "complete"
          ? { completed_at: new Date().toISOString() }
          : {}),
        ...(newStatus === "submitted"
          ? { submitted_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", requestId);
  };

  // Group tickets by status
  const grouped: Record<MaterialRequestStatus, Ticket[]> = {
    submitted: [],
    in_production: [],
    complete: [],
    draft: [],
  };
  for (const t of tickets) {
    if (grouped[t.status]) {
      grouped[t.status].push(t);
    }
  }

  const { pending, completedThisWeek, avgTurnaround } =
    computeMetrics(tickets);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--ghost-text)]" />
      </div>
    );
  }

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 mx-0">
      <PageHeader
        eyebrow="Print queue"
        title="Ticket Workbench"
        right={
          <div className="flex items-center gap-4">
            {intakeCount > 0 && <NewIntakeBadge count={intakeCount} />}
            <PreviewLink />
            <span className="text-border">|</span>
            <div className="flex items-center gap-4 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-mono">
                  Pending
                </span>
                <MonoNumeral size="sm" className="text-foreground font-semibold">
                  {pending}
                </MonoNumeral>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-mono">
                  This Week
                </span>
                <MonoNumeral size="sm" className="text-foreground font-semibold">
                  {completedThisWeek}
                </MonoNumeral>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-mono">
                  Avg
                </span>
                <MonoNumeral size="sm" className="text-foreground font-semibold">
                  {avgTurnaround}
                </MonoNumeral>
              </div>
            </div>
          </div>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      {/* Kanban grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTickets = grouped[col.status];
          return (
            <div
              key={col.status}
              className="bg-[var(--off-white)] rounded-xl p-3 min-h-[400px]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-[var(--ghost-text)] font-medium">
                  {col.label}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
                  {colTickets.length}
                </span>
              </div>

              {/* Cards */}
              {colTickets.length === 0 ? (
                <p className="text-[11px] text-[var(--ghost-text)] text-center py-8">
                  No tickets
                </p>
              ) : (
                colTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
