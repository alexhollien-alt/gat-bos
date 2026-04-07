"use client";

import { useState } from "react";
import { Contact, ContactTier } from "@/lib/types";
import { TIER_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { InteractionModal } from "@/components/interactions/interaction-modal";
import Link from "next/link";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export interface StaleContact extends Contact {
  last_interaction_at: string | null;
  severity: "critical" | "warning" | "notice";
}

/** Tier-aware staleness thresholds (days) */
export const STALE_THRESHOLDS: Record<string, number> = {
  A: 7,
  B: 14,
  C: 21,
  P: 30,
};
export const DEFAULT_STALE_THRESHOLD = 14;

export function getStaleThreshold(tier: ContactTier | null): number {
  if (!tier) return DEFAULT_STALE_THRESHOLD;
  return STALE_THRESHOLDS[tier] ?? DEFAULT_STALE_THRESHOLD;
}

export function getStaleSeverity(
  tier: ContactTier | null,
  lastDate: string | null
): "critical" | "warning" | "notice" | null {
  if (!lastDate) return "critical"; // never contacted
  const days = differenceInDays(new Date(), parseISO(lastDate));
  const threshold = getStaleThreshold(tier);
  if (days < threshold) return null; // not stale
  if (tier === "A" || !lastDate) return "critical";
  if (tier === "B") return "warning";
  return "notice";
}

function staleDays(lastDate: string | null): number {
  if (!lastDate) return 999;
  return differenceInDays(new Date(), parseISO(lastDate));
}

function staleLabel(days: number): string {
  if (days >= 999) return "Never contacted";
  return `${days}d ago`;
}

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    badge: "bg-red-500/15 text-red-400",
    dot: "bg-red-500",
  },
  warning: {
    label: "Warning",
    badge: "bg-orange-500/15 text-orange-400",
    dot: "bg-orange-400",
  },
  notice: {
    label: "Notice",
    badge: "bg-yellow-500/15 text-yellow-400",
    dot: "bg-yellow-400",
  },
};

export function StaleContactsWidget({
  contacts,
  onUpdate,
}: {
  contacts: StaleContact[];
  onUpdate: () => void;
}) {
  const [logContactId, setLogContactId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const critical = contacts.filter((c) => c.severity === "critical");
  const warning = contacts.filter((c) => c.severity === "warning");
  const notice = contacts.filter((c) => c.severity === "notice");

  const collapsed = !expanded;
  const visibleLimit = 5;

  function renderGroup(
    items: StaleContact[],
    severity: "critical" | "warning" | "notice"
  ) {
    if (items.length === 0) return null;
    const config = SEVERITY_CONFIG[severity];
    const shown = collapsed ? items.slice(0, visibleLimit) : items;

    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5 mt-2 first:mt-0">
          <div className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {config.label}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full",
              config.badge
            )}
          >
            {items.length}
          </span>
        </div>
        <div className="space-y-1">
          {shown.map((c) => {
            const days = staleDays(c.last_interaction_at);
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors"
              >
                <Link
                  href={`/contacts/${c.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    {c.tier && (
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                          TIER_CONFIG[c.tier].bgColor,
                          TIER_CONFIG[c.tier].textColor
                        )}
                      >
                        {c.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company || "Independent"}
                  </p>
                </Link>
                <span
                  className={cn(
                    "text-xs font-mono font-medium shrink-0",
                    severity === "critical"
                      ? "text-red-400"
                      : severity === "warning"
                        ? "text-orange-400"
                        : "text-yellow-400"
                  )}
                >
                  {staleLabel(days)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => setLogContactId(c.id)}
                  title="Log interaction"
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const totalCount = contacts.length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention
            {totalCount > 0 && (
              <span className="bg-orange-500/15 text-orange-400 text-xs font-mono px-1.5 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              All contacts are fresh
            </p>
          ) : (
            <>
              {renderGroup(critical, "critical")}
              {renderGroup(warning, "warning")}
              {renderGroup(notice, "notice")}

              {totalCount > visibleLimit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-muted-foreground"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show all {totalCount}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {logContactId && (
        <InteractionModal
          open={!!logContactId}
          onOpenChange={(open) => {
            if (!open) setLogContactId(null);
          }}
          contactId={logContactId}
          onSuccess={() => {
            setLogContactId(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
