import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient as createSupabaseAnonClient } from "@supabase/supabase-js";
import { AccentRule, Eyebrow, SectionShell } from "@/components/screen";

type AgentRow = {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  title: string | null;
  brokerage: string | null;
  headshot_url: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
};

// Anon-only client for the public /agents/[slug] route. The RPCs are
// SECURITY DEFINER + GRANT EXECUTE TO anon (per Slice 7B Task 5), so this
// path bypasses Supabase auth cookies. Direct SELECT on `contacts` would be
// denied by account-scoped RLS; the RPCs are the only public read surface.
function publicSupabase() {
  return createSupabaseAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function fetchAgentBySlug(slug: string): Promise<AgentRow | null> {
  const supabase = publicSupabase();
  const { data, error } = await supabase.rpc("get_public_agent_by_slug", {
    p_slug: slug,
  });
  if (error || !data) return null;
  const rows = data as AgentRow[];
  return rows.length > 0 ? rows[0] : null;
}

function fullName(row: AgentRow): string {
  return `${row.first_name} ${row.last_name}`.trim();
}

function phoneHref(phone: string | null): string | null {
  if (!phone) return null;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function websiteHref(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function websiteLabel(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export async function generateStaticParams() {
  const supabase = publicSupabase();
  const { data, error } = await supabase.rpc("get_public_agent_slugs");
  if (error || !data) return [];
  return (data as { slug: string }[]).map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = await fetchAgentBySlug(slug);
  if (!agent) return {};
  const name = fullName(agent);
  const title = agent.title ? `${name} · ${agent.title}` : name;
  const description =
    agent.tagline ??
    (agent.brokerage ? `${name}, ${agent.brokerage}.` : name);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: agent.headshot_url ? [agent.headshot_url] : undefined,
    },
  };
}

export default async function AgentLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await fetchAgentBySlug(slug);
  if (!agent) notFound();

  const name = fullName(agent);
  const first = agent.first_name;
  const phoneLink = phoneHref(agent.phone);
  const webLink = websiteHref(agent.website_url);
  const webLabel = websiteLabel(agent.website_url);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name,
  };
  if (agent.title) jsonLd.jobTitle = agent.title;
  if (agent.brokerage)
    jsonLd.worksFor = { "@type": "Organization", name: agent.brokerage };
  if (agent.phone) jsonLd.telephone = agent.phone;
  if (agent.email) jsonLd.email = agent.email;
  if (webLink) jsonLd.url = webLink;
  if (agent.headshot_url) jsonLd.image = agent.headshot_url;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO */}
      <SectionShell padY="md" className="pt-12 sm:pt-16">
        <div className="flex flex-col sm:flex-row items-stretch gap-10">
          {agent.headshot_url && (
            <div className="flex-shrink-0 w-full sm:w-[280px] relative">
              <div className="h-[320px] sm:h-[380px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={agent.headshot_url}
                  alt={name}
                  className="h-full w-full object-cover object-top headshot-mask-hero"
                />
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center">
            <h1 className="font-display text-[34px] sm:text-[52px] text-white leading-[1.05] tracking-[-0.02em] mb-5">
              {name}
            </h1>
            {agent.tagline && (
              <p className="font-sans text-[14px] sm:text-[15px] text-white/30 leading-[1.75] max-w-xl mb-6">
                {agent.tagline}
              </p>
            )}
            {agent.title && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--accent-red)]/70 font-semibold">
                  {agent.title}
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionShell>

      <AccentRule variant="primary" />

      {/* CONTACT */}
      <SectionShell padY="md">
        <div className="rounded-2xl border border-white/[0.06] bg-[var(--surface-raised)]/60 p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <Eyebrow tone="crimson" className="mb-3">
                Work with {first}
              </Eyebrow>
              {agent.brokerage && (
                <h2 className="font-display text-[26px] sm:text-[32px] text-white leading-[1.15] tracking-[-0.015em]">
                  {agent.brokerage}
                </h2>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {agent.phone && phoneLink && (
                <a
                  href={phoneLink}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
                >
                  {agent.phone}
                </a>
              )}
              {agent.email && (
                <a
                  href={`mailto:${agent.email}`}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
                >
                  {agent.email}
                </a>
              )}
              {webLabel && webLink && (
                <a
                  href={webLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-[color:var(--accent-red)] transition-colors"
                >
                  {webLabel}
                </a>
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      {/* REFERRAL FOOTER -- Option B (agent-forward, gender-neutral) */}
      <SectionShell padY="md">
        <div className="border-t border-white/[0.06] pt-10">
          <div className="max-w-3xl">
            <Eyebrow tone="muted" className="mb-4">
              Title Partner
            </Eyebrow>
            <p className="font-display text-[22px] sm:text-[28px] text-white/80 leading-[1.3] tracking-[-0.01em] mb-6">
              The transaction {first} promises their clients is the transaction they experience, because their title partner is part of the team, not a vendor.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-sans text-[13px] text-white/50">Alex Hollien</p>
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
