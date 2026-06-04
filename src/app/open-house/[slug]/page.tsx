/* Public open house landing page. Agent-owned, no GAT branding (digital surface).
   Canonical 4-color system + Cal Sans / PT Sans / Italianno, scoped to this
   route via an inline :root block so the page is self-contained. This is the
   click target for the blast email button. */
/* eslint-disable @next/next/no-page-custom-font, @next/next/no-img-element */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";
import { formatBlastDate, formatTimeRange } from "@/lib/open-house/format";

interface PageProps {
  params: { slug: string };
}

interface AgentContact {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  headshot_url: string | null;
}

interface BlastRow {
  id: string;
  slug: string;
  address: string;
  city: string;
  state: string | null;
  price: string | null;
  open_house_date: string;
  open_house_start: string | null;
  open_house_end: string | null;
  details: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photos: string[] | null;
  hero_image_url: string | null;
  status: string;
  agent: AgentContact | null;
}

const VISIBLE_STATUSES = ["preview", "sending", "sent"];

async function getBlast(slug: string): Promise<BlastRow | null> {
  const { data, error } = await adminClient
    .from("open_house_blasts")
    .select(
      "id, slug, address, city, state, price, open_house_date, open_house_start, open_house_end, details, beds, baths, sqft, photos, hero_image_url, status, agent:contacts!agent_contact_id(first_name, last_name, full_name, email, phone, brokerage, headshot_url)",
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[open-house page] lookup failed", error);
    return null;
  }
  return (data as unknown as BlastRow) ?? null;
}

function agentName(a: AgentContact | null): string | null {
  if (!a) return null;
  return a.full_name?.trim() || `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const blast = await getBlast(params.slug);
  if (!blast) return { title: "Open House" };
  const { dateLabel } = formatBlastDate(blast.open_house_date);
  const cityState = [blast.city, blast.state].filter(Boolean).join(", ");
  const title = `${blast.address}, ${blast.city} | Open House ${formatBlastDate(blast.open_house_date).shortDate}`.slice(0, 60);
  const description = `Open house at ${blast.address}, ${cityState} on ${dateLabel}.${blast.price ? ` Offered at ${blast.price}.` : ""} Tour this home with ${agentName(blast.agent) ?? "the listing agent"}.`.slice(0, 160);
  return {
    title,
    description,
    openGraph: {
      title: `Open House: ${blast.address}`,
      description,
      type: "website",
      url: `/open-house/${blast.slug}`,
      images: blast.hero_image_url ? [blast.hero_image_url] : undefined,
    },
  };
}

function buildJsonLd(blast: BlastRow): string {
  const name = agentName(blast.agent);
  const listing: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${blast.address}, ${blast.city}`,
    url: `/open-house/${blast.slug}`,
    image: blast.hero_image_url ?? blast.photos?.[0] ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: blast.address,
      addressLocality: blast.city,
      addressRegion: blast.state ?? "AZ",
    },
    datePosted: blast.open_house_date,
    description: blast.details ?? undefined,
  };
  const agent: Record<string, unknown> | undefined =
    name && blast.agent
      ? {
          "@type": "RealEstateAgent",
          name,
          email: blast.agent.email ?? undefined,
          telephone: blast.agent.phone ?? undefined,
          worksFor: blast.agent.brokerage
            ? { "@type": "Organization", name: blast.agent.brokerage }
            : undefined,
        }
      : undefined;
  return JSON.stringify(agent ? [listing, agent] : listing);
}

