-- Phase 1: Contact detail page evolution
-- Adds rep_pulse_updated_at column + auto-update trigger
-- Idempotent. Safe to run multiple times.
--
-- Run in Supabase SQL Editor. Verify the NOTICE output.

-- 1. Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'rep_pulse_updated_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN rep_pulse_updated_at TIMESTAMPTZ;
    RAISE NOTICE 'Added contacts.rep_pulse_updated_at column';
  ELSE
    RAISE NOTICE 'contacts.rep_pulse_updated_at already exists, skipping';
  END IF;
END $$;

-- 2. Backfill: any contact with a non-null rep_pulse but null timestamp
--    gets stamped with now() so the temperature coalesce treats it as fresh.
--    Only runs once because it WHERE's the null condition.
UPDATE contacts
SET rep_pulse_updated_at = COALESCE(updated_at, now())
WHERE rep_pulse IS NOT NULL
  AND rep_pulse_updated_at IS NULL;

-- 3. Trigger function: auto-update rep_pulse_updated_at when rep_pulse changes
CREATE OR REPLACE FUNCTION touch_rep_pulse_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update timestamp if rep_pulse actually changed
  IF NEW.rep_pulse IS DISTINCT FROM OLD.rep_pulse THEN
    NEW.rep_pulse_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS contacts_rep_pulse_touch ON contacts;
CREATE TRIGGER contacts_rep_pulse_touch
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION touch_rep_pulse_updated_at();

-- 5. Verification queries (uncomment to run)
-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'contacts' AND column_name = 'rep_pulse_updated_at';
--
-- SELECT id, first_name, last_name, rep_pulse, rep_pulse_updated_at
--   FROM contacts
--   WHERE rep_pulse IS NOT NULL
--   LIMIT 5;
