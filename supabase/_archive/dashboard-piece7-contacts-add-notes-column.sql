-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 7
-- contacts.notes column add
-- ============================================================
-- Generated: 2026-04-07
-- Per: Phase 2.1 naming-drift fix
--
-- BACKGROUND:
--   The naming-drift refactor (relationship -> stage in code,
--   drop lead_status / company / source_detail entirely) revealed
--   that /api/intake and the contact form modal both insert into
--   a `notes` column on contacts. The live DB does not currently
--   have a notes column, so those inserts have been silently
--   failing. This piece adds it.
--
-- WHAT THIS DOES (idempotent):
--   1. ADD COLUMN IF NOT EXISTS contacts.notes text NULL
--
-- WHAT THIS DOES NOT DO:
--   - Does not backfill any data. Existing 103 contacts get NULL.
--   - Does not add a CHECK constraint, default, or NOT NULL.
--     notes is optional free-form annotation; nullable text is correct.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--
-- VERIFICATION:
--   See queries at the bottom of this file.
-- ============================================================

BEGIN;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes text;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='notes')   AS notes_data_type,
  (SELECT is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='notes')   AS notes_nullable;

-- Expected:
--   notes_data_type:  text
--   notes_nullable:   YES
