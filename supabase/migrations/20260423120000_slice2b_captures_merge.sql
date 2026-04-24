-- ================================================================
-- SLICE 2B: Captures Consolidation
-- Merges voice_memos, intake_queue, email_inbox into captures.
-- Extends captures with 5 new columns + 2 CHECK constraints.
-- spine_inbox: SKIPPED (already absent from Supabase, verified 2026-04-23).
-- Source tables all have 0 rows; INSERTs are no-ops, DROPs still fire.
-- Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- Pre-insert column additions (needed before INSERTs reference them)
-- ----------------------------------------------------------------

-- source added here so each INSERT sets the correct value ('voice_memo', 'intake', 'email_inbox')
ALTER TABLE captures ADD COLUMN IF NOT EXISTS source     text NOT NULL DEFAULT 'manual';

-- transcript and metadata added before INSERTs that reference these columns
ALTER TABLE captures ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS metadata   jsonb;

-- ----------------------------------------------------------------
-- PART 1: Data merge (Task 1)
-- ----------------------------------------------------------------

-- voice_memos -> captures
INSERT INTO captures (
  id, user_id, raw_text, source, transcript, metadata, created_at, updated_at,
  processed
)
SELECT
  id,
  user_id,
  raw_transcript                            AS raw_text,
  'voice_memo'                              AS source,
  raw_transcript                            AS transcript,
  processed_output                          AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM voice_memos
ON CONFLICT (id) DO NOTHING;

-- intake_queue -> captures (WHERE deleted_at IS NULL)
INSERT INTO captures (
  id, user_id, raw_text, source, metadata, created_at, updated_at, processed
)
SELECT
  id,
  user_id,
  raw_input                                 AS raw_text,
  'intake'                                  AS source,
  parsed_data                               AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM intake_queue
WHERE deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- email_inbox -> captures
INSERT INTO captures (
  id, user_id, raw_text, source, parsed_contact_id, metadata, created_at, updated_at,
  processed
)
SELECT
  id,
  user_id,
  COALESCE(body_preview, subject, '')       AS raw_text,
  'email_inbox'                             AS source,
  contact_id                                AS parsed_contact_id,
  jsonb_build_object(
    'gmail_id',       gmail_id,
    'from_email',     from_email,
    'from_name',      from_name,
    'subject',        subject,
    'priority_score', priority_score
  )                                         AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM email_inbox
ON CONFLICT (id) DO NOTHING;

-- Drop source tables (no data loss: all were 0 rows)
DROP TABLE IF EXISTS voice_memos  CASCADE;
DROP TABLE IF EXISTS intake_queue CASCADE;
DROP TABLE IF EXISTS email_inbox  CASCADE;

-- ----------------------------------------------------------------
-- PART 2: Remaining schema changes to captures (Task 2)
-- ----------------------------------------------------------------

ALTER TABLE captures ADD COLUMN IF NOT EXISTS suggested_target jsonb;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'pending';

-- CHECK constraints (use DO $$ block for IF NOT EXISTS equivalent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'captures_source_check'
      AND conrelid = 'captures'::regclass
  ) THEN
    ALTER TABLE captures ADD CONSTRAINT captures_source_check
      CHECK (source IN ('manual','spine_inbox','voice_memo','intake','email_inbox','audio'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'captures_status_check'
      AND conrelid = 'captures'::regclass
  ) THEN
    ALTER TABLE captures ADD CONSTRAINT captures_status_check
      CHECK (status IN ('pending','promoted','discarded'));
  END IF;
END $$;

-- Index on source for filtered queries
CREATE INDEX IF NOT EXISTS idx_captures_source ON captures(source);

-- Backfill source for pre-existing rows (default 'manual' applies; merged rows already have explicit values)
UPDATE captures SET source = 'manual' WHERE source IS NULL;

-- Backfill status for already-promoted captures
UPDATE captures SET status = 'promoted' WHERE processed = true AND status = 'pending';

COMMIT;
