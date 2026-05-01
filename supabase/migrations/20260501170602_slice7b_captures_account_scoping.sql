-- Slice 7B Task 2 (table 2/6) -- captures: add account_id, backfill, account-scoped RLS
--
-- captures has NO deleted_at column, so backfill skips the active/soft-deleted
-- split (every row is active by definition).

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.captures
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT.
ALTER TABLE public.captures
  DROP CONSTRAINT IF EXISTS captures_account_id_fkey;

ALTER TABLE public.captures
  ADD CONSTRAINT captures_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.captures
  WHERE account_id IS NULL;

  UPDATE public.captures c
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = c.user_id
     AND a.deleted_at IS NULL
     AND c.account_id IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (captures) backfill mismatch: expected % rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (captures) backfill: % rows updated', backfilled_count;
END $$;

-- 4. Enforce NOT NULL.
ALTER TABLE public.captures
  ALTER COLUMN account_id SET NOT NULL;

-- 5. Index account_id for the RLS subquery (no deleted_at predicate -- column absent).
CREATE INDEX IF NOT EXISTS captures_account_id_idx
  ON public.captures (account_id);

-- 6. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS "Users manage own captures" ON public.captures;
DROP POLICY IF EXISTS captures_account_select ON public.captures;
DROP POLICY IF EXISTS captures_account_insert ON public.captures;
DROP POLICY IF EXISTS captures_account_update ON public.captures;
DROP POLICY IF EXISTS captures_account_delete ON public.captures;

CREATE POLICY captures_account_select
  ON public.captures
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY captures_account_insert
  ON public.captures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY captures_account_update
  ON public.captures
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

CREATE POLICY captures_account_delete
  ON public.captures
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
