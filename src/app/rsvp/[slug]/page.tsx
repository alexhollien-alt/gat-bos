/* eslint-disable no-restricted-syntax -- public RSVP page uses a one-off
   organic-luxe marketing palette (bone/desert/terracotta) intentionally
   divergent from the CRM design system. Color values are scoped to this
   route only and never feed into shared components. */
/* eslint-disable @next/next/no-page-custom-font -- Cormorant Garamond is
   loaded inline for this standalone guest-facing marketing surface and not
   used elsewhere in the app. */
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { RSVPForm } from "./RSVPForm";
import type { Metadata } from "next";

interface PageProps {
  params: { slug: string };
}

interface HostContact {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
}

interface PublicEventRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  address: string | null;
  event_start: string;
  event_end: string;
  hero_image_url: string | null;
  intro_copy: string | null;
  status: string;
  timezone: string;
  host_contact_id: string | null;
  host: HostContact | null;
}

async function getEvent(slug: string): Promise<PublicEventRow | null> {
  const { data, error } = await adminClient
    .from("public_events")
    .select(
      "id, slug, title, subtitle, address, event_start, event_end, hero_image_url, intro_copy, status, timezone, host_contact_id, host:contacts!host_contact_id(id, first_name, last_name, full_name, email, phone, brokerage)",
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[rsvp page] event lookup failed", error);
    return null;
  }
  return (data as unknown as PublicEventRow) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event) return { title: "RSVP" };
  return {
    title: `${event.title} -- RSVP`,
    description: event.subtitle ?? "A private broker preview. Reserve your spot.",
    openGraph: {
      title: event.title,
      description: event.subtitle ?? undefined,
      images: event.hero_image_url ? [event.hero_image_url] : undefined,
    },
  };
}

function formatDateLine(iso: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Phoenix",
  };
  const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d);
  const weekday =
    parts.find((p) => p.type === "weekday")?.value.toUpperCase() ?? "";
  const month =
    parts.find((p) => p.type === "month")?.value.toUpperCase() ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${weekday}, ${month} ${day}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Phoenix",
        hour12: true,
      })
      .replace(":00", "")
      .replace(/\s?(AM|PM)/i, (m) => m.trim().toUpperCase());
  };
  return `${fmt(startIso)} TO ${fmt(endIso)}`;
}

function buildEventJsonLd(event: PublicEventRow): string {
  const host = event.host;
  const hostName =
    host?.full_name?.trim() ||
    (host ? `${host.first_name} ${host.last_name}`.trim() : null);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.subtitle ?? event.intro_copy ?? undefined,
    startDate: event.event_start,
    endDate: event.event_end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.address
      ? {
          "@type": "Place",
          name: event.title,
          address: {
            "@type": "PostalAddress",
            streetAddress: event.address,
          },
        }
      : undefined,
    image: event.hero_image_url ?? undefined,
    organizer:
      hostName && host?.email
        ? {
            "@type": "Person",
            name: hostName,
            email: host.email,
          }
        : undefined,
  };
  return JSON.stringify(jsonLd);
}

