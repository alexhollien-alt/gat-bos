"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MaterialRequest } from "@/lib/types";
import { MaterialRequestRow } from "@/components/materials/material-request-row";
import { REQUEST_STATUS_CONFIG } from "@/lib/constants";
import type { MaterialRequestStatus } from "@/lib/types";
import { Inbox } from "lucide-react";
import {
  AccentRule,
  FilterPill,
  PageHeader,
  SectionShell,
} from "@/components/screen";

const STATUS_FILTERS: { value: MaterialRequestStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "in_production", label: "In Production" },
  { value: "complete", label: "Complete" },
];

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

export default function MaterialsPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<MaterialRequestStatus | "all">("all");
  const [intakeCount, setIntakeCount] = useState(0);

  const fetchRequests = useCallback(async () => {
    let query = supabase
      .from("material_requests")
      .select(
        "*, contacts(id, first_name, last_name, company), material_request_items(*)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) {
      setRequests(
        data.map((r: Record<string, unknown>) => ({
          ...r,
          items: r.material_request_items,
        })) as MaterialRequest[]
      );
    }

    const { count } = await supabase
      .from("material_requests")
      .select("*", { count: "exact", head: true })
      .eq("source", "intake")
      .eq("status", "submitted")
      .is("deleted_at", null);

    setIntakeCount(count ?? 0);
  }, [statusFilter, supabase]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openCount = requests.filter((r) => r.status !== "complete").length;
  const openCountText = `${openCount} open request${openCount !== 1 ? "s" : ""}`;

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-4xl mx-0">
      <PageHeader
        eyebrow="Print queue"
        title="Material Requests"
        subhead={openCountText}
        right={
          intakeCount > 0 ? (
            <div className="flex items-center gap-3">
              <PreviewLink />
              <NewIntakeBadge count={intakeCount} />
            </div>
          ) : (
            <PreviewLink />
          )
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map((filter) => (
          <FilterPill
            key={filter.value}
            tone="neutral"
            active={statusFilter === filter.value}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </FilterPill>
        ))}
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <MaterialRequestRow
            key={req.id}
            request={req}
            onUpdate={fetchRequests}
            showContact
          />
        ))}
        {requests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "No material requests yet. Create one from a contact's page."
                : `No ${REQUEST_STATUS_CONFIG[statusFilter as MaterialRequestStatus]?.label.toLowerCase()} requests.`}
            </p>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
