# P1: messages_log + event_invites store intent, not actual delivery

**Severity:** P1
**Filed:** 2026-05-04
**Owner:** Alex Hollien
**Source incident:** Content Creation Day dry-run (event_id `6ead0a36-ec15-4fce-a7b9-769279c7f5a5`), 2026-05-04 19:23-19:24 UTC
**Related plan:** `~/.claude/plans/plan-3-sentence-summary-binary-lemon.md` Phase B

---

## Problem

`messages_log.recipient_email` and `event_invites.status` both store the **intended** recipient and the **intended** send outcome at the moment `sendMessage()` is called. Neither column records what Resend actually did with the email after the API handoff.

Two specific failure modes this masks:

1. **Safe-recipient diversion.** When `RESEND_SAFE_RECIPIENT` is set (dry-run mode), the Resend adapter rewrites `to:` to the safe address but `messages_log.recipient_email` keeps the original intended address. Reading `messages_log` post-send looks like 24 real agents got the email. They did not. Only `alexhollien@gmail.com` did.
2. **Provider rejections / bounces.** A row can land as `status='sent'` in `messages_log` based on a successful Resend API 202, then bounce or get suppressed downstream. The append-only `event_sequence` jsonb captures the lifecycle, but the top-level `status` column does not.

This was the exact failure mode in the Content Creation Day handoff: a prior session read `messages_log` + `event_invites` and reported "all 24 sends delivered to real agents." They had not. The dry-run had diverted everything to one inbox per `RESEND_SAFE_RECIPIENT`. Resend dashboard was the only ground truth.

## Evidence

- Dry-run for event `6ead0a36-ec15-4fce-a7b9-769279c7f5a5` at 19:23-19:24 UTC 2026-05-04: `event_invites.status='sent'` for 24 rows, `messages_log.recipient_email` shows the 24 agent addresses, but Resend dashboard shows all 24 outbound `to:` fields as `alexhollien@gmail.com`.
- `src/lib/messaging/adapters/resend.ts` rewrites the `to:` field when `RESEND_SAFE_RECIPIENT` is set; it does not propagate the rewrite back into `messages_log`.
- `src/lib/messaging/send.ts` writes `recipient_email` from the caller's `recipient.email` arg, before the adapter runs.

## Impact

- Verification queries in plan files and runbooks that read `messages_log.status='sent'` or `event_invites.status='sent'` to confirm delivery are silently wrong in any environment with `RESEND_SAFE_RECIPIENT` set.
- Activity ledger entries (`activity_events.verb='event.invite.sent'`) inherit the same intent-vs-actual gap because they fire on `sendMessage()` return, not on a Resend webhook callback.
- Stalls debugging when a real send misroutes; the source-of-truth is Resend dashboard, which is not queryable from CRM data.

## Recommended fix (sketch, not scoped)

Three layers, ranked by blast radius:

1. **Schema:** add `messages_log.actual_recipient_email text` populated by the adapter post-send (after `RESEND_SAFE_RECIPIENT` rewrite if applicable). Keep `recipient_email` as intent. Add `messages_log.delivery_confirmed_at timestamptz` populated by the Resend webhook on `email.delivered`.
2. **Documentation:** add a comment to `messages_log.recipient_email` and `event_invites.status` columns via `COMMENT ON COLUMN` calling out that these are intent-only.
3. **Query convention:** runbooks and plans must verify delivery against `message_events` (webhook-sourced) joined to `messages_log.provider_message_id`, not against `messages_log.status` directly. Update all existing PLAN.md / runbook query templates accordingly.

## Acceptance criteria (when this ticket gets worked)

- [ ] `messages_log` has a column or jsonb path that records the actual `to:` field Resend received, distinct from intended recipient.
- [ ] A query convention exists for "did this send actually deliver to this person" that does not rely on `messages_log.status` alone.
- [ ] At least one existing runbook / plan (Slice 8 weekly-edge-send, EventInvite Phase 3.3 verification) updated to use the new convention.
- [ ] Comments on `messages_log.recipient_email` + `event_invites.status` explicitly flag intent-only semantics.

## References

- `~/.claude/plans/plan-3-sentence-summary-binary-lemon.md` line 697-701 (verification discipline note that prompted this ticket)
- `~/crm/src/lib/messaging/send.ts`
- `~/crm/src/lib/messaging/adapters/resend.ts`
- `~/crm/src/app/api/webhooks/resend/route.ts`
- Standing Rule 23 (Supabase CLI exclusive) -- any schema change here lands as a migration via `supabase migration new`

---

Remaining placeholders: none.
