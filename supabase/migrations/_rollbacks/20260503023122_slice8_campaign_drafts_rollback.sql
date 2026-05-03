-- Rollback for 20260503023122_slice8_campaign_drafts.sql
--
-- Drops campaign_drafts table and all dependent indexes/policies.
-- Safe to run if the forward migration was applied; no-op if not.

DROP POLICY IF EXISTS campaign_drafts_alex_all ON public.campaign_drafts;
DROP POLICY IF EXISTS campaign_drafts_service_all ON public.campaign_drafts;
DROP INDEX IF EXISTS public.campaign_drafts_week_template_active_uniq;
DROP INDEX IF EXISTS public.campaign_drafts_status_idx;
DROP INDEX IF EXISTS public.campaign_drafts_week_idx;
DROP TABLE IF EXISTS public.campaign_drafts;
