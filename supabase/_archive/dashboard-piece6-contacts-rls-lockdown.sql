-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 6
-- contacts RLS lockdown + dormant auth user soft-delete
-- ============================================================
-- Generated: 2026-04-07
-- Per: ~/.claude/rules/dashboard.md
-- Per: Standing Rule 3 (no hard deletes -- soft via deleted_at)
--
-- PREREQ: Piece 5 must have run successfully (contacts.user_id NOT NULL,
--         all rows owned by alex@alexhollienco.com).
--
-- BACKGROUND:
--   1. The contacts table has three permissive RLS policies that read
--      every row to any authenticated user:
--        authenticated_select  USING (true)
--        authenticated_insert  WITH CHECK (true)
--        authenticated_update  USING (true)
--      With Alex now the sole owner of all 103 contacts (Piece 5),
--      these are replaced with a single owner-scoped policy that
--      mirrors the existing opportunities pattern.
--   2. auth.users has a dormant row (yourcoll2347@gmail.com) created
--      during early CRM testing that has never signed in. Per Standing
--      Rule 3 it is soft-deleted via deleted_at + banned_until rather
--      than DELETE FROM auth.users.
--
-- WHAT THIS DOES (idempotent, transactional):
--   1. Soft-deletes the dormant auth user (deleted_at + banned_until)
--   2. Drops the three permissive contacts policies
--   3. Re-asserts RLS enabled on contacts
--   4. Creates "Users manage own contacts" policy:
--        FOR ALL TO authenticated
--        USING (user_id = auth.uid())
--        WITH CHECK (user_id = auth.uid())
--
-- BLAST RADIUS REVIEW (verified before authoring):
--   - src/app/api/intake/route.ts uses adminClient (service role,
--     bypasses RLS) and explicitly sets user_id on insert. Safe.
--   - src/app/api/webhooks/resend/route.ts uses adminClient. Safe.
--   - src/components/contacts/contact-form-modal.tsx uses the session
--     client and explicitly passes user_id: user!.id. Safe.
--   - All other call sites are server pages reading via the session
--     client. Alex owns all 103 rows after Piece 5 so the strict
--     policy returns the identical rowset. Safe.
--
-- KNOWN FOLLOW-UP (out of scope for this piece):
--   src/app/api/intake/route.ts uses
--     adminClient.auth.admin.listUsers({ perPage: 1 })
--   to resolve "the owner" user_id and caches it for the process
--   lifetime. With two auth users this was non-deterministic. After
--   this piece soft-deletes yourcoll2347, the listUsers call returns
--   only Alex and the resolution becomes deterministic. Long-term,
--   that route should hard-pin the owner_id (env var or constant)
--   rather than rely on listUsers ordering. File a follow-up ticket.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--
-- VERIFICATION:
--   See queries at the bottom of this file.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Soft-delete the dormant auth user
-- ============================================================
DO $$
DECLARE
  dormant_id    uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  dormant_email text := 'yourcoll2347@gmail.com';
  found_email   text;
BEGIN
  SELECT email INTO found_email FROM auth.users WHERE id = dormant_id;

  IF found_email IS NULL THEN
    RAISE NOTICE 'Dormant user % not found. Nothing to soft-delete.', dormant_id;
  ELSIF found_email <> dormant_email THEN
    RAISE EXCEPTION 'Safety check failed: id % does not match email %, found %',
      dormant_id, dormant_email, found_email;
  ELSE
    UPDATE auth.users
       SET deleted_at   = COALESCE(deleted_at,   now()),
           banned_until = COALESCE(banned_until, '2099-12-31 00:00:00+00'::timestamptz)
     WHERE id = dormant_id;
    RAISE NOTICE 'Soft-deleted auth user % (deleted_at + banned_until set)', dormant_email;
  END IF;
END $$;

-- ============================================================
-- 2. Drop the three permissive contacts policies
-- ============================================================
DROP POLICY IF EXISTS authenticated_select ON contacts;
DROP POLICY IF EXISTS authenticated_insert ON contacts;
DROP POLICY IF EXISTS authenticated_update ON contacts;

-- ============================================================
-- 3. Re-assert RLS enabled on contacts (defensive)
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Owner-scoped policy (mirrors opportunities)
-- ============================================================
DROP POLICY IF EXISTS "Users manage own contacts" ON contacts;
CREATE POLICY "Users manage own contacts" ON contacts
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  (SELECT count(*) FROM auth.users WHERE deleted_at IS NULL)                                                                                          AS active_auth_users,
  (SELECT email    FROM auth.users WHERE id = 'b735d691-4d86-4e31-9fd3-c2257822dca3')                                                                 AS alex_email,
  (SELECT (deleted_at IS NOT NULL) FROM auth.users WHERE id = '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb')                                                 AS dormant_soft_deleted,
  (SELECT count(*) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='contacts')                                                                                                AS contacts_policy_count,
  (SELECT pol.polname FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='contacts' LIMIT 1)                                                                                        AS contacts_policy_name,
  (SELECT pg_get_expr(pol.polqual, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='contacts' LIMIT 1)                                                                                        AS contacts_policy_using;

-- Expected:
--   active_auth_users:     1
--   alex_email:            alex@alexhollienco.com
--   dormant_soft_deleted:  true
--   contacts_policy_count: 1
--   contacts_policy_name:  Users manage own contacts
--   contacts_policy_using: (user_id = auth.uid())
