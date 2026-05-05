# Content Creation Day -- Inbound RSVP Pipeline Audit

**Date:** 2026-05-04
**Scope:** End-to-end RSVP handling pipeline for the Content Creation Day send (24 agents, EVENT_ID=`6ead0a36-ec15-4fce-a7b9-769279c7f5a5`)
**Mode:** Read-only. No code or data modifications.

---

## Verdict: YELLOW (audit was CORRECT)

This audit's read of the pipeline was correct. A separate handoff mistakenly claimed the 24 sends had reached real agent inboxes; that claim was wrong. Resend dashboard confirms all 24 sends had `to: alexhollien@gmail.com` -- the dry-run worked exactly as designed under `RESEND_SAFE_RECIPIENT`. The audit's Phase B readiness call (real send still pending separate authorization) stands.

**Database columns are misleading for send verification.** `messages_log.recipient_email` stores the INTENDED recipient (the agent), not the actual Resend `to:` field. `event_invites.status='sent'` means "the script attempted a send", not "the agent received the email". Both columns conflate intent with outcome. Reading the database alone to confirm "did this email actually go to this agent" is unreliable by design. **The Resend dashboard (or the Resend API queried by `provider_message_id`) is the only ground truth for actual delivery `to:` field.** No future audit may declare a send "real" using only database queries; audits must hit Resend.

The **outbound send path is GREEN.** The Phase B real send to 24 agents can proceed safely once the safe-recipient diversion is cleared.

The **inbound RSVP automation path is RED.** Two P0 defects make automatic RSVP handling unreliable: the inbox-scan cron is failing every 30 minutes, and the Gmail sync route cannot persist new emails. Replies will arrive in Alex's Gmail inbox normally but will NOT surface in `/today` or get auto-drafted by Claude until those defects are fixed. **Tonight's send does not depend on those paths**, but Alex needs to plan to triage RSVPs in Gmail manually for the next 24-72 hours.

---

## Executive summary

The email-send infrastructure (Resend adapter, templates, messages_log, activity_events ledger, approval surface) is healthy. The Phase 3.3 dry-run sent 24 emails earlier today; all rows landed in `messages_log` with `status='sent'`, all 24 `event_invites` rows flipped to `status='sent'`, and 24 `event.invite.sent` activity events fired. RESEND_SAFE_RECIPIENT diverted every delivery to `alexhollien@gmail.com` with `[TEST -> ...]` prefixed subjects, exactly as designed. Resend domain DNS for `alexhollienco.com` is verified (DKIM + DMARC publish; SPF does not list Resend explicitly but DKIM alignment carries DMARC).

The inbound side is broken in two ways. `GOOGLE_USER_EMAIL` in `.env.local` is the literal placeholder string `<placeholder-replace-with-real-gmail>`, so `/api/inbox/scan` has been logging "user lookup failed: no user matched" every 30 minutes for at least 24 hours. Independently, `/api/gmail/sync` upserts to `emails` are crashing on a NOT NULL constraint on `user_id` because the route does not include `user_id` in the upsert payload. Any RSVP that lands in Gmail will not be ingested, will not produce an `email_drafts` row, and will not surface in the approval queue.

Webhook ingress for engagement events (delivered, opened, clicked) is also disconnected: zero rows in `message_events` for any of the 24 sends. Root cause is the long-standing Resend dashboard config blocker (already documented in `BLOCKERS.md`). This is informational, not a Phase B blocker.

---

## Stage-by-stage findings

### Stage 1 -- Gmail inbound (RED)

**Components**
- Cron: `vercel.json` registers `/api/gmail/sync` at 15:00, 19:00, 23:00 UTC daily; `/api/inbox/scan` every 30 minutes.
- OAuth: `src/lib/gmail/oauth.ts:26` hardcodes Alex's `USER_ID = b735d691-4d86-4e31-9fd3-c2257822dca3`. Refresh token is present in `oauth_tokens` (verified via `last_used_at=2026-05-04T20:00:43Z`, scope union covers `gmail.readonly`, `gmail.modify`, `calendar.events`).
- Sync route: `src/app/api/gmail/sync/route.ts:49-138` lists unread, classifies, upserts to `emails`, fires-and-forgets to `/api/email/generate-draft`.
- Scan route: `src/app/api/inbox/scan/route.ts:22-44` reads `GOOGLE_USER_EMAIL` env and resolves it against `auth.users` via `listUsers({perPage:1000})`.

