-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 7
-- 11-table RLS lockdown (Option B: per-table user_id ownership)
-- ============================================================
-- Generated: 2026-04-07
-- Per: ~/.claude/rules/dashboard.md
-- Per: Standing Rule 3 (no hard deletes), Rule 5 (Alex approves)
--
-- PREREQ:
--   - Phase 1 (dashboard-piece5-retry-2026-04-07) verified:
--       contacts.user_id NOT NULL with DEFAULT auth.uid()
--       opportunities.user_id NOT NULL with DEFAULT auth.uid()
--   - Alex (b735d691-4d86-4e31-9fd3-c2257822dca3) is the sole
--     active auth.users row (per Piece 6 dormant-user soft-delete).
--
-- BACKGROUND:
--   The audit on 2026-04-07 revealed 11 tables with wide-open
--   RLS (USING (true)) and no user_id column at all:
--
--     tasks
--     campaigns
--     campaign_steps
--     campaign_enrollments
--     campaign_step_completions
--     activities
--     intake_queue
--     listings
--     referral_partners
--     requests
--     resources
--
--   This piece adds user_id to every one, backfills all rows to
--   Alex, sets DEFAULT auth.uid() and NOT NULL, drops the wide
--   policies, and creates owner-scoped "Users manage own X"
--   policies that mirror the contacts/opportunities/deals/
--   follow_ups pattern.
--
-- WHAT THIS DOES (idempotent, transactional):
--   For each of the 11 tables:
--     1. ADD COLUMN user_id uuid REFERENCES auth.users(id)
--        ON DELETE CASCADE  (only if missing)
--     2. UPDATE WHERE user_id IS NULL SET to Alex's id
--     3. ALTER COLUMN user_id SET DEFAULT auth.uid()
--     4. ALTER COLUMN user_id SET NOT NULL
--     5. DROP IF EXISTS the three wide-open policies
--        (authenticated_select / authenticated_insert /
--         authenticated_update) and the campaigns family's
--        single _all policies
--     6. CREATE POLICY "Users manage own <table>"
--        FOR ALL TO authenticated
--        USING (user_id = auth.uid())
--        WITH CHECK (user_id = auth.uid())
--     7. CREATE INDEX idx_<table>_user on (user_id)
--        WHERE deleted_at IS NULL  (or unconditional for tables
--        without deleted_at)
--
-- WHAT THIS DOES NOT DO (out of scope, will be follow-up pieces):
--   - Add foreign key constraints to *_id columns (data integrity
--     gap flagged in the snapshot file but separate concern).
--   - Touch the trigger function split (set_updated_at vs
--     update_updated_at). Cosmetic, deferred.
--   - Touch the material_requests "anonymous intake" policies.
--     They are intentional (anon submissions to /intake) and
--     coexist correctly with the locked owner policy.
--
-- BLAST RADIUS REVIEW:
--   - All 11 tables become invisible to anyone except Alex.
--   - With only 1 active auth user, this is functionally identical
--     to the current state for read paths.
--   - WRITE paths: any code that inserts into these tables without
--     setting user_id will now fall through to the DEFAULT auth.uid().
--     Code paths that use the service role / adminClient bypass
--     RLS entirely and must explicitly set user_id.
--   - Known service-role write paths to verify after this runs:
--       src/app/api/intake/route.ts                (intake_queue, listings, requests)
--       src/app/api/webhooks/resend/route.ts       (campaign_step_completions)
--     Both already use adminClient. Both should explicitly set
--     user_id on insert. Confirm grep on user_id in those files.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this entire file. Run.
--   Watch the NOTICE output. Run the verification block at the
--   bottom and post the result back.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Constants and sanity check
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  alex_exists  boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = alex_user_id) INTO alex_exists;
  IF NOT alex_exists THEN
    RAISE EXCEPTION 'Alex auth.users row % not found. Aborting Piece 7.', alex_user_id;
  END IF;
  RAISE NOTICE 'Sanity check passed. Alex is %.', alex_user_id;
END $$;


-- ============================================================
-- 1. tasks
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tasks' AND column_name='user_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'tasks: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM tasks WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE tasks SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'tasks: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON tasks;
DROP POLICY IF EXISTS authenticated_insert ON tasks;
DROP POLICY IF EXISTS authenticated_update ON tasks;
DROP POLICY IF EXISTS "Users manage own tasks" ON tasks;
CREATE POLICY "Users manage own tasks" ON tasks
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);


-- ============================================================
-- 2. campaigns
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns' AND column_name='user_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'campaigns: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM campaigns WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE campaigns SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'campaigns: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE campaigns ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS campaigns_all ON campaigns;
DROP POLICY IF EXISTS authenticated_select ON campaigns;
DROP POLICY IF EXISTS authenticated_insert ON campaigns;
DROP POLICY IF EXISTS authenticated_update ON campaigns;
DROP POLICY IF EXISTS "Users manage own campaigns" ON campaigns;
CREATE POLICY "Users manage own campaigns" ON campaigns
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);


