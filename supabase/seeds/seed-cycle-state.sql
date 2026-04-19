-- Spine Task 16: Seed cycle_state for all tiered contacts
-- Populates the Today View Tier Alerts section with real cadence data.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
--
-- Cadence thresholds per dashboard.md / build spec:
--   A = 7 days, B = 10 days, C = 14 days, P = no active cadence

BEGIN;

INSERT INTO cycle_state (contact_id, user_id, cadence_days, next_due_at, last_touched_at, status, created_at, updated_at)
SELECT
  c.id AS contact_id,
  c.user_id,
  CASE c.tier
    WHEN 'A' THEN 7
    WHEN 'B' THEN 10
    WHEN 'C' THEN 14
  END AS cadence_days,
  -- next_due_at = last_touchpoint + cadence, or now if no touchpoint
  COALESCE(c.last_touchpoint, now()) + (
    CASE c.tier
      WHEN 'A' THEN interval '7 days'
      WHEN 'B' THEN interval '10 days'
      WHEN 'C' THEN interval '14 days'
    END
  ) AS next_due_at,
  COALESCE(c.last_touchpoint, now()) AS last_touched_at,
  'active' AS status,
  now() AS created_at,
  now() AS updated_at
FROM contacts c
WHERE c.tier IN ('A', 'B', 'C')
  AND c.deleted_at IS NULL
  AND c.type = 'realtor'
ON CONFLICT (contact_id) DO NOTHING;

-- Verify
DO $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM cycle_state WHERE status = 'active';
  RAISE NOTICE 'cycle_state rows: %', cnt;
  IF cnt < 1 THEN
    RAISE WARNING 'Expected at least 1 cycle_state row, got %', cnt;
  END IF;
END $$;

COMMIT;
