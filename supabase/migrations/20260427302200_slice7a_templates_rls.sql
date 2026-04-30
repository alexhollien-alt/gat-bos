-- ============================================================
-- SLICE 7A TASK B-21 -- templates RLS rewrite (forward) -- FINAL RLS REWRITE
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 21 of 21
--
-- Replaces email-based alex_templates_all (single combined FOR ALL policy)
-- with column-based templates_user_isolation. user_id was added by suppl-15
-- add-column migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid, is_nullable=NO,
-- default=auth.uid(), 10 rows, 0 NULL user_ids.
--
-- templates is the only table in the slice with a single combined FOR ALL
-- policy (no split read/write), so B-21 is a single migration, not a pair.
-- This commit closes Phase B (all 21 RLS rewrites complete; email-based
-- isolation fully retired across the schema).
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
--
-- Rollback:
--   DROP POLICY IF EXISTS templates_user_isolation ON public.templates;
--   CREATE POLICY alex_templates_all
--     ON public.templates
--     FOR ALL
--     TO authenticated
--     USING      ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
--     WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_templates_all ON public.templates;

CREATE POLICY templates_user_isolation
  ON public.templates
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY templates_user_isolation ON public.templates IS
  'Slice 7A: replaces email-based alex_templates_all; column user_id checked against auth.uid().';

COMMIT;
