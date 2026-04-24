-- ================================================================
-- SLICE 2C: Tasks Extension + Follow-ups Merge + Opportunities
--           Consolidation + Deals Merge + Spine Idempotent Drops
-- follow_ups: 0 rows -- INSERT is no-op; DROP fires.
-- deals:      0 rows -- INSERT is no-op; DROP fires.
-- opportunities: 2 rows -- preserved via ON CONFLICT DO NOTHING.
-- Spine tables: already gone -- DROPs are no-ops.
-- Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- PART 1: Extend tasks table (Task 1)
-- ----------------------------------------------------------------

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type        text NOT NULL DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source      text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_reason  text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS action_hint text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_type_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_type_check
      CHECK (type IN ('todo', 'follow_up', 'commitment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------
-- PART 2: Merge follow_ups into tasks (Task 2)
-- follow_ups has 0 rows; INSERT is a no-op. DROP still fires.
-- follow_ups.due_date is DATE; tasks.due_date is timestamptz.
-- follow_up_status mapping: pending -> open, completed -> completed, skipped -> cancelled.
-- ----------------------------------------------------------------

INSERT INTO tasks (
  id, user_id, contact_id, title, due_reason, due_date, priority,
  status, snoozed_until, completed_at, created_at, updated_at, deleted_at,
  type, source
)
SELECT
  id,
  user_id,
  contact_id,
  COALESCE(reason, 'Follow up')                           AS title,
  reason                                                  AS due_reason,
  due_date::timestamptz                                   AS due_date,
  priority,
  CASE status::text
    WHEN 'pending'   THEN 'open'
    WHEN 'completed' THEN 'completed'
    ELSE                  'cancelled'
  END                                                     AS status,
  snoozed_until,
  completed_at,
  created_at,
  updated_at,
  deleted_at,
  'follow_up'                                             AS type,
  'follow_ups'                                            AS source
FROM follow_ups
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS follow_ups CASCADE;

-- ----------------------------------------------------------------
-- PART 3: Extend opportunities + merge deals (Task 3)
-- opportunities preserved (2 live rows). deals has 0 rows.
-- ----------------------------------------------------------------

-- Add deal-specific columns to opportunities (all nullable)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS buyer_name           text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS seller_name          text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS earnest_money        numeric;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS commission_rate      numeric;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_company       text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_officer       text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS title_company        text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lender_name          text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lender_partner_id    uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contract_date        date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_open_date     date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS scheduled_close_date date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS actual_close_date    date;

-- Merge deals rows into opportunities
-- deal_stage 'clear_to_close' has no equivalent in opportunity_stage; maps to 'in_escrow'.
INSERT INTO opportunities (
  id, user_id, contact_id,
  property_address, property_city, property_state, property_zip,
  sale_price, stage, escrow_number, notes,
  buyer_name, seller_name, earnest_money, commission_rate,
  escrow_company, escrow_officer, title_company, lender_name, lender_partner_id,
  contract_date, escrow_open_date, scheduled_close_date, actual_close_date,
  created_at, updated_at, deleted_at
)
SELECT
  d.id,
  d.user_id,
  d.contact_id,
  d.property_address,
  d.property_city,
  d.property_state,
  d.property_zip,
  d.sale_price,
  CASE d.stage::text
    WHEN 'clear_to_close' THEN 'in_escrow'::opportunity_stage
    ELSE d.stage::text::opportunity_stage
  END                     AS stage,
  d.escrow_number,
  d.notes,
  d.buyer_name,
  d.seller_name,
  d.earnest_money,
  d.commission_rate,
  d.escrow_company,
  d.escrow_officer,
  d.title_company,
  d.lender_name,
  d.lender_partner_id,
  d.contract_date,
  d.escrow_open_date,
  d.scheduled_close_date,
  d.actual_close_date,
  d.created_at,
  d.updated_at,
  d.deleted_at
FROM deals d
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS deals CASCADE;

-- ----------------------------------------------------------------
-- PART 4: Idempotent spine table drops (Task 5)
-- All 4 already absent from DB; safe no-ops.
-- ----------------------------------------------------------------

DROP TABLE IF EXISTS signals     CASCADE;
DROP TABLE IF EXISTS focus_queue  CASCADE;
DROP TABLE IF EXISTS cycle_state  CASCADE;
DROP TABLE IF EXISTS commitments  CASCADE;

COMMIT;
