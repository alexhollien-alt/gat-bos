-- ============================================================
-- SLICE 7A TASK B-12 -- oauth_tokens RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 12 of 21
--
-- Replaces email-based alex_oauth_tokens_all with column-based
-- oauth_tokens_user_isolation. user_id pre-existed (one of 3 tables
-- with user_id before slice 7A; no add-column migration needed),
-- but type was text -- fixed in 0b-suppl-16 immediately preceding.
--
-- Mid-slice smoke gate (#12 cluster) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-oauth_tokens-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_oauth_tokens_all ON public.oauth_tokens;

CREATE POLICY oauth_tokens_user_isolation
  ON public.oauth_tokens
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY oauth_tokens_user_isolation ON public.oauth_tokens IS
  'Slice 7A: replaces email-based alex_oauth_tokens_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (post-apply, MCP-confirmed 2026-04-29):
--   pg_policy on public.oauth_tokens = oauth_tokens_user_isolation only
--   USING + WITH CHECK = (user_id = auth.uid())
--   roles = {authenticated}; relrowsecurity = true
--   alex_oauth_tokens_all dropped
-- ============================================================
