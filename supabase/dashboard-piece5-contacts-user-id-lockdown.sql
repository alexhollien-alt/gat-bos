-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 5
-- contacts.user_id lockdown: backfill + DEFAULT + NOT NULL
-- ============================================================
-- Generated: 2026-04-07
-- Per: ~/.claude/rules/dashboard.md
--
-- PREREQ: Piece 2 must have run successfully (contacts.user_id column
--         exists as nullable uuid REFERENCES auth.users ON DELETE CASCADE).
--
-- BACKGROUND:
--   Piece 2 added contacts.user_id as nullable and noted "BACKFILL
--   REQUIRED before NOT NULL." Verification on 2026-04-06 confirmed all
--   103 contacts still had NULL user_id. The CRM still rendered them
--   because the contacts RLS policies are wide-open (USING true) on the
--   authenticated role -- a separate security gap tracked outside this
--   piece. This file fixes the data side: assigns ownership, locks the
--   column NOT NULL, and sets DEFAULT auth.uid() so future inserts from
--   the CRM are auto-scoped to the signed-in user.
--
-- WHAT THIS DOES (safe, idempotent, transactional):
--   1. Backfills NULL user_id rows to alex@alexhollienco.com
--      (the only active operator -- the second auth.users row has never
--      signed in)
--   2. Sets contacts.user_id DEFAULT auth.uid()
--   3. Adds NOT NULL constraint on contacts.user_id
--
-- WHAT THIS DOES NOT DO:
--   - Does not alter RLS policies on contacts. The wide-open policies
--     (authenticated_select, authenticated_insert, authenticated_update)
--     remain in place. Replacing them with an owner-scoped policy is a
--     separate decision and should ship as its own piece once the CRM
--     code paths that may depend on cross-tenant reads are reviewed.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--
-- VERIFICATION:
--   See queries at the bottom of this file.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Backfill existing NULL rows
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
  alex_exists boolean;
BEGIN
  -- Sanity check: confirm Alex's auth user still exists before we touch data
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = alex_user_id)
    INTO alex_exists;

  IF NOT alex_exists THEN
    RAISE EXCEPTION 'Alex auth.users row % not found. Aborting backfill.', alex_user_id;
  END IF;

  SELECT count(*) INTO null_count FROM contacts WHERE user_id IS NULL;

  IF null_count > 0 THEN
    UPDATE contacts SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Backfilled % contacts.user_id rows to %', null_count, alex_user_id;
  ELSE
    RAISE NOTICE 'No NULL user_id rows on contacts. Backfill skipped.';
  END IF;
END $$;

-- ============================================================
-- 2. DEFAULT auth.uid() for future inserts
-- ============================================================
-- Idempotent: SET DEFAULT is a no-op if the default already matches.
ALTER TABLE contacts ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ============================================================
-- 3. NOT NULL constraint
-- ============================================================
-- Idempotent: SET NOT NULL is a no-op if the constraint is already in place.
-- Will raise an error if any row still has NULL user_id, which is the
-- intended safety net (the backfill above should have handled all rows).
ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  (SELECT count(*) FROM contacts)                                                                                                                      AS total_contacts,
  (SELECT count(*) FROM contacts WHERE user_id IS NULL)                                                                                                AS null_user_id,
  (SELECT count(*) FROM contacts WHERE user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3')                                                               AS alex_owned,
  (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='user_id')                  AS user_id_nullable,
  (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='user_id')               AS user_id_default;

-- Expected:
--   total_contacts:    103
--   null_user_id:        0
--   alex_owned:        103
--   user_id_nullable:   NO
--   user_id_default:    auth.uid()
