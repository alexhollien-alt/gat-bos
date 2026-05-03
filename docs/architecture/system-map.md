# System Map -- GAT-BOS CRM

## Context

GAT-BOS is a single-operator multi-tenant CRM serving Alex Hollien at Great American Title Agency. It tracks the universe of real estate agents Alex services, ingests communications (Gmail, Google Calendar, voice / text captures, intake form), and triages follow-up across a layered AI surface.

This document is the structural index. Every other architecture doc references it. It maps:

1. Top-level repository layout
2. The Next.js App Router route tree (UI + API)
3. The 26 domain modules under `src/lib/`
4. The 18 component buckets under `src/components/`
5. The 9 cron jobs in `vercel.json`
6. The `supabase/` layout (migrations + seeds; contents off-limits)
7. The `scripts/` directory (smoke + debug + build)
8. A cross-module dependency graph

It does NOT prescribe changes. Document `technical-debt-hotspots.md` is where risk and refactor candidates live.

Generated 2026-05-01 from a read-only architecture pass. Source of truth: `~/crm/src/`, `~/crm/supabase/migrations/` filenames, `~/crm/vercel.json`. Spot-checked against `BUILD.md`, `SCHEMA.md`, `ROADMAP.md`, and the existing 13-doc set under `~/crm/docs/`.

---

## 1. Top-level repository layout

