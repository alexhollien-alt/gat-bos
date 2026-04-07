-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 1 OF 3
-- Rename contacts.temperature to contacts.health_score
-- ============================================================
-- Generated: 2026-04-06
-- Per: ~/.claude/rules/dashboard.md
--
-- WHAT THIS DOES:
--   Renames the existing contacts.temperature column to contacts.health_score.
--   Non-destructive: PostgreSQL preserves all values, indexes, and constraints
--   on RENAME COLUMN. Your manually set values stay intact.
--
-- WHEN TO RUN:
--   AFTER the code update has landed (the 13 TypeScript files that reference
--   contacts.temperature have been updated to read contacts.health_score).
--   Or run them in the same minute -- there will be a brief window where the
--   live app errors if it queries the old name.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--   Verify with the SELECT at the bottom.
--
-- ROLLBACK (if you need to undo):
--   ALTER TABLE contacts RENAME COLUMN health_score TO temperature;
-- ============================================================

ALTER TABLE contacts RENAME COLUMN temperature TO health_score;

-- Verification: confirm the column exists under the new name
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contacts'
  AND column_name IN ('temperature', 'health_score');

-- Expected output: one row, column_name = 'health_score'.
-- If you see two rows or 'temperature', the rename did not run.

-- Verification: confirm your manual values survived the rename
SELECT health_score, count(*) AS contact_count
FROM contacts
WHERE deleted_at IS NULL
GROUP BY health_score
ORDER BY health_score DESC NULLS LAST
LIMIT 10;
