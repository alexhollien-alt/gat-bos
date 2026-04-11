-- ============================================================================
-- Phase 3: add the 5 missing GAT-BOS tables + extend interaction_type enum
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 3
-- Source:   GAT-BOS-Complete-Build-Spec.md, tables 3-7 (lines 89-158)
--
-- NEW TABLES:
--   1. email_log       Resend campaign send tracking (per-contact, per-email)
--   2. events          Calendar sync (meetings, BNI, open houses, closings)
--   3. email_inbox     Gmail triage queue, Claude-scored and tagged
--   4. voice_memos     Brain-dump transcripts and Claude-extracted actions
--   5. agent_metrics   Business outcomes per agent per period
--
-- ENUM EXTENSION:
--   interaction_type enum gets three new values to match the spec's touchpoint
--   vocabulary:
--     + email_sent     (currently logged as generic 'email')
--     + email_received (currently logged as generic 'email')
--     + event          (links interactions to events table rows)
--   Existing values preserved: call, text, email, meeting, broker_open, lunch,
--   note. 'email' stays alongside email_sent / email_received so legacy rows
--   do not need migration.
--
-- COMMON PATTERN (applied to all 5 new tables):
--   - id uuid pk default gen_random_uuid()
--   - user_id uuid not null default auth.uid() references auth.users on delete cascade
--   - created_at timestamptz default now()
--   - updated_at timestamptz default now() with BEFORE UPDATE trigger
--     via existing public.set_updated_at() function from the baseline
--   - enable row level security
--   - owner-scoped "Users manage own {table}" policy,
--     mirrors Phase 1 / piece 6's contacts pattern
--   - DROP POLICY IF EXISTS + CREATE POLICY for idempotent replay
--   - CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS throughout
--
-- NOT APPLIED TO LIVE DB IN THIS COMMIT.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Extend interaction_type enum
-- ============================================================================
-- Postgres 17 allows ALTER TYPE ADD VALUE inside a transaction as long as the
-- new value is not used in the same transaction. We do not insert any rows
-- with these new values here, so the transaction is safe.
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_sent';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_received';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'event';

-- ============================================================================
-- 1. email_log
-- ============================================================================
-- Tracks every campaign email sent via Resend. One row per (contact, send).
-- Status transitions via Resend webhooks. resend_id is unique for webhook
-- idempotency.
CREATE TABLE IF NOT EXISTS public.email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign    text NOT NULL,                   -- weekly_edge, closing_brief, onboarding_warm, onboarding_cold, etc.
  subject     text NOT NULL,
  sent_at     timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'sent',    -- sent, delivered, opened, clicked, bounced, failed
  resend_id   text UNIQUE,                     -- Resend's tracking ID, unique for webhook idempotency
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_user_sent_idx
  ON public.email_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_contact_idx
  ON public.email_log (contact_id);
CREATE INDEX IF NOT EXISTS email_log_campaign_idx
  ON public.email_log (user_id, campaign);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own email_log" ON public.email_log;
CREATE POLICY "Users manage own email_log" ON public.email_log
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS email_log_set_updated_at ON public.email_log;
CREATE TRIGGER email_log_set_updated_at
  BEFORE UPDATE ON public.email_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. events
