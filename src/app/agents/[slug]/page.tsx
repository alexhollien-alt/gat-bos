import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AccentRule, Eyebrow, SectionShell } from "@/components/screen";

type AgentRecord = {
  slug: string;
  name: string;
  brokerage: string;
  title: string;
  specialty: string;
  market: string;
  phone: string | null;
  phoneHref: string | null;
  email: string;
  website: string | null;
  websiteHref: string | null;
  photoUrl: string;
  tagline: string;
  bio: string;
  meta: {
    title: string;
    description: string;
  };
};

// BLOCKER #1: `contacts` table missing slug/photo_url/tagline columns.
// Hardcoding agent records here until a plumbing session lands that migration.
const AGENTS: Record<string, AgentRecord> = {
  "julie-jarmiolowski": {
    slug: "julie-jarmiolowski",
    name: "Julie Jarmiolowski",
    brokerage: "My Home Group -- Kay-Grant Group",
    title: "Real Estate Advisor",
    specialty: "Optima Camelview Village · Old Town Scottsdale",
    market: "Scottsdale · Paradise Valley · Arcadia",
    phone: "(602) 663-5256",
    phoneHref: "tel:+16026635256",
    email: "julie@kay-grant.com",
    website: "kay-grant.com/julie",
    websiteHref: "https://www.kay-grant.com/julie",
    photoUrl: "/agents/julie-jarmiolowski.jpg",
    tagline:
      "Optima Camelview resident and realtor, guiding neighbors through one of the Valley's most architectural addresses.",
    bio: "Scottsdale luxury advisor with a decade focused inside Optima Camelview Village. Julie represents buyers and sellers who want a specialist, not a generalist -- someone who knows which floor lines, tower, and view orientation actually trades, and at what price.",
    meta: {
      title: "Julie Jarmiolowski · Optima Camelview Specialist",
      description:
        "Scottsdale luxury advisor specializing in Optima Camelview Village and Old Town Scottsdale condos. My Home Group (Kay-Grant Group).",
    },
  },
  "fiona-bigbee": {
    slug: "fiona-bigbee",
    name: "Fiona Bigbee",
    brokerage: "Coldwell Banker Realty",
    title: "Real Estate Agent",
    specialty: "North Scottsdale · 85258",
    market: "Scottsdale",
    // BLOCKER #4: Fiona phone + website not in CONTACT.md source.
    phone: null,
    phoneHref: null,
    email: "fiona.bigbee@gmail.com",
    website: null,
    websiteHref: null,
    photoUrl: "/agents/fiona-bigbee.jpg",
    tagline:
      "85258 is my backyard. Your next move starts with the agent who knows every block.",
    bio: "Scottsdale agent with Coldwell Banker Realty, focused on the 85258 zip in North Scottsdale. Fiona runs a direct-mail farming program on her territory, representing buyers and sellers who want a neighborhood specialist paying close attention to one market, its resale patterns, and its pricing rhythm.",
    meta: {
      title: "Fiona Bigbee · North Scottsdale Specialist",
      description:
        "North Scottsdale real estate agent focused on the 85258 zip. Coldwell Banker Realty.",
    },
  },
  "denise-van-den-bossche": {
    slug: "denise-van-den-bossche",
    name: "Denise van den Bossche",
    brokerage: "Realty Executives Arizona Territory -- Exec-Elite",
    title: "Real Estate Advisor",
    specialty: "Paradise Valley · Scottsdale · Arcadia",
    market: "Paradise Valley · Scottsdale · Arcadia",
    // BLOCKER #4: Denise phone + website not in CONTACT.md source.
    phone: null,
    phoneHref: null,
    email: "denisevdb@exec-elite.com",
    website: null,
    websiteHref: null,
    photoUrl: "/agents/denise-van-den-bossche.jpg",
    tagline:
      "Paradise Valley and Scottsdale, handled quietly. Discretion is the service.",
    bio: "Paradise Valley and Scottsdale advisor with the Exec-Elite team at Realty Executives Arizona Territory. Denise represents sellers who need discrete, tailored marketing and buyers who want a long view on neighborhood-specific trades. Partnered with Norm Hampton on select listings.",
    meta: {
      title: "Denise van den Bossche · Paradise Valley + Scottsdale Advisor",
      description:
        "Paradise Valley and Scottsdale real estate advisor with the Exec-Elite team at Realty Executives Arizona Territory.",
    },
  },
};

