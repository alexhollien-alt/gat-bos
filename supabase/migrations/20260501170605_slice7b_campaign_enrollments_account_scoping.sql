-- Slice 7B Task 2 (table 4/6) -- campaign_enrollments: add account_id, backfill, account-scoped RLS

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.campaign_enrollments
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT.
ALTER TABLE public.campaign_enrollments
  DROP CONSTRAINT IF EXISTS campaign_enrollments_account_id_fkey;

ALTER TABLE public.campaign_enrollments
  ADD CONSTRAINT campaign_enrollments_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id for active rows with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.campaign_enrollments
  WHERE account_id IS NULL
    AND deleted_at IS NULL;

  UPDATE public.campaign_enrollments e
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = e.user_id
     AND a.deleted_at IS NULL
     AND e.account_id IS NULL
     AND e.deleted_at IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (campaign_enrollments) backfill mismatch: expected % active rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (campaign_enrollments) backfill: % active rows updated', backfilled_count;
END $$;

-- 4. Backfill soft-deleted rows so NOT NULL holds for the entire table.
UPDATE public.campaign_enrollments e
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.owner_user_id = e.user_id
   AND a.deleted_at IS NULL
   AND e.account_id IS NULL;

-- 5. Enforce NOT NULL.
ALTER TABLE public.campaign_enrollments
  ALTER COLUMN account_id SET NOT NULL;

-- 6. Index account_id for the RLS subquery.
CREATE INDEX IF NOT EXISTS campaign_enrollments_account_id_idx
  ON public.campaign_enrollments (account_id)
  WHERE deleted_at IS NULL;

-- 7. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS "Users manage own campaign_enrollments" ON public.campaign_enrollments;
DROP POLICY IF EXISTS campaign_enrollments_account_select ON public.campaign_enrollments;
DROP POLICY IF EXISTS campaign_enrollments_account_insert ON public.campaign_enrollments;
DROP POLICY IF EXISTS campaign_enrollments_account_update ON public.campaign_enrollments;
DROP POLICY IF EXISTS campaign_enrollments_account_delete ON public.campaign_enrollments;

CREATE POLICY campaign_enrollments_account_select
  ON public.campaign_enrollments
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY campaign_enrollments_account_insert
  ON public.campaign_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY campaign_enrollments_account_update
  ON public.campaign_enrollments
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY campaign_enrollments_account_delete
  ON public.campaign_enrollments
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

COMMIT;
