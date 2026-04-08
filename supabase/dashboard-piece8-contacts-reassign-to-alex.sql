-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 8
-- contacts.user_id reassignment: dormant -> Alex
-- ============================================================
-- Generated: 2026-04-07
-- Per: Phase 2.1 contacts page diagnosis
--
-- BACKGROUND:
--   Piece 5 was supposed to backfill all NULL contacts.user_id
--   rows to Alex (b735d691-4d86-4e31-9fd3-c2257822dca3). At
--   verification time the count looked right, but the live state
--   today shows 103 contacts owned by the dormant test user
--   (05a13169 = yourcoll2347@gmail.com, soft-deleted in piece 6)
--   and only 2 contacts owned by Alex (the curl-test inserts
--   from Phase 2.1 Task 7).
--
--   Either piece 5 ran with a different hardcoded UUID at the
--   time, or some other operation reassigned the rows after.
--   Either way, the contacts page now shows zero rows because
--   the new RLS policy USING (user_id = auth.uid()) restricts
--   Alex to the 2 rows he owns. This piece reassigns the 103
--   dormant-owned rows to Alex so the page returns 105 rows.
--
-- WHAT THIS DOES (idempotent, transactional):
--   1. Verify Alex's auth user is active (not soft-deleted)
--   2. UPDATE all contacts.user_id where user_id = dormant_id
--      to user_id = alex_id
--   3. Log how many rows moved
--
-- WHAT THIS DOES NOT DO:
--   - Does not touch contacts owned by other UUIDs (only the
--     specific dormant user is reassigned).
--   - Does not change RLS policies (piece 6 already set those).
--   - Does not soft-delete the dormant user again (piece 6
--     already did that and this piece reads the auth.users
--     state without modifying it).
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--   (Phase 2.1 applied this directly via mcp__supabase__execute_sql
--    before committing the file. The file lives in the repo for
--    audit trail and to match the piece 5/6/7 pattern.)
--
-- VERIFICATION:
--   See queries at the bottom of this file.
-- ============================================================

BEGIN;

DO $$
DECLARE
  alex_id        uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  dormant_id     uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  alex_active    boolean;
  reassign_count int;
BEGIN
  -- Sanity check: confirm Alex's auth user is still active
  SELECT (deleted_at IS NULL)
    INTO alex_active
    FROM auth.users
   WHERE id = alex_id;

  IF alex_active IS NULL THEN
    RAISE EXCEPTION 'Alex auth.users row % not found. Aborting reassign.', alex_id;
  END IF;

  IF NOT alex_active THEN
    RAISE EXCEPTION 'Alex auth.users row % is soft-deleted. Aborting reassign.', alex_id;
  END IF;

  -- Reassign
  SELECT count(*) INTO reassign_count
    FROM contacts
   WHERE user_id = dormant_id;

  IF reassign_count > 0 THEN
    UPDATE contacts
       SET user_id = alex_id
     WHERE user_id = dormant_id;
    RAISE NOTICE 'Reassigned % contacts.user_id rows from dormant % to Alex %',
      reassign_count, dormant_id, alex_id;
  ELSE
    RAISE NOTICE 'No contacts owned by dormant user %. Reassign skipped.', dormant_id;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  (SELECT count(*) FROM contacts
     WHERE user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'
       AND deleted_at IS NULL)                                      AS alex_owned,
  (SELECT count(*) FROM contacts
     WHERE user_id = '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb'
       AND deleted_at IS NULL)                                      AS dormant_owned,
  (SELECT count(*) FROM contacts WHERE deleted_at IS NULL)          AS total_active;

-- Expected after run:
--   alex_owned:     105
--   dormant_owned:    0
--   total_active:   105
