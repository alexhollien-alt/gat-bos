-- ============================================================
-- SLICE 8 PHASE 5.8 -- error_logs.user_id NOT NULL -> NULLABLE (Option A)
-- ============================================================
-- Plan:    ~/crm/.planning/phases/021-slice-8-phase-5-cron-registration-dry-run/PLAN.md (handoff)
-- Branch:  plumbing/slice8-phase5-8-error-logs-user-id-nullable
--
-- Why: PR #31 (webhook 401) and PR #32 (drafts route 401/404/500) added
-- logError() breadcrumbs to silent early-exit paths that fire BEFORE
-- authentication. user_id DEFAULT auth.uid() resolves to NULL in those
-- contexts, which trips the NOT NULL constraint and silently drops the
-- breadcrumb -- the exact diagnostic blind spot those PRs aimed to close.
--
-- Drop NOT NULL so unauthenticated breadcrumbs persist with user_id=NULL.
-- Service-role inserts already bypass RLS via adminClient. Authenticated
-- writes still resolve user_id via DEFAULT auth.uid() and remain RLS-scoped.
--
-- Paired rollback: _rollbacks/20260504080432_slice8_phase5_8_error_logs_user_id_nullable_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.error_logs ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.error_logs.user_id IS
  'Slice 8 Phase 5.8: NULLABLE. Authenticated writes resolve via DEFAULT auth.uid(); pre-auth 401/404/500 breadcrumbs from logError() persist with user_id=NULL so they remain queryable.';

COMMIT;

-- ============================================================
-- Verify (after push):
--   \d public.error_logs
--   -- expect: user_id | uuid | (no "not null" attribute)
-- ============================================================
