"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { RefreshCw, Sunrise } from "lucide-react";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

interface MorningBriefResponse {
  brief_date: string;
  generated_at: string;
  brief_text: string;
  brief_json: unknown;
  model: string;
  contacts_scored: number;
}

type Loaded = { kind: "loaded"; data: MorningBriefResponse };
type Empty = { kind: "empty" };
type LatestPayload = Loaded | Empty;

function formatBriefDate(briefDate: string): string {
  // brief_date is YYYY-MM-DD in MST. Parse as local-naive date so the
  // displayed weekday matches Phoenix wall-clock instead of UTC drift.
  const [y, m, d] = briefDate.split("-").map((part) => Number(part));
  if (!y || !m || !d) return briefDate;
  return format(new Date(y, m - 1, d), "EEEE, MMMM d, yyyy");
}

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Phoenix",
});

export function MorningClient() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<LatestPayload>({
    queryKey: ["morning", "latest"],
    queryFn: async () => {
      const res = await fetch("/api/morning/latest");
      if (res.status === 404) {
        return { kind: "empty" };
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({ error: "Failed to load brief" }))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to load brief");
      }
      const json = (await res.json()) as MorningBriefResponse;
      return { kind: "loaded", data: json };
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["morning"] });
  };

  const subhead =
    data?.kind === "loaded" ? (
      <span className="font-mono tracking-wide">{formatBriefDate(data.data.brief_date)}</span>
    ) : null;

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-5xl mx-0">
      <PageHeader
        eyebrow="Pre-coffee"
        title="Morning Brief"
        subhead={subhead}
        right={
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            aria-label="Refresh morning brief"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <section
        role="region"
        aria-label="Morning brief"
        className="rounded-lg border border-border bg-card/40 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Sunrise className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Today&apos;s read
          </h2>
        </div>

        {isLoading ? (
          <BriefSkeleton />
        ) : error ? (
          <p className="font-mono text-xs uppercase tracking-wider text-destructive">
            {error instanceof Error ? error.message : "Failed to load brief"}
          </p>
        ) : !data || data.kind === "empty" ? (
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            No brief yet for today. Cron runs at 5:30am MST.
          </p>
        ) : (
          <BriefBody payload={data.data} />
        )}
      </section>
    </SectionShell>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-4 w-1/3 rounded bg-secondary/60 animate-pulse" />
      <div className="h-3 w-full rounded bg-secondary/40 animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-secondary/40 animate-pulse" />
      <div className="h-3 w-4/6 rounded bg-secondary/40 animate-pulse" />
      <div className="h-4 w-1/4 rounded bg-secondary/60 animate-pulse mt-6" />
      <div className="h-3 w-full rounded bg-secondary/40 animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-secondary/40 animate-pulse" />
    </div>
  );
}

function BriefBody({ payload }: { payload: MorningBriefResponse }) {
  const generatedLabel = `${TIME_FORMATTER.format(parseISO(payload.generated_at))} MST`;

  return (
    <div className="space-y-4">
      <pre className="font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {payload.brief_text}
      </pre>
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Generated {generatedLabel}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          · {payload.contacts_scored} contacts scored
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          · {payload.model}
        </span>
      </div>
    </div>
  );
}
