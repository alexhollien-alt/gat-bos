# Phase 020 -- Slice 8 Phase 4: Weekly Edge Assemble + Send + Review Gate UI

**Generated:** 2026-05-02
**Base:** main @ `cf300d6` (Slice 8 Phase 3 merge)
**Branch:** `gsd/020-slice-8-phase-4-weekly-edge-assemble-send-review`
**Parent plan:** `~/.claude/plans/crm-weekly-edge-campaign-infra-2026-04-30.md` Phase 4
**Classification:** BUILD (Build vs Plumbing protocol). Includes one new migration + UI + 2 cron routes + 1 API route.
**Pre-authorization:** Alex explicit "Don't stop. Lock it. Proceed. Don't ask me anything" -- 2026-05-02. Clears Standing Rule 5 BLOCKING gates for the migration push and PR open. PR merge still routed through `automation.md` Phase Completion Protocol on Alex "ship it" trigger after this session ends.

---

## Drafts Schema Gap -- Resolution

**Choice: Option B -- new `campaign_drafts` table.**

**Rejected:**
- **Option A (extend `email_drafts` with `kind` column):** Pollutes a tightly-scoped Gmail-reply schema. `email_drafts.email_id` is `NOT NULL REFERENCES emails(id) ON DELETE CASCADE`; weakening to nullable undermines reply-path invariants. The 30-min `expires_at` default + `escalation_flag` + `email_draft_status` enum are reply-shaped and meaningless for campaigns.
- **Option C (generic `drafts` table + migrate existing rows):** High-risk teardown of working `/drafts` UI. No upside.

**Why B wins:**
1. Different lifecycle: campaigns have weekly cadence + recipient-list expansion; replies have per-email 30-min expiry.
2. Different relationships: campaigns reference `recipient_list_slug`; replies reference one parent `email_id`.
3. Different RLS scope: campaigns are admin-tier (alex-only on `auth.jwt() email`); replies follow per-account scoping post-Slice 7B.
4. UI tab pattern (Reply | Campaign) is cleaner than mixed-shape kind-filter rows.

---

## Open Questions -- LOCKED

| OQ | Choice | Rationale |
|----|--------|-----------|
| Drafts schema | **Option B** -- new `campaign_drafts` table | Above |
| Bulk approve | **Drop -- single-click only** | Cron writes one campaign draft per week; bulk = over-engineering |
| Recipient list seed | **`contacts WHERE type='agent' AND deleted_at IS NULL`** (5 seed agents from Slice 7B) | Concrete recipient set already exists; subscriber-list table deferred to LATER.md |
| Vercel cron registration | **Defer to Phase 5** | Phase 5 owns `vercel.json` + first live dry-run |
| Migration push timing | **Push in this phase** (BLOCKING-gate cleared by pre-authorization) | Slice 7C precedent: migrations push within their own phase, not deferred |
| Status enum vs text | **Text + CHECK constraint** | Lighter migration, no enum-rename risk later. Values: `pending_review`, `approved`, `rejected`, `sent`, `send_failed` |

---

## Pre-flight Verification Order

Run all six. Halt and report on miss.

| # | Check | Expected | Action on miss |
|---|-------|----------|----------------|
| a | `git rev-parse main` | `cf300d6...` | If main ahead, audit drift before branching |
| a | `git status -s` | known untracked only (AGENTS.md, PROJECT_CONTEXT.md, docs/{architecture,executive,infrastructure}/) | Stop, report |
| b | `psql -c "SELECT to_regclass('public.weekly_snapshot')"` | not NULL | Phase 1 missing -- stop |
| c | `psql -c "SELECT slug FROM templates WHERE slug='weekly-edge'"` | 1 row | Template seed missing -- stop |
| d | `test -f src/lib/ai/weekly-edge-writer.ts` | exists | Phase 3 missing -- stop |
| e | `psql -c "SELECT to_regclass('public.campaign_drafts')"` | NULL | If non-NULL, audit before re-running migration |
| f | `git branch -a \| grep -i campaign-drafts` | 0 matches | Stop, report |

---

## Task Order (with gates)