export default async function RSVPPage({ params }: PageProps) {
  const event = await getEvent(params.slug);
  if (!event) notFound();
  if (event.status !== "live" && event.status !== "closed") notFound();

  const isClosed = event.status === "closed";
  const dateLine = formatDateLine(event.event_start);
  const timeLine = formatTimeRange(event.event_start, event.event_end);

  const host = event.host;
  const hostFirstName = host?.first_name ?? "your host";
  const hostFullName =
    host?.full_name?.trim() ||
    (host ? `${host.first_name} ${host.last_name}`.trim() : null);
  const hostEmail = host?.email ?? null;
  const hostBrokerage = host?.brokerage ?? null;

  const bone = "#F5F0E8";
  const ink = "#1F1B16";
  const accent = "#9B6B4A";

  return (
    <>
      {/* JSON-LD Event schema (Standing Rule 11) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildEventJsonLd(event) }}
      />

      {/* Google Fonts loaded inline for this public page. The CRM app font
          stack is Inter/Syne/Space Mono; RSVP page is a guest-facing
          marketing surface and intentionally diverges. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
        rel="stylesheet"
      />

      <main
        style={{
          background: bone,
          color: ink,
          minHeight: "100vh",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 15,
          lineHeight: 1.7,
          margin: 0,
          padding: 0,
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "0 0 80px 0",
          }}
        >
          {/* Hero photo */}
          {event.hero_image_url ? (
            <div style={{ width: "100%", aspectRatio: "3 / 2", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.hero_image_url}
                alt={event.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "3 / 2",
                background: `linear-gradient(135deg, ${ink} 0%, ${accent} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: bone,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontStyle: "italic",
                fontSize: 22,
                letterSpacing: "0.04em",
              }}
            >
              {/* PLACEHOLDER: hero image URL once Berneil photo is selected. */}
              Hero photo coming soon
            </div>
          )}

          {/* Eyebrow */}
          <div
            style={{
              padding: "40px 32px 8px 32px",
              textAlign: "center",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(31,27,22,0.7)",
              fontWeight: 600,
            }}
          >
            Broker Open
          </div>

          {/* Address with flanking rules. Rules render on >=560px viewports;
              on narrow mobile the address takes full row width and the rules
              hide so the address stays legible without clipping. */}
          <div
            className="rsvp-address-row"
            style={{
              padding: "0 24px 24px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span
              aria-hidden
              className="rsvp-address-rule"
              style={{
                flex: 1,
                height: 1,
                background: "rgba(155,107,74,0.4)",
                maxWidth: 80,
              }}
            />
            <span
              className="rsvp-address-text"
              style={{
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(31,27,22,0.85)",
                textAlign: "center",
              }}
            >
              {event.address ?? "[PLACEHOLDER: address]"}
            </span>
            <span
              aria-hidden
              className="rsvp-address-rule"
              style={{
                flex: 1,
                height: 1,
                background: "rgba(155,107,74,0.4)",
                maxWidth: 80,
              }}
            />
          </div>
          <style>{`
            @media (max-width: 559px) {
              .rsvp-address-rule { display: none; }
              .rsvp-address-text { font-size: 11px; letter-spacing: 0.1em; }
            }
          `}</style>

          {/* Event headline (Cormorant italic) */}
          <h1
            style={{
              margin: 0,
              padding: "0 32px 8px 32px",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(32px, 6vw, 44px)",
              lineHeight: 1.1,
              textAlign: "center",
              color: ink,
            }}
          >
            {event.title}
          </h1>

          {event.subtitle ? (
            <div
              style={{
                padding: "0 32px 24px 32px",
                textAlign: "center",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "rgba(31,27,22,0.7)",
              }}
            >
              {event.subtitle}
            </div>
          ) : null}

          {/* Date / time */}
          <div
            style={{
              padding: "16px 32px 32px 32px",
              textAlign: "center",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: 26,
              letterSpacing: "0.02em",
              color: ink,
            }}
          >
            {dateLine} <span style={{ color: accent, margin: "0 4px" }}>·</span>{" "}
            {timeLine}
          </div>

          {/* Intro copy */}
          {event.intro_copy ? (
            <p
              style={{
                margin: 0,
                padding: "0 32px 40px 32px",
                textAlign: "center",
                fontSize: 16,
                lineHeight: 1.7,
                color: "rgba(31,27,22,0.85)",
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {event.intro_copy}
            </p>
          ) : null}

          {/* Form or closed notice */}
          <div style={{ padding: "0 32px" }}>
            {isClosed ? (
              <div
                style={{
                  padding: "32px 24px",
                  background: "rgba(31,27,22,0.04)",
                  border: "1px solid rgba(31,27,22,0.12)",
                  textAlign: "center",
                  fontSize: 14,
                  color: "rgba(31,27,22,0.7)",
                }}
              >
                RSVP closed for this event. Reach out directly if you&apos;d
                still like to attend.
              </div>
            ) : (
              <RSVPForm
                slug={event.slug}
                eventTitle={event.title}
                hostFirstName={hostFirstName}
              />
            )}
          </div>

          {/* Footer -- host metadata bound to joined contacts row */}
          <footer
            style={{
              marginTop: 64,
              padding: "32px",
              borderTop: "1px solid rgba(31,27,22,0.12)",
              textAlign: "center",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(31,27,22,0.6)",
            }}
          >
            {hostBrokerage ? (
              <div style={{ marginBottom: 8 }}>{hostBrokerage}</div>
            ) : null}
            {hostFullName ? (
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 14,
                  textTransform: "none",
                  letterSpacing: "0.02em",
                  color: "rgba(31,27,22,0.7)",
                }}
              >
                {hostFullName}
              </div>
            ) : null}
            {hostEmail ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "none",
                  color: "rgba(31,27,22,0.6)",
                }}
              >
                <a
                  href={`mailto:${hostEmail}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {hostEmail}
                </a>
              </div>
            ) : null}
          </footer>
        </div>
      </main>
    </>
  );
}

// Remaining placeholders in this file:
//   - Hero image URL (event.hero_image_url) -- empty until Berneil hero photo
//     is selected and uploaded.