**P0 -- inbox-scan placeholder env (recurring failure for 24+ hours).** `GOOGLE_USER_EMAIL` is set to the literal string `<placeholder-replace-with-real-gmail>` in `.env.local`. There is no matching `auth.users` row. `error_logs` shows 25 rows of "`/api/inbox/scan: user lookup failed: no user matched`" between 2026-05-04 08:30Z and 20:00Z (every 30 minutes). All inbound thread classification is dead. **Fix: set `GOOGLE_USER_EMAIL=alex@alexhollienco.com` in `.env.local` and Vercel env (Production + Preview).**

**P0 -- gmail/sync upsert NOT NULL crash.** `/api/gmail/sync/route.ts:89-114` upserts an emails row that omits `user_id`. The `emails` table has a NOT NULL constraint on `user_id` (column exists per live schema probe). Two errors logged today (08:43Z and 15:00Z): "`emails upsert failed: null value in column user_id of relation emails violates not-null constraint`". Even when the cron runs without OAuth issues, no inbound email is persisted, no contact match is recorded, and the fire-and-forget to `generate-draft` never gets a valid `email_id`. **Fix: include `user_id: 'b735d691-4d86-4e31-9fd3-c2257822dca3'` in the upsert payload at `route.ts:91-110` (matching the single-tenant constant from `oauth.ts:26`). Same single-tenant constant should be threaded.**

**Token refresh logic.** `src/lib/gmail/sync-client.ts:31-46` registers a `tokens` event listener that calls `saveTokens(t)`, so refresh-on-expiry is wired and proven by the `last_used_at` timestamp. No P0 here.

### Stage 2 -- Agent resolution (GREEN, currently dormant)

**Components**
- `src/lib/gmail/filter.ts:30-48` -- `classifyEmail(input)` consults a `Map<email,contactId>` built from `contacts` and falls through to a domain regex matching the major brokerage TLDs and major mail providers.
- `loadContactMap()` in sync-route reads `contacts.email`, lowercases, builds the map (no domain disambiguation needed).

**Coverage of the 24 invitees (live probe).**
| Email pattern | Count | Will match |
|---|---|---|
| `@gmail.com` | 13 | YES via domain regex (`gmail` token) |
| `@cbrealty.com`, `@kw.com`, `@coldwell*` | 2 | YES via brokerage tokens |
| `@yahoo.com`, `@TackettTeam.com`, `@calledtoclose.co`, `@infinitebeaconhomes.com`, `@gcanyonrealty.com`, `@barrettre.com` | 9 | YES via contact-map lookup (all 24 are in `contacts` and matched to `event_invites`) |

**No-match behavior.** Emails that fail both contact-match and domain-match are dropped (skipped, reason recorded) at `src/app/api/gmail/sync/route.ts:77-80`. Not crash, not queue. Ledger captures the skip reason in the route response, not in `error_logs` (skipped intentionally to avoid noise).

**Risk note.** Joey Gutierrez's contact email is `Homeprosreco@gmail.com` and he ALSO has an `auth.users` row at `homeprosreco@gmail.com`. If Joey replies, the contact-map lookup uses lowercase comparison (good), so it will match the contact regardless of his RSVP-from address casing.

### Stage 3 -- Activity event write (GREEN, dependent on Stage 1)

**Components**
- `src/lib/activity/writeEvent.ts:1-44` -- service-role insert into `activity_events`, never throws, logs to `error_logs` on failure.
- The Phase B send wrapper at `src/lib/events/sendEventInvite.ts:91-110` calls `writeEvent` after each send (verified by 24 `event.invite.sent` rows from the dry-run).

