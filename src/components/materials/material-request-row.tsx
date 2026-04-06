"use client";

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest } from "@/lib/types";
import {
  REQUEST_STATUS_CONFIG,
  REQUEST_TYPE_CONFIG,
  REQUEST_PRIORITY_CONFIG,
  PRODUCT_TYPE_CONFIG,
} from "@/lib/constants";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function MaterialRequestRow({
  request,
  onUpdate,
  showContact = false,
}: {
  request: MaterialRequest;
  onUpdate: () => void;
  showContact?: boolean;
}) {
  const supabase = createClient();
  const statusConfig = REQUEST_STATUS_CONFIG[request.status];
  const typeConfig = REQUEST_TYPE_CONFIG[request.request_type];
  const priorityConfig = REQUEST_PRIORITY_CONFIG[request.priority];

  const itemSummary = request.items?.length
    ? request.items
        .map(
          (item) =>
            `${item.quantity}x ${PRODUCT_TYPE_CONFIG[item.product_type]?.label ?? item.product_type}`
        )
        .join(", ")
    : "No items";

  async function updateStatus(value: string) {
    const updates: Record<string, unknown> = { status: value };
    if (value === "submitted" && !request.submitted_at) {
      updates.submitted_at = new Date().toISOString();
    }
    if (value === "complete" && !request.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("material_requests")
      .update(updates)
      .eq("id", request.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      onUpdate();
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-slate-800 truncate">
            {request.title}
          </p>
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap",
              statusConfig.bgColor,
              statusConfig.textColor
            )}
          >
            {statusConfig.label}
          </span>
          {request.priority === "rush" && (
            <span className={cn("text-xs font-medium", priorityConfig.color)}>
              Rush
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showContact && request.contacts && (
            <Link
              href={`/contacts/${request.contacts.id}`}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              {request.contacts.first_name} {request.contacts.last_name}
              {request.contacts.company
                ? ` - ${request.contacts.company}`
                : ""}
            </Link>
          )}
          <span className="text-xs text-slate-400">{typeConfig.label}</span>
          <span className="text-xs text-slate-400">{itemSummary}</span>
          <span className="text-xs text-slate-400">
            {format(new Date(request.created_at), "MMM d, yyyy")}
          </span>
        </div>
      </div>
      <Select value={request.status} onValueChange={updateStatus}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(REQUEST_STATUS_CONFIG).map(([key, val]) => (
            <SelectItem key={key} value={key}>
              {val.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
