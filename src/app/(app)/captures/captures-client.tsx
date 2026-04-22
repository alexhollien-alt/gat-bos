"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Capture, ParsedIntent } from "@/lib/types";
import { PARSED_INTENT_LABELS } from "@/lib/types";

interface CapturesClientProps {
  initial: Capture[];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function intentBadgeColor(intent: ParsedIntent | null): string {
  switch (intent) {
    case "interaction":
      return "bg-emerald-500/15 text-emerald-400";
    case "follow_up":
      return "bg-sky-500/15 text-sky-400";
    case "ticket":
      return "bg-amber-500/15 text-amber-400";
    case "note":
      return "bg-secondary text-foreground";
    case "unprocessed":
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function CapturesClient({ initial }: CapturesClientProps) {
  const [captures, setCaptures] = useState<Capture[]>(initial);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  async function handleProcess(id: string) {
    if (processing[id]) return;
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/captures/${id}/process`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast.error("Couldn't mark processed", {
          description: err.error ?? "Unknown error",
          position: "top-right",
        });
        return;
      }
      setCaptures((prev) =>
        prev.map((c) => (c.id === id ? { ...c, processed: true } : c))
      );
    } catch (e) {
      toast.error("Couldn't mark processed", {
        description: e instanceof Error ? e.message : "Network error",
        position: "top-right",
      });
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  }

  if (captures.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-secondary/20",
          "px-6 py-12 text-center space-y-3"
        )}
      >
        <div
          className={cn(
            "mx-auto h-10 w-10 rounded-full flex items-center justify-center",
            "bg-[var(--brand-red)]/10 text-[var(--brand-red)]"
          )}
          aria-hidden="true"
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No captures yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Drop one in the bar at the bottom of any page.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {captures.map((c) => {
        const contact = c.contacts;
        const intentLabel = c.parsed_intent
          ? PARSED_INTENT_LABELS[c.parsed_intent]
          : PARSED_INTENT_LABELS.unprocessed;
        return (
          <li
            key={c.id}
            className={cn(
              "rounded-md border border-border bg-card p-4 space-y-2",
              !c.processed && "border-l-2 border-l-[var(--brand-red)]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {c.raw_text}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full font-medium",
                      intentBadgeColor(c.parsed_intent)
                    )}
                  >
                    {intentLabel}
                  </span>
                  {contact ? (
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  ) : null}
                  <span className="text-muted-foreground">
                    {formatTimestamp(c.created_at)}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {c.processed ? (
                  <span className="text-xs text-muted-foreground">
                    processed
                  </span>
                ) : (
                  <button
                    onClick={() => handleProcess(c.id)}
                    disabled={processing[c.id]}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md border border-border",
                      "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {processing[c.id] ? "..." : "Process"}
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
