-- ============================================================
-- PHASE 1.3.1 -- GMAIL MVP SCHEMA
-- Tables: emails, email_drafts, oauth_tokens, error_logs
-- Enum:   email_draft_status
-- RLS:    alex-only, keyed on auth.jwt() email claim (single-user system)
-- ============================================================
-- Spec:  ~/Downloads/GAT-BOS-Phase-1.3.1-Gmail-MVP-Specification.md
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 2)
-- Generated: 2026-04-16
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file fully rebuilds the schema. No data loss risk
-- on first run (tables are new); on re-run, all Phase 1.3.1 data
-- is wiped. Do not re-run after Phase 3 populates emails.
--
-- RLS approach:
--   Spec section "Row-Level Security" uses auth.uid() = '{{ALEX_UUID}}'.
--   Spec section "API Route Protection" gates on email == alex@alexhollienco.com.
--   We keep policies keyed on auth.jwt() ->> 'email' to match the route
--   protection contract exactly, avoid hardcoding a UUID, and stay
--   single-user-clean. Server-side inserts from the cron route bypass
--   RLS via service_role key (standard Supabase pattern).
--
-- OAuth token encryption:
--   access_token + refresh_token stored as TEXT in this migration.
--   Application-level encryption via Supabase Vault lands in Phase 3
--   when the OAuth callback handler writes tokens. Do not insert
--   real tokens until Phase 3 encryption is wired.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.email_drafts CASCADE;
DROP TABLE IF EXISTS public.emails CASCADE;
DROP TABLE IF EXISTS public.oauth_tokens CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TYPE  IF EXISTS public.email_draft_status CASCADE;

-- ------------------------------------------------------------
-- Enum: email_draft_status
-- ------------------------------------------------------------
CREATE TYPE public.email_draft_status AS ENUM (
  'generated',
  'approved',
  'sent',
  'discarded',
  'revised'
);

-- ------------------------------------------------------------
-- emails: synced from Gmail, filtered to contacts + RE domains
-- ------------------------------------------------------------
CREATE TABLE public.emails (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_id           TEXT UNIQUE NOT NULL,
  gmail_thread_id    TEXT,
  from_email         TEXT NOT NULL,
  from_name          TEXT,
  subject            TEXT NOT NULL,
  body_plain         TEXT,
  body_html          TEXT,
  snippet            TEXT,
  is_unread          BOOLEAN NOT NULL DEFAULT TRUE,
  is_contact_match   BOOLEAN NOT NULL DEFAULT FALSE,
  contact_id         UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_domain     TEXT,
  is_potential_re_pro BOOLEAN NOT NULL DEFAULT FALSE,
  labels             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emails_contact_id      ON public.emails (contact_id);
CREATE INDEX idx_emails_unread_recent   ON public.emails (is_unread, created_at DESC);
CREATE INDEX idx_emails_from_email      ON public.emails (from_email);

COMMENT ON TABLE public.emails IS
  'Gmail messages synced via /api/gmail/sync. Filtered to contacts + RE domain pattern. Upsert on gmail_id; duplicate syncs update synced_at only.';

-- ------------------------------------------------------------
-- email_drafts: Claude-generated responses + approval history
-- ------------------------------------------------------------
CREATE TABLE public.email_drafts (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id                     UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  draft_subject                TEXT,
  draft_body_plain             TEXT,
  draft_body_html              TEXT,
  status                       public.email_draft_status NOT NULL DEFAULT 'generated',
  escalation_flag              TEXT CHECK (escalation_flag IN ('marlene', 'agent_followup') OR escalation_flag IS NULL),
  escalation_reason            TEXT,
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  approved_at                  TIMESTAMPTZ,
  approved_by                  TEXT,
  sent_at                      TIMESTAMPTZ,
  sent_via                     TEXT CHECK (sent_via IN ('resend', 'gmail_draft') OR sent_via IS NULL),
  revisions_count              INT NOT NULL DEFAULT 0,
  created_in_gmail_draft_id    TEXT,
  created_in_obsidian_file_path TEXT,
  audit_log                    JSONB NOT NULL DEFAULT jsonb_build_object('event_sequence', '[]'::jsonb, 'metadata', '{}'::jsonb),
  metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drafts_email_id        ON public.email_drafts (email_id);
CREATE INDEX idx_drafts_status_recent   ON public.email_drafts (status, created_at DESC);
CREATE INDEX idx_drafts_expires_at      ON public.email_drafts (expires_at);

COMMENT ON TABLE public.email_drafts IS
  'Claude-generated drafts + full audit trail. expires_at = generated_at + 30 min. Phase 5 rejects sends on expired drafts. One active draft per email_id; re-generating an existing generated/approved draft is a no-op per spec idempotency rule.';

-- ------------------------------------------------------------
-- oauth_tokens: Google OAuth credentials (single user, single provider for now)
-- ------------------------------------------------------------
CREATE TABLE public.oauth_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL DEFAULT 'alex',
  provider       TEXT NOT NULL DEFAULT 'google',
  access_token   TEXT,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ,
  scopes         TEXT[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at   TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.oauth_tokens IS
  'OAuth refresh/access tokens. NOT YET encrypted at column level -- Phase 3 wraps writes in Supabase Vault. Do not insert real tokens until Phase 3 lands.';

-- ------------------------------------------------------------
-- error_logs: system failures captured from API routes
-- ------------------------------------------------------------
CREATE TABLE public.error_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint       TEXT,
  error_code     INT,
  error_message  TEXT,
  context        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_error_logs_recent     ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON public.error_logs (resolved, created_at DESC) WHERE resolved = FALSE;

COMMENT ON TABLE public.error_logs IS
  'System error capture for Phase 3/4/5 API routes. context JSONB holds draft_id, email_id, gmail API response, retry attempt count.';

-- ------------------------------------------------------------
-- updated_at trigger for email_drafts
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_email_drafts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_drafts_updated_at ON public.email_drafts;
CREATE TRIGGER trg_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_email_drafts_updated_at();

-- ------------------------------------------------------------
-- RLS: single-user system, alex-only via JWT email claim
-- ------------------------------------------------------------
ALTER TABLE public.emails        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_emails_all"       ON public.emails;
DROP POLICY IF EXISTS "alex_drafts_all"       ON public.email_drafts;
DROP POLICY IF EXISTS "alex_oauth_tokens_all" ON public.oauth_tokens;
DROP POLICY IF EXISTS "alex_error_logs_all"   ON public.error_logs;

CREATE POLICY "alex_emails_all" ON public.emails
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_drafts_all" ON public.email_drafts
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_oauth_tokens_all" ON public.oauth_tokens
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_error_logs_all" ON public.error_logs
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants: authenticated role gets full CRUD (RLS does the gating);
-- service_role bypasses RLS for server-side cron + OAuth callback.
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_tokens  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs    TO authenticated;

GRANT USAGE ON TYPE public.email_draft_status TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.emails;         -- expect 0
-- SELECT count(*) FROM public.email_drafts;   -- expect 0
-- SELECT count(*) FROM public.oauth_tokens;   -- expect 0
-- SELECT count(*) FROM public.error_logs;     -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('emails','email_drafts','oauth_tokens','error_logs')
-- ORDER BY tablename, polname;
-- -- expect 4 rows, one policy per table
--
-- SELECT unnest(enum_range(NULL::public.email_draft_status));
-- -- expect 5 rows: generated, approved, sent, discarded, revised
--
-- ============================================================
