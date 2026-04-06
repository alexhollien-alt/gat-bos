"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MaterialRequest } from "@/lib/types";
import { MaterialRequestRow } from "@/components/materials/material-request-row";
import { REQUEST_STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MaterialRequestStatus } from "@/lib/types";
import { Inbox } from "lucide-react";

const STATUS_FILTERS: { value: MaterialRequestStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "in_production", label: "In Production" },
  { value: "complete", label: "Complete" },
];

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

    // Count new intake submissions (submitted status, intake source)
    const { count } = await supabase
      .from("material_requests")
      .select("*", { count: "exact", head: true })
      .eq("source", "intake")
      .eq("status", "submitted")
      .is("deleted_at", null);

    setIntakeCount(count ?? 0);
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openCount = requests.filter(
    (r) => r.status !== "complete"
  ).length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Material Requests
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {openCount} open request{openCount !== 1 ? "s" : ""}
          </p>
        </div>
        {intakeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            <Inbox className="h-4 w-4" />
            {intakeCount} new intake submission{intakeCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 mb-4">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              statusFilter === filter.value
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Request list */}
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
            <p className="text-sm text-slate-400">
              {statusFilter === "all"
                ? "No material requests yet. Create one from a contact's page."
                : `No ${REQUEST_STATUS_CONFIG[statusFilter as MaterialRequestStatus]?.label.toLowerCase()} requests.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
