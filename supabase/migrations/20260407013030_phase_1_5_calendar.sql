-- ============================================================
-- PHASE 1.5 -- CALENDAR BIDIRECTIONAL SYNC
-- Table:  events
-- Enum:   event_source
-- RLS:    alex-only, keyed on auth.jwt() ->> 'email'
-- ============================================================
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 7)
-- Generated: 2026-04-18
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file rebuilds Phase 1.5 schema only. events is new
-- in 1.5; no data loss on first run. On re-run, all Phase 1.5 data
-- is wiped. Do not re-run after real events are synced.
--
-- Bidirectional sync contract:
--   source='gcal_pull'       -- row origin is Google Calendar; inbound
--                               cron upserts on gcal_event_id; GCal
--                               wins (overwrites local fields).
--   source='dashboard_create'-- row originated in GAT-BOS; /api/calendar/create
--                               inserts locally first, then calls
--                               events.insert on GCal and backfills
--                               gcal_event_id. Dashboard is canonical.
--
-- Soft delete (standing rule 3):
--   events carry deleted_at TIMESTAMPTZ NULL. No hard deletes.
--
-- FK scoping:
--   project_id REFERENCES projects(id) ON DELETE SET NULL
--   contact_id REFERENCES contacts(id) ON DELETE SET NULL
--   Both nullable; an event can stand alone without a project or contact.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.events CASCADE;
DROP TYPE  IF EXISTS public.event_source CASCADE;

-- ------------------------------------------------------------
-- Enum: event_source
-- ------------------------------------------------------------
CREATE TYPE public.event_source AS ENUM (
  'gcal_pull',
  'dashboard_create'
);

-- ------------------------------------------------------------
-- events: calendar entries, bidirectionally synced with Google Calendar
-- ------------------------------------------------------------
CREATE TABLE public.events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gcal_event_id  TEXT UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  location       TEXT,
  attendees      JSONB NOT NULL DEFAULT '[]'::jsonb,
  project_id     UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  source         public.event_source NOT NULL,
  synced_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- gcal_event_id is NULL for dashboard-created events between local
-- insert and successful outbound events.insert. Partial unique already
-- enforced by UNIQUE constraint (NULLs are distinct in Postgres).

CREATE INDEX idx_events_start_at      ON public.events (start_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_events_gcal_event_id ON public.events (gcal_event_id)
  WHERE gcal_event_id IS NOT NULL;
CREATE INDEX idx_events_project       ON public.events (project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;
CREATE INDEX idx_events_contact       ON public.events (contact_id)
  WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
CREATE INDEX idx_events_today_window  ON public.events (start_at, end_at)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.events IS
  'Calendar events, bidirectionally synced with Google Calendar. source=gcal_pull rows are overwritten by hourly cron (GCal wins). source=dashboard_create rows are created locally, then mirrored to GCal and backfilled with gcal_event_id. Soft-delete via deleted_at per standing rule 3.';

-- ------------------------------------------------------------
-- updated_at trigger for events
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_events_updated_at();

-- ------------------------------------------------------------
-- RLS: alex-only, same pattern as Phase 1.3.1 and 1.4
-- ------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_events_all" ON public.events;

CREATE POLICY "alex_events_all" ON public.events
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

GRANT USAGE ON TYPE public.event_source TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.events;   -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'events'
-- ORDER BY polname;
-- -- expect 1 row: alex_events_all
--
-- SELECT unnest(enum_range(NULL::public.event_source));
-- -- expect 2 rows: gcal_pull, dashboard_create
--
-- \d+ public.events
-- -- confirm indexes + FKs to projects and contacts
--
-- ============================================================