-- ============================================================
-- 3. campaign_steps
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaign_steps' AND column_name='user_id'
  ) THEN
    ALTER TABLE campaign_steps ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'campaign_steps: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM campaign_steps WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE campaign_steps SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'campaign_steps: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE campaign_steps ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE campaign_steps ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS campaign_steps_all ON campaign_steps;
DROP POLICY IF EXISTS authenticated_select ON campaign_steps;
DROP POLICY IF EXISTS authenticated_insert ON campaign_steps;
DROP POLICY IF EXISTS authenticated_update ON campaign_steps;
DROP POLICY IF EXISTS "Users manage own campaign_steps" ON campaign_steps;
CREATE POLICY "Users manage own campaign_steps" ON campaign_steps
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_campaign_steps_user ON campaign_steps(user_id);


-- ============================================================
-- 4. campaign_enrollments
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaign_enrollments' AND column_name='user_id'
  ) THEN
    ALTER TABLE campaign_enrollments ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'campaign_enrollments: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM campaign_enrollments WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE campaign_enrollments SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'campaign_enrollments: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE campaign_enrollments ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE campaign_enrollments ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS campaign_enrollments_all ON campaign_enrollments;
DROP POLICY IF EXISTS authenticated_select ON campaign_enrollments;
DROP POLICY IF EXISTS authenticated_insert ON campaign_enrollments;
DROP POLICY IF EXISTS authenticated_update ON campaign_enrollments;
DROP POLICY IF EXISTS "Users manage own campaign_enrollments" ON campaign_enrollments;
CREATE POLICY "Users manage own campaign_enrollments" ON campaign_enrollments
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_user ON campaign_enrollments(user_id);


-- ============================================================
-- 5. campaign_step_completions
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaign_step_completions' AND column_name='user_id'
  ) THEN
    ALTER TABLE campaign_step_completions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'campaign_step_completions: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM campaign_step_completions WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE campaign_step_completions SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'campaign_step_completions: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE campaign_step_completions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE campaign_step_completions ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS campaign_step_completions_all ON campaign_step_completions;
DROP POLICY IF EXISTS authenticated_select ON campaign_step_completions;
DROP POLICY IF EXISTS authenticated_insert ON campaign_step_completions;
DROP POLICY IF EXISTS authenticated_update ON campaign_step_completions;
DROP POLICY IF EXISTS "Users manage own campaign_step_completions" ON campaign_step_completions;
CREATE POLICY "Users manage own campaign_step_completions" ON campaign_step_completions
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_campaign_step_completions_user ON campaign_step_completions(user_id);


-- ============================================================
-- 6. activities
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='activities' AND column_name='user_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'activities: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM activities WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE activities SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'activities: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE activities ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE activities ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON activities;
DROP POLICY IF EXISTS authenticated_insert ON activities;
DROP POLICY IF EXISTS authenticated_update ON activities;
DROP POLICY IF EXISTS "Users manage own activities" ON activities;
CREATE POLICY "Users manage own activities" ON activities
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_activities_user
  ON activities(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 7. intake_queue
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='intake_queue' AND column_name='user_id'
  ) THEN
    ALTER TABLE intake_queue ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'intake_queue: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM intake_queue WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE intake_queue SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'intake_queue: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE intake_queue ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE intake_queue ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON intake_queue;
DROP POLICY IF EXISTS authenticated_insert ON intake_queue;
DROP POLICY IF EXISTS authenticated_update ON intake_queue;
DROP POLICY IF EXISTS "Users manage own intake_queue" ON intake_queue;
CREATE POLICY "Users manage own intake_queue" ON intake_queue
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_intake_queue_user
  ON intake_queue(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 8. listings
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='listings' AND column_name='user_id'
  ) THEN
    ALTER TABLE listings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'listings: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM listings WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE listings SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'listings: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE listings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE listings ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON listings;
DROP POLICY IF EXISTS authenticated_insert ON listings;
DROP POLICY IF EXISTS authenticated_update ON listings;
DROP POLICY IF EXISTS "Users manage own listings" ON listings;
CREATE POLICY "Users manage own listings" ON listings
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_listings_user
  ON listings(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 9. referral_partners
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referral_partners' AND column_name='user_id'
  ) THEN
    ALTER TABLE referral_partners ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'referral_partners: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM referral_partners WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE referral_partners SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'referral_partners: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE referral_partners ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE referral_partners ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON referral_partners;
