"use client";

import type { Commitment } from "@/lib/spine/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface OverdueCommitmentsSectionProps {
  commitments: Commitment[];
}

export function OverdueCommitmentsSection({
  commitments,
}: OverdueCommitmentsSectionProps) {
  if (commitments.length === 0) {
    return (
      <section role="region" aria-label="Overdue commitments">
        <SectionHeader count={0} />
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No overdue commitments. You are caught up.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section role="region" aria-label="Overdue commitments">
      <SectionHeader count={commitments.length} />
      <div className="space-y-2">
        {commitments.map((c) => (
          <CommitmentRow key={c.id} commitment={c} />
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <AlertCircle className="h-4 w-4 text-red-500" />
      <h2
        className="text-lg font-semibold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Overdue Commitments
      </h2>
      {count > 0 && (
        <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
          {count}
        </span>
      )}
    </div>
  );
}

function CommitmentRow({ commitment }: { commitment: Commitment }) {
  const overdue = commitment.due_at
    ? formatDistanceToNowStrict(new Date(commitment.due_at), {
        addSuffix: true,
      })
    : "no due date";

  const kindLabel = commitment.kind
    ? commitment.kind.charAt(0).toUpperCase() + commitment.kind.slice(1)
    : "Task";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-white/[0.12] transition-colors">
      <button
        className="shrink-0 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-green-500 transition-colors"
        aria-label={`Mark "${commitment.title}" as done`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{commitment.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-muted-foreground">
            {kindLabel}
          </span>
          <span className="text-xs text-red-400 font-mono">
            Due {overdue}
          </span>
        </div>
      </div>
    </div>
  );
}