-- ============================================================================
-- Calendar sync surface. contact_ids is a uuid array because many events have
-- multiple attendees (BNI table guest list, open house co-hosts, etc.). Postgres
-- does not enforce FKs on array elements; the app is responsible for data
-- integrity. google_event_id is unique for sync idempotency.
CREATE TABLE IF NOT EXISTS public.events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  type             text NOT NULL DEFAULT 'personal',  -- bni, open_house, agent_meeting, closing, personal
  start_time       timestamptz NOT NULL,
  end_time         timestamptz,
  location         text,
  contact_ids      uuid[] NOT NULL DEFAULT '{}'::uuid[],
  notes            text,
  google_event_id  text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_start_idx
  ON public.events (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS events_user_type_idx
  ON public.events (user_id, type);
-- GIN index on contact_ids so "events involving contact X" stays fast
CREATE INDEX IF NOT EXISTS events_contact_ids_gin_idx
  ON public.events USING gin (contact_ids);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own events" ON public.events;
CREATE POLICY "Users manage own events" ON public.events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. email_inbox
-- ============================================================================
-- Gmail triage queue. Distinct from intake_queue (which is form submissions).
-- Claude runs over new rows and fills priority_score, suggested_action, and
-- draft_reply. contact_id is nullable because Claude may not find a match.
-- gmail_id is unique for sync idempotency.
CREATE TABLE IF NOT EXISTS public.email_inbox (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id          text NOT NULL UNIQUE,
  from_email        text NOT NULL,
  from_name         text,
  subject           text,
  body_preview      text,                                              -- first ~500 chars
  received_at       timestamptz NOT NULL,
  contact_id        uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  priority_score    smallint CHECK (priority_score BETWEEN 1 AND 10),  -- Claude-rated 1-10
  status            text NOT NULL DEFAULT 'unread',                    -- unread, triaged, replied, archived
  suggested_action  text,
  draft_reply       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_inbox_user_received_idx
  ON public.email_inbox (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_inbox_user_status_idx
  ON public.email_inbox (user_id, status);
CREATE INDEX IF NOT EXISTS email_inbox_contact_idx
  ON public.email_inbox (contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own email_inbox" ON public.email_inbox;
CREATE POLICY "Users manage own email_inbox" ON public.email_inbox
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS email_inbox_set_updated_at ON public.email_inbox;
CREATE TRIGGER email_inbox_set_updated_at
  BEFORE UPDATE ON public.email_inbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. voice_memos
-- ============================================================================
-- Voice memo ingestion: raw_transcript is the Whisper output, processed_output
-- is the JSON Claude extracted (action_items, contacts_mentioned, follow_ups,
-- sentiment, etc.). contact_ids is a uuid array because a single memo often
-- references multiple people.
CREATE TABLE IF NOT EXISTS public.voice_memos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_transcript    text NOT NULL,
  processed_output  jsonb,                                  -- Claude's structured extraction
  contact_ids       uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status            text NOT NULL DEFAULT 'pending',        -- pending, processed, reviewed, archived
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_memos_user_created_idx
  ON public.voice_memos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_memos_user_status_idx
  ON public.voice_memos (user_id, status);
CREATE INDEX IF NOT EXISTS voice_memos_contact_ids_gin_idx
  ON public.voice_memos USING gin (contact_ids);

ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own voice_memos" ON public.voice_memos;
CREATE POLICY "Users manage own voice_memos" ON public.voice_memos
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS voice_memos_set_updated_at ON public.voice_memos;
CREATE TRIGGER voice_memos_set_updated_at
  BEFORE UPDATE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. agent_metrics
-- ============================================================================
-- Business outcomes per agent per period. One row per (contact_id, period).
-- Example periods: "2026-Q1", "2026-04", "2026-W15". App decides granularity.
-- revenue is nullable (optional, sensitive). Claude does not read it unless
-- explicitly asked.
CREATE TABLE IF NOT EXISTS public.agent_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id       uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  period           text NOT NULL,                    -- "2026-Q1", "2026-04", "2026-W15", etc.
  escrows_opened   integer NOT NULL DEFAULT 0 CHECK (escrows_opened >= 0),
  escrows_closed   integer NOT NULL DEFAULT 0 CHECK (escrows_closed >= 0),
  referral_source  text,                             -- BNI, SAAR, cold_outreach, referral, etc.
  revenue          numeric(12,2),                    -- nullable, optional
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_metrics_contact_period_uniq UNIQUE (contact_id, period)
);

CREATE INDEX IF NOT EXISTS agent_metrics_user_period_idx
  ON public.agent_metrics (user_id, period);
CREATE INDEX IF NOT EXISTS agent_metrics_contact_idx
  ON public.agent_metrics (contact_id);

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own agent_metrics" ON public.agent_metrics;
CREATE POLICY "Users manage own agent_metrics" ON public.agent_metrics
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS agent_metrics_set_updated_at ON public.agent_metrics;
CREATE TRIGGER agent_metrics_set_updated_at
  BEFORE UPDATE ON public.agent_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.email_log     IS 'Resend campaign email tracking, one row per (contact, send). Webhooks transition status.';
COMMENT ON TABLE public.events        IS 'Calendar events (BNI, open houses, agent meetings, closings). Synced from Google Calendar.';
COMMENT ON TABLE public.email_inbox   IS 'Gmail triage queue. Claude scores priority and suggests replies. Distinct from intake_queue (form submissions).';
COMMENT ON TABLE public.voice_memos   IS 'Voice memo transcripts and Claude-extracted action items. Multi-contact via contact_ids uuid[].';
COMMENT ON TABLE public.agent_metrics IS 'Per-agent business outcomes by period. UNIQUE (contact_id, period). revenue column is optional/sensitive.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- -- tables exist
-- select table_name from information_schema.tables
--  where table_schema='public'
--    and table_name in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  order by table_name;
-- expected: 5 rows
--
-- -- rls enabled
-- select c.relname, c.relrowsecurity
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public'
--    and c.relname in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  order by c.relname;
-- expected: all 5 relrowsecurity = true
--
-- -- one owner-scoped policy per table
-- select c.relname, count(*) as policy_count
--   from pg_policy pol
--   join pg_class c on c.oid=pol.polrelid
--   join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public'
--    and c.relname in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  group by c.relname
--  order by c.relname;
-- expected: all 5 policy_count = 1
--
-- -- interaction_type enum extended
-- select enumlabel from pg_enum
--   join pg_type t on t.oid=enumtypid
--  where t.typname='interaction_type'
--  order by enumsortorder;
-- expected: call, text, email, meeting, broker_open, lunch, note, email_sent, email_received, event
-- ============================================================================
