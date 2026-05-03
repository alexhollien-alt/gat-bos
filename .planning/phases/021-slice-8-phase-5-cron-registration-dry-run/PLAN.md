# Phase 021 -- Slice 8 Phase 5: Cron Registration + First Live Dry-Run

**Generated:** 2026-05-03
**Base:** main @ post-PR-#21 merge (Slice 8 Phase 4 squash)
**Branch:** `gsd/021-slice-8-phase-5-cron-registration-dry-run`
**Parent plan:** `~/.claude/plans/crm-weekly-edge-campaign-infra-2026-04-30.md` Phase 5
**Classification:** PLUMBING (Build vs Plumbing protocol). vercel.json + 1 small resolver branch + manual prod verification.
**Pre-authorization:** Alex explicit "Lock it keep proceeding keep going. I trust your recommendations." -- 2026-05-03. Clears Standing Rule 5 BLOCKING gates for: PR #21 merge, Phase 5 PR open + merge, prod cron registration, single live send to alex@alexhollienco.com.

---

## Open Questions -- LOCKED

| OQ | Choice | Rationale |
|----|--------|-----------|
| Dry-run recipient scope | **Add `dry-run-alex` recipient list slug, hardcoded to alex@alexhollienco.com** | Surgical: one resolver branch, no env var mutation, no risk of mass-send leak. RESEND_SAFE_RECIPIENT remains untouched (its current value is opaque to this session per security boundary). |
| Recipient list switch on draft | **Direct UPDATE on campaign_drafts row pre-approval via supabase CLI psql** | One-row mutation; simpler than building a UI dropdown for a single dry-run. |
| Cron registration timing | **Register all 3 in vercel.json this phase; first natural fire is Mon 13:00 UTC** | Per parent plan Phase 5. |
| Manual trigger ordering | **altos-pull → assemble → UPDATE recipient_list_slug → approve → send** | Mirrors weekly cycle; only deviation is the recipient swap for dry-run. |
| Approve mechanism | **Via /drafts UI (Campaign tab → Approve button)** | Verifies the Phase 4 UI surface end-to-end. |
| Post-dry-run state | **Leave dry-run-alex resolver in code (LATER cleanup)** | Useful for future dry-runs; cost is one branch in resolver. Documented in LATER.md. |

---

## Pre-flight Verification Order

Run all eight. Halt and report on miss.

| # | Check | Expected | Action on miss |
|---|-------|----------|----------------|
| a | `gh pr view 21 --json mergeStateStatus,mergeable` | `CLEAN` + `MERGEABLE` | Stop, report |
| b | `vercel env ls production \| grep RESEND_WEBHOOK_SECRET` | row present | Stop, set via `vercel env add` |
| c | `vercel env ls production \| grep CRON_SECRET` | row present | Stop, set |
| d | `vercel env ls production \| grep RESEND_API_KEY` | row present | Stop, set |
| e | After PR #21 merge: `git log --oneline -1` on main | shows Phase 4 squash | Stop, audit |
| f | `psql -c "SELECT to_regclass('public.campaign_drafts')"` | not NULL | Phase 4 migration missing -- stop |
| g | `psql -c "SELECT to_regclass('public.weekly_snapshot')"` | not NULL | Phase 1 missing -- stop |
| h | `cat vercel.json \| jq '.crons[].path' \| grep weekly-edge` | 0 matches | If non-zero, audit before adding |

---

## Task Order (with gates)

| # | Task | Type | Gate |
|---|------|------|------|
| 1 | Merge PR #21 (`gh pr merge 21 --squash --delete-branch`) using `CLAUDE_AUTOMATION_PR_MERGE=21` env-var bypass per AI_AGENT_OPERATING_MODEL.md Section 13 precedent | git | merge SUCCESS, branch deleted on remote |
| 2 | `git checkout main && git pull` | git | local main matches remote HEAD |
| 3 | `git checkout -b gsd/021-slice-8-phase-5-cron-registration-dry-run` | git | branch created |
| 4 | Add `dry-run-alex` branch in `src/lib/campaigns/recipients.ts` (hardcoded recipient: alex@alexhollienco.com, contactId='dry-run', fullName='Alex Hollien (dry-run)', userId=null) + add slug to `KNOWN_LISTS` set | code | typecheck PASS |
| 5 | Edit `vercel.json` -- append 3 cron entries: `/api/cron/altos-pull` `0 13 * * 1`, `/api/cron/weekly-edge-assemble` `0 18 * * 2`, `/api/cron/weekly-edge-send` `0 20 * * 2` | config | jq parse PASS, all paths match files on disk |
| 6 | `cd ~/crm && pnpm typecheck && pnpm build` | gate | both PASS |
| 7 | Commit + push + `gh pr create --fill` | git | PR opens, Vercel preview SUCCESS |
| 8 | Merge PR (`CLAUDE_AUTOMATION_PR_MERGE=<#>` bypass) | git | merge SUCCESS |
| 9 | Wait for prod deploy SUCCESS (`vercel ls --scope=alex-8417s-projects \| head -3` until READY) | gate | deploy READY on main |
| 10 | `vercel cron ls` against the new prod deploy | gate | shows altos-pull, weekly-edge-assemble, weekly-edge-send in output |
| 11 | Manual trigger altos-pull: `curl -H "Authorization: Bearer $CRON_SECRET" https://gat-bos.vercel.app/api/cron/altos-pull` | gate | 200; row in `weekly_snapshot` for current ISO Monday |
| 12 | Manual trigger assemble: `curl -H "Authorization: Bearer $CRON_SECRET" https://gat-bos.vercel.app/api/cron/weekly-edge-assemble` | gate | 200; new `campaign_drafts` row, status='pending_review' |
| 13 | `psql -c "UPDATE campaign_drafts SET recipient_list_slug='dry-run-alex' WHERE id='<id>' AND status='pending_review'"` (uses `supabase db psql` or linked URL) | data | 1 row updated |
| 14 | Open `/drafts` (Campaign tab) → click Approve on the row. **Path A patch applied** to `src/app/api/campaigns/drafts/route.ts`: all 3 UPDATE branches (approve / reject / edit_html) now (a) chain `.select("id")` after `.eq("id", body.id)` so supabase-js returns the rows actually written, (b) emit `logError(ROUTE, ...)` breadcrumbs to `error_logs` on update error AND on 0-row match, (c) return HTTP 409 with explicit message when 0 rows match (was previously silent 200). Closes Gate 14 silent-failure repro from BLOCKERS 2026-05-03. | UI | DB shows `approved_at` populated, `status='approved'`; on failure, `error_logs` row with endpoint=`/api/campaigns/drafts` + draft_id context appears within 1s of click |
| 15 | Manual trigger send: `curl -H "Authorization: Bearer $CRON_SECRET" https://gat-bos.vercel.app/api/cron/weekly-edge-send` | gate | 200; response shows 1 recipient sent |
| 16 | Verify Resend send: query `messages_log` for the most recent row -- `to=alex@alexhollienco.com`, `provider='resend'`, `provider_message_id` populated, `status='sent'` | data | row exists |
| 17 | Wait ≤ 60s for Resend webhook delivery event → query `activity_events` for verb `email.delivered` or similar | data | event recorded |
| 18 | Inbox confirmation: Alex eyeballs alex@alexhollienco.com inbox for the Weekly Edge | manual | email received, renders correctly |

