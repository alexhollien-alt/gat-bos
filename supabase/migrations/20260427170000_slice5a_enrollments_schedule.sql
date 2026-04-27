-- Slice 5A Task 1 -- campaign_enrollments schedule indexes
-- Pre-flight (2026-04-27 MCP read) confirmed:
--   - campaign_enrollments.next_action_at column ALREADY EXISTS (no column add)
--   - idx_enrollments_next_action ALREADY EXISTS with the exact predicate the
--     starter calls idx_campaign_enrollments_due:
--     CREATE INDEX idx_enrollments_next_action ON public.campaign_enrollments
--       USING btree (next_action_at)
--       WHERE ((deleted_at IS NULL) AND (status = 'active'::text))
--   - The only missing index is the contact-active dedup index used by
--     autoEnrollNewAgent() to short-circuit duplicate enrollments.
--
-- This paste only adds the missing dedup index. Idempotent: IF NOT EXISTS.
-- Run from the Supabase SQL Editor as Alex (project owner).

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_contact_active
  ON public.campaign_enrollments (contact_id)
  WHERE deleted_at IS NULL AND status = 'active';

-- Verification (read-only, safe to re-run):
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'campaign_enrollments'
ORDER BY indexname;
