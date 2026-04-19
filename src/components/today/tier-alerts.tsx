"use client";

import type { TodayPayloadT } from "@/lib/spine/types";
import { AlertTriangle, Phone, MessageSquare } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

type ComingDueItem = TodayPayloadT["coming_due"][number];

interface TierAlertsSectionProps {
  comingDue: ComingDueItem[];
}

export function TierAlertsSection({ comingDue }: TierAlertsSectionProps) {
  if (comingDue.length === 0) {
    return (
      <section role="region" aria-label="Tier alerts">
        <SectionHeader count={0} />
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No agents approaching their cadence threshold right now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section role="region" aria-label="Tier alerts">
      <SectionHeader count={comingDue.length} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {comingDue.map((item) => (
          <TierAlertCard key={item.cycle.contact_id} item={item} />
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <h2
        className="text-lg font-semibold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Tier Alerts
      </h2>
      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
        {count}
      </span>
    </div>
  );
}

function TierAlertCard({ item }: { item: ComingDueItem }) {
  const { cycle, contact } = item;
  const name = `${contact.first_name} ${contact.last_name}`;
  const dueDate = cycle.next_due_at ? new Date(cycle.next_due_at) : null;
  const lastTouched = cycle.last_touched_at
    ? formatDistanceToNowStrict(new Date(cycle.last_touched_at), {
        addSuffix: true,
      })
    : "never";

  return (
    <div className="rounded-lg border border-border p-4 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/contacts/${contact.id}`}
            className="text-sm font-medium text-foreground hover:underline truncate block"
          >
            {name}
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            Last contact: <span className="font-mono">{lastTouched}</span>
          </p>
          {dueDate && (
            <p className="text-xs text-yellow-500 mt-0.5">
              Due{" "}
              <span className="font-mono">
                {formatDistanceToNowStrict(dueDate, { addSuffix: true })}
              </span>
            </p>
          )}
          {cycle.cadence_days && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Cadence: <span className="font-mono">{cycle.cadence_days}d</span>
            </p>
          )}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          {contact.first_name && (
            <a
              href={`sms:?body=Hey ${contact.first_name}`}
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Text ${name}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </a>
          )}
          <a
            href={`tel:${contact.id}`}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Call ${name}`}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
