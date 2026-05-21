// src/app/portal/[slug]/dashboard/page.tsx
//
// Slice 7C Task 4a + 7C.5: agent portal dashboard.
//
// The [slug] layout has already validated the portal session via
// requirePortalSession, so reaching this page guarantees a session whose email
// matches the slug-resolved agent contact. We re-call requirePortalSession to
// receive the typed PortalSession (the layout discards its return value).
// The server-side fetch is deduplicated within a single request.
//
// Data sections read through the Slice 7C.5 RPC wrappers in
// src/lib/portal/reads.ts. Each RPC is SECURITY DEFINER, scoped via
// auth.jwt() ->> 'email' matched against the slug-resolved agent contact.
// Empty result sets fall back to the original empty-state copy.

import type { Metadata } from "next";
import { requirePortalSession } from "@/lib/auth/requirePortalSession";
import {
  getPortalTouchpoints,
  getPortalMessages,
  getPortalUpcomingEvents,
  type PortalTouchpoint,
  type PortalMessage,
  type PortalUpcomingEvent,
} from "@/lib/portal/reads";

export const metadata: Metadata = {
  title: "Dashboard - Partner Portal",
};

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const DATETIME_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function formatDate(value: string | null, opts: Intl.DateTimeFormatOptions) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, opts);
}

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { agent } = await requirePortalSession(slug);

  const [touchpoints, messages, events] = await Promise.all([
    getPortalTouchpoints(slug),
    getPortalMessages(slug),
    getPortalUpcomingEvents(slug),
  ]);

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
        <TouchpointsCard rows={touchpoints} />
        <MessagesCard rows={messages} />
        <UpcomingEventsCard rows={events} />
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

function TouchpointsCard({ rows }: { rows: PortalTouchpoint[] }) {
  if (rows.length === 0) {
    return (
      <DashboardCard
        eyebrow="Touchpoints"
        title="No recent activity"
        body="Your touchpoint history with Alex will appear here once the portal data feed is live."
      />
    );
  }
  return (
    <DashboardListCard eyebrow="Touchpoints" title="Recent touchpoints">
      {rows.map((row) => {
        const when = formatDate(row.occurred_at ?? row.created_at, DATE_FMT);
        const label = row.touchpoint_type.replace(/_/g, " ");
        return (
          <li key={row.id} className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {when ?? "Pending"} - {label}
            </p>
            {row.project_title ? (
              <p className="text-sm font-medium text-zinc-200">
                {row.project_title}
              </p>
            ) : null}
            {row.note ? (
              <p className="line-clamp-2 text-sm text-zinc-400">{row.note}</p>
            ) : null}
          </li>
        );
      })}
    </DashboardListCard>
  );
}

function MessagesCard({ rows }: { rows: PortalMessage[] }) {
  if (rows.length === 0) {
    return (
      <DashboardCard
        eyebrow="Messages"
        title="Inbox is empty"
        body="Email and SMS conversations sent on your behalf will appear here for review."
      />
    );
  }
  return (
    <DashboardListCard eyebrow="Messages" title="Recent messages">
      {rows.map((row) => {
        const when = formatDate(row.sent_at ?? row.created_at, DATE_FMT);
        return (
          <li key={row.id} className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {when ?? "Pending"} - {row.status}
            </p>
            <p className="text-sm font-medium text-zinc-200">
              {row.template_name ?? "Direct message"}
            </p>
            <p className="text-xs text-zinc-500">{row.recipient_email}</p>
          </li>
        );
      })}
    </DashboardListCard>
  );
}

function UpcomingEventsCard({ rows }: { rows: PortalUpcomingEvent[] }) {
  if (rows.length === 0) {
    return (
      <DashboardCard
        eyebrow="Upcoming events"
        title="Nothing scheduled"
        body="Open houses, broker tours, and client celebrations you are attending will appear here."
      />
    );
  }
  return (
    <DashboardListCard eyebrow="Upcoming events" title="On the calendar">
      {rows.map((row) => {
        const when = formatDate(row.start_at, DATETIME_FMT);
        return (
          <li key={row.id} className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {when ?? "Scheduled"}
              {row.rsvp_status ? ` - ${row.rsvp_status}` : ""}
            </p>
            <p className="text-sm font-medium text-zinc-200">{row.title}</p>
            {row.location ? (
              <p className="text-xs text-zinc-500">{row.location}</p>
            ) : null}
          </li>
        );
      })}
    </DashboardListCard>
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

function DashboardListCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {eyebrow}
      </p>
      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>
      <ul className="mt-4 space-y-4">{children}</ul>
    </article>
  );
}