| # | Task | Type | Gate |
|---|------|------|------|
| 0 | Confirm branch `gsd/020-slice-8-phase-4-weekly-edge-assemble-send-review` from main `cf300d6` | local git | autonomous |
| 1 | Migration: `campaign_drafts` table + RLS policies | migration + prod push | **PRE-AUTHORIZED** |
| 2 | `supabase gen types typescript --linked > src/lib/supabase/types.ts` | local | autonomous |
| 3 | `src/lib/campaigns/recipients.ts` -- recipient list resolver | TS code | autonomous |
| 4 | `src/lib/campaigns/render-weekly-edge.ts` -- snapshot+narrative -> rendered template | TS code | autonomous |
| 5 | `src/app/api/cron/weekly-edge-assemble/route.ts` -- assembly cron | TS code | autonomous |
| 6 | `src/app/api/cron/weekly-edge-send/route.ts` -- send cron | TS code | autonomous |
| 7 | `src/app/api/campaigns/drafts/route.ts` -- GET (list) + PATCH (approve/reject/edit) | TS code | autonomous |
| 8 | `src/app/(app)/drafts/page.tsx` + `drafts-client.tsx` -- tab split (Reply | Campaign), inline PreviewFrame, single-click approve/reject/edit | TS code | autonomous |
| 9 | Quality gates: `pnpm typecheck && pnpm build` | bash | autonomous |
| 10 | Update `BUILD.md`, `BLOCKERS.md`, `SCHEMA.md`, `LATER.md` | docs | autonomous |
| 11 | `git push -u origin gsd/020-...`, open PR via `gh pr create --fill` | git remote | **PRE-AUTHORIZED** |
| 12 | Print STATUS.md update for Alex review | docs | autonomous |

---

## Migration File

`supabase/migrations/<ts>_slice8_campaign_drafts.sql`

