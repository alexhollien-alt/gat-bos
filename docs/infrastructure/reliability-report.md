# Reliability Report -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation

---

## What was audited

- `vercel.json` cron catalog (9 schedules across 7 routes).
- Webhook handling (`/api/webhooks/resend`).
- Async failure paths in `campaign-runner` and intake.
- Error boundary status (`app/error.tsx`, `app/global-error.tsx`).
- Dev-server vs prod env divergence flags (5 `ROLLBACK_*` env vars).
- Transaction-vs-multi-call risk per write path.

---

## Cron job catalog

| Path | Schedule | Auth | Writes | Failure mode |
|------|----------|------|--------|---------------|
| `/api/inbox/scan` | `*/30 * * * *` | Bearer CRON_SECRET (assumed) | inbox/email_drafts (Gmail polling) | UNKNOWN -- not deeply inspected |
| `/api/gmail/sync` | `0 15,19,23 * * *` (3pm, 7pm, 11pm) | Bearer CRON_SECRET | email_drafts | ROLLBACK_GMAIL_SYNC + ROLLBACK_DRAFT_GEN flags exist; behavior on flag set: returns early no-op |
| `/api/calendar/sync-in` | `0 * * * *` (hourly) | Bearer CRON_SECRET | events table (gcal_pull source) | ROLLBACK_CAL_SYNC flag |
| `/api/cron/recompute-health-scores` | `0 11 * * *` (11am) | Bearer CRON_SECRET | contacts.health_score | UNKNOWN |
| `/api/cron/morning-brief` | `30 12 * * *` (12:30pm Phoenix) | Bearer CRON_SECRET | morning_briefs | UNKNOWN |
| `/api/cron/campaign-runner` | `*/15 * * * *` | Bearer CRON_SECRET | campaign_enrollments, campaign_step_completions, message_log, message_events, activity_events | sendMessage throw -> activity_events 'campaign.send_failed', current_step unchanged, next tick retries (no exponential backoff) |
| `/api/cron/touchpoint-reminder` | `0 12 * * *` (noon) | Bearer CRON_SECRET | touchpoints + Resend send (uses RESEND_SAFE_RECIPIENT in non-prod) | UNKNOWN |

**Risk:** Three of the four `/api/cron/*` routes have not been deeply audited this pass. The campaign-runner has been read end-to-end; its failure semantics are well-engineered and documented inline.

---

## R1 -- Vercel cron at-least-once delivery + missing idempotency keys -- HIGH

Vercel cron is at-least-once. During deploys or platform incidents, a cron path can fire twice within seconds. Of the 9 scheduled jobs, only the campaign-runner has a built-in dedup mechanism (the `next_action_at <= now()` time-window query, which advances after the first tick). Other jobs may double-write.

**Specific exposure:**

- `morning-brief` -- if it inserts a `morning_briefs` row each run without a `(user_id, date)` unique key, two morning briefs land in the table on the rare double-fire. UNVERIFIED.
- `touchpoint-reminder` -- depending on idempotency, could re-send a Resend email on double-fire.
- `recompute-health-scores` -- recompute is idempotent by definition; double-fire wastes compute but is safe.
- `inbox/scan` and `gmail/sync` -- depend on Gmail message_id uniqueness in their dedup; UNVERIFIED.
- `calendar/sync-in` -- upsert on `gcal_event_id` per Phase 7 verification; safe.

**Fix:** Document each cron's idempotency contract. Sketched in `proposed-patches/04-cron-idempotency-checklist.md`.

---

## R2 -- Resend webhook handling -- robust, retry-safe -- INFO

Already covered in `security-audit.md` S4. Reliability-side notes:

- 200 returned even for unhandled event types, so Resend stops retrying (good).
- 500 only on processing exceptions; Resend's exponential-backoff retry covers transient DB blips.
- Svix replay window is 5 minutes; older signed payloads are rejected.

**Risk:** None observed.

---

## R3 -- Async failure paths in campaign-runner -- correct -- INFO

`src/app/api/cron/campaign-runner/route.ts` handles all three failure modes correctly:

- `sendMessage` throw: writes `campaign.send_failed` event, logs to error_logs, does NOT advance `current_step` -> next tick re-tries the same step. Acceptable for transient Resend / network failures; without exponential backoff, a permanent failure (bad template, banned recipient) keeps re-trying every 15 minutes. Per `LATER.md`: backoff tracked for Slice 5B follow-up.
- Missing campaign step row: marks enrollment completed; emits `campaign.completed`.
- NULL `template_slug` step: emits `campaign.step_skipped`, advances current_step + next_action_at to preserve cadence.
- Missing/deleted/email-less contact: emits `campaign.step_skipped` with reason; advances current_step.

**Risk for unbounded retry on a permanently-failing step:**

