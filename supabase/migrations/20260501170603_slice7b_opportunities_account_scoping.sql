-- Slice 7B Task 2 (table 3/6) -- opportunities: add account_id, backfill, account-scoped RLS
--
-- Existing policy "Users manage own opportunities" was scoped TO public; rewrite
-- tightens to TO authenticated to match Slice 7A precedent.

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT.
ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_account_id_fkey;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id for active rows with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.opportunities
  WHERE account_id IS NULL
    AND deleted_at IS NULL;

  UPDATE public.opportunities o
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = o.user_id
     AND a.deleted_at IS NULL
     AND o.account_id IS NULL
     AND o.deleted_at IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (opportunities) backfill mismatch: expected % active rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (opportunities) backfill: % active rows updated', backfilled_count;
END $$;

-- 4. Backfill soft-deleted rows so NOT NULL holds for the entire table.
UPDATE public.opportunities o
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.owner_user_id = o.user_id
   AND a.deleted_at IS NULL
   AND o.account_id IS NULL;

-- 5. Enforce NOT NULL.
ALTER TABLE public.opportunities
  ALTER COLUMN account_id SET NOT NULL;

-- 6. Index account_id for the RLS subquery.
CREATE INDEX IF NOT EXISTS opportunities_account_id_idx
  ON public.opportunities (account_id)
  WHERE deleted_at IS NULL;

-- 7. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS "Users manage own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS opportunities_account_select ON public.opportunities;
DROP POLICY IF EXISTS opportunities_account_insert ON public.opportunities;
DROP POLICY IF EXISTS opportunities_account_update ON public.opportunities;
DROP POLICY IF EXISTS opportunities_account_delete ON public.opportunities;

CREATE POLICY opportunities_account_select
  ON public.opportunities
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY opportunities_account_insert
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY opportunities_account_update
  ON public.opportunities
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

CREATE POLICY opportunities_account_delete
  ON public.opportunities
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
