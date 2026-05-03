# Plumbing Audit -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation
**Mode:** read-only audit

---

## What was audited

- Env var handling pattern (52 `process.env.*` accesses, 29 files).
- Supabase client variants (`server.ts`, `client.ts`, `admin.ts`) and their consumers.
- Validation surface: zod usage by file, what's gated and what isn't.
- Transaction safety on multi-write paths (campaign-runner, intake, capture promotion).
- Idempotency on cron + webhooks.
- Retry semantics across all jobs.
- Rate limiter (`src/lib/rate-limit/check.ts`) and AI budget guard (`src/lib/ai/_budget.ts`).
- Error logging shim (`src/lib/error-log.ts`).

---

## Findings

### P1 -- Env handling: scattered, no schema, no boot check -- HIGH

52 `process.env.*` reads across 29 files; every one uses either the non-null assertion (`X!`), a boolean coerce (`=== "true"`), or a fallback chain (`X ?? Y`).

**Patterns observed:**

```
src/middleware.ts:8                           NEXT_PUBLIC_SUPABASE_URL!  -- non-null assertion
src/lib/supabase/admin.ts:7                   SUPABASE_SERVICE_ROLE_KEY! -- non-null assertion
src/app/api/captures/route.ts:73              CAPTURES_AI_PARSE === "true" -- boolean flag
src/app/api/calendar/create/route.ts:43       ROLLBACK_CAL_WRITE === "true" -- rollback flag
src/app/api/email/approve-and-send/route.ts:255  NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin -- fallback
src/app/api/cron/touchpoint-reminder/route.ts:214  NODE_ENV === "production" -- env-gate
```

**Risk:** No single place to know what env vars are required, optional, or feature-flag-shaped. Cold-start Lambdas hit the missing var only on the first request to the dependent route. See `security-audit.md` S1 for the latent prod bug list (OPENAI_API_KEY etc.).

**Fix:** Centralized `src/lib/env.ts` with zod schema. Drafted in `proposed-patches/02-env-loader.diff`.

---

### P2 -- Supabase client variants -- consistent and correct -- INFO

| Variant | File | RLS context | Used by |
|---------|------|-------------|---------|
| Browser | `src/lib/supabase/client.ts` | anon, RLS-bound to `auth.uid()` | All `'use client'` components |
| Server | `src/lib/supabase/server.ts` | anon w/ cookies, RLS-bound to current session user | RSC + server actions |
| Admin (service-role) | `src/lib/supabase/admin.ts` | bypasses RLS | Cron, webhooks, intake, error-log, internal RPCs |

The split is clean. Service-role usage is explicit (admin client must be imported by name; no accidental scope leak). Each client uses anon key vs service-role key correctly.

**One observation:** `src/middleware.ts` constructs its own `createServerClient` inline rather than calling `createClient` from `lib/supabase/server.ts`. This is correct -- middleware needs the request/response cookie wiring -- but it means there are two slightly-different server-client constructors in the codebase. Acceptable.

---

### P3 -- Validation coverage: 5 files using zod, sparse on routes -- HIGH

zod imports:

```
src/lib/validations.ts                       (canonical schema definitions)
src/lib/intake/process.ts                    (intake payload validation, used by /api/intake)
src/lib/inbox/types.ts                       (inbox message schema, used by /api/inbox/scan)
src/app/(app)/campaigns/[id]/actions.ts      (campaign action validation)
src/components/campaigns/step-form.tsx       (client-side form validation)
```

**Validation matrix per public-write route:**

| Route | zod-validated body? | Other validation |
|-------|---------------------|------------------|
| `/api/intake` (POST) | YES (intakeSchema in process.ts) | rate-limit + honeypot |
| `/api/captures` (POST) | partial: relies on AI/rules parsing in `lib/captures/actions.ts` | -- |
| `/api/contacts` (POST/PUT) | UNKNOWN (not inspected; in scope for next pass) | session-gated |
| `/api/projects` (POST/PUT) | UNKNOWN | session-gated |
| `/api/email/generate-draft` (POST) | UNKNOWN | session-gated; ROLLBACK_DRAFT_GEN flag |
| `/api/email/approve-and-send` (POST) | UNKNOWN | dual-auth (CRON_SECRET or session) |
| `/api/calendar/create` (POST) | UNKNOWN | ROLLBACK_CAL_WRITE flag |
| `/api/transcribe` (POST) | UNKNOWN | session-gated; OpenAI Whisper |
| `/api/activity/interaction` (POST) | UNKNOWN | session-gated |
| `/api/webhooks/resend` (POST) | parses raw body after Svix verify; no schema | Svix HMAC |
| `/api/cron/*` (GET, all 4 internal cron routes) | n/a (no body) | Bearer CRON_SECRET |
| `/api/inbox/scan` (GET) | n/a | Bearer CRON_SECRET |
| `/api/gmail/sync` (GET/POST) | UNKNOWN | mixed |
| `/api/calendar/sync-in` (GET) | n/a | Bearer CRON_SECRET |
| `/api/auth/gmail/{authorize,callback}` (GET) | n/a (OAuth) | OAuth state signing |

