-- Slice 7B Task 2 (table 5/6) -- events: add account_id, backfill, account-scoped RLS
--
-- Existing policy: events_user_isolation. Replaces with 4 split account-scoped
-- policies (SELECT/INSERT/UPDATE/DELETE).

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_account_id_fkey;

ALTER TABLE public.events
  ADD CONSTRAINT events_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id for active rows with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.events
  WHERE account_id IS NULL
    AND deleted_at IS NULL;

  UPDATE public.events e
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = e.user_id
     AND a.deleted_at IS NULL
     AND e.account_id IS NULL
     AND e.deleted_at IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (events) backfill mismatch: expected % active rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (events) backfill: % active rows updated', backfilled_count;
END $$;

-- 4. Backfill soft-deleted rows so NOT NULL holds for the entire table.
UPDATE public.events e
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.owner_user_id = e.user_id
   AND a.deleted_at IS NULL
   AND e.account_id IS NULL;

-- 5. Enforce NOT NULL.
ALTER TABLE public.events
  ALTER COLUMN account_id SET NOT NULL;

-- 6. Index account_id for the RLS subquery.
CREATE INDEX IF NOT EXISTS events_account_id_idx
  ON public.events (account_id)
  WHERE deleted_at IS NULL;

-- 7. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS events_user_isolation ON public.events;
DROP POLICY IF EXISTS events_account_select ON public.events;
DROP POLICY IF EXISTS events_account_insert ON public.events;
DROP POLICY IF EXISTS events_account_update ON public.events;
DROP POLICY IF EXISTS events_account_delete ON public.events;

CREATE POLICY events_account_select
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY events_account_insert
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY events_account_update
  ON public.events
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

CREATE POLICY events_account_delete
  ON public.events
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
