import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildBlastPreview } from "@/lib/open-house/sender";
import { WALL } from "@/lib/open-house/config";
import { ApprovePanel } from "./ApprovePanel";

export const metadata = { title: "Preview Open House Blast" };

export default async function BlastPreviewPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const preview = await buildBlastPreview(params.id);
  if (!preview) notFound();
  if (preview.blast.user_id !== user.id) notFound();

  const { blast, sample, recipientCount, suppressedCount, landingUrl, preflight } = preview;
  const pass = preflight.evaluation.pass;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Preview and send</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {blast.address}, {blast.city} {blast.state ?? ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}
        >
          Preflight: {pass ? "PASS" : "BLOCKED"}
        </span>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_1fr]">
        {/* Email preview */}
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Email preview (subject: {sample.subject})
          </div>
          <iframe
            title="Email preview"
            srcDoc={sample.html}
            className="h-[640px] w-full rounded-lg border border-input bg-white"
          />
          <div className="mt-3 text-sm">
            Landing page:{" "}
            <a href={landingUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {landingUrl}
            </a>
          </div>
        </div>

        {/* Controls + invariants */}
        <div className="space-y-6">
          <div className="rounded-lg border border-input p-5">
            <div className="text-sm text-muted-foreground">Matched recipients</div>
            <div className="font-display text-3xl text-foreground">{recipientCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {suppressedCount} suppressed or invalid excluded automatically
            </div>
          </div>

          <ApprovePanel
            blastId={blast.id}
            recipientCount={recipientCount}
            canSend={pass && recipientCount > 0}
            city={blast.city}
            initialAutoSend={blast.auto_send}
          />

          <div className="rounded-lg border border-input p-5 text-xs text-muted-foreground">
            <div className="mb-2 font-semibold text-foreground">Guardrails (WALL)</div>
            <ul className="space-y-1">
              <li>Complaint ceiling: {(WALL.maxComplaintRate * 100).toFixed(2)}%</li>
              <li>Bounce ceiling: {(WALL.maxBounceRate * 100).toFixed(0)}%</li>
              <li>Sends from the dedicated open house subdomain only</li>
              <li>Batched in 100s, warmup-capped, every message one-click unsubscribe</li>
              <li>Segmented by city, never an unsegmented blob</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preflight report */}
      <details className="mt-8 rounded-lg border border-input p-5">
        <summary className="cursor-pointer text-sm font-semibold">Pre-send checklist</summary>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {preflight.formatted}
        </pre>
      </details>
    </div>
  );
}