```
~/crm/
├── src/                         Next.js source
│   ├── app/                     App Router routes (pages + API)
│   ├── components/              React components by feature
│   ├── lib/                     Domain modules + shared helpers
│   └── middleware.ts            Auth + public-route bypass
├── supabase/                    Database
│   ├── migrations/              91 idempotent SQL files
│   ├── seeds/                   Seed data
│   ├── _archive/                Retired migrations
│   ├── snippets/                Ad-hoc SQL utilities
│   ├── schema.sql               Snapshot of public schema
│   ├── seed.sql                 Demo data
│   ├── config.toml              Supabase CLI config
│   └── *.sql                    Slice-era one-off SQL kept for reference
├── scripts/                     59 .mjs / .ts smoke + debug helpers
├── docs/                        Pre-existing feature docs (13 files)
│   └── architecture/            This directory (added by this pass)
├── audit/                       Reconciliation logs
│   └── 2026-04-slice7a-migration-reconciliation/
├── public/                      Static assets (agent headshots, fonts)
├── gat-bos-project-files/       Reference materials (out-of-app)
├── .planning/                   GSD config (auto_advance: false)
├── .plan/                       Per-day stream + phase logs
├── .claude/                     Claude Code hooks + agents (repo-scoped)
├── BACKLOG.md                   Hot queue + future work
├── BLOCKERS.md                  Open broken integrations + resolutions
├── BUILD.md                     What's currently building + Built history
├── ROADMAP.md                   Phase 1-4 multi-quarter roadmap
├── SCHEMA.md                    Per-table tier + status reference
├── friction-log.md              Operator friction notes
├── LATER.md                     Mid-session "do this later" capture
├── README.md                    Public-facing readme (intentionally minimal)
├── CLAUDE.md                    Per-repo Claude Code rules
├── package.json                 pnpm-locked dependencies
├── pnpm-lock.yaml               Lockfile
├── vercel.json                  Vercel cron declarations only
├── next.config.mjs              `/follow-ups` -> `/tasks?type=follow_up` redirect
├── tailwind.config.ts           Kit Screen font wiring
├── postcss.config.mjs           PostCSS config (Tailwind + nesting)
├── components.json              shadcn/ui v4 config
├── tsconfig.json                Strict TS, paths set to `@/*`
├── tsconfig.tsbuildinfo         (generated)
└── vitest.config.ts             Vitest 4 config
```

The repo is a single Next.js 14 (App Router) project. There is no monorepo, no workspace, no separate worker process. All scheduled work runs as Vercel Cron-triggered API routes inside the same Next app.

---

## 2. Next.js App Router route tree

### Route groups

Next App Router uses `(group)` directories for layout grouping without consuming a path segment. GAT-BOS has two:

- `(auth)` -- the unauthenticated shell (login, signup)
- `(app)` -- the authenticated shell (every internal route)

Plus three public top-level surfaces that bypass `middleware.ts`:

- `/api/*` -- the entire API surface (skipped on the public-route allow-list)
- `/intake` -- public capture form (Alex shares this URL with agents)
- `/agents/[slug]` -- per-agent landing pages (currently Julie, Fiona, Denise)

### UI routes

| Group / segment | Page path | Purpose |
|---|---|---|
| `(auth)/login` | `/login` | Email + password sign-in |
| `(auth)/signup` | `/signup` | Account create |
| `(app)/today` | `/today` | Spine-era dashboard (canonical) |
| `(app)/today-v2` | `/today-v2` | Read-only Phase 008 surface (live-bind, no mutations yet) |
| `(app)/dashboard` | `/dashboard` | Bento dashboard (cards + KPIs) |
| `(app)/morning` | `/morning` | Latest morning brief reader |
| `(app)/inbox` | `/inbox` | Triaged inbox view (scored Gmail threads) |
| `(app)/drafts` | `/drafts` | Pending email drafts queue |
| `(app)/contacts` | `/contacts`, `/contacts/[id]` | Contact list + detail |
| `(app)/projects` | `/projects/[id]` | Project detail (touchpoints + tasks) |
| `(app)/opportunities` | `/opportunities` | Pipeline (extended in Slice 2C with deal columns) |
| `(app)/captures` | `/captures` | Promotion queue from capture bar |
| `(app)/tasks` | `/tasks?type=...` | Unified task queue (todo / follow_up / commitment) |
| `(app)/actions` | `/actions` | Prioritized action list (Tier 1 Linear Focus widget at scale) |
| `(app)/tickets` | `/tickets`, `/tickets/[id]` | Material requests (renamed in Slice 3B) |
| `(app)/materials` | `/materials` | 308 redirect to `/tickets` (Slice 3B legacy) |
| `(app)/campaigns` | `/campaigns`, `/campaigns/[id]`, `/campaigns/new` | Drip campaign editor |
| `(app)/analytics` | `/analytics` | KPI charts (Recharts directly, no shadcn Chart wrapper yet) |
| `(app)/weekly-edge/preview` | `/weekly-edge/preview` | Newsletter preview |
| `intake` (public) | `/intake` | Public capture form, no auth, route at `~/crm/src/app/intake/` |
| `agents/[slug]` (public) | `/agents/[slug]` | SSG agent landing pages, JSON-LD + Open Graph |
| `/` | root | Redirects to `/dashboard` (or `/login` if anon) |

### API routes

All under `~/crm/src/app/api/`. 30 `route.ts` handlers across 11 functional groups. Every cron route requires `Bearer CRON_SECRET`; webhook routes require provider-specific HMAC.

| Group | Routes | Auth |
|---|---|---|
| Activity | `activity/interaction` | session |
| Auth (Gmail OAuth) | `auth/gmail/authorize`, `auth/gmail/callback` | OAuth flow |
| Calendar | `calendar/create`, `calendar/sync-in` (cron) | session / cron |
| Captures | `captures`, `captures/[id]/process`, `captures/cleanup-audio` | session (rate-limited) |
| Contacts | `contacts`, `contacts/[id]`, `contacts/[id]/auto-enroll` | session |
| Cron | `cron/morning-brief`, `cron/campaign-runner`, `cron/recompute-health-scores`, `cron/touchpoint-reminder` | cron |
| Email | `email/drafts`, `email/generate-draft`, `email/approve-and-send`, `email/test` | session |
| Events | `events/invite-preview` | session |
| Gmail | `gmail/sync` (cron), `gmail/mark-read` | cron / session |
| Inbox | `inbox/items`, `inbox/scan` (cron) | session / cron |
| Intake | `intake` | public + rate-limited |
| Morning | `morning/latest` | session |
| Projects | `projects`, `projects/[id]`, `projects/[id]/touchpoints` | session |
| Transcribe | `transcribe` | session (OpenAI Whisper) |
| Webhooks | `webhooks/resend` | HMAC (no rate limit, intentional) |

Auth helpers live at `src/lib/api-auth.ts`: `requireApiToken(request)` (Bearer INTERNAL_API_TOKEN), `verifyCronSecret(request)`, `verifySession()`, `verifyBearerOrSession(request)`. Tenant context is resolved through `tenantFromRequest()` (see `auth-flow.md`).

---

## 3. Domain modules under `src/lib/`

26 directories + 11 top-level helpers. Every domain follows the standardized shape from Slice 3A:

```
src/lib/<entity>/
├── actions.ts    server-side mutations (write path)
├── queries.ts    server-side reads (with .eq('account_id', ...) for service callers)
└── types.ts      Row / Insert / Update + service contracts
```

Slice-7A migrated every write path off `OWNER_USER_ID` env-var and `ALEX_EMAIL` constant. Both are deleted. Tenant scoping flows through `tenantFromRequest()` -> `account_id`-keyed columns under RLS, OR explicit `.eq('account_id', ...)` for service-role callers.

### Domain modules (entity-shaped)

| Module | Purpose | Notes |
|---|---|---|
| `activity/` | Canonical event ledger | `writeEvent.ts` is the only sanctioned write path for `activity_events`. `types.ts` carries the `ActivityVerb` union (40+ verbs, see auth-flow.md). `queries.ts` exports `getContactTimeline()` for the contact detail page. |
| `ai/` | All Claude API call sites | `_client.ts` (callClaude wrapper), `_budget.ts` (daily $5 default cap, soft cap at 80%), `_cache.ts` (DB-backed result cache), `_pricing.ts` (rate table per model). Capability files: `morning-brief.ts`, `capture-parse.ts`, `draft-revise.ts`, `inbox-score.ts`. |
| `auth/` | Tenant resolution | `tenantFromRequest.ts` is the single resolver. Returns `{kind, userId, accountId}` or `{kind: 'service', reason}`. No silent fallbacks. |
| `calendar/` | Google Calendar API | `client.ts` wraps googleapis Calendar v3. |
| `campaigns/` | Drip campaign engine | `actions.ts` (autoEnroll, send-failure handling), `queries.ts`, `types.ts`. Slice 3B folded `auto-enroll.ts` into `actions.ts`. |
| `captures/` | Universal capture bar pipeline | `rules.ts` (regex parser, Slice 3B rename from `parse.ts`), `actions.ts` (promoteCapture state machine, 5 targets), `queries.ts`, `types.ts`. |
| `claude/` | Slice 6 shims | `brief-client.ts`, `draft-client.ts` -- thin re-export shims pointing to `ai/morning-brief` and `ai/draft-revise`. Scheduled to delete in Slice 7+. |
| `contacts/` | Contacts CRUD | `actions.ts`, `queries.ts`, `types.ts`. |
| `crypto/` | At-rest token encryption | `vault.ts` -- AES-GCM via OAUTH_ENCRYPTION_KEY for `oauth_tokens`. Distinct purpose from `OAUTH_STATE_SIGNING_KEY` (state nonce HMAC, lives in `gmail/oauth.ts`). |
| `events/` | Calendar events + invite templates | `actions.ts`, `queries.ts`, `types.ts`, `invite-templates.ts` (4 renderers in one file post-Slice-3B: home tour, class day, content day, happy hour). |
| `gmail/` | Google Gmail API | `oauth.ts` (consent + state-nonce signing), `sync-client.ts` (oauth_tokens-backed thread fetcher used by /api/inbox/scan and /api/gmail/sync), `filter.ts`. |
| `hooks/` | Post-creation event hooks | `post-creation.ts` dispatcher; isolated handlers under `handlers/` (project-created, contact-created, contact-auto-enroll, event-created). One handler failure cannot cascade. |
| `inbox/` | Inbox triage | `scorer.ts` -> shim to `ai/inbox-score`. `types.ts`. |
| `intake/` | Public intake form orchestration | `process.ts` (with `process.test.ts`). Server-side contact upsert, hook fan-out. |
| `messaging/` | Templates + send abstraction (Slice 4) | `send.ts` (sendMessage), `render.ts` (Handlebars-lite), `draftActions.ts` (with test), `types.ts`. Adapters under `adapters/`: `resend.ts`, `gmail.ts`. |
| `notifications/` | Escalation routing | `escalation.ts` -- Marlene routing + agent prospect flag (Phase 1.3.2). |
| `observation/` | Phase 1.3.2-D analytics | `readout.ts` -- terminal-draft observation rollup. |
| `opportunities/` | Pipeline (Slice 2C consolidated) | `actions.ts`, `queries.ts`, `types.ts`. Holds the 13 deal-specific columns merged from the dropped `deals` table. |
| `projects/` | Project tracking | `actions.ts`, `queries.ts`, `types.ts`. |
| `rate-limit/` | Supabase-backed sliding-window limiter | `check.ts` (checkRateLimit), `extract-ip.ts`, `check.test.ts`. Fail-open on RPC error. |
| `resend/` | Resend client wrapper | `client.ts` -- single point of `RESEND_API_KEY` access; honors `RESEND_SAFE_RECIPIENT`. |
| `scoring/` | Action scoring | `temperature.ts` -- canonical CADENCE constants (today-v2 inlines a copy until post-Slice-4 merge). |
| `supabase/` | Three Supabase client factories | `admin.ts` (service-role, bypasses RLS), `server.ts` (anon-key SSR with cookie session), `client.ts` (anon-key browser). See `auth-flow.md`. |
| `tasks/` | Task queue (extended in Slice 2C) | `actions.ts`, `queries.ts`, `types.ts`. Includes `linked_interaction_id` column for audit linkage to activity_events. |
| `tickets/` | Material requests (renamed Slice 3B) | `actions.ts`, `queries.ts`, `types.ts`. Components still under `src/components/materials/` (rename deferred). |
| `touchpoints/` | Project touchpoint helpers | `weeklyWhere.ts` (end-of-Sunday America/Phoenix bound, with `weeklyWhere.test.ts`). |

### Top-level helpers (one file each)

| File | Purpose |
|---|---|
| `action-scoring.ts` | 0-100 action ranking formula. Used by `/actions`. |
| `agent-palette.ts` | Per-agent palette assignment (Classic Estate, Desert Modern, etc.). |
| `api-auth.ts` | `requireApiToken`, `verifyCronSecret`, `verifySession`, `verifyBearerOrSession`. |
| `constants.ts` | App constants. ALEX_EMAIL deleted in Slice 7A. |
| `contact-activity.ts` | Contact timeline aggregator. |
| `csv-export.ts` | CSV export utility. |
| `error-log.ts` | `logError(scope, message, context)` -- writes to `error_logs`. |
| `retry.ts` | Exponential backoff wrapper around any async fn. Used by `ai/_client.ts`. |
| `temperature.ts` | Legacy temperature helper. |
| `types.ts` | Cross-module type exports. |
| `utils.ts` | Generic utilities (`cn` for Tailwind class merge, etc.). |
| `validations.ts` | Zod schemas for API inputs. |

---

## 4. Component buckets under `src/components/`

```
src/components/
├── campaigns/          Campaign editor pieces, step list, send-mode toggles
├── contacts/           Contact list, contact card, filters, contact form
├── dashboard/          Dashboard widgets (campaign-timeline, task-list, etc.)
├── drafts/             Draft list, draft detail, send-now / revise affordances
├── follow-ups/         Follow-up list + form. Still referenced from contact detail + dashboard quick-actions, even though `/follow-ups` route was deleted in Slice 3
├── inbox/              Inbox row, score badges
├── interactions/       interaction-modal (call / text / meeting / note logger)
├── materials/          Materials index + form (route renamed to /tickets but components dir not yet renamed -- LATER.md)
├── notes/              Note editor + display
├── opportunities/      Pipeline tiles
├── screen/             Showcase-tier screen-design library (depth, motion, glass-surface utilities)
├── tags/               Tag chips + picker
├── tasks/              Task list, task form
├── today/              Today-page widgets (post-Slice-2A: lean set after spine-only widgets were deleted)
├── tickets/            (placeholder; Slice 3B did not rename materials/ -> tickets/)
├── ui/                 shadcn/ui primitives (Button, Dialog, Select, Tabs, etc.)
├── capture-bar.tsx     Universal capture bar (mounted at (app)/layout.tsx)
├── capture-bar-server.tsx   Server-side capture parsing helpers
├── command-palette.tsx Cmd+K palette via cmdk + shadcn Command
├── query-provider.tsx  TanStack Query QueryClientProvider with per-data-type staleTime overrides
└── sidebar.tsx         Persistent left nav
```

Top-level shells (capture-bar, command-palette, query-provider, sidebar) wrap every authenticated page. They live at `src/components/` root, not inside a folder, because they are mounted from `(app)/layout.tsx` and have no peers.

---

## 5. Cron jobs (`vercel.json`)

```json
"crons": [
  { "path": "/api/inbox/scan",                       "schedule": "*/30 * * * *" },
  { "path": "/api/gmail/sync",                        "schedule": "0 15 * * *" },
  { "path": "/api/gmail/sync",                        "schedule": "0 19 * * *" },
  { "path": "/api/gmail/sync",                        "schedule": "0 23 * * *" },
  { "path": "/api/calendar/sync-in",                  "schedule": "0 * * * *" },
  { "path": "/api/cron/recompute-health-scores",      "schedule": "0 11 * * *" },
  { "path": "/api/cron/morning-brief",                "schedule": "30 12 * * *" },
  { "path": "/api/cron/campaign-runner",              "schedule": "*/15 * * * *" },
  { "path": "/api/cron/touchpoint-reminder",          "schedule": "0 12 * * *" }
]
```

All schedules are UTC. `morning-brief` fires at 12:30 UTC = 5:30 AM Phoenix time. `touchpoint-reminder` fires at 12:00 UTC = 5:00 AM Phoenix, 30 minutes before the morning brief, so a freshly-ticked summary email is in Alex's inbox before he reads the brief. `gmail/sync` fires three times daily but `inbox/scan` runs every 30 min as the dominant Gmail-pulling cron.

`captures/cleanup-audio` is NOT wired to cron yet (BLOCKERS.md item 2026-04-23). Audio files accumulate in Supabase Storage until that's added.

---

## 6. Supabase layout

```
~/crm/supabase/
├── migrations/           91 timestamped migration files
├── _archive/             Retired pre-Slice-1 migrations
├── seeds/                Per-environment seed data
├── snippets/             Ad-hoc SQL utilities
├── backups/              Manual schema dumps
├── .branches/            Supabase branch metadata
├── .temp/                CLI scratch
├── schema.sql            Latest snapshot (informational)
├── seed.sql              Demo data
├── config.toml           Supabase CLI config
└── (root .sql)           Slice-era one-off SQL (campaigns.sql, contact-activity-prep.sql, dashboard-piece*.sql, materials.sql, phase4-migration.sql, dashboard-architecture-v1-superseded.sql)
```

**Migration content is OFF-LIMITS for this architecture pass.** Slice 7A.5 (Migration History Reconciliation) is in flight and owns the migration ledger. We enumerate filenames but do not open contents.

Migration filename convention: `<14-digit-timestamp>_<snake-case-name>.sql`. As of this pass, all 91 files match this convention. (BLOCKERS.md notes 6 legacy `phase-*.sql` and `slice-*.sql` filenames, but a directory listing shows zero non-conforming names today; that BLOCKERS entry may be resolved by the in-flight 7A.5 work. Treat as discovery; see `technical-debt-hotspots.md`.)

Tables by tier (full reference in `~/crm/SCHEMA.md`):

- **Raw, live**: `accounts`, `activity_events`, `contacts`, `interactions_legacy`, `notes`, `tasks`, `tickets`, `ticket_items`, `design_assets`, `events`, `projects`, `project_touchpoints`, `email_drafts`, `emails`, `captures`, `campaign_enrollments`, `campaigns`, `campaign_steps`, `campaign_step_completions`, `contact_tags`, `tags`, `opportunities`, `agent_health` (view), `error_logs`, `oauth_tokens`, `inbox_items`, `templates`, `messages_log`, `message_events`, `ai_usage_log`, `ai_cache`, `attendees`, `event_templates`, `morning_briefs`, `relationship_health_*` (3 tables).
- **Operational, live**: `rate_limits`.
- **Views**: `interactions` (UNION of legacy rows + activity_events WHERE verb LIKE 'interaction.%').
- **Dropped**: `follow_ups`, `deals`, `spine_inbox`, `commitments`, `signals`, `focus_queue`, `cycle_state`.

---

## 7. Scripts directory

`~/crm/scripts/` holds 59 .mjs / .ts / .py scripts in 5 functional buckets:

| Bucket | Examples | Purpose |
|---|---|---|
| Smoke tests | `slice7a-smoke.mjs`, `slice5b-smoke.mjs`, `phase-008-smoke.mjs`, `phase-9-realtime-smoke.mjs`, `auto-enroll-smoke-test.mjs` | End-to-end verification of slice-level work |
| Phase debug | `phase-9-debug-*.mjs` (15 files), `phase-1.3.2-*.mjs`, `phase-7-gate-verify.mjs` | Per-phase forensic probes (Realtime, auth, drafts, hydration) |
| Probes | `probe-anthropic.mjs`, `probe-brief.mjs`, `probe-insert.mjs`, `probe-rate-limit-rpc.mjs` | Single-purpose API + DB probes |
| Build / seed | `build-gatbos-seed.py`, `generate-import-sql.mjs`, `backfill-activity-events.mjs`, `event-cycle-step-4-fix-and-seed.mjs` | One-off data prep |
| Audit / monitoring | `check-error-log.mjs`, `morning-api-debug.mjs`, `morning-error-probe.mjs`, `morning-check.mjs`, `event-cycle-check-*.mjs`, `qa-2026-04-26-verify.mjs` | Live system health probes |

Conventions: `.mjs` for runtime scripts (no build step), `.ts` for the single TypeScript helper (`event-cycle-step-5-draft-2-render.ts`), `.py` for Python utilities. None are wired to CI.

---

## 8. Cross-module dependency graph

```mermaid
flowchart TD
  classDef boundary fill:#fef3c7,stroke:#a16207,stroke-width:1px;
  classDef domain fill:#e0f2fe,stroke:#0369a1,stroke-width:1px;
  classDef external fill:#ede9fe,stroke:#7c3aed,stroke-width:1px;
  classDef storage fill:#fee2e2,stroke:#b91c1c,stroke-width:1px;

  middleware[middleware.ts]:::boundary
  apiAuth[lib/api-auth.ts]:::boundary
  tenant[lib/auth/tenantFromRequest.ts]:::boundary

  sbAdmin[lib/supabase/admin.ts]:::storage
  sbServer[lib/supabase/server.ts]:::storage
  sbClient[lib/supabase/client.ts]:::storage

  activity[lib/activity/*]:::domain
  captures[lib/captures/*]:::domain
  intakeMod[lib/intake/process.ts]:::domain
  messaging[lib/messaging/*]:::domain
  hooks[lib/hooks/*]:::domain
  ai[lib/ai/*]:::domain
  campaigns[lib/campaigns/*]:::domain
  rateLimit[lib/rate-limit/*]:::domain
  gmailLib[lib/gmail/*]:::domain
  calLib[lib/calendar/client.ts]:::domain
  resendLib[lib/resend/client.ts]:::domain
  errorLog[lib/error-log.ts]:::domain

  ApiRoutes[app/api/**/route.ts]
  ServerActions[Server Actions]
  Pages[app/(app)/**/page.tsx]
  Components[components/*]

  Anthropic((Anthropic SDK)):::external
  Resend((Resend SDK)):::external
  Google((googleapis SDK)):::external
  OpenAI((OpenAI Whisper)):::external
  SupabaseDB[(Supabase / Postgres)]:::storage

  middleware --> sbServer
  ApiRoutes --> apiAuth
  ApiRoutes --> tenant
  tenant --> sbServer
  tenant --> apiAuth

  ApiRoutes --> rateLimit
  ApiRoutes --> sbAdmin
  ApiRoutes --> sbServer
  ServerActions --> sbServer
  Pages --> sbServer
  Components --> sbClient

  rateLimit --> sbAdmin
  activity --> sbAdmin
  hooks --> activity
  hooks --> sbAdmin
  campaigns --> sbAdmin
  campaigns --> activity
  messaging --> resendLib
  messaging --> gmailLib
  messaging --> sbAdmin
  intakeMod --> hooks
  intakeMod --> sbAdmin
  captures --> sbAdmin
  captures --> activity

  ai --> sbAdmin
  ai --> activity
  ai --> errorLog
  ai --> Anthropic

  resendLib --> Resend
  gmailLib --> Google
  calLib --> Google
  ApiRoutes --> OpenAI
  sbAdmin --> SupabaseDB
  sbServer --> SupabaseDB
  sbClient --> SupabaseDB
```

Key observations:

1. **One-way fan-out from API routes.** API route handlers depend on lib modules; lib modules do not depend on API routes. There is no inverted dependency.
2. **Three Supabase clients are the only DB boundary.** Every read or write goes through `lib/supabase/{admin,server,client}.ts`. No code calls `@supabase/supabase-js` directly except those three files.
3. **`activity_events` is a sink.** `lib/activity/writeEvent.ts` is the only sanctioned writer. Many modules call it; it depends only on `sbAdmin` and `error-log`.
4. **`tenantFromRequest` is the auth chokepoint.** Any handler that needs `userId` or `accountId` calls it. It depends on `sbServer` (for session) and `apiAuth` (for cron + webhook + intake gates).
5. **AI flows through one wrapper.** Every Claude call routes through `ai/_client.ts` `callClaude()` -- which composes budget guard, prompt cache, retry, and `ai_usage_log` write in one function.

For probe results on circular dependencies, file size, and god-file candidates, see `dependency-analysis.md`.

---

## Cross-references

- Auth: `auth-flow.md`
- Data: `data-flow.md`
- Debt: `technical-debt-hotspots.md`
- Dependencies: `dependency-analysis.md`
- AI agents working in this repo: `ai-agent-guide.md`
