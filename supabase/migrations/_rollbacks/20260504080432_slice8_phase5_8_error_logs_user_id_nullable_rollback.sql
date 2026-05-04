-- ============================================================
-- ROLLBACK -- Slice 8 Phase 5.8 error_logs.user_id NULLABLE
-- ============================================================
-- Restores NOT NULL on error_logs.user_id. Backfills any pre-auth
-- breadcrumbs (user_id IS NULL) to OWNER_USER_ID before the constraint
-- so the rollback does not fail.
--
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3 (Alex auth.users)
-- ============================================================

BEGIN;

UPDATE public.error_logs
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.error_logs ALTER COLUMN user_id SET NOT NULL;

COMMENT ON COLUMN public.error_logs.user_id IS NULL;

COMMIT;
