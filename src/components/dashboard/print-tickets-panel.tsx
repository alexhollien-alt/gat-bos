"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaterialRequestStatus, ContactTier } from "@/lib/types";

// ---------------------
// Types
// ---------------------

interface PanelTicketContact {
  first_name: string;
  last_name: string;
  tier: ContactTier | null;
}

interface PanelTicket {
  id: string;
  title: string;
  status: MaterialRequestStatus;
  created_at: string;
  contacts: PanelTicketContact | null;
}

// ---------------------
// Tier badge config
// ---------------------

// Screen brand values per digital-aesthetic.md (NOT the print brand-red/brand-blue)
const TIER_BADGE: Record<
  string,
  { bg: string; color: string }
> = {
  A: { bg: "bg-[color:var(--accent-red)]/10", color: "text-[var(--accent-red)]" },
  B: { bg: "bg-[color:var(--accent-blue)]/10", color: "text-[var(--accent-blue)]" },
  C: { bg: "bg-[color:var(--text-secondary)]/10", color: "text-[var(--text-secondary)]" },
  P: { bg: "bg-[color:var(--surface-raised)]/10", color: "text-muted-foreground" },
};

// ---------------------
// Status pill config
// ---------------------

const STATUS_LABEL: Record<MaterialRequestStatus, string> = {
  submitted: "New",
  in_production: "Production",
  draft: "Draft",
  complete: "Done",
};

// ---------------------
// Time-ago helper -- compact format: "3h", "2d", "5m"
// ---------------------

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------
// Widget
// ---------------------

export function PrintTicketsPanel() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<PanelTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from("material_requests")
        .select("id, title, status, created_at, contacts(first_name, last_name, tier)")
        .is("deleted_at", null)
        .neq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setTickets(data as unknown as PanelTicket[]);
      }
      setLoading(false);
    }

    fetchTickets();
  }, [supabase]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print Tickets
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2 font-mono">Loading...</p>
        ) : tickets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No active tickets</p>
        ) : (
          <div className="space-y-1">
            {tickets.map((ticket) => {
              const contact = ticket.contacts;
              const tier = contact?.tier ?? null;
              const tierStyle = tier ? TIER_BADGE[tier] : null;
              const agentLabel = contact
                ? `${contact.first_name} ${contact.last_name.charAt(0)}.`
                : null;
              const statusLabel = STATUS_LABEL[ticket.status] ?? ticket.status;
              const ago = timeAgo(ticket.created_at);

              return (
                <div
                  key={ticket.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
                >
                  {/* Tier badge */}
                  {tierStyle && tier ? (
                    <span
                      className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${tierStyle.bg} ${tierStyle.color}`}
                    >
                      {tier}
                    </span>
                  ) : (
                    <span className="shrink-0 w-[22px]" />
                  )}

                  {/* Title + agent */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                      {ticket.title}
                    </p>
                    {agentLabel && (
                      <p className="text-[10px] text-muted-foreground truncate leading-tight">
                        {agentLabel}
                      </p>
                    )}
                  </div>

                  {/* Status pill */}
                  <span className="shrink-0 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                    {statusLabel}
                  </span>

                  {/* Time-ago */}
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground w-6 text-right">
                    {ago}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* View all link */}
        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href="/tickets"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all tickets &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
