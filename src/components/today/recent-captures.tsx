"use client";

import type { TodayPayloadT } from "@/lib/spine/types";
import { Inbox } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

type CaptureItem = TodayPayloadT["recent_captures"][number];

interface RecentCapturesSectionProps {
  captures: CaptureItem[];
}

export function RecentCapturesSection({
  captures,
}: RecentCapturesSectionProps) {
  return (
    <section role="region" aria-label="Recent captures">
      <div className="flex items-center gap-3 mb-3">
        <Inbox className="h-4 w-4 text-purple-500" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Recent Captures
        </h2>
        {captures.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {captures.length}
          </span>
        )}
      </div>

      {captures.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No recent captures. Use the capture bar or voice memo to add items.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {captures.map((c) => (
            <CaptureRow key={c.id} capture={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function CaptureRow({ capture }: { capture: CaptureItem }) {
  const age = capture.captured_at
    ? formatDistanceToNowStrict(new Date(capture.captured_at), {
        addSuffix: true,
      })
    : "";

  const preview =
    capture.raw_text && capture.raw_text.length > 120
      ? capture.raw_text.slice(0, 120) + "..."
      : capture.raw_text ?? "";

  const parsed = capture.parsed ?? false;

  return (
    <div className="rounded-lg border border-border p-3 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{preview || "(empty)"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono text-muted-foreground">
              {capture.source}
            </span>
            {age && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {age}
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded ${
            parsed
              ? "bg-green-500/10 text-green-400"
              : "bg-yellow-500/10 text-yellow-400"
          }`}
        >
          {parsed ? "parsed" : "pending"}
        </span>
      </div>
    </div>
  );
}