export function generateStaticParams() {
  return Object.keys(AGENTS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = AGENTS[slug];
  if (!agent) return {};
  return {
    title: agent.meta.title,
    description: agent.meta.description,
    openGraph: {
      title: agent.meta.title,
      description: agent.meta.description,
      images: [agent.photoUrl],
    },
  };
}

export default async function AgentLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = AGENTS[slug];
  if (!agent) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: agent.name,
    jobTitle: agent.title,
    worksFor: { "@type": "Organization", name: agent.brokerage },
    areaServed: agent.market,
    telephone: agent.phone,
    email: agent.email,
    url: agent.websiteHref,
    image: agent.photoUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO */}
      <SectionShell padY="md" className="pt-12 sm:pt-16">
        <div className="flex flex-col sm:flex-row items-stretch gap-10">
          <div className="flex-shrink-0 w-full sm:w-[280px] relative">
            <div className="h-[320px] sm:h-[380px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agent.photoUrl}
                alt={agent.name}
                className="h-full w-full object-cover object-top headshot-mask-hero"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <Eyebrow tone="crimson" className="text-[10px] tracking-[0.3em] opacity-80 mb-4">
              {agent.specialty}
            </Eyebrow>
            <h1 className="font-display text-[34px] sm:text-[52px] text-white leading-[1.05] tracking-[-0.02em] mb-5">
              {agent.name}
            </h1>
            <p className="font-sans text-[14px] sm:text-[15px] text-white/30 leading-[1.75] max-w-xl mb-6">
              {agent.tagline}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--accent-red)]/70 font-semibold">
                {agent.title}
              </p>
              <span className="text-white/10 text-[8px]">&bull;</span>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">
                {agent.market}
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <AccentRule variant="primary" />

      {/* ABOUT */}
      <SectionShell padY="md" maxWidth="container-narrow">
        <div className="max-w-2xl">
          <Eyebrow tone="muted" className="mb-4">
            About {agent.name.split(" ")[0]}
          </Eyebrow>
          <p className="font-sans text-[16px] sm:text-[17px] text-white/70 leading-[1.7]">
            {agent.bio}
          </p>
        </div>
      </SectionShell>

      {/* GALLERY placeholder -- BLOCKER: no Julie-specific portfolio assets in /public/portfolio/ yet */}
      <SectionShell padY="md">
        <Eyebrow tone="muted" className="mb-6">
          Recent Work
        </Eyebrow>
        <div className="rounded-xl border border-white/[0.06] bg-[var(--surface-raised)]/40 px-6 py-10 text-center">
          <p className="font-sans text-[13px] text-[var(--text-muted)]">
            Current listings and recently closed transactions will appear here.
          </p>
        </div>
      </SectionShell>

      {/* CONTACT */}
      <SectionShell padY="md">
        <div className="rounded-2xl border border-white/[0.06] bg-[var(--surface-raised)]/60 p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <Eyebrow tone="crimson" className="mb-3">
                Work with {agent.name.split(" ")[0]}
              </Eyebrow>
              <h2 className="font-display text-[26px] sm:text-[32px] text-white leading-[1.15] tracking-[-0.015em]">
                {agent.brokerage}
              </h2>
            </div>
            <div className="flex flex-col gap-1.5">
              {agent.phone && agent.phoneHref && (
                <a
                  href={agent.phoneHref}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
                >
                  {agent.phone}
                </a>
              )}
              <a
                href={`mailto:${agent.email}`}
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
              >
                {agent.email}
              </a>
              {agent.website && agent.websiteHref && (
                <a
                  href={agent.websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
                >
                  {agent.website}
                </a>
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      {/* REFERRAL FOOTER -- Option B (agent-forward) */}
      <SectionShell padY="md">
        <div className="border-t border-white/[0.06] pt-10">
          <div className="max-w-3xl">
            <Eyebrow tone="muted" className="mb-4">
              Title Partner
            </Eyebrow>
            <p className="font-display text-[22px] sm:text-[28px] text-white/80 leading-[1.3] tracking-[-0.01em] mb-6">
              The transaction {agent.name.split(" ")[0]} promises her clients is the transaction they experience -- because her title partner is part of the team, not a vendor.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-sans text-[13px] text-white/50">
                Alex Hollien
              </p>
              <span className="text-white/15 text-[8px]">&bull;</span>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Title Sales Executive, Great American Title
              </p>
              <span className="text-white/15 text-[8px]">&bull;</span>
              <a
                href="tel:+14802042983"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[color:var(--accent-red)] transition-colors"
              >
                (480) 204-2983
              </a>
            </div>
          </div>
        </div>
      </SectionShell>
    </>
  );
}

// Remaining placeholders (logged to BLOCKERS.md):
// - Fiona + Denise phone/website fields null; CONTACT.md source does not have them  (Blocker #4)
// - contacts table slug/photo_url/tagline columns TBD; agent records hardcoded until migration lands  (Blocker #1)
