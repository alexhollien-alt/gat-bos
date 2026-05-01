-- ============================================================================
-- Phase 2.1 RLS lockdown + notes column + ownership backfill/reassignment
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 1
-- Replaces: supabase/dashboard-piece5-contacts-user-id-lockdown.sql
--           supabase/dashboard-piece6-contacts-rls-lockdown.sql
--           supabase/dashboard-piece7-contacts-add-notes-column.sql
--           supabase/dashboard-piece8-contacts-reassign-to-alex.sql
--
-- BACKGROUND:
--   These four pieces were applied directly to the live DB on 2026-04-07
--   via the Supabase MCP execute_sql path, BEFORE the MCP went read-only
--   on 2026-04-08. They never existed as numbered migrations, so
--   `supabase db reset` / `supabase db push` could not replay them
--   and a fresh environment would not match production. This file wraps
--   all four as one idempotent migration so:
--
--     1. Fresh environments (staging, scratch branches, CI) can replay
--        the full Phase 2.1 lockdown in order.
--     2. Production (already in post-state) is unaffected -- every
--        statement is guarded so re-running is a no-op.
--     3. The repo's single source of truth for Phase 2.1 lives under
--        supabase/migrations/ alongside the baseline and spine tables.
--
--   The original loose .sql files are moved to supabase/_archive/ in the
--   same commit that adds this migration.
--
-- IDEMPOTENCY GUARANTEES:
--   - All backfill / reassign statements are conditional (only touch
--     rows matching the target predicate; no-op if the post-state is
--     already in place).
--   - ALTER COLUMN SET DEFAULT / SET NOT NULL are no-ops when already
--     in place.
--   - DROP POLICY IF EXISTS + CREATE POLICY pattern recreates the
--     owner-scoped policy on every run -- the final state is the same.
--   - ADD COLUMN IF NOT EXISTS for contacts.notes.
--   - Soft-delete of dormant auth user uses COALESCE so deleted_at /
--     banned_until do not get overwritten if already set.
--
-- ORIGINAL PIECE PROVENANCE (preserved as comments below each section).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PIECE 5 -- contacts.user_id lockdown
-- Backfill NULLs to Alex, set DEFAULT auth.uid(), set NOT NULL
-- Source: dashboard-piece5-contacts-user-id-lockdown.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
  alex_exists boolean;
BEGIN
  -- Sanity: Alex's auth user still exists before touching data.
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = alex_user_id)
    INTO alex_exists;

  SELECT count(*) INTO null_count FROM contacts WHERE user_id IS NULL;

  IF NOT alex_exists THEN
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Alex auth.users row % not found but % contacts need backfill. Aborting.', alex_user_id, null_count;
    ELSE
      RAISE NOTICE 'Phase21/piece5: Alex auth.users row not present and no contacts to backfill (fresh local replay). Skipping.';
      RETURN;
    END IF;
  END IF;

  IF null_count > 0 THEN
    UPDATE contacts SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Phase21/piece5: backfilled % contacts.user_id rows to %', null_count, alex_user_id;
  ELSE
    RAISE NOTICE 'Phase21/piece5: no NULL user_id rows on contacts. Backfill skipped.';
  END IF;
END $$;

ALTER TABLE contacts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- PIECE 6 -- contacts RLS lockdown + dormant auth user soft-delete
-- Drop permissive policies, re-enable RLS, create owner-scoped policy,
-- soft-delete the never-used test auth user.
-- Source: dashboard-piece6-contacts-rls-lockdown.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  dormant_id    uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  dormant_email text := 'yourcoll2347@gmail.com';
  found_email   text;
BEGIN
  SELECT email INTO found_email FROM auth.users WHERE id = dormant_id;

  IF found_email IS NULL THEN
    RAISE NOTICE 'Phase21/piece6: dormant user % not found. Nothing to soft-delete.', dormant_id;
  ELSIF found_email <> dormant_email THEN
    RAISE EXCEPTION 'Phase21/piece6: safety check failed -- id % does not match email %, found %',
      dormant_id, dormant_email, found_email;
  ELSE
    -- COALESCE protects prior deleted_at / banned_until from being overwritten on replay.
    UPDATE auth.users
       SET deleted_at   = COALESCE(deleted_at,   now()),
           banned_until = COALESCE(banned_until, '2099-12-31 00:00:00+00'::timestamptz)
     WHERE id = dormant_id;
    RAISE NOTICE 'Phase21/piece6: soft-deleted auth user %', dormant_email;
  END IF;
