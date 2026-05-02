// src/app/portal/[slug]/dashboard/page.tsx
//
// Slice 7C Task 4a: agent portal dashboard.
//
// The [slug] layout has already validated the portal session via
// requirePortalSession, so reaching this page guarantees a session whose email
// matches the slug-resolved agent contact. We re-call requirePortalSession to
// receive the typed PortalSession (the layout discards its return value).
// The server-side fetch is deduplicated within a single request.
//
// Data sections (touchpoints, messages, upcoming events) render as empty
// states. Account-scoped tables (project_touchpoints, messages_log, events)
// are gated by 7B RLS to the account owner (Alex), so they are unreadable to
// the agent's authenticated session. The portal-read RPC layer is logged in
// BLOCKERS.md and will land in a follow-up slice.

import type { Metadata } from "next";
import { requirePortalSession } from "@/lib/auth/requirePortalSession";

export const metadata: Metadata = {
  title: "Dashboard - Partner Portal",
};

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { agent } = await requirePortalSession(slug);

  const fullName = `${agent.first_name} ${agent.last_name}`.trim();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Welcome back
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          {fullName}
        </h1>
        {agent.brokerage ? (
          <p className="text-sm text-zinc-400">{agent.brokerage}</p>
        ) : null}
        {agent.tagline ? (
          <p className="max-w-2xl text-base leading-relaxed text-zinc-300">
            {agent.tagline}
          </p>
        ) : null}
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          eyebrow="Touchpoints"
          title="No recent activity"
          body="Your touchpoint history with Alex will appear here once the portal data feed is live."
        />
        <DashboardCard
          eyebrow="Messages"
          title="Inbox is empty"
          body="Email and SMS conversations sent on your behalf will appear here for review."
        />
        <DashboardCard
          eyebrow="Upcoming events"
          title="Nothing scheduled"
          body="Open houses, broker tours, and client celebrations you are attending will appear here."
        />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-6 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Need something?
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-zinc-100">
          Submit a marketing request
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Use the request form to brief Alex on a new flyer, postcard, email, or
          listing campaign. Requests route directly into his production queue.
        </p>
      </section>
    </div>
  );
}

function DashboardCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {eyebrow}
      </p>
      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </article>
  );
}
