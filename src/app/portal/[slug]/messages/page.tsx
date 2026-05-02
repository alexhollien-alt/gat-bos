// src/app/portal/[slug]/messages/page.tsx
//
// Slice 7C Task 4d: agent portal messages inbox.
//
// The [slug] layout has already validated the portal session via
// requirePortalSession, so reaching this page guarantees a session whose email
// matches the slug-resolved agent contact. We re-call requirePortalSession to
// receive the typed PortalSession (the layout discards its return value).
// The server-side fetch is deduplicated within a single request.
//
// Data section renders an empty state. The messages_log table is gated by 7B
// account-scoping RLS to the account owner (Alex), so it is unreadable to the
// agent's authenticated session. The portal-read RPC layer
// (get_portal_messages) is logged in BLOCKERS.md and will land in a follow-up
// slice.

import type { Metadata } from "next";
import { requirePortalSession } from "@/lib/auth/requirePortalSession";

export const metadata: Metadata = {
  title: "Messages - Partner Portal",
};

export default async function PortalMessagesPage({
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
          Messages
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Your inbox with Alex
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Email and SMS conversations sent to or about {fullName} will appear
          here for review. Read-only for now; replies still go through your
          regular inbox.
        </p>
      </header>

      <section
        aria-labelledby="recent-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-10"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Recent
        </p>
        <h2
          id="recent-heading"
          className="mt-3 font-display text-xl font-semibold tracking-tight text-zinc-100"
        >
          Inbox is empty
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          When Alex sends an email or text on your behalf, the subject, snippet,
          and timestamp will surface here. You will also receive a copy at your
          regular email address.
        </p>
      </section>

      <section
        aria-labelledby="archive-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-6 py-8"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Archive
        </p>
        <h2
          id="archive-heading"
          className="mt-3 font-display text-lg font-semibold tracking-tight text-zinc-100"
        >
          History will populate here
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A searchable record of past messages, including campaign sends and
          one-off notes, will surface as the portal data feed comes online.
        </p>
      </section>
    </div>
  );
}