END $$;

DROP POLICY IF EXISTS authenticated_select ON contacts;
DROP POLICY IF EXISTS authenticated_insert ON contacts;
DROP POLICY IF EXISTS authenticated_update ON contacts;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own contacts" ON contacts;
CREATE POLICY "Users manage own contacts" ON contacts
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PIECE 7 -- contacts.notes column add
-- Nullable text, no default, no backfill. Fixes silent insert failures
-- from /api/intake and the contact form modal.
-- Source: dashboard-piece7-contacts-add-notes-column.sql (2026-04-07)
-- ============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================================
-- PIECE 8 -- contacts.user_id reassignment (dormant -> Alex)
-- Piece 5's backfill was originally run against a different UUID.
-- This reassigns any rows still owned by the dormant user to Alex.
-- Idempotent: no-op if no dormant-owned rows remain.
-- Source: dashboard-piece8-contacts-reassign-to-alex.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  alex_id        uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  dormant_id     uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  alex_active    boolean;
  reassign_count int;
BEGIN
  -- Sanity: Alex still active.
  SELECT (deleted_at IS NULL)
    INTO alex_active
    FROM auth.users
   WHERE id = alex_id;

  SELECT count(*) INTO reassign_count
    FROM contacts
   WHERE user_id = dormant_id;

  IF alex_active IS NULL THEN
    IF reassign_count > 0 THEN
      RAISE EXCEPTION 'Phase21/piece8: Alex auth.users row % not found but % contacts need reassignment. Aborting.', alex_id, reassign_count;
    ELSE
      RAISE NOTICE 'Phase21/piece8: Alex auth.users row not present and no dormant-owned contacts (fresh local replay). Skipping.';
      RETURN;
    END IF;
  END IF;

  IF NOT alex_active THEN
    IF reassign_count > 0 THEN
      RAISE EXCEPTION 'Phase21/piece8: Alex auth.users row % is soft-deleted but % contacts need reassignment. Aborting.', alex_id, reassign_count;
    ELSE
      RAISE NOTICE 'Phase21/piece8: Alex soft-deleted and no dormant-owned contacts. Skipping.';
      RETURN;
    END IF;
  END IF;

  IF reassign_count > 0 THEN
    UPDATE contacts
       SET user_id = alex_id
     WHERE user_id = dormant_id;
    RAISE NOTICE 'Phase21/piece8: reassigned % contacts.user_id rows from dormant % to Alex %',
      reassign_count, dormant_id, alex_id;
  ELSE
    RAISE NOTICE 'Phase21/piece8: no contacts owned by dormant user %. Reassign skipped.', dormant_id;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- select
--   (select count(*) from contacts)                                       as total_contacts,
--   (select count(*) from contacts where user_id is null)                 as null_user_id,
--   (select count(*) from contacts
--      where user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3')             as alex_owned,
--   (select count(*) from contacts
--      where user_id = '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb')             as dormant_owned,
--   (select is_nullable from information_schema.columns
--      where table_schema='public' and table_name='contacts'
--        and column_name='user_id')                                        as user_id_nullable,
--   (select data_type from information_schema.columns
--      where table_schema='public' and table_name='contacts'
--        and column_name='notes')                                          as notes_exists,
--   (select count(*) from pg_policy pol
--      join pg_class c on c.oid=pol.polrelid
--      join pg_namespace n on n.oid=c.relnamespace
--     where n.nspname='public' and c.relname='contacts')                   as contacts_policy_count,
--   (select count(*) from auth.users where deleted_at is null)             as active_auth_users;
--
-- Expected post-state:
--   total_contacts         >= 105
--   null_user_id           = 0
--   alex_owned             = total_contacts
--   dormant_owned          = 0
--   user_id_nullable       = NO
--   notes_exists           = text
--   contacts_policy_count  = 1
--   active_auth_users      = 1
-- ============================================================================
