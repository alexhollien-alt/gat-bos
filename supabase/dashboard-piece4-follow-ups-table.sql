-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 4 OF 4
-- follow_ups table: Linear Focus bucket #1 source
-- ============================================================
-- Generated: 2026-04-06
-- Per: ~/.claude/rules/dashboard.md
-- Per: ~/Documents/Alex Hub(Obs)/digital-aesthetic-upgrade/docs:architecture:dashboard-widgets.md.md
--
-- PREREQ: Pieces 1, 2, and 3 must have run successfully.
--   - Piece 1: contacts.health_score rename
--   - Piece 2: deals table, opportunities security, materialized view
--   - Piece 3: agent_health smart coalesce view
--
-- WHY THIS EXISTS:
--   The original schema.sql declared a follow_ups table but it does NOT
--   exist in the live DB. action-queue.tsx and (app)/actions/page.tsx
--   both query it and have presumably been failing silently. The Linear
--   Focus model from Section 5 of the architecture doc requires bucket #1
--   ("Overdue follow-ups") to read from this table.
--
-- WHAT THIS DOES (safe, additive, idempotent):
--   1. Creates follow_up_status enum (pending, completed, snoozed, cancelled)
--   2. Creates follow_ups table with modern columns (snoozed_until,
--      completed_via_interaction_id, deleted_at, priority)
--   3. RLS policy: user_id = auth.uid()
--   4. Partial indexes for the dashboard bucket query patterns
--   5. updated_at trigger reusing the existing function from schema.sql
--   6. Adds follow_ups to supabase_realtime publication
--   7. Backfills one pending follow-up per contact whose
--      next_action_date is set, preserving existing intent
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--   Watch for NOTICE output that explains what each defensive block did.
--
-- VERIFICATION:
--   See queries at the bottom of this file.
-- ============================================================


-- ============================================================
-- 1. follow_up_status enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE follow_up_status AS ENUM (
    'pending',
    'completed',
    'snoozed',
    'cancelled'
  );
  RAISE NOTICE 'Created follow_up_status enum.';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'follow_up_status enum already exists. No change.';
END $$;


-- ============================================================
-- 2. follow_ups table
-- ============================================================
-- One outstanding "next touch" PER follow-up reason. Multiple pending
-- follow-ups per contact are allowed (e.g. "send Q2 market report" AND
-- "check in on referral lead from open house"). The dashboard bucket
-- query orders by tier weight + due_date.

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

  -- What the touchpoint is for
  reason text NOT NULL,

  -- Schedule
  due_date date NOT NULL,
  status follow_up_status DEFAULT 'pending' NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Snooze (parallel to tasks.snoozed_until pattern)
  snoozed_until timestamptz,

  -- Resolution
  completed_at timestamptz,
  completed_via_interaction_id uuid REFERENCES interactions(id) ON DELETE SET NULL,

  -- Origin tracking (manual, auto-backfill, morning-briefing, etc.)
  created_via text DEFAULT 'manual',

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);


-- ============================================================
-- 3. Row level security
-- ============================================================

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own follow_ups" ON follow_ups;
CREATE POLICY "Users manage own follow_ups" ON follow_ups
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- 4. Indexes for dashboard bucket query patterns
-- ============================================================
-- The Linear Focus bucket #1 query is roughly:
--   SELECT ... FROM follow_ups
--   WHERE user_id = $1
--     AND status = 'pending'
--     AND deleted_at IS NULL
--     AND (snoozed_until IS NULL OR snoozed_until <= now())
--     AND due_date <= current_date
--   ORDER BY due_date ASC