export default async function OpenHousePage({ params }: PageProps) {
  const blast = await getBlast(params.slug);
  if (!blast) notFound();
  if (!VISIBLE_STATUSES.includes(blast.status)) notFound();

  const dates = formatBlastDate(blast.open_house_date);
  const timeLabel = formatTimeRange(blast.open_house_start, blast.open_house_end);
  const cityState = [blast.city, blast.state].filter(Boolean).join(", ");
  const name = agentName(blast.agent);
  const hero = blast.hero_image_url ?? blast.photos?.[0] ?? null;
  const gallery = (blast.photos ?? []).filter((p) => p && p !== hero);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${blast.address}, ${cityState}`)}`;

  const specs: Array<{ label: string; value: string }> = [];
  if (blast.beds != null) specs.push({ label: "Beds", value: String(blast.beds) });
  if (blast.baths != null) specs.push({ label: "Baths", value: String(blast.baths) });
  if (blast.sqft != null) specs.push({ label: "Sq Ft", value: blast.sqft.toLocaleString("en-US") });
  if (blast.price) specs.push({ label: "Offered At", value: blast.price });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(blast) }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=Italianno&family=PT+Sans:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        :root {
          --color-ground: #FCFBFB;
          --color-structure: #192A56;
          --color-signal: #F7D794;
          --color-atmosphere: #EDA6A3;
          --font-display: 'Cal Sans', system-ui, sans-serif;
          --font-body: 'PT Sans', system-ui, sans-serif;
          --font-accent: 'Italianno', cursive;
        }
        * { box-sizing: border-box; }
        .oh-main { margin:0; background:var(--color-ground); color:var(--color-structure);
          font-family:var(--font-body); font-size:16px; line-height:1.65; }
        .oh-hero { position:relative; min-height:72vh; display:flex; align-items:flex-end;
          background:var(--color-structure); overflow:hidden; }
        .oh-hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .oh-hero-overlay { position:absolute; inset:0;
          background:linear-gradient(180deg, rgba(25,42,86,0.15) 0%, rgba(25,42,86,0.85) 100%); }
        .oh-hero-inner { position:relative; z-index:2; padding:48px 32px; max-width:1100px;
          margin:0 auto; width:100%; color:var(--color-ground); }
        .oh-eyebrow { font-size:12px; letter-spacing:0.22em; text-transform:uppercase;
          color:var(--color-signal); margin-bottom:14px; }
        .oh-h1 { font-family:var(--font-display); font-size:clamp(34px,6vw,64px); line-height:1.04;
          margin:0 0 10px 0; font-weight:400; }
        .oh-sub { font-size:clamp(15px,2vw,18px); opacity:0.92; margin-bottom:24px; }
        .oh-cta { display:inline-block; background:var(--color-signal); color:var(--color-structure);
          font-weight:700; text-decoration:none; padding:15px 34px; border-radius:6px;
          transition:transform 160ms ease, box-shadow 160ms ease; }
        .oh-cta:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(25,42,86,0.25); }
        .oh-snapshot { display:flex; flex-wrap:wrap; gap:0; max-width:1100px; margin:0 auto;
          padding:0 32px; }
        .oh-stat { flex:1; min-width:140px; padding:28px 12px; text-align:center;
          border-right:1px solid rgba(25,42,86,0.12); }
        .oh-stat:last-child { border-right:0; }
        .oh-stat-v { font-family:var(--font-display); font-size:30px; line-height:1; }
        .oh-stat-l { font-size:12px; letter-spacing:0.14em; text-transform:uppercase;
          opacity:0.65; margin-top:8px; }
        .oh-section { max-width:760px; margin:0 auto; padding:64px 32px; }
        .oh-section-label { font-size:12px; letter-spacing:0.2em; text-transform:uppercase;
          color:var(--color-structure); opacity:0.55; margin-bottom:14px; }
        .oh-section-h { font-family:var(--font-display); font-size:clamp(26px,4vw,38px);
          line-height:1.1; margin:0 0 22px 0; font-weight:400; }
        .oh-detail-card { background:#fff; border:1px solid rgba(25,42,86,0.1); border-radius:10px;
          padding:32px; }
        .oh-when { display:flex; gap:14px; align-items:baseline; flex-wrap:wrap;
          font-size:19px; }
        .oh-when b { font-family:var(--font-display); font-weight:400; }
        .oh-gallery { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .oh-gallery img { width:100%; aspect-ratio:3/2; object-fit:cover; border-radius:8px; display:block; }
        .oh-agent { display:flex; gap:24px; align-items:center; flex-wrap:wrap;
          background:var(--color-structure); color:var(--color-ground); border-radius:12px; padding:32px; }
        .oh-agent-photo { width:104px; height:104px; object-fit:cover; border-radius:50%;
          flex-shrink:0; }
        .oh-agent-name { font-family:var(--font-display); font-size:24px; }
        .oh-agent a { color:var(--color-signal); text-decoration:none; }
        .oh-footer { text-align:center; padding:48px 32px; font-size:12px; opacity:0.6;
          border-top:1px solid rgba(25,42,86,0.12); }
        .oh-compliance { display:flex; gap:18px; justify-content:center; align-items:center;
          margin-bottom:14px; }
        .oh-compliance img { height:30px; width:auto; }
        @media (max-width:560px){ .oh-gallery{ grid-template-columns:1fr; } .oh-stat{ min-width:120px; } }
        @media (prefers-reduced-motion:reduce){ .oh-cta{ transition:none; } }
      `}</style>

      <main className="oh-main">
        {/* 1. HERO */}
        <header className="oh-hero">
          {hero ? <img src={hero} alt={`${blast.address}, ${blast.city}`} /> : null}
          <div className="oh-hero-overlay" />
          <div className="oh-hero-inner">
            <div className="oh-eyebrow">Open House {dates.dateLabel}{timeLabel ? `, ${timeLabel}` : ""}</div>
            <h1 className="oh-h1">{blast.address}</h1>
            <div className="oh-sub">{cityState}{blast.price ? ` · ${blast.price}` : ""}</div>
            <a className="oh-cta" href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Get directions
            </a>
          </div>
        </header>

        {/* 2. SNAPSHOT BAR */}
        {specs.length > 0 ? (
          <section className="oh-snapshot" aria-label="Property snapshot">
            {specs.map((s) => (
              <div className="oh-stat" key={s.label}>
                <div className="oh-stat-v">{s.value}</div>
                <div className="oh-stat-l">{s.label}</div>
              </div>
            ))}
          </section>
        ) : null}

        {/* 3. OPEN HOUSE DETAILS */}
        <section className="oh-section">
          <div className="oh-section-label">The Open House</div>
          <h2 className="oh-section-h">Join us at {blast.address}</h2>
          <div className="oh-detail-card">
            <div className="oh-when">
              <b>{dates.dateLabel}</b>
              {timeLabel ? <span>{timeLabel}</span> : null}
            </div>
            <div style={{ marginTop: 12, opacity: 0.85 }}>{cityState}</div>
            <div style={{ marginTop: 18 }}>
              <a className="oh-cta" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Open in Maps
              </a>
            </div>
          </div>
        </section>

        {/* 4. THE STORY */}
        {blast.details ? (
          <section className="oh-section" style={{ paddingTop: 0 }}>
            <div className="oh-section-label">The Home</div>
            <p style={{ fontSize: 18, lineHeight: 1.75, margin: 0 }}>{blast.details}</p>
          </section>
        ) : null}

        {/* 5. GALLERY */}
        {gallery.length > 0 ? (
          <section className="oh-section" style={{ paddingTop: 0, maxWidth: 1000 }}>
            <div className="oh-gallery">
              {gallery.map((src, i) => (
                <img key={i} src={src} alt={`${blast.address} photo ${i + 2}`} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 6. AGENT CARD */}
        {name ? (
          <section className="oh-section" style={{ paddingTop: 0 }}>
            <div className="oh-agent">
              {blast.agent?.headshot_url ? (
                <img className="oh-agent-photo" src={blast.agent.headshot_url} alt={name} />
              ) : null}
              <div>
                <div className="oh-agent-name">{name}</div>
                {blast.agent?.brokerage ? <div style={{ opacity: 0.85 }}>{blast.agent.brokerage}</div> : null}
                <div style={{ marginTop: 10, display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {blast.agent?.phone ? <a href={`tel:${blast.agent.phone}`}>{blast.agent.phone}</a> : null}
                  {blast.agent?.email ? <a href={`mailto:${blast.agent.email}`}>{blast.agent.email}</a> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* 7. FOOTER (compliance: MLS trio, no GAT on digital) */}
        <footer className="oh-footer">
          <div className="oh-compliance">
            <img src="/email-assets/compliance/mls-realtor-logo.png" alt="MLS Realtor" />
            <img src="/email-assets/compliance/equal-housing-opportunity.png" alt="Equal Housing Opportunity" />
          </div>
          <div>
            {name ? `Presented by ${name}` : "Presented by the listing agent"}
            {blast.agent?.brokerage ? `, ${blast.agent.brokerage}` : ""}
          </div>
        </footer>
      </main>
    </>
  );
}
