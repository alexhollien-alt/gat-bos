# PROJECT_CONTEXT.md

Business and product framing for GAT-BOS. Read this after `AGENTS.md` and before opening source code.

---

## Who

**Alex Hollien**, Title Sales Executive at **Great American Title Agency** (GAT). Phoenix Valley.

Alex is not a real estate agent. His clients are real estate agents. He is their one-person marketing department: he produces flyers, brochures, landing pages, listing presentations, weekly emails, and one-on-one strategy sessions. The agents bring transactions to GAT (escrow + title). The relationship is volume-driven, trust-driven, and deeply specific to the Valley.

GAT-BOS (Business Operating System) is the software that makes Alex's job tractable at the volume he runs.

---

## What it is

A multi-tenant CRM purpose-built for the title-sales / agent-relationship workflow. Today it serves one operator (Alex). Designed multi-tenant from Slice 7A so a second account can land without an architectural rewrite.

Core capabilities:

1. **Contact + relationship tracking** -- 105+ agents in his book, tiered (A/B/C/P) by relationship strength, with health scores recomputed daily from interaction frequency, deal volume, recency, and responsiveness.
2. **Universal capture bar** -- text-only (voice deferred to v2) at every authenticated page. Rule parser (default) + Claude parser (feature-flagged) classify intent and link to a contact.
3. **Capture promotion** -- 5-target state machine (interaction, note, follow_up, ticket, touchpoint, event). Captures earn their keep by becoming real CRM rows.
4. **Email triage + drafting** -- Gmail sync 3x daily; Claude generates a contextual draft for each unread thread; 4-action approval (send_now via Resend, create_gmail_draft for escalation, discard, revise).
5. **Drip campaigns** -- 15-min cron tick; templates resolved by slug; sends through Resend or Gmail per campaign step.
6. **Calendar sync** -- two-way Google Calendar; events fan into post-creation hooks; project_touchpoints fire when events link to a project.
7. **Public intake form** -- agents share `/intake`; rate-limited; auto-creates contact; fires welcome task + auto-enrollment hooks.
8. **Per-agent landing pages** -- public SSG at `/agents/[slug]` with JSON-LD for share previews. Currently three: Julie Jarmiolowski, Fiona Bigbee, Denise van den Bossche.
9. **Morning brief** -- daily 5:30 AM Phoenix Claude-assembled markdown briefing scoring contacts and surfacing top signals.
10. **Today / Today-v2 dashboards** -- Linear Focus model: 6 prioritized buckets (overdue follow-ups, closings today/tomorrow, agents going cold, scheduled meetings, proactive touchpoints, pipeline items needing attention).

The tone is operator-tier: every surface is something Alex looks at once a day or once an hour. Latency, density, and scoring quality matter more than feature breadth.

---

## Where it runs

- **Hosting:** Vercel (production: `gat-bos.vercel.app`; aliased to a custom domain via Vercel).
- **DB + Auth + Storage + Realtime:** Supabase (project ref `rndnxhvibbqqjrzapdxs`).
- **Email send:** Resend (domain `alexhollienco.com` verified and warmed; sender `alex@alexhollienco.com`).
- **AI:** Anthropic (Claude API, default model `claude-sonnet-4-6`; Haiku for inbox triage).
- **OAuth / Calendar / Mail:** Google APIs (Gmail + Calendar via `googleapis`).
- **Scheduling:** Vercel Cron (9 schedules in `vercel.json`).
- **Local dev:** `pnpm dev` -> `localhost:3000` (or 3001 if 3000 is taken).

---

## Where it is in its lifecycle

**Phase 1 (CRM Spine) is shipped.** Phase 2 (Lifecycle Automation + Content) is mid-flight. Phase 3 (Intelligence + Agent Portal) is scoped. Phase 4 (Ambient + Scale) is deferred.

The team uses a "slice" vocabulary on top of phases. A slice is a focused plumbing or feature drop with explicit acceptance gates. Recent shipped slices:

| Slice | Date | Focus |
|---|---|---|
| 1 | 2026-04-22 | Activity ledger foundation (`activity_events` + `writeEvent()`) |
| 2A/B/C | 2026-04-23 / 24 | Spine drop, captures consolidation, tasks/opportunities consolidation |
| 3A/B | 2026-04-24 / 26 | Route thinning, lib standardization, ticket rename, OAuth state-signing decouple |
| 4 | 2026-04-27 | Templates + messaging abstraction (`src/lib/messaging/`) |
| 5A/B | 2026-04-27 | Campaign runner + post-creation hooks + touchpoint reminder cron |
| 6 | 2026-04-27 | AI consolidation (`src/lib/ai/`) + budget guard |
| 7A | 2026-04-30 | Multi-tenant auth + RLS rewrite (single biggest auth change to date) |
| 7A.5 | **in flight 2026-05-01** | Migration history reconciliation (plumbing-only) |

`BUILD.md` carries the full audit trail. Read its `## Built` history for context on any subsystem.

---

## Business constraints

### Excluded providers (locked)

- **No Twilio / SMS / phone-OTP.** Alex's relationship medium is email, calendar, and in-person meetings. SMS is deliberately out.
- **No Zapier / Make / n8n.** Orchestration runs in cron + post-creation hooks. Zero third-party automation glue.
- **No Stripe.** GAT-BOS is internal software; no billing surface. (GAT itself bills clients through their separate ERP -- not in this codebase.)
- **No Mailerlite.** Migrated off in 2026 Q1; Resend is the canonical send path.
- **No Vercel KV / Edge Config / Blob.** State lives in Supabase.
- **No Sentry / PostHog / Datadog.** Errors flow to `error_logs`. Observability is Postgres-shaped.

