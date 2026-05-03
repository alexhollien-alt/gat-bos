-- Slice 8 Phase 4 -- Weekly Edge mass-send infrastructure
-- BUILD: campaign_drafts table for cron-assembled campaign drafts.
--
-- One row per (week_of, template_slug) for the active draft cycle. Cron at
-- /api/cron/weekly-edge-assemble inserts pending_review rows; reviewer in
-- /drafts approves/rejects/edits; cron at /api/cron/weekly-edge-send
-- expands recipient list and dispatches via sendMessage().
--
-- Distinct from public.email_drafts (Gmail reply schema, NOT NULL FK to
-- emails). Sibling table -- different lifecycle, different RLS scope.
-- See ~/.claude/plans/crm-weekly-edge-campaign-infra-2026-04-30.md Phase 4
-- and ~/crm/.planning/phases/020-slice-8-phase-4-weekly-edge-assemble-send-review/PLAN.md
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE POLICY.

CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug        text NOT NULL,
  template_version     integer,
  week_of              date NOT NULL,
  recipient_list_slug  text NOT NULL,
  subject              text NOT NULL,
  body_html            text NOT NULL,
  body_text            text NOT NULL,
  narrative_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  variables            jsonb NOT NULL DEFAULT '{}'::jsonb,
  status               text NOT NULL DEFAULT 'pending_review',
  approved_at          timestamptz,
  approved_by          text,
  rejected_at          timestamptz,
  rejected_reason      text,
  sent_at              timestamptz,
  send_summary         jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT campaign_drafts_status_check
    CHECK (status IN ('pending_review','approved','rejected','sent','send_failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_drafts_week_template_active_uniq
  ON public.campaign_drafts (week_of, template_slug)
  WHERE deleted_at IS NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS campaign_drafts_status_idx
  ON public.campaign_drafts (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS campaign_drafts_week_idx
  ON public.campaign_drafts (week_of DESC)
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

COMMENT ON TABLE public.campaign_drafts IS
  'Slice 8 Phase 4. Cron-assembled mass-send campaign drafts. Distinct from email_drafts (Gmail reply schema). Single-tenant alex-only RLS; multi-account scoping deferred until Slice 8 goes multi-tenant.';