Schema:
```sql
CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug      text NOT NULL,            -- 'weekly-edge'
  template_version   integer,                  -- pin at assembly time; null = latest
  week_of            date NOT NULL,            -- ISO week the draft represents
  recipient_list_slug text NOT NULL,           -- 'agents-active' for v1
  subject            text NOT NULL,
  body_html          text NOT NULL,
  body_text          text NOT NULL,
  narrative_payload  jsonb NOT NULL,           -- { snapshots: [...], narratives: [...] } for re-render
  variables          jsonb NOT NULL DEFAULT '{}'::jsonb, -- variables passed to sendMessage()
  status             text NOT NULL DEFAULT 'pending_review',
  approved_at        timestamptz,
  approved_by        text,
  rejected_at        timestamptz,
  rejected_reason    text,
  sent_at            timestamptz,
  send_summary       jsonb,                    -- { recipients_sent, recipients_failed }
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  CONSTRAINT campaign_drafts_status_check
    CHECK (status IN ('pending_review','approved','rejected','sent','send_failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_drafts_week_template_uniq
  ON public.campaign_drafts (week_of, template_slug)
  WHERE deleted_at IS NULL AND status NOT IN ('rejected');

CREATE INDEX IF NOT EXISTS campaign_drafts_status_idx
  ON public.campaign_drafts (status, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_drafts_alex_all ON public.campaign_drafts;
CREATE POLICY campaign_drafts_alex_all
  ON public.campaign_drafts
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

DROP POLICY IF EXISTS campaign_drafts_service_all ON public.campaign_drafts;
CREATE POLICY campaign_drafts_service_all
  ON public.campaign_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

Idempotency: every CREATE is `IF NOT EXISTS` and every POLICY is `DROP IF EXISTS` first. Rollback companion at `_rollbacks/<ts>_slice8_campaign_drafts_rollback.sql`.

---

## Cron Routes (no `vercel.json` registration in this phase)

Both routes follow the existing cron-route pattern: Bearer `CRON_SECRET` auth, service-role client, structured JSON return, activity_events emission.

### 4a -- Assembly cron (`/api/cron/weekly-edge-assemble`)

Flow:
1. Auth check (Bearer `CRON_SECRET`).
2. Resolve current ISO week's Monday as `week_of`.
3. Idempotency: if `campaign_drafts` row exists for `(week_of, 'weekly-edge')` with status NOT IN (`rejected`), return 200 with `{ skipped: true, draft_id }`.
4. Fetch latest `weekly_snapshot` rows per tracked market for current `week_of`.
5. For each market: call `runWeeklyEdgeWriter()` from Phase 3.
6. Render `weekly-edge` template via `renderTemplate()` from `src/lib/messaging/render.ts` -- variables include narrative blocks per market plus standard footer fields.
7. Insert one `campaign_drafts` row, status='pending_review'.
8. Emit `activity_events` `campaign.draft_created` with `{ draft_id, week_of, market_count }`.
9. Return `{ ok: true, draft_id, week_of }`.

### 4b -- Send cron (`/api/cron/weekly-edge-send`)

Flow:
1. Auth check (Bearer `CRON_SECRET`).
2. Find `campaign_drafts WHERE status='approved' AND approved_at IS NOT NULL AND sent_at IS NULL ORDER BY approved_at LIMIT 1`.
3. If none: emit `activity_events` `campaign.send_skipped_unapproved`, return `{ ok: true, skipped: true }`.
4. Resolve recipient list via `resolveRecipientList(slug)`.
5. For each recipient: `sendMessage({ templateSlug: 'weekly-edge', recipient, userId: <alex-account-owner>, variables: <draft.variables> })`. Track sent_count + failed_count + per-recipient errors.
6. Update draft row: `sent_at = now()`, `status = 'sent'` (or `'send_failed'` if failed_count > 0), `send_summary = { sent, failed, errors }`.
7. Emit `activity_events` `campaign.sent` per success and `campaign.send_failed` per failure.
8. Return `{ ok: true, draft_id, sent, failed }`.

---

## API Route -- `/api/campaigns/drafts`

`GET`: returns `campaign_drafts WHERE deleted_at IS NULL ORDER BY created_at DESC` (latest 25). Wrapped in `{ drafts: [...] }`.

`PATCH`: body `{ id, action, body_html?, rejected_reason? }`. Actions:
- `approve`: write `approved_at = now()`, `approved_by = auth.jwt() email`, `status = 'approved'`. Reject if status != 'pending_review'.
- `reject`: write `rejected_at = now()`, `rejected_reason`, `status = 'rejected'`. Reject if status != 'pending_review'.
- `edit_html`: write `body_html = body_html`, leave status. Allowed only when status = 'pending_review'.

Auth: server-side Supabase client, requires authenticated user. RLS on `campaign_drafts` enforces alex-only.

---

## UI Extension -- `/drafts`

`page.tsx`:
- Existing prefetch keeps `["email_drafts", "pending"]`.
- Add second prefetch: `["campaign_drafts", "all"]` from new `/api/campaigns/drafts`.
- Pass both arrays to `DraftsClient`.

`drafts-client.tsx`:
- Add tab strip at top: `Reply (N)` | `Campaign (M)`. Default tab = `Reply`.
- Reply tab renders existing draft list unchanged.
- Campaign tab renders campaign rows: header (week_of, recipient list, status badge), inline `PreviewFrame` (reuse from `weekly-edge/preview/preview-frame.tsx`), Approve / Edit / Reject buttons.
- Edit opens an inline `<textarea>` against `body_html`; Save calls PATCH with `action='edit_html'`.
- Approve / Reject call PATCH with the matching action.
- After mutation: invalidate `["campaign_drafts", "all"]` query.

---

## Critical files

**New:**
- `supabase/migrations/<ts>_slice8_campaign_drafts.sql`
- `supabase/migrations/_rollbacks/<ts>_slice8_campaign_drafts_rollback.sql`
- `src/lib/campaigns/recipients.ts`
- `src/lib/campaigns/render-weekly-edge.ts`
- `src/app/api/cron/weekly-edge-assemble/route.ts`
- `src/app/api/cron/weekly-edge-send/route.ts`
- `src/app/api/campaigns/drafts/route.ts`

**Modified:**
- `src/lib/supabase/types.ts` (regenerated)
- `src/app/(app)/drafts/page.tsx`
- `src/app/(app)/drafts/drafts-client.tsx`
- `BUILD.md`
- `SCHEMA.md`
- `LATER.md` (recipient-list table; bulk approve revisit; subscriber preferences)

**Untouched:**
- `src/lib/messaging/send.ts`, `render.ts`, adapters, types
- `src/lib/ai/weekly-edge-writer.ts`
- `src/app/api/cron/campaign-runner/route.ts` (Slice 5A, out of scope)
- `email_drafts` table + `/api/email/drafts` route + reply-path UI

---

## Hard Rules

1. No `vercel.json` edits in this phase (Phase 5 owns).
2. No first live send in this phase (Phase 5 owns).
3. No bulk approve.
4. Migration is fully idempotent; safe to re-run.
5. Soft delete only (Standing Rule 3).
6. No em dashes (Standing Rule 2). No banned words (Standing Rule 7) -- writer post-process already handles, no new copy generated in this phase.
7. `pnpm typecheck && pnpm build` PASS before pushing.
8. PR merge to main waits for Alex "ship it" -- not auto-merged this session.