CREATE INDEX IF NOT EXISTS idx_follow_ups_user_pending
  ON follow_ups(user_id, due_date)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_follow_ups_contact
  ON follow_ups(contact_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_follow_ups_snoozed
  ON follow_ups(snoozed_until)
  WHERE status = 'snoozed' AND deleted_at IS NULL;


-- ============================================================
-- 5. updated_at trigger
-- ============================================================
-- Reuses the existing update_updated_at() function from schema.sql.

DROP TRIGGER IF EXISTS follow_ups_updated_at ON follow_ups;
CREATE TRIGGER follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 6. Supabase Realtime publication
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'follow_ups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE follow_ups;
    RAISE NOTICE 'Added follow_ups to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'follow_ups already in supabase_realtime publication.';
  END IF;
END $$;


-- ============================================================
-- 7. Backfill from contacts.next_action_date
-- ============================================================
-- Preserves existing "next touch" intent already captured on contacts.
-- Only inserts when:
--   - contacts.next_action_date IS NOT NULL (intent exists)
--   - contacts.user_id IS NOT NULL (RLS anchor available)
--   - contacts.deleted_at IS NULL (active contact)
--   - No existing follow-up already references this contact (idempotent)
--
-- This is safe to re-run -- the NOT EXISTS clause prevents duplicates.

DO $$
DECLARE
  inserted_count int;
BEGIN
  INSERT INTO follow_ups (
    user_id,
    contact_id,
    reason,
    due_date,
    status,
    priority,
    created_via
  )
  SELECT
    c.user_id,
    c.id,
    COALESCE(NULLIF(c.next_action, ''), 'Follow up') AS reason,
    c.next_action_date::date AS due_date,
    'pending'::follow_up_status,
    CASE
      WHEN c.tier = 'A' THEN 'high'
      WHEN c.tier = 'B' THEN 'medium'
      ELSE 'low'
    END AS priority,
    'backfill_from_contacts' AS created_via
  FROM contacts c
  WHERE c.next_action_date IS NOT NULL
    AND c.user_id IS NOT NULL
    AND c.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM follow_ups f
      WHERE f.contact_id = c.id
        AND f.created_via = 'backfill_from_contacts'
        AND f.deleted_at IS NULL
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % follow-ups from contacts.next_action_date.', inserted_count;
END $$;


-- ============================================================
-- VERIFY
-- ============================================================
--
-- 1. Table exists and has rows:
--    SELECT count(*) AS total,
--           count(*) FILTER (WHERE status = 'pending') AS pending,
--           count(*) FILTER (WHERE due_date <= current_date AND status = 'pending') AS overdue
--    FROM follow_ups
--    WHERE deleted_at IS NULL;
--
-- 2. Backfill matches contacts with next_action_date set:
--    SELECT
--      (SELECT count(*) FROM contacts WHERE next_action_date IS NOT NULL AND deleted_at IS NULL) AS contacts_with_next_action,
--      (SELECT count(*) FROM follow_ups WHERE created_via = 'backfill_from_contacts' AND deleted_at IS NULL) AS backfilled_follow_ups;
--    -- These two numbers should be equal.
--
-- 3. The Linear Focus bucket #1 query (overdue follow-ups for current user):
--    SELECT f.id, f.reason, f.due_date, f.priority,
--           c.first_name, c.last_name, c.tier
--    FROM follow_ups f
--    JOIN contacts c ON c.id = f.contact_id
--    WHERE f.user_id = auth.uid()
--      AND f.status = 'pending'
--      AND f.deleted_at IS NULL
--      AND (f.snoozed_until IS NULL OR f.snoozed_until <= now())
--      AND f.due_date <= current_date
--    ORDER BY
--      CASE c.tier WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
--      f.due_date ASC
--    LIMIT 20;
--
-- 4. RLS sanity check (should return only your own rows):
--    SELECT count(*) FROM follow_ups;
--
-- 5. Realtime publication includes follow_ups:
--    SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND tablename = 'follow_ups';
--    -- Should return one row.
--
-- ============================================================


-- ============================================================
-- ROLLBACK (emergency only)
-- ============================================================
--
-- Soft delete the backfilled rows first (per no-hard-delete standing rule):
--   UPDATE follow_ups SET deleted_at = now()
--   WHERE created_via = 'backfill_from_contacts';
--
-- Then drop the table itself if absolutely necessary:
--   ALTER PUBLICATION supabase_realtime DROP TABLE follow_ups;
--   DROP TRIGGER IF EXISTS follow_ups_updated_at ON follow_ups;
--   DROP TABLE IF EXISTS follow_ups;
--   DROP TYPE IF EXISTS follow_up_status;
--
-- ============================================================
