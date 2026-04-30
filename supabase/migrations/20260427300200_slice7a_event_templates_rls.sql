-- ============================================================
-- SLICE 7A TASK B-7 -- event_templates RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 7 of 21
--
-- Replaces email-based alex_event_templates_all with column-based
-- event_templates_user_isolation. user_id was added in Phase A
-- (20260427300600_slice7a_event_templates_user_id.sql).
--
-- Mid-slice smoke gate (#9) deferred to Phase C harness.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-event_templates-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_event_templates_all ON public.event_templates;

CREATE POLICY event_templates_user_isolation
  ON public.event_templates
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY event_templates_user_isolation ON public.event_templates IS
  'Slice 7A: replaces email-based alex_event_templates_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.event_templates'::regclass;
--   -- expect: event_templates_user_isolation (and ONLY that)
-- ============================================================
