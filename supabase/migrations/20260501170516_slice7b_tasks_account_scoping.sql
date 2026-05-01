-- Slice 7B Task 2 (table 1/6) -- tasks: add account_id, backfill, account-scoped RLS
--
-- Pattern matches Task 1 (contacts schema delta). One account per owner_user_id
-- from Slice 7A; backfill joins via accounts.owner_user_id = tasks.user_id.
-- Active-row count assertion guards against drift.

BEGIN;

-- 1. Add nullable account_id (NOT NULL set after backfill).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 2. FK -> accounts.id, ON DELETE RESTRICT (matches Slice 7A precedent).
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_account_id_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 3. Backfill account_id for active rows with row-count assertion.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.tasks
  WHERE account_id IS NULL
    AND deleted_at IS NULL;

  UPDATE public.tasks t
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = t.user_id
     AND a.deleted_at IS NULL
     AND t.account_id IS NULL
     AND t.deleted_at IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 2 (tasks) backfill mismatch: expected % active rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 2 (tasks) backfill: % active rows updated', backfilled_count;
END $$;

-- 4. Backfill soft-deleted rows so NOT NULL holds for the entire table.
UPDATE public.tasks t
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.owner_user_id = t.user_id
   AND a.deleted_at IS NULL
   AND t.account_id IS NULL;

-- 5. Enforce NOT NULL.
ALTER TABLE public.tasks
  ALTER COLUMN account_id SET NOT NULL;

-- 6. Index account_id for the RLS subquery.
CREATE INDEX IF NOT EXISTS tasks_account_id_idx
  ON public.tasks (account_id)
  WHERE deleted_at IS NULL;

-- 7. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
DROP POLICY IF EXISTS tasks_account_select ON public.tasks;
DROP POLICY IF EXISTS tasks_account_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_account_update ON public.tasks;
DROP POLICY IF EXISTS tasks_account_delete ON public.tasks;

CREATE POLICY tasks_account_select
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY tasks_account_insert
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY tasks_account_update
  ON public.tasks
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

CREATE POLICY tasks_account_delete
  ON public.tasks
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
