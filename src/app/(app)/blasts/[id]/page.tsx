import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBlast, landingUrlFor } from "@/lib/open-house/sender";
import { getBlastStats } from "@/lib/open-house/queries";
import { WALL } from "@/lib/open-house/config";

export const metadata = { title: "Open House Blast" };

function pct(n: number): string {
  return `${(n * 100).toFixed(n < 0.01 && n > 0 ? 2 : 1)}%`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-input p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`font-display text-3xl ${tone === "warn" ? "text-red-600" : "text-foreground"}`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default async function BlastDashboardPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const blast = await loadBlast(params.id);
  if (!blast) notFound();
  if (blast.user_id !== user.id) notFound();

  const stats = await getBlastStats(params.id);
  const landingUrl = landingUrlFor(blast.slug);

  const bounceOver = stats.bounceRate > WALL.maxBounceRate;
  const complaintOver = stats.complaintRate > WALL.maxComplaintRate;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">{blast.address}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {blast.city}
            {blast.state ? `, ${blast.state}` : ""} {" · "} status: {blast.status}
            {blast.sent_at ? ` · sent ${new Date(blast.sent_at).toLocaleString()}` : ""}
          </p>
        </div>
        <a
          href={`/blasts/${blast.id}/preview`}
          className="rounded-md border border-input px-3 py-1.5 text-sm"
        >
          Preview
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Recipients" value={String(blast.recipient_count ?? stats.total)} sub={`${stats.queued} queued, ${stats.failed} failed`} />
        <Kpi label="Delivered" value={String(stats.delivered)} sub={`${pct(stats.deliveredRate)} of dispatched`} />
        <Kpi label="Opens" value={String(stats.opened)} sub={`${pct(stats.openRate)} of delivered`} />
        <Kpi label="Clicks" value={String(stats.clicked)} sub={`${pct(stats.clickRate)} of delivered`} />
        <Kpi
          label="Bounce rate"
          value={pct(stats.bounceRate)}
          sub={`limit ${pct(WALL.maxBounceRate)}`}
          tone={bounceOver ? "warn" : "ok"}
        />
        <Kpi
          label="Complaint rate"
          value={pct(stats.complaintRate)}
          sub={`limit ${pct(WALL.maxComplaintRate)}`}
          tone={complaintOver ? "warn" : "ok"}
        />
      </div>

      <div className="mt-6 rounded-lg border border-input p-5 text-sm">
        <div className="font-semibold text-foreground">Guardrail status</div>
        <div className={`mt-2 ${bounceOver ? "text-red-600" : "text-emerald-700"}`}>
          {bounceOver ? "Bounce rate OVER the 4% wall" : "Bounce rate within the 4% wall"}
        </div>
        <div className={complaintOver ? "text-red-600" : "text-emerald-700"}>
          {complaintOver
            ? "Complaint rate OVER the 0.08% wall"
            : "Complaint rate within the 0.08% wall"}
        </div>
      </div>

      <div className="mt-6 text-sm">
        Landing page:{" "}
        <a href={landingUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {landingUrl}
        </a>
      </div>
    </div>
  );
}