---

## Halt Conditions

- **Halt 1:** PR #21 not mergeable -- stop, report blocker.
- **Halt 2:** vercel.json jq parse fails -- stop, fix syntax.
- **Halt 3:** typecheck/build fails -- stop, fix at source.
- **Halt 4:** PR Vercel preview FAILED -- stop, read deploy logs.
- **Halt 5:** prod deploy fails post-merge -- rollback via `vercel rollback`.
- **Halt 6:** `vercel cron ls` missing one of the three -- audit `vercel.json` schema, do not retry without diagnosis.
- **Halt 7:** altos-pull returns non-200 or fails to upsert -- check Altos client status (placeholder mode acceptable per Phase 2 fill-and-flag).
- **Halt 8:** assemble returns non-200 or 0 markets -- inspect `weekly_snapshot` row count for current Monday.
- **Halt 9:** send returns non-200 or 0 recipients -- inspect `dry-run-alex` resolver wiring.
- **Halt 10:** Resend send returns failure -- inspect `RESEND_API_KEY` validity, capture error to `BLOCKERS.md`.
- **Halt 11:** No webhook event after 5 minutes -- inspect `RESEND_WEBHOOK_SECRET` against Resend dashboard's configured value.

---

## Rollback Plan

If dry-run fails post-send (e.g. wrong recipient, broken render):
1. `psql -c "UPDATE campaign_drafts SET deleted_at=now() WHERE id='<id>'"` (Standing Rule 3 soft delete).
2. `vercel rollback` to pre-Phase-5 deploy (preserves crons but reverts code).
3. Drop the 3 cron entries from `vercel.json` via revert commit on a hotfix branch.
4. Document failure mode in `BLOCKERS.md`, do not re-attempt without root cause.

No DB schema changes in this phase. Soft-delete on campaign_drafts is the only data side effect from a failed dry-run.

---

## Critical Files Touched

**Modified:**
- `vercel.json` (3 new cron entries)
- `src/lib/campaigns/recipients.ts` (add `dry-run-alex` branch + slug to KNOWN_LISTS)
- `BUILD.md` (Phase 5 Built entry)
- `LATER.md` (note `dry-run-alex` resolver kept for future dry-runs; consider unifying with a generic `single-recipient` mechanism)
- `~/.claude/state/STATUS.md` (Slice 8 Phase 5 SHIPPED entry on completion)

**Untouched:**
- `src/app/api/cron/altos-pull/route.ts` -- no edit
- `src/app/api/cron/weekly-edge-assemble/route.ts` -- no edit
- `src/app/api/cron/weekly-edge-send/route.ts` -- no edit
- `src/lib/messaging/send.ts` -- no edit
- All Slice 8 Phase 1-4 migrations -- no edit

---

## Verification at Phase Closure

1. `vercel cron ls` shows 3 new Weekly Edge crons in production.
2. `weekly_snapshot` has at least 1 row for current ISO Monday (placeholder data acceptable).
3. `campaign_drafts` shows the dry-run row with `status='sent'`, `sent_at` populated, `send_summary` reflects 1 success / 0 fail.
4. `messages_log` shows alex@alexhollienco.com Resend send, `status='sent'`, `provider_message_id` populated.
5. `activity_events` shows `campaign.draft_created`, `campaign.sent`, and downstream Resend webhook verb (`email.delivered` or platform-specific).
6. Inbox at alex@alexhollienco.com received the Weekly Edge issue, renders correctly under Phase 4 brand-audit thresholds.
7. `~/.claude/state/STATUS.md` updated with Phase 5 SHIPPED entry, recording the live first-send date and bypass log entries.
