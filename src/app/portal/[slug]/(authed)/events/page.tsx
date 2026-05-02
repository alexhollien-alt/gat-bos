// src/app/portal/[slug]/events/page.tsx
//
// Slice 7C Task 4c: agent portal events list.
//
// The [slug] layout has already validated the portal session via
// requirePortalSession, so reaching this page guarantees a session whose email
// matches the slug-resolved agent contact. We re-call requirePortalSession to
// receive the typed PortalSession (the layout discards its return value).
// The server-side fetch is deduplicated within a single request.
//
// Data section renders an empty state. The events table (and the
// event_attendees join) is gated by 7B account-scoping RLS to the account
// owner (Alex), so it is unreadable to the agent's authenticated session.
// The portal-read RPC layer (get_portal_upcoming_events) is logged in
// BLOCKERS.md and will land in a follow-up slice.

import type { Metadata } from "next";
import { requirePortalSession } from "@/lib/auth/requirePortalSession";

export const metadata: Metadata = {
  title: "Events - Partner Portal",
};

export default async function PortalEventsPage({
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
          Upcoming events
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Your calendar with Alex
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Open houses, broker tours, client celebrations, and partner events
          you are attending will appear here for {fullName}.
        </p>
      </header>

      <section
        aria-labelledby="upcoming-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-10"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Upcoming
        </p>
        <h2
          id="upcoming-heading"
          className="mt-3 font-display text-xl font-semibold tracking-tight text-zinc-100"
        >
          Nothing scheduled
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Once an event is on the books, the date, location, and your role will
          appear here. You will also receive an email confirmation any time
          Alex adds you as an attendee.
        </p>
      </section>

      <section
        aria-labelledby="past-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-6 py-8"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Past events
        </p>
        <h2
          id="past-heading"
          className="mt-3 font-display text-lg font-semibold tracking-tight text-zinc-100"
        >
          History will populate here
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A record of past events you attended with Alex, including notes and
          follow-ups, will surface as the portal data feed comes online.
        </p>
      </section>
    </div>
  );
}