If a recipient email becomes invalid and Resend rejects it permanently, the runner will retry every 15 minutes forever (until enrollment is paused manually or the contact's email is fixed). Logged in `LATER.md` already.

**Fix:** Add max-retry counter to `campaign_enrollments` (schema; hands-off until 7A.5).

---

## R4 -- Error boundaries: ABSENT -- HIGH

Files searched: `~/crm/src/app/error.tsx`, `~/crm/src/app/global-error.tsx`, any `ErrorBoundary` component. **None exist.**

In Next.js 14 App Router:

- Without `error.tsx`, an uncaught error in a server component renders Next's default error UI to the browser (white screen + status code).
- Without `global-error.tsx`, an error in the root layout or root server component takes down the whole app with a Next.js framework error.

**Risk:**

- Production user-visible error UX is degraded.
- No structured error capture at the boundary level.
- Combined with the absence of Sentry/OTel, an in-prod 500 in a server component is invisible to operations unless a user reports it.

**Fix:** Land minimal `error.tsx` + `global-error.tsx` that show a recover-friendly UI and call `logError()`. Drafted in `proposed-patches/05-error-boundaries.diff` (additive, no-touch to any existing route).

---

## R5 -- Rollback flags: 5 named env-driven kill switches -- INFO

Found:

```
ROLLBACK_GMAIL_SYNC    src/app/api/gmail/sync/route.ts:35,142,164
                       src/app/api/auth/gmail/{authorize,callback}/route.ts:14, :9
ROLLBACK_DRAFT_GEN     src/app/api/gmail/sync/route.ts:35
                       src/app/api/email/generate-draft/route.ts:64
ROLLBACK_SEND          src/app/api/email/approve-and-send/route.ts:85
ROLLBACK_CAL_WRITE     src/app/api/calendar/create/route.ts:43
ROLLBACK_CAL_SYNC      src/app/api/calendar/sync-in/route.ts:144,161
```

Pattern: `if (process.env.ROLLBACK_X === "true") { return early no-op or 503 }`.

**Strength:** Operationally great. Alex can disable any of five integration paths via Vercel env-var update without a redeploy.

**Weakness:** Zero documentation. Nothing in BLOCKERS.md, README.md, or `.env.local` explains what each flag does, what triggers a rollback, or who flips them. A future Alex (or anyone else) under outage pressure has to grep src/ to find the flags and read each route's comment to understand the side-effect.

**Fix:** Land `ROLLBACK_FLAGS.md` runbook in `docs/infrastructure/`. Drafted in this audit's section "Operational runbook" below; no separate patch.

---

## R6 -- Dev-server vs prod env divergence -- LOW

Two specific divergence points:

1. **`/api/email/test/route.ts:13`** -- guards against running in production (`if (process.env.NODE_ENV === "production") return 403`). Good safety pattern.
2. **`/api/cron/touchpoint-reminder/route.ts:214-216`** -- routes Resend sends to `RESEND_SAFE_RECIPIENT` outside production. Standard test-routing pattern.
3. **`/api/events/invite-preview/route.ts:32-33`** -- gates production-only behavior on `VERCEL_ENV === "production" || NODE_ENV === "production"`.

**Risk:** Mixed signals on which env-var defines "prod" -- some routes use `NODE_ENV`, some use `VERCEL_ENV`, some use both. On Vercel preview deploys, `NODE_ENV=production` but `VERCEL_ENV=preview`, so a route that gates only on `NODE_ENV` will run prod paths in preview.

**Fix:** Document the canonical "is this prod?" predicate in `src/lib/env.ts` (when it lands).

---

## R7 -- Transaction safety -- see plumbing-audit.md P4 -- HIGH

Cross-referenced. Multi-write paths use service-role + sequential inserts, NOT transactions. The campaign-runner explicitly handles the post-send-advance-failed case but cannot prevent a duplicate send on the next tick. Idempotency keys (R1) are the path forward, not transactions.

---

## Operational runbook (Rollback flags)

Set any of these to `"true"` in Vercel env to disable the corresponding integration. All take effect on next request without a deploy. All default to OFF (integration ENABLED).

| Flag | What it disables | When to flip |
|------|-------------------|--------------|
| `ROLLBACK_GMAIL_SYNC` | Gmail OAuth + cron sync (3 endpoints) | Gmail API outage, OAuth credential rotation, suspected bad data ingest |
| `ROLLBACK_DRAFT_GEN` | AI draft-generation (gmail/sync calls + on-demand generate-draft) | Anthropic outage, runaway cost, prompt regression |
| `ROLLBACK_SEND` | `/api/email/approve-and-send` | Resend outage, accidental campaign-pause needed |
| `ROLLBACK_CAL_WRITE` | `/api/calendar/create` outbound | GCal API issue, accidental dashboard-create flood |
| `ROLLBACK_CAL_SYNC` | `/api/calendar/sync-in` (hourly cron + manual) | GCal pull-side issue |

Removing the flag (or setting it to anything other than `"true"`) re-enables. None of these affect read paths; existing data stays visible.

---

## Severity rollup

| Severity | Findings |
|----------|----------|
| Critical | none |
| High | R1 (cron idempotency gaps), R4 (no error boundaries), R7 (no multi-write txns) |
| Medium | R5 (rollback flags undocumented), R6 (NODE_ENV vs VERCEL_ENV inconsistency) |
| Low | R3 (campaign-runner backoff, already in LATER) |
| Info | R2 (Resend webhook robust), Operational runbook (above) |

---

## Out of scope

- Deep audit of `morning-brief`, `touchpoint-reminder`, `recompute-health-scores`, `inbox/scan`, `gmail/sync` routes.
- Schema changes for idempotency keys.
- Backoff implementation in campaign-runner.

---

## Remaining placeholders

- None.