DROP POLICY IF EXISTS authenticated_insert ON referral_partners;
DROP POLICY IF EXISTS authenticated_update ON referral_partners;
DROP POLICY IF EXISTS "Users manage own referral_partners" ON referral_partners;
CREATE POLICY "Users manage own referral_partners" ON referral_partners
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_referral_partners_user
  ON referral_partners(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 10. requests
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='requests' AND column_name='user_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'requests: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM requests WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE requests SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'requests: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE requests ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE requests ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON requests;
DROP POLICY IF EXISTS authenticated_insert ON requests;
DROP POLICY IF EXISTS authenticated_update ON requests;
DROP POLICY IF EXISTS "Users manage own requests" ON requests;
CREATE POLICY "Users manage own requests" ON requests
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_requests_user
  ON requests(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 11. resources
-- ============================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='resources' AND column_name='user_id'
  ) THEN
    ALTER TABLE resources ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'resources: added user_id column.';
  END IF;

  SELECT count(*) INTO null_count FROM resources WHERE user_id IS NULL;
  IF null_count > 0 THEN
    UPDATE resources SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'resources: backfilled % rows.', null_count;
  END IF;
END $$;

ALTER TABLE resources ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE resources ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS authenticated_select ON resources;
DROP POLICY IF EXISTS authenticated_insert ON resources;
DROP POLICY IF EXISTS authenticated_update ON resources;
DROP POLICY IF EXISTS "Users manage own resources" ON resources;
CREATE POLICY "Users manage own resources" ON resources
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_resources_user
  ON resources(user_id) WHERE deleted_at IS NULL;


COMMIT;


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run this AFTER the COMMIT above. Every row should show:
--   user_id_nullable = NO
--   user_id_default  = auth.uid()
--   policy_count     = 1
--   policy_using     = (user_id = auth.uid())
-- ============================================================

WITH target_tables AS (
  SELECT unnest(ARRAY[
    'tasks',
    'campaigns',
    'campaign_steps',
    'campaign_enrollments',
    'campaign_step_completions',
    'activities',
    'intake_queue',
    'listings',
    'referral_partners',
    'requests',
    'resources'
  ]) AS table_name
)
SELECT
  t.table_name,
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name=t.table_name AND column_name='user_id') AS user_id_nullable,
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name=t.table_name AND column_name='user_id') AS user_id_default,
  (SELECT count(*) FROM pg_policy pol
     JOIN pg_class c ON c.oid = pol.polrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=t.table_name)                                AS policy_count,
  (SELECT pg_get_expr(pol.polqual, pol.polrelid) FROM pg_policy pol
     JOIN pg_class c ON c.oid = pol.polrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=t.table_name LIMIT 1)                        AS policy_using
FROM target_tables t
ORDER BY t.table_name;


-- Row count audit (the broken query is fixed here)
SELECT 'tasks' AS t, count(*) FROM tasks UNION ALL
SELECT 'campaigns', count(*) FROM campaigns UNION ALL
SELECT 'campaign_steps', count(*) FROM campaign_steps UNION ALL
SELECT 'campaign_enrollments', count(*) FROM campaign_enrollments UNION ALL
SELECT 'campaign_step_completions', count(*) FROM campaign_step_completions UNION ALL
SELECT 'activities', count(*) FROM activities UNION ALL
SELECT 'intake_queue', count(*) FROM intake_queue UNION ALL
SELECT 'listings', count(*) FROM listings UNION ALL
SELECT 'referral_partners', count(*) FROM referral_partners UNION ALL
SELECT 'requests', count(*) FROM requests UNION ALL
SELECT 'resources', count(*) FROM resources
ORDER BY t;


-- ============================================================
-- ROLLBACK (emergency only)
-- ============================================================
-- Run only if Phase 7 broke a code path you cannot patch.
-- This restores the wide-open posture but does NOT remove the
-- user_id columns (those stay -- they are non-destructive).
--
-- BEGIN;
-- DROP POLICY IF EXISTS "Users manage own tasks" ON tasks;
-- DROP POLICY IF EXISTS "Users manage own campaigns" ON campaigns;
-- DROP POLICY IF EXISTS "Users manage own campaign_steps" ON campaign_steps;
-- DROP POLICY IF EXISTS "Users manage own campaign_enrollments" ON campaign_enrollments;
-- DROP POLICY IF EXISTS "Users manage own campaign_step_completions" ON campaign_step_completions;
-- DROP POLICY IF EXISTS "Users manage own activities" ON activities;
-- DROP POLICY IF EXISTS "Users manage own intake_queue" ON intake_queue;
-- DROP POLICY IF EXISTS "Users manage own listings" ON listings;
-- DROP POLICY IF EXISTS "Users manage own referral_partners" ON referral_partners;
-- DROP POLICY IF EXISTS "Users manage own requests" ON requests;
-- DROP POLICY IF EXISTS "Users manage own resources" ON resources;
-- -- Recreate the wide policies on each table:
-- -- CREATE POLICY authenticated_select ON tasks FOR SELECT USING (true);
-- -- (etc, repeat for each table -- copy from snapshot file on Desktop)
-- COMMIT;
-- ============================================================
