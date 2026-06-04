// src/lib/open-house/config.ts
// Central config for the open house blast system. Every deliverability-sensitive
// value lives here so the WALL invariants and the dedicated-subdomain rule are
// enforced in one place. Env vars override defaults so prod can point at the
// verified subdomain without code changes.

// ---------------------------------------------------------------------------
// Sending identity. NEVER the root or CRM domain (WALL invariant).
// opens.alexhollienco.com is a dedicated subdomain, separate from
// alexhollienco.com (root) and gat-bos.vercel.app (CRM/transactional).
// ---------------------------------------------------------------------------
export const SENDING_DOMAIN =
  process.env.BLAST_SENDING_DOMAIN?.trim() || "opens.alexhollienco.com";

// The mailbox the blast is sent from on the subdomain. Display name is the
// agent (agent branding on), filled per blast in the sender.
export const BLAST_FROM_ADDRESS =
  process.env.BLAST_FROM_ADDRESS?.trim() || `opens@${SENDING_DOMAIN}`;

// Replies route to a real monitored inbox, not the subdomain.
export const BLAST_REPLY_TO =
  process.env.BLAST_REPLY_TO?.trim() || "alex@alexhollienco.com";

// Public base URL for landing pages + unsubscribe links. MUST match the From
// domain so the click target aligns with the sending subdomain (Primary signal).
export const PUBLIC_BASE_URL = (
  process.env.BLAST_PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");

// Domains a blast may NEVER send from (WALL: never root or CRM domain).
export const FORBIDDEN_FROM_DOMAINS = [
  "alexhollienco.com", // root
  "gat-bos.vercel.app", // CRM / transactional host
];

// ---------------------------------------------------------------------------
// WALL invariant limits (hard ceilings, surfaced in the dashboard).
// ---------------------------------------------------------------------------
export const WALL = {
  maxComplaintRate: 0.0008, // 0.08%
  maxBounceRate: 0.04, // 4%
} as const;

// ---------------------------------------------------------------------------
// Batching + warmup. Batch in groups of 100. Warm the subdomain gradually:
// a per-send cap keeps day-one volume low until reputation is built.
// ---------------------------------------------------------------------------
export const BATCH_SIZE = 100;
export const THROTTLE_MS = 500; // 2 req/sec, matches Resend default rate limit

// Suggested warmup ramp (day index -> max recipients that day). The send route
// applies blast.daily_send_cap when set; this ramp is the default suggestion
// surfaced in the UI. Conservative early volume protects a cold subdomain.
export const WARMUP_RAMP: number[] = [50, 100, 250, 500, 1000, 2000, 5000];

// ---------------------------------------------------------------------------
// Canonical brand hex (Email Exception: email inlines hex, no CSS variables).
// Source of truth is design-tokens; reproduced here only for email building.
// ---------------------------------------------------------------------------
export const EMAIL_COLORS = {
  ground: "#FCFBFB", // Pearl White
  structure: "#192A56", // Midnight Navy
  signal: "#F7D794", // Champagne
  atmosphere: "#EDA6A3", // Dusty Rose
} as const;

// Only contacts with this email_status are mailable. Everything else is
// suppressed (the status field doubles as the suppression list).
export const MAILABLE_STATUS = "active";

// Recipient contact types eligible for an agent-to-agent open house blast.
export const RECIPIENT_TYPES = ["realtor", "agent"] as const;
