-- Slice 7B Task 1 -- contacts schema delta + RLS rewrite for account-scoping
--
-- Changes:
--   1. Add 'agent' to contacts_type_check (12th sanctioned value, joins the 11
--      existing classifications: realtor, lender, builder, vendor, buyer,
--      seller, past_client, warm_lead, referral_partner, sphere, other).
--      See LATER.md [2026-04-30] for the realtor/agent overlap note.
--   2. Add slug column (text, nullable until backfilled, then UNIQUE per account).
--   3. Add tagline column (text, nullable -- empty taglines hidden by route).
--   4. Add account_id column (uuid, FK -> accounts.id, nullable until backfill).
--   5. Backfill account_id for existing rows (1 account per owner_user_id from
--      Slice 7A; user_id -> account via accounts.owner_user_id).
--   6. Set account_id NOT NULL after backfill.
--   7. Replace single-tenant RLS ("Users manage own contacts" scoped on user_id)
--      with account-scoped RLS, gated through accounts table.
--
-- Reuses existing headshot_url column (NOT adding photo_url). See plan
-- Schema Drift Resolution Q-drift-2.
--
-- Rollback ships as a separate migration (next file in sequence) per Rule 3
-- (no hard deletes -- soft markers + reversible DDL only).

BEGIN;

-- 1. Extend contacts_type_check to include 'agent'.
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_type_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_type_check
  CHECK (type = ANY (ARRAY[
    'realtor'::text,
    'lender'::text,
    'builder'::text,
    'vendor'::text,
    'buyer'::text,
    'seller'::text,
    'past_client'::text,
    'warm_lead'::text,
    'referral_partner'::text,
    'sphere'::text,
    'other'::text,
    'agent'::text
  ]));

-- 2. Add slug, tagline, account_id columns.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS slug       text,
  ADD COLUMN IF NOT EXISTS tagline    text,
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- 3. FK on account_id (nullable during backfill, NOT NULL set in step 5).
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_account_id_fkey;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- 4. Backfill account_id for every existing active contact via owner_user_id.
--    Slice 7A guarantees one active account per user_id. Assert row-count match.
DO $$
DECLARE
  expected_count integer;
  backfilled_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM public.contacts
  WHERE account_id IS NULL
    AND deleted_at IS NULL;

  UPDATE public.contacts c
     SET account_id = a.id
    FROM public.accounts a
   WHERE a.owner_user_id = c.user_id
     AND a.deleted_at IS NULL
     AND c.account_id IS NULL
     AND c.deleted_at IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  IF backfilled_count <> expected_count THEN
    RAISE EXCEPTION
      'Slice 7B Task 1 backfill mismatch: expected % active rows, updated %',
      expected_count, backfilled_count;
  END IF;

  RAISE NOTICE 'Slice 7B Task 1 backfill: % active rows updated', backfilled_count;
END $$;

-- 5. Enforce NOT NULL on account_id now that active rows are backfilled.
--    Soft-deleted rows (deleted_at IS NOT NULL) are intentionally excluded
--    from the backfill above. Backfill them too so the NOT NULL constraint
--    holds for the entire table.
UPDATE public.contacts c
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.owner_user_id = c.user_id
   AND a.deleted_at IS NULL
   AND c.account_id IS NULL;

ALTER TABLE public.contacts
  ALTER COLUMN account_id SET NOT NULL;

-- 6. Index account_id for the new RLS subquery.
CREATE INDEX IF NOT EXISTS contacts_account_id_idx
  ON public.contacts (account_id)
  WHERE deleted_at IS NULL;

-- 7. Slug uniqueness per account (slug is nullable; UNIQUE permits multiple NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS contacts_account_slug_unique
  ON public.contacts (account_id, slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;

-- 8. Replace single-tenant RLS with account-scoped RLS.
DROP POLICY IF EXISTS "Users manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS contacts_account_select ON public.contacts;
DROP POLICY IF EXISTS contacts_account_insert ON public.contacts;
DROP POLICY IF EXISTS contacts_account_update ON public.contacts;
DROP POLICY IF EXISTS contacts_account_delete ON public.contacts;

CREATE POLICY contacts_account_select
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY contacts_account_insert
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY contacts_account_update
  ON public.contacts
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

CREATE POLICY contacts_account_delete
  ON public.contacts
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
