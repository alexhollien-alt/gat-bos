-- Slice 5A Task 4 -- campaign_steps.template_slug column (NULL-tolerant)
-- Idempotent. Adds nullable text column + partial index.
-- Runner treats NULL as no-op skip and writes campaign.step_skipped activity.

ALTER TABLE public.campaign_steps
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE INDEX IF NOT EXISTS idx_campaign_steps_active_with_slug
  ON public.campaign_steps (campaign_id, step_number)
  WHERE deleted_at IS NULL AND template_slug IS NOT NULL;