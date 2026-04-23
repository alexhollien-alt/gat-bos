-- Campaign enrollment schedule column.
--
-- Adds `next_action_at` to campaign_enrollments so the enrollment row knows
-- when its current step is due. Pre-computed at enrollment (now() + step1.delay_days)
-- and rolled forward by `completeStep()` using the next step's delay_days.
-- Cleared to NULL on last step completion.
--
-- Enables a future dispatcher/cron: `WHERE next_action_at <= now() AND status='active'`.

ALTER TABLE campaign_enrollments
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_enrollments_next_action
  ON campaign_enrollments (next_action_at)
  WHERE deleted_at IS NULL AND status = 'active';
