// src/components/inbox/inbox-row.tsx
"use client";

import type { InboxItem } from "@/lib/inbox/types";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const RULE_LABELS: Record<string, string> = {
  direct_question: "Question",
  deliverable_request: "Request",
  escalation_language: "Urgent",
  cold_contact: "New contact",
};

const TIER_COLORS: Record<string, string> = {
  A: "text-red-500",
  B: "text-orange-500",
  C: "text-muted-foreground",
  P: "text-muted-foreground",
};

interface InboxRowProps {
  item: InboxItem;
  onDismiss: (id: string) => void;
  onMarkReplied: (id: string) => void;
  isMutating: boolean;
}

export function InboxRow({ item, onDismiss, onMarkReplied, isMutating }: InboxRowProps) {
  return (
    <div
      role="listitem"
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border border-border bg-card",
        "hover:border-foreground/20 transition-colors",
        isMutating && "opacity-50 pointer-events-none"
      )}
    >
      {/* Score badge */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
        <span className="text-xs font-mono font-medium text-foreground">{item.score}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {item.sender_name || item.sender_email}
          </span>
          {item.contact_tier && (
            <span className={cn("text-xs font-mono", TIER_COLORS[item.contact_tier] ?? "text-muted-foreground")}>
              {item.contact_tier}
            </span>
          )}
          {!item.contact_id && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Unknown
            </span>
          )}
        </div>
        <p className="text-sm text-foreground truncate mb-1">{item.subject}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.snippet}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {item.matched_rules.map((rule) => (
            <span
              key={rule}
              className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium"
            >
              {RULE_LABELS[rule] ?? rule}
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground ml-auto font-mono">
            {formatDistanceToNow(new Date(item.received_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1">
        <button
          onClick={() => onMarkReplied(item.id)}
          title="Mark replied"
          aria-label="Mark as replied"
          disabled={isMutating}
          className="p-1.5 rounded text-muted-foreground hover:text-green-500 hover:bg-secondary transition-colors"
        >
          <CheckCircle className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDismiss(item.id)}
          title="Dismiss"
          aria-label="Dismiss thread"
          disabled={isMutating}
          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-secondary transition-colors"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