**Inbound write coverage.** When Stage 1 fixes land, Gmail-side activity will surface via:
- `/api/gmail/sync` -> upsert to `emails` (no activity event today; this is a known gap, not a P0 blocker for tonight's send).
- `/api/inbox/scan` -> insert into `inbox_items` (also no `writeEvent` call today; same gap).
- `/api/email/generate-draft` -> insert into `email_drafts` with `audit_log.event_sequence` (per-draft trace).

**Idempotency.** `inbox_items` is gated by a SELECT-existing-by-thread-id check at `route.ts:71-78`; re-poll on the same thread skips rather than re-inserts. `emails` upsert is keyed on `gmail_id` via `onConflict`. No double-write risk.

### Stage 4 -- Draft generation (UNREACHABLE today, code is healthy)

**Components**
- `src/app/api/email/generate-draft/route.ts:271-279` POST handler, Bearer CRON_SECRET auth.
- `src/lib/ai/draft-revise.ts` -> `callClaude` with `DEFAULT_MODEL = "claude-sonnet-4-5"` (verified at `src/lib/ai/_client.ts`).
- `withRetry` 10s timeout, 2 retries with 1s/2s backoff (`src/lib/retry.ts`).

**Idempotency.** `route.ts:84-107` short-circuits if a non-discarded draft already exists for `email_id`.

**Prompt context.** `route.ts:144-162` builds `senderTier` from `contact.type` and `contactName`/`contactRelationship`. Tier-mapping inverts to `agent` for `type='realtor'` or `type='agent'`; for the Content Creation Day list, every recipient is tagged `type='agent'` (Slice 7B seed) so they will all map to tier `A`.

**Failure handling.** `route.ts:168-174` returns 502 on Claude failure and writes to `error_logs`. Not silent.

**Why unreachable today.** The fire-and-forget call at `gmail/sync/route.ts:34-47` is wrapped in `.catch(()=>{})` and only runs after a successful emails upsert. With the user_id NOT NULL crash blocking the upsert, the trigger never fires.

### Stage 5 -- Approval surface (GREEN)

**Components**
- Page: `src/app/(app)/drafts/page.tsx:11,34-36` enforces Supabase session, redirects to `/login?next=/drafts` if unauthenticated.
- Client: `src/app/(app)/drafts/drafts-client.tsx` (568 lines) renders the queue, countdown timer, send-now / create-gmail-draft / discard / revise actions.
- Server action: `src/app/api/email/approve-and-send/route.ts:84-345` validates session OR Bearer, transitions state, emits `writeEvent('email.sent')`.

**State machine integrity.** `validateAction` at `src/lib/messaging/draftActions.ts` rejects expired or already-sent drafts with 409 (verified by recent error_logs hardening from PRs #29, #31, #32). All four actions (send_now, create_gmail_draft, revise, discard) appended to `audit_log.event_sequence` for traceability.

**Production state.** Zero `pending_review` drafts in the Slice 8 view; zero `email_drafts` rows in the last 24 hours (consequence of Stage 1 being broken, not Stage 5).

### Stage 6 -- Resend outbound (GREEN)

**Components**
- Adapter: `src/lib/messaging/adapters/resend.ts:14-42`. Honors `RESEND_SAFE_RECIPIENT`. Uses `withRetry` (10s/2 retries).
- Legacy direct caller: `src/lib/resend/client.ts` -- `sendDraft` for `/api/email/approve-and-send`. Same RESEND_SAFE_RECIPIENT honor + `replyTo` + In-Reply-To/References threading.
- From-address: `Alex Hollien <alex@alexhollienco.com>` hardcoded in both adapters.

**Domain DNS state (live `dig` 2026-05-04 20:08Z).**
- SPF: `v=spf1 a include:_spf.google.com include:_spf.mlsend.com mx ~all` -- does not list Resend explicitly. **Acceptable** because Resend's envelope MAIL FROM uses a Resend-owned bounce domain and DKIM alignment carries DMARC.
- DKIM: `resend._domainkey.alexhollienco.com` -- public RSA key published. PASS.
- DMARC: `v=DMARC1; p=none;` -- lenient, won't reject on misalignment. PASS.

**Reply threading.** `sendDraft` (used by `/api/email/approve-and-send`) sets `In-Reply-To` and `References` headers when an inbound thread is being answered. The launch wrapper for tonight (`sendEventInvite`) does NOT set thread headers because these are first-touch invites, not replies. Correct behavior.

**Reply-to.** The launch path uses `sendMessage` -> Resend adapter, which does NOT set a `replyTo` header. Replies will return to the `From` address (`alex@alexhollienco.com`). For tonight's send, this is what Alex wants. Cloudflare Email Routing forwards `alex@alexhollienco.com` -> `ahollien@azgat.com`, so RSVPs surface in Alex's normal Gmail inbox.

**Burst rate.** Launch script `scripts/send-content-creation-day-launch.ts:90-92` paces with `await new Promise(r => setTimeout(r, 600))` between sends -- 24 sends will take roughly 14-16 seconds. Resend's documented limit is 10/second; we are well under.

**P2 -- SPF gap.** Adding `include:_spf.resend.com` would harden alignment under stricter receiver policies. Not blocking. Log to LATER.md.

### Stage 7 -- Send-side activity event (GREEN)

**Components**
- `src/lib/events/sendEventInvite.ts:97-110` writes `event.invite.sent` after each successful send, with `to_email`, `message_log_id`, `provider_message_id` in `context`.
- 24 rows verified in `activity_events` from the dry-run (object_table=`event_invites`, verb=`event.invite.sent`, occurred_at 2026-05-04 19:23-19:24Z).

**Last-touch update.** `sendEventInvite` does NOT update `contacts.last_touch_at` directly. The contact-side last-touch logic lives in the relationship-health refresh (`/api/cron/recompute-health-scores`). For tonight's purposes, the activity_events ledger is sufficient; health scores recompute at the next 11:00 UTC cron tick.

---

## Cross-cutting

**Soft-delete compliance.** All probed tables (events, event_invites, contacts, templates, messages_log, oauth_tokens) carry `deleted_at` timestamps. Phase B Step 2 must use `UPDATE ... SET status='queued'`, not `DELETE`. Standing Rule 3 honored.

**Logging.** All five inbound/outbound routes write to `error_logs` on failure with route prefix and structured context. Successes do not write to error_logs (intentional). 30 entries pulled from the last 36 hours; signal-to-noise is good (the 25 inbox-scan failures dominate).

**Rate limits we should worry about tonight.**
- Resend: 10/sec, 24 sends paced at 600ms = comfortable.
- Claude API: not invoked tonight (no draft generation in the path).
- Gmail API: not invoked for the send itself; invoked only by inbound sync/scan crons that are already failing (so no risk of bursting).
- supabase service-role: 24 single-row updates + 24 single-row writes to messages_log + 24 to activity_events = 72 short writes over 14 seconds. No risk.

**Failure mode of the launch loop.** `scripts/send-content-creation-day-launch.ts:97-101` catches per-send exceptions, logs `FAIL {name}: {message}`, increments `failed`, and continues. No retry-with-backoff. No dead-letter. **Acceptable for first-touch invites:** if 1-2 sends fail (Resend transient 5xx), Alex can re-run the script -- it filters `status='queued'` and skips already-sent rows by status check.

**Idempotency of re-running the launch script.** The script filters `event_invites WHERE status='queued' AND deleted_at IS NULL`. If tonight's run partially fails and Alex re-runs, only failed/queued rows resend. Good.

---

## P0 list (MUST fix before relying on inbound automation)

1. **`GOOGLE_USER_EMAIL` placeholder in .env.local + Vercel.** Replace `<placeholder-replace-with-real-gmail>` with `alex@alexhollienco.com` in `.env.local` and via `vercel env add GOOGLE_USER_EMAIL production` (and `preview`). Recommended fix file: `.env.local` line containing `GOOGLE_USER_EMAIL=`.

2. **`/api/gmail/sync` upsert missing `user_id`.** Add `user_id: 'b735d691-4d86-4e31-9fd3-c2257822dca3'` (or thread the constant from `gmail/oauth.ts:26`) to the upsert payload at `src/app/api/gmail/sync/route.ts:91-110`. Verify with `pnpm typecheck && pnpm build`. **DO NOT** apply tonight; this is a separate plumbing PR.

## P1 list (fix this week)

1. **`/api/inbox/scan` does not write `writeEvent`.** Inbound thread surfacing has no activity-ledger trace. When a thread is scored and inserted into `inbox_items`, no `inbox.thread_surfaced` event fires. Add a `writeEvent` call after the `inbox_items` insert at `src/app/api/inbox/scan/route.ts:103-127`. Low-risk addition.

2. **Resend webhook -> 0 message_events.** Existing BLOCKERS entry. Resend dashboard endpoint URL or signing-secret config drift. Cannot be fixed from code; needs Alex to verify dashboard config and fire a test event. Tonight's send will produce no engagement telemetry until this clears, but invitees will still receive mail.

## P2 list (logged for later)

1. **SPF doesn't include Resend.** Add `include:_spf.resend.com` to the SPF TXT for `alexhollienco.com` for stricter receiver alignment. DMARC alignment via DKIM still passes today.

2. **`replyTo` not set on event invite sends.** If Alex ever wants RSVPs to flow to a specific routing address (e.g., a CRM webhook endpoint), wire `replyTo` through `sendMessage` and the Resend adapter.

3. **`emails.user_id` constraint fix is a single-tenant lock-in.** Threading `user_id` through `gmail/sync` makes the route ready for multi-tenant later, per the LATER.md "Per-user OAuth token threading" entry.

---

## Recommended end-to-end smoke test (post-Phase B, post-fixes)

Once the P0 fixes land, smoke the inbound side with this sequence:

1. From a Gmail account that maps to a `contacts` row (e.g., `Homeprosreco@gmail.com`), reply to the Content Creation Day invite with text "Yes, I'll be there".
2. Wait 30 minutes (next inbox-scan cron tick) OR manually trigger `curl -H "Authorization: Bearer $CRON_SECRET" https://gat-bos.vercel.app/api/gmail/sync?hours=2`.
3. Verify `emails` row inserted with `is_contact_match=true`, `contact_id=<Joey's id>`.
4. Verify `email_drafts` row generated with `status='generated'`, `escalation_flag` likely null (no marlene/agent_followup keywords).
5. Verify `inbox_items` row inserted with `score>0`, `status='pending'`.
6. Open `/drafts` in browser, see the queued draft, hit Approve, send goes via Resend.
7. Verify `event_invites.status` flipped to `rsvp_yes` (NOTE: today, `event_invites.status` does NOT auto-update from inbound replies. Logged as a P3 follow-up: wire a post-draft hook that scans for "yes/no/maybe" tokens and updates `event_invites` accordingly. For tonight, RSVPs are tracked manually in Gmail.).

---

## Phase B readiness summary

| Check | Status |
|---|---|
| RESEND_SAFE_RECIPIENT diversion is correct, removable | YES (`alexhollien@gmail.com`, line 1 of `.env.local`) |
| 24 contacts have valid emails (no placeholders) | YES (24 rows verified, all have real email addresses) |
| `event-invite` template v2 exists with new subject | YES (id=`883fb778-a842-4c63-9894-4d3ab3efc622`, version 2, subject does NOT contain `[TEST -> ...]` literal -- prefix is via `{{test_prefix}}` Handlebars var) |
| sendMessage picks v2 by default | YES (orders by version DESC, picks 2) |
| Launch script runs from `EVENT_ID` + `ALEX_USER_ID` env | YES (script verified at `scripts/send-content-creation-day-launch.ts`) |
| Resend domain DNS verified | YES (DKIM + DMARC; SPF acceptable via DKIM alignment) |
| event_invites soft-revertable | YES (24 rows currently `status='sent'`, can UPDATE back to `queued`) |
| messages_log preserves test history | YES (Standing Rule 3 honored; we touch only `event_invites.status`) |

**Phase B can proceed once Alex says go.** Inbound P0s are NOT blockers for the send itself. They affect what happens AFTER agents reply. Plan to triage RSVPs manually in Gmail for the next 24-72 hours while the P0 fixes land in a separate plumbing PR.

---

Remaining placeholders: none.
