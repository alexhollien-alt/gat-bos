-- Slice 7B Task 2 (table 6/6) -- email_drafts: add account_id, backfill, account-scoped RLS
--
-- email_drafts has NO deleted_at column. Existing policy: email_drafts_user_isolation.

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT.
ALTER TABLE public.email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_account_id_fkey;

ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.email_drafts
  WHERE account_id IS NULL;

  UPDATE public.email_drafts d
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = d.user_id
     AND a.deleted_at IS NULL
     AND d.account_id IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (email_drafts) backfill mismatch: expected % rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (email_drafts) backfill: % rows updated', backfilled_count;
END $$;

-- 4. Enforce NOT NULL.
ALTER TABLE public.email_drafts
  ALTER COLUMN account_id SET NOT NULL;

-- 5. Index account_id for the RLS subquery (no deleted_at predicate -- column absent).
CREATE INDEX IF NOT EXISTS email_drafts_account_id_idx
  ON public.email_drafts (account_id);

-- 6. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS email_drafts_user_isolation ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_account_select ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_account_insert ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_account_update ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_account_delete ON public.email_drafts;

CREATE POLICY email_drafts_account_select
  ON public.email_drafts
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY email_drafts_account_insert
  ON public.email_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY email_drafts_account_update
  ON public.email_drafts
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

CREATE POLICY email_drafts_account_delete
  ON public.email_drafts
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