**Risk:** Routes marked UNKNOWN may be doing trust-the-shape parsing. A route like `/api/contacts` that takes JSON and writes to the DB without zod validation is one TypeScript-vs-runtime mismatch away from a malformed insert that bypasses CHECK constraints (the contacts.stage CHECK already has zod backing in `validations.ts` -- but only if the route uses it).

**Fix:** Per-route zod adoption, route by route, post-7A.5. Sketched in `proposed-patches/03-route-validation-patterns.md` (review-only doc, not a diff).

---

### P4 -- Transaction safety: multi-write paths use service-role + sequential inserts, NOT transactions -- HIGH

Postgres RPCs are the only transactional surface. Direct service-role `.insert()` / `.update()` chains via `adminClient` from a route handler do NOT execute in a single transaction.

**Critical multi-write paths inspected:**

1. **`campaign-runner` cron (`src/app/api/cron/campaign-runner/route.ts`)** -- per enrollment: read step, conditionally `sendMessage()` (network!), update enrollment.current_step, insert campaign_step_completions, writeEvent. Five distinct writes (some best-effort, e.g. `void writeEvent(...)`). If `sendMessage()` succeeds but the subsequent `update enrollment.current_step` fails, the campaign step double-fires on the next tick.

   **Mitigation already in code:** the runner explicitly handles the "advance failed AFTER send succeeded" case (line 312-317): it logs the error but does NOT mark the run as failed (correct -- the email already went out). However, the next tick will try to send the SAME step again because `current_step` did not advance. This is a known minor double-send risk.

2. **`/api/intake` (POST)** -- `processIntake()` does: account lookup, rate limit, contact upsert, intake_request insert, intake_items insert. If items insert fails after request insert, you get an orphaned intake_request row. Looking at coverage in `src/lib/intake/process.ts`: 41.5% lines covered including the contact + request insert paths but only partial items-failure coverage.

3. **Resend webhook (`/api/webhooks/resend`)** -- on `email.opened`/`email.clicked`: `messages_log` lookup, `message_events` insert, `contacts` health_score update, `writeEvent`. If health-score update succeeds but writeEvent fails, the audit trail loses the open/click event but the score moved. Acceptable; writeEvent is fire-and-forget by design.

4. **Capture promotion (`src/lib/captures/actions.ts`)** -- HANDS-OFF (in 7A.5 hands-off list). Not inspected.

**Risk:** None of the above is critical, but they each carry a small "two-writes, one-succeeded" tail-risk. Postgres transactions inside Supabase JS are awkward (no native multi-statement BEGIN/COMMIT exposed); the typical fix is to wrap multi-writes in a SQL function (RPC) and call it once.

**Fix:** Identify the highest-traffic multi-write paths (campaign-runner advance + insert is the top candidate) and consider promoting to a single `advance_campaign_step()` RPC. Schema work; hands-off until 7A.5 lands.

---

### P5 -- Idempotency: weak across the board -- HIGH

| Component | Idempotent? | How |
|-----------|-------------|-----|
| Resend webhook | NO -- relies on Svix's at-least-once retry semantics, but no dedup key on `message_events` | Risk: duplicate score bumps on repeated delivery of the same event |
| `/api/intake` | partial -- honeypot dedups bots, but a real partner who hits "submit" twice creates two intake_requests | Recommendation: add submission_token UUID from client + unique index |
| `/api/cron/campaign-runner` | NO -- a duplicate cron firing within 30 seconds (Vercel can briefly double-invoke during deploys) would advance the same enrollment twice | Mitigation: 50-row LIMIT + lte(next_action_at, now()) means second tick sees `next_action_at` updated and skips |
| `/api/cron/morning-brief` | UNKNOWN -- not inspected this pass |
| `/api/cron/touchpoint-reminder` | UNKNOWN |
| `/api/cron/recompute-health-scores` | UNKNOWN |
| `/api/inbox/scan` | UNKNOWN |
| `/api/gmail/sync` | UNKNOWN -- relies on Gmail message-id uniqueness presumably |

**Risk:** Vercel cron at-least-once delivery + no dedup keys means edge cases can produce duplicate side effects. The campaign-runner is partially protected by the time-window filter; webhook events are NOT.

**Fix (sketch):** Add `provider_message_id + event_type` unique index on `message_events`. Add `submission_token` UUID column on `intake_requests` with unique index. These are schema changes -- HANDS-OFF until 7A.5 lands. Documented for follow-up.

---

### P6 -- Retry semantics: ad-hoc, no central retry helper -- MEDIUM

`src/lib/retry.ts` exists (referenced in `test-coverage.txt`, 0% coverage) -- file is untested. Need to inspect to confirm shape.

