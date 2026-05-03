# Dependency Analysis -- GAT-BOS CRM

## Context

This document inventories every external dependency and audits the internal dependency graph for circularity, coupling, and god-file accumulation. Findings are derived from a read-only architecture pass: file-size scans (`wc -l`), `grep -rohE` import counts, and targeted dependency probes against the high-traffic lib modules.

The headline finding: **the codebase is unusually clean for its scope**. Zero circular dependencies, near-zero `any` usage, single-responsibility lib modules, and a one-way fan-out from API routes to lib modules. The debt is concentrated in three places: large UI files (`task-list.tsx`, `analytics/page.tsx`), one large lib file (`captures/actions.ts`, `invite-templates.ts`), and a thin test layer (5 test files).

Detailed risk classification lives in `technical-debt-hotspots.md`. This doc reports what was measured.

---

## 1. External integrations

| Service | SDK | Env vars | Entry point | Failure mode |
|---|---|---|---|---|
| **Anthropic Claude** | `@anthropic-ai/sdk@^0.85.0` | `ANTHROPIC_API_KEY`, `AI_DAILY_BUDGET_USD` | `src/lib/ai/_client.ts` -> singleton from `getClient()` | `BudgetExceededError` on hard cap; retry wrapper on transient errors; budget warning event on 80% soft cap |
| **Resend** (transactional email) | `resend@^6.10.0` | `RESEND_API_KEY`, `RESEND_SAFE_RECIPIENT`, `RESEND_WEBHOOK_SECRET` | `src/lib/resend/client.ts` -> single `Resend` instance | Webhook HMAC reject; send retries via `withRetry`; messages_log captures status |
| **Google APIs** (Gmail + Calendar) | `googleapis@^171.4.0` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_ENCRYPTION_KEY` (token at-rest), `OAUTH_STATE_SIGNING_KEY` (state nonce HMAC) | `src/lib/gmail/oauth.ts`, `src/lib/gmail/sync-client.ts`, `src/lib/calendar/client.ts` | Token refresh handled by googleapis OAuth2 client; bad token surfaces via 401 from Google API; logged to `error_logs` |
| **OpenAI Whisper** (transcription only) | `openai@^6.34.0` | `OPENAI_API_KEY` | `src/app/api/transcribe/route.ts` (single call site) | Try/catch returns 500 with error message; no retry |
| **Supabase** | `@supabase/ssr@^0.9.0`, `@supabase/supabase-js@^2.99.2` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Three factories at `src/lib/supabase/{server,client,admin}.ts` | RLS on for anon-key clients; service-role bypasses; rate-limit fail-open on RPC error |

### Not in the stack

The following integrations are **explicitly excluded**. They appear in some legacy comments or earlier roadmap notes but are not in `package.json` and not in the codebase:

- **Twilio** -- no SMS surface. CLAUDE.md and standing rules forbid SMS providers.
- **Zapier / Make / n8n** -- no third-party automation. Cron + post-creation hooks cover the orchestration surface.
- **Stripe** -- no billing surface. GAT-BOS is internal-use software; no payment flows.
- **Vercel KV / Edge Config / Blob** -- no managed Vercel storage. State lives in Supabase.
- **Sentry / PostHog / Datadog / Bugsnag** -- no third-party observability. Errors go to `public.error_logs` via `lib/error-log.ts`.
- **Mailerlite** -- migrated off (Phase 2.2). All transactional + campaign email is Resend.

### Cron-driven external traffic

Per `vercel.json`, 9 crons hit external services on schedule:

| Cron | External call(s) | Frequency |
|---|---|---|
| `/api/inbox/scan` | Gmail (list unread + score via Claude) | every 30 min |
| `/api/gmail/sync` | Gmail (3 daily syncs at 15:00 / 19:00 / 23:00 UTC) | 3x daily |
| `/api/calendar/sync-in` | Google Calendar (list events) | hourly |
| `/api/cron/morning-brief` | Anthropic (1 call) | 12:30 UTC daily |
| `/api/cron/recompute-health-scores` | None (SQL only, refreshes materialized view) | 11:00 UTC daily |
| `/api/cron/campaign-runner` | Resend or Gmail (per due enrollment, capped at 50/tick) | every 15 min |
| `/api/cron/touchpoint-reminder` | Resend (1 summary email) | 12:00 UTC daily |

**Bursty surfaces:** campaign-runner can fire up to 50 sends per 15-min tick, so peak external traffic is `Resend.send` at ~3.3 calls/min if every enrollment is overdue. inbox/scan may make 1 Anthropic call per unread thread (Haiku 4.5 for triage scoring) plus 1 Gmail list per tick.

---

## 2. Internal cross-module imports

Source-of-truth file: every `from '@/lib/...'` import found via `grep -rohE`. Below is the inbound-coupling chart for the high-traffic modules.

### Inbound-coupling: who imports `@/lib/<module>`?

| Module | Imported by | Count signal |
|---|---|---|
| `lib/supabase/admin` | API routes, lib write paths, hooks, ai/_client, ai/_budget, ai/_cache, captures/actions, intake/process, messaging/send, rate-limit/check, activity/writeEvent, calendar/sync-in, contacts/auto-enroll | very high (every write) |
| `lib/supabase/server` | Server Components, route handlers needing session, `tenantFromRequest`, `verifySession` | high (every authenticated read) |
| `lib/supabase/client` | Client components, useQuery hooks | high (browser code) |
| `lib/auth/tenantFromRequest` | Every API route that needs tenant context | medium-high |
| `lib/api-auth` | tenantFromRequest, every cron route, dual-auth routes | medium |
| `lib/activity/writeEvent` | hooks, captures/actions, intake/process, calendar/sync-in, email/approve-and-send, email/generate-draft, campaign-runner, captures/[id]/process, webhooks/resend, ai/_budget | high (every side-effect emit) |
| `lib/ai/_client` (callClaude) | morning-brief, capture-parse, draft-revise, inbox-score | medium (one capability each) |
| `lib/ai/_budget` | callClaude only | low (1 caller) |
| `lib/ai/_cache` | callClaude only | low |
| `lib/messaging/send` | campaign-runner, touchpoint-reminder | low |
| `lib/error-log` | many (every catch-and-log surface) | high (lateral utility) |

### Outbound coupling: which modules does `@/lib/ai/_client` depend on?

```
@/lib/ai/_client.ts (203 lines)
├── @anthropic-ai/sdk
├── @/lib/retry (withRetry)
├── @/lib/supabase/admin
├── @/lib/error-log
├── @/lib/ai/_budget
├── @/lib/ai/_cache
└── @/lib/ai/_pricing
```

This is healthy: `_client` depends only on its own namespace and infra utilities. No cross-domain reach into `messaging`, `captures`, or `activity`.

---

## 3. Circular dependency probe

Targeted greps were run between the four highest-traffic lib modules to detect inverted dependencies.

| Probe | Result |
|---|---|
| `grep -rl "from '@/lib/captures" src/lib/{ai,messaging,activity}/` | 0 matches |
| `grep -rl "from '@/lib/messaging" src/lib/{ai,captures,activity}/` | 0 matches |
| `grep -rl "from '@/lib/ai" src/lib/{messaging,captures,activity}/` | 0 matches |
| `grep -rl "from '@/lib/activity" src/lib/{ai,messaging,captures}/` | 0 matches except direct `writeEvent` callers (one-way down) |

**Verdict: zero circular dependencies in the high-traffic chain.** The activity ledger is a sink (everyone writes to it; it imports from no domain module). The AI namespace is a sink (every capability calls it; it imports from no domain). The messaging namespace is a sink. The dependency direction is clean: API routes -> lib/<entity> -> lib/{activity, ai, messaging, supabase, retry, error-log}.

`madge --circular` was not run because `madge` is not installed and the architecture pass forbids dependency installs. Manual greps cover the load-bearing chain. Future passes that want a complete proof can add `madge` to devDependencies in a separate plumbing slice.

---

## 4. God-file candidates (>400 lines)

`wc -l` over `src/`, sorted descending:

| File | Lines | Class |
|---|---|---|
| `src/components/dashboard/task-list.tsx` | 979 | UI god-file: dashboard-tier task list with state + render + mutations bundled |
| `src/app/(app)/analytics/page.tsx` | 923 | Page god-file: data aggregation + multiple Recharts charts in one file |
| `src/app/intake/page.tsx` | 728 | Public form page: comprehensive validation + stepper UI |
| `src/lib/events/invite-templates.ts` | 715 | Template library god-file: 4 invite renderers + shell + types in one file |
| `src/app/(app)/contacts/[id]/page.tsx` | 679 | Contact detail page: profile + activity + forms + tabs |
| `src/app/(app)/today-v2/queries.ts` | 596 | Query helpers (CADENCE constants currently inlined here) |
| `src/components/drafts/drafts-client.tsx` | 538 | Drafts page client: 4-action state machine + countdowns + revise UI |
| `src/lib/captures/actions.ts` | 531 | promoteCapture + 5 target handlers + helpers in one file |
| `src/app/(app)/today-v2/today-v2-client.tsx` | 525 | Today-v2 dashboard surface (5 widgets composed inline) |
| `src/lib/types.ts` | 512 | Cross-module type exports |

### What "god-file" means here

Not all 400+-line files are debt. `lib/types.ts` is a type-export aggregator and 512 lines is normal for that role. `invite-templates.ts` was *intentionally* consolidated in Slice 3B from a multi-file directory into one file. `today-v2/queries.ts` carries a deliberate copy of CADENCE that will collapse post-Slice-4 merge.

The actual debt-shaped files are:

- `task-list.tsx` -- mixes state, mutations, and render across six different task buckets. A natural decomposition split is: list-shell + per-bucket section + task-row component + the mutation hooks. There's no urgent reason to do it; it works.
- `analytics/page.tsx` -- the page hand-rolls data aggregation across multiple tables and renders 4-6 Recharts charts inline. shadcn Chart wrappers are not used here yet (see existing `~/crm/docs/INDEX.md` "What was not documented").
- `drafts-client.tsx` -- the 4-action state machine plus countdowns plus revise UI. Tight coupling between countdown logic and action buttons.
- `captures/actions.ts` -- 5 promotion targets in one file. Each target is its own state path. Could split per target.

Risk classification per file is in `technical-debt-hotspots.md`.

---

## 5. Top components by import frequency

Sourced from `grep -rohE "from ['\"]@/components/[^'\"]+['\"]" src/ | sort | uniq -c | sort -rn`.

| Imports | Module |
|---|---|
| 37 | `@/components/ui/button` |
| 30 | `@/components/screen` (the screen-design library directory) |
| 18 | `@/components/ui/select` |
| 16 | `@/components/ui/input` |
| 13 | `@/components/ui/textarea` |
| 13 | `@/components/ui/label` |
| 13 | `@/components/ui/card` |
| 11 | `@/components/ui/dialog` |
| 4 | `@/components/ui/badge` |
| 3 | `@/components/tasks/task-form` |
| 3 | `@/components/screen/eyebrow` |
| 3 | `@/components/screen/accent-rule` |
| 2 | `@/components/ui/voice-input` |
| 2 | `@/components/ui/tabs` |
| 2 | `@/components/ui/sonner` |

The top 5 are all shadcn/ui v4 primitives. The custom `screen/` library (Kit Screen showcase tier per `digital-aesthetic.md`) is the most-imported app-side directory at 30, mostly as a barrel. shadcn primitives outside the top 9 see double-digit but lower usage.

This pattern is healthy: a thin shadcn primitive base, one custom design library on top (`screen/`), feature-specific components below. No "supercomponent" gravity well except the dashboard task-list.

---

## 6. Lib file size distribution (top 20)

| Lines | File |
|---|---|
| 715 | `src/lib/events/invite-templates.ts` (Slice 3B intentional consolidation) |
| 531 | `src/lib/captures/actions.ts` (state machine over 5 promotion targets) |
| 512 | `src/lib/types.ts` (type-export aggregator) |
| 418 | `src/lib/messaging/draftActions.test.ts` (test file) |
| 333 | `src/lib/intake/process.ts` (with 251-line test) |
| 330 | `src/lib/hooks/handlers/project-created.ts` (the most complex post-creation handler) |
| 255 | `src/lib/gmail/sync-client.ts` |
| 251 | `src/lib/intake/process.test.ts` |
| 250 | `src/lib/messaging/draftActions.ts` |
| 242 | `src/lib/validations.ts` |
| 232 | `src/lib/contact-activity.ts` |
| 212 | `src/lib/observation/readout.ts` |
| 211 | `src/lib/messaging/send.ts` |
| 208 | `src/lib/action-scoring.ts` |
| 203 | `src/lib/ai/_client.ts` |
| 186 | `src/lib/constants.ts` |
| 184 | `src/lib/ai/morning-brief.ts` |
| 177 | `src/lib/ai/capture-parse.ts` |
| 168 | `src/lib/ai/draft-revise.ts` |
| 163 | `src/lib/rate-limit/check.test.ts` |

Median lib file is around 100 lines. Standard `actions.ts/queries.ts/types.ts` shape across 8+ entity dirs (Slice 3A) keeps domain modules focused.

---

## 7. ActivityVerb enum size

`src/lib/activity/types.ts` defines the union. Current count: **40 verbs** across 7 namespaces:

```
capture.*       9 verbs (created, transcribed, classified, promoted, promoted.task, promoted.ticket, promoted.contact, promoted.touchpoint, promoted.event)
ticket.*        2 verbs (status_changed, notes_updated)
email.*         1 verb  (sent)
message.*       2 verbs (sent, drafted)
project.*       2 verbs (updated, hook_fired)
event.*         3 verbs (created, contact_only, hook_fired)
campaign.*      4 verbs (step_fired, step_skipped, send_failed, completed)
ai.*            4 verbs (call, budget_blocked, budget_warning, budget_default_used)
interaction.*   10 verbs (call, text, email, meeting, broker_open, lunch, note, email_sent, email_received, event, backfilled)
hook.*          1 verb  (failed)
contact.*       1 verb  (hook_fired)
```

Per-verb usage is documented in the data-flow doc and in `~/crm/SCHEMA.md`. The verb namespace is healthy: every verb has a clear emitter, no orphans, no synonym pairs.

---

## 8. Test coverage probe

Test file inventory (vitest):

| File | Lines | Coverage area |
|---|---|---|
| `src/lib/auth/__tests__/tenantFromRequest.test.ts` | unknown (under tests/ dir) | Slice 7A tenant resolver, 6 cases |
| `src/lib/intake/process.test.ts` | 251 | Public intake processing |
| `src/lib/messaging/draftActions.test.ts` | 418 | Draft state-machine validation |
| `src/lib/rate-limit/check.test.ts` | 163 | Window math + fail-open |
| `src/lib/touchpoints/weeklyWhere.test.ts` | unknown | end-of-Sunday MST DST math, 6 cases |

**Five test files across ~32k LOC src/.** That's a 0.2% test-file ratio. Critical-path coverage is good (auth, intake, rate-limit, draft state machine, touchpoint math) but UI, route handlers, and integration are uncovered.

This is a substantial debt signal but not a crisis. The repo's protective layer is integration smoke (slice7a-smoke.mjs, slice5b-smoke.mjs, phase-9-realtime-smoke.mjs, etc.) rather than unit tests. CI is not configured; verification gate is `pnpm typecheck && pnpm build` per CLAUDE.md.

---

## 9. TypeScript `any` usage

| Search | Count |
|---|---|
| `: any\b` in `src/lib/` | 1 |
| `: any\b` in `src/components/` | 0 |

A 1-in-32k count is exceptional discipline. The single `any` is presumably an intentional escape hatch (Anthropic SDK types do not always export the helper types). Worth spot-checking when the component lands in code review, not a refactor target.

---

## 10. TanStack Query adoption

Approximate count: **19 sites** import `useQuery`. Distribution skews to `(app)/analytics/page.tsx`, `(app)/today-v2/today-v2-client.tsx`, `(app)/captures/captures-client.tsx`, plus dashboard widgets in `components/dashboard/`.

Conventions per `~/crm/docs/tanstack-query-provider.md`: single QueryClient via `query-provider.tsx`, default staleTime overrides per data type (60s KPIs, 30s tasks, 5min profiles, Infinity for prefs). Realtime subscriptions invalidate cache rather than mutate state directly.

---

## 11. Schema mid-flight items (BLOCKERS perspective)

`BLOCKERS.md` flags items that would surface in a strict architecture audit. Verified status as of this pass:

| Blocker (open in BLOCKERS.md) | Verified state |
|---|---|
| 6 non-conforming migration filenames | **0 found in directory listing.** All 91 migrations match `<14-digit-timestamp>_<name>.sql`. BLOCKERS.md may be stale; in-flight Slice 7A.5 reconciliation likely renamed them. |
| `contacts` missing `slug`, `photo_url`, `tagline` | Confirmed missing per BLOCKERS. `/agents/[slug]` reads from a hardcoded `AGENTS` const in `src/app/agents/[slug]/page.tsx`. |
| Fiona + Denise phone/website missing | Confirmed missing in CONTACT.md upstream (per BLOCKERS). |
| Voice / mic capture not wired | `capture-bar.tsx` is text-only. No `MediaRecorder` / `webkitSpeechRecognition` path. |
| Inline contact picker for captures missing a contact | UI shows "Needs contact" pill; no inline picker. |
| `captures-audio` cron not wired | `vercel.json` has no entry for `/api/captures/cleanup-audio`. Audio files accumulate. |
| 5 spine-era today widgets deleted | Confirmed: `tier-alerts.tsx`, `overdue-commitments.tsx`, `today-focus.tsx`, `recent-captures.tsx`, `week-stats.tsx` are gone. Today page is sparse pending Slice 2B rebuilds. |
| Capture editing after submit not wired | `captures-client.tsx` shows raw_text as static `<p>`. No PATCH route. |

The migration-name BLOCKER vs. directory-listing mismatch is itself a technical-debt-hotspots item: BLOCKERS.md may have stale "Open" entries that have already been fixed by 7A.5 work.

---

## 12. Configuration footprint

| File | Purpose | Risk |
|---|---|---|
| `package.json` | pnpm-locked deps, 30 prod + 11 dev | clean, modest deps |
| `pnpm-lock.yaml` | lockfile | committed (correct) |
| `vercel.json` | crons only (9 entries) | minor: missing cleanup-audio cron |
| `next.config.mjs` | one redirect (`/follow-ups` -> `/tasks?type=follow_up`) | minimal |
| `tailwind.config.ts` | Kit Screen font wiring + tailwindcss-animate plugin | per CLAUDE.md, fonts via CSS vars |
| `tsconfig.json` | strict mode, `@/*` paths | clean |
| `components.json` | shadcn v4 config | clean |
| `vitest.config.ts` | test config | minimal |
| `postcss.config.mjs` | postcss + tailwind | minimal |
| `.env.local.example` | listed in README, expected | not committed (correct) |

No webpack overrides, no custom server, no API route middlewares beyond `middleware.ts`. The Next configuration is intentionally near-empty.

---

## Cross-references

- Specific debt classifications + DO NOT AUTO-FIX banners: `technical-debt-hotspots.md`
- Auth + RLS depth: `auth-flow.md`
- Module purpose map: `system-map.md`
- Per-flow tracing: `data-flow.md`
