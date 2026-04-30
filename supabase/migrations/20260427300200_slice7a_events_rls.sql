-- ============================================================
-- SLICE 7A TASK B-8 -- events RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 8 of 21
--
-- Replaces email-based alex_events_all with column-based
-- events_user_isolation. user_id was added in Phase A
-- (20260427300700_slice7a_events_user_id.sql).
--
-- Mid-slice smoke gate (#9) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-events-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_events_all ON public.events;

CREATE POLICY events_user_isolation
  ON public.events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY events_user_isolation ON public.events IS
  'Slice 7A: replaces email-based alex_events_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.events'::regclass;
--   -- expect: events_user_isolation (and ONLY that)
-- ============================================================
