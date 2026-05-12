// Phase 5 of ~/.claude/plans/idempotent-toasting-tome.md
// Public read-only agent portal. URL is the auth: whoever holds the token
// gets the agent's last 5 deliverables + open transactions.
//
// Middleware bypasses /agent/* (see src/middleware.ts). Server component;
// service-role client used inside getAgentPortalData. Mobile-first layout
// at 375px and up, matches the Partner Portal aesthetic.

import { notFound } from "next/navigation";
import {
  getAgentPortalData,
  type AgentPortalData,
  type OpenTransaction,
} from "@/lib/portal/agent-portal-queries";
import type { ActivityEvent } from "@/lib/activity/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AgentPortalPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getAgentPortalData(token);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Great American Title
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <Hero contact={data.contact} />
        <Section title="Open Transactions">
          {data.openTransactions.length === 0 ? (
            <EmptyRow label="No active transactions on the books." />
          ) : (
            <ul className="space-y-3">
              {data.openTransactions.map((tx) => (
                <TransactionRow key={tx.opportunity_id} tx={tx} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent Deliverables">
          {data.deliverables.length === 0 ? (
            <EmptyRow label="No deliverables shipped yet." />
          ) : (
            <ul className="space-y-3">
              {data.deliverables.map((evt) => (
                <DeliverableRow key={evt.id} evt={evt} />
              ))}
            </ul>
          )}
        </Section>
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-3xl px-5 py-6 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:px-6">
          Powered by Great American Title Agency
        </div>
      </footer>
    </div>
  );
}

function Hero({ contact }: { contact: AgentPortalData["contact"] }) {
  const displayName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Agent";
  return (
    <div className="mb-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        Partner Snapshot
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
        {displayName}
      </h1>
      {contact.brokerage && (
        <p className="mt-2 text-sm text-zinc-400">{contact.brokerage}</p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
      {label}
    </div>
  );
}

function TransactionRow({ tx }: { tx: OpenTransaction }) {
  const stageLabel = STAGE_LABELS[tx.stage] ?? tx.stage.replace(/_/g, " ");
  const salePrice = typeof tx.context.sale_price === "number"
    ? formatCurrency(tx.context.sale_price)
    : null;
  const closeDate = typeof tx.context.scheduled_close_date === "string"
    ? tx.context.scheduled_close_date
    : null;
  return (
    <li className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-base font-medium text-zinc-100">
          {stageLabel}
        </span>
        {salePrice && (
          <span className="font-mono text-sm text-zinc-300">{salePrice}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {closeDate && <span>Closing {closeDate}</span>}
        <span>Updated {formatRelative(tx.last_event_at)}</span>
      </div>
    </li>
  );
}

function DeliverableRow({ evt }: { evt: ActivityEvent }) {
  const format = typeof evt.context.format === "string"
    ? evt.context.format
    : "deliverable";
  const skill = typeof evt.context.skill === "string"
    ? evt.context.skill
    : null;
  const projectContext = typeof evt.context.project_context === "string"
    ? evt.context.project_context
    : null;
  return (
    <li className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-base font-medium capitalize text-zinc-100">
          {format}
        </span>
        <span className="font-mono text-xs text-zinc-500">
          {formatRelative(evt.occurred_at)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {projectContext && <span>{projectContext}</span>}
        {skill && <span className="font-mono">{skill}</span>}
      </div>
    </li>
  );
}

const STAGE_LABELS: Record<string, string> = {
  opened: "Prospect opened",
  under_contract: "Under contract",
  in_escrow: "In escrow",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}