### Co-brand and partner constraints

GAT-BOS produces marketing collateral for agents. Two lender partners co-brand on a per-agent basis:

- **Christine McConnell (Nations Lending)** -- Julie Jarmiolowski / Optima Camelview Village pieces ONLY. Never volunteered. Never on generic GAT collateral.
- **Stephanie Reid (Gravity Home Loans)** -- Stephanie's own pieces only. Never co-present with Christine in the same deliverable, except Q4 client celebration events (separate roles).

Lender partner scoping is enforced by `~/.claude/rules/standing-rules.md` and `~/.claude/rules/brand.md`. Any deliverable that names a financing partner must respect the scope.

GAT itself co-brands on print materials only via the back-cover compliance row (small GAT Classic logo + Equal Housing Opportunity logo + MLS-Realtor logo). Never as a text line on listing presentations, landing pages, email body, or digital-only output.

### Voice + brand

Per Standing Rule 7 and `~/.claude/rules/brand.md`:

- Banned words: stunning, breathtaking, amazing.
- Banned punctuation: exclamation marks, em dashes, lorem ipsum.
- Voice axis: Sotheby's prestige + Flodesk warmth + Apple precision.
- Referral handle (verbatim, locked): "I make sure the transaction you promised your client is the transaction they experience."

These rules govern marketing copy. They also govern any user-facing string the CRM emits (toast text, headers, empty-state copy, draft email subject lines).

---

## Why the architecture looks the way it does

### Single-tenant in practice, multi-tenant in design

Today there is one `accounts` row (Alex). Slice 7A built the multi-tenant scaffolding for two reasons: (1) to remove the hardcoded `OWNER_USER_ID` and `ALEX_EMAIL` patterns that were fragile single-points-of-failure, and (2) to allow GAT to extend the system to a second operator without another auth rewrite. The design is multi-tenant; the data is not yet.

### Activity-events as a sink, not a stream

Every user-observable side effect emits to `activity_events`. The contact detail page reads its timeline from `getContactTimeline()` which projects from `activity_events`. This makes the activity ledger the system of record for "what happened" -- ahead of the spine tables (now dropped) and ahead of per-domain audit columns. The trade-off is a slightly chatty insert path; the win is a single coherent timeline.

### One Anthropic wrapper

Every Claude call goes through `callClaude()`. The wrapper composes:
1. Optional cache lookup (`ai_cache` DB-backed, per-feature, sha256 keys);
2. Budget guard (`AI_DAILY_BUDGET_USD`, default $5/day, soft cap warning at 80%, hard cap throws);
3. Anthropic SDK call with prompt cache enabled by default (`cache_control: ephemeral`);
4. Pricing + ai_usage_log write at the end.

The cap is opinionated. Alex has not shipped to scale where >$5/day is realistic, and the cap fires loud warnings before block. The Anthropic prompt cache (5-min server TTL) covers in-flight prefix reuse; the DB cache covers durable cross-process result reuse.

### Supabase + Vercel only

The stack is intentionally narrow. Adding a service is rare; subtracting is cheap. The architecture pass found zero third-party dependencies that don't fit the four-vendor footprint (Vercel, Supabase, Anthropic, Google + Resend for transactional email and OpenAI for transcription). A future contributor proposing a fifth vendor must justify against this constraint.

### Cron + post-creation hooks for orchestration

Every orchestrated flow is either:
1. A Vercel cron tick at a fixed schedule (9 in `vercel.json`), OR
2. A post-creation hook fired after a row insert (`src/lib/hooks/post-creation.ts` -> isolated handlers), OR
3. A webhook (Resend events; Gmail watch is not yet wired).

There is no message queue, no background worker, no Celery, no BullMQ. State changes happen at request time or at cron tick.

---

## Risk surfaces (inherited)

Documented in `docs/architecture/technical-debt-hotspots.md`. Headlines:

- **7A.5 perimeter is in flight.** Don't touch migrations, RLS, tenant scoping, captures actions, or AI budget guard without explicit Alex approval.
- **Test coverage is thin** (5 unit test files). Smoke scripts in `scripts/` cover much, but UI regressions land via `pnpm build` and manual eyes.
- **5 today-page widgets** were deleted in Slice 2A and not yet rebuilt against `activity_events`. The today page is sparse.
- **`captures-audio` cleanup cron is not wired**, so Storage objects accumulate.
- **README.md is stale** (mentions `npm`, dropped tables); minor.

---

## What success looks like

The system is "done enough" when:

1. Alex's morning routine is: read the brief at 5:30 AM Phoenix time, process inbox + drafts in 30 min, the rest of the day is meetings + design work.
2. Every interaction is captured (capture bar) and promoted (5-target state machine) without leaving the CRM.
3. Every recurring email cadence (Weekly Edge, Closing Brief, agent onboarding drips) sends from Resend on autopilot.
4. Every agent's relationship health score reflects live activity within 24 hours.
5. Every public-facing marketing surface (`/agents/[slug]` + intake) is on-brand without manual deploy steps per agent.

We're roughly 70% there. The remaining 30% is in `BACKLOG.md` and ROADMAP Phase 2.x / 3.x.

---

## Cross-references

- One-page contract: `AGENTS.md`
- Per-repo Claude rules: `CLAUDE.md`
- Architecture index: `docs/architecture/EXECUTIVE_SUMMARY.md`
- Operational state: `BUILD.md`, `BLOCKERS.md`, `ROADMAP.md`, `SCHEMA.md`
- Brand + voice: `~/.claude/rules/brand.md` (loaded automatically in Claude sessions)