Cron handlers use:

- `campaign-runner` -- explicit "do NOT advance current_step on send-fail; next tick retries" pattern (line 289-291). Good.
- Webhook -- 500 on processing error -> Resend retries with exponential backoff. Good.
- `error-log.ts` -- fire-and-forget; log failures are silently swallowed (line 14: `.then(() => null, () => null)`). Intentional, but one source of "the issue was logged but the log itself failed" silent loss.

**Fix:** Read `src/lib/retry.ts` and document its contract OR remove it if unused. Followed up in observability-gaps.md.

---

### P7 -- Rate limiter -- well-engineered, fail-open, single-table -- INFO

`src/lib/rate-limit/check.ts` (94.73% coverage; one of the most-tested modules):

- Fixed-window (not sliding-window despite docstring) over `(key, window_start)` PK.
- Atomic increment via `increment_rate_limit()` RPC (SECURITY DEFINER, INSERT ON CONFLICT DO UPDATE).
- Fail-open on RPC error: `console.warn` + return `{ allowed: true }`. Documented at line 21-24.
- Lazy cleanup: deletes rows older than `2 * windowSec`. Hard-delete carve-out for operational data -- see Standing Rule 3 exception note in the file.

**Used by:** `/api/intake` (10/5min/IP). No other route uses it currently.

**Risk:** Fail-open means the public intake endpoint is unprotected during a Supabase outage. Acceptable trade-off but worth flagging in the runbook (it isn't yet).

---

### P8 -- AI budget guard -- well-designed -- INFO

`src/lib/ai/_budget.ts`:

- Daily USD cap from `AI_DAILY_BUDGET_USD` env (default $5.00).
- Reads via `current_day_ai_spend_usd()` RPC.
- Soft-cap at 80%: writes `ai.budget_warning` event once per (feature, day) using in-memory dedup map.
- Hard-cap at 100%: throws `BudgetExceededError`; caller writes `ai.budget_blocked` event.
- Per-feature accounting (capture-parse, draft-revise, inbox-score, morning-brief).

**Risk:** In-memory dedup means warm Lambdas dedupe correctly but cold-start re-fires the warning. Acceptable trade-off documented at line 91.

---

### P9 -- Error logging shim -- thin, fire-and-forget, single table -- MEDIUM

`src/lib/error-log.ts` is 16 lines:

```ts
export async function logError(endpoint, error_message, context, error_code?) {
  await adminClient
    .from("error_logs")
    .insert({ endpoint, error_code, error_message, context })
    .then(() => null, () => null);
}
```

Used by every cron + webhook + intake handler. Writes to `error_logs` table.

**Strengths:**
- Fire-and-forget, never blocks the response.
- Single table = one read for "what's broken."

**Weaknesses:**
- No stack trace; `context` is a free-form record.
- No severity (`error_code` is HTTP-shaped, optional).
- Silent failure on the log insert itself -- if the DB is down, the error is lost forever.
- No external alerting (email, Slack, Sentry).
- `error_logs` table read path NOT inspected (any UI? any cron summary?).

**Fix:** Discussed in `observability-gaps.md`.

---

### P10 -- 21 console.log/warn/error calls -- LOW

Full list (from grep):

```
src/app/(app)/projects/[id]/page.tsx:56
src/app/(app)/contacts/[id]/page.tsx:98
src/app/(app)/campaigns/actions.ts:41
src/app/api/intake/route.ts:57, 83
src/app/api/webhooks/resend/route.ts:117, 172
src/app/api/transcribe/route.ts:89
src/components/ui/voice-input.tsx:103, 141
src/lib/activity/queries.ts:22, 37
src/lib/intake/process.ts:246, 283, 302
src/lib/ai/capture-parse.ts:124
src/lib/ai/inbox-score.ts:78, 82
src/lib/rate-limit/check.ts:73 (and one comment at L24)
```

Most are `console.error` for failures already routed through `logError()` to `error_logs`, plus one `console.warn` in the fail-open rate-limit path.

**Risk:** None. These are intentional dual-write (DB + Vercel logs).

**Fix:** None needed. If a logger module ever lands, fold these into it.

---

## Severity rollup

| Severity | Findings |
|----------|----------|
| Critical | none |
| High | P1 (no env validator), P3 (sparse zod), P4 (no multi-write txns), P5 (idempotency gaps) |
| Medium | P6 (retry helper unverified), P9 (error-log thin) |
| Low | P10 (console calls intentional) |
| Info | P2 (Supabase clients clean), P7 (rate limiter solid), P8 (AI budget solid) |

---

## Out of scope

- Per-route validation refactor (post-7A.5).
- `provider_message_id` unique index on `message_events` (schema, hands-off).
- Promoting campaign-runner advance to RPC (schema, hands-off).
- Read of `src/lib/retry.ts` to confirm contract (deferred).

---

## Remaining placeholders

- None.
