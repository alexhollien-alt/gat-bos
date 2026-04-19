-- ============================================================
-- PHASE 1.4 -- PROJECTS DATA MODEL
-- Tables: projects, project_touchpoints
-- Enums:  project_type, project_status
-- RLS:    alex-only, keyed on auth.jwt() ->> 'email'
-- ============================================================
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 6)
-- Generated: 2026-04-18
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file rebuilds Phase 1.4 schema only. projects and
-- project_touchpoints are new in 1.4; no data loss on first run. On
-- re-run, all Phase 1.4 data is wiped. Do not re-run after real
-- projects exist.
--
-- Polymorphism:
--   project_touchpoints.entity_table + entity_id form a polymorphic
--   pointer into emails / email_drafts / events / contacts / notes.
--   No cross-table FK enforcement -- application layer owns integrity.
--   (Plan Phase 6 accepts this trade.)
--
-- Soft delete (standing rule 3):
--   projects carry deleted_at TIMESTAMPTZ NULL. project_touchpoints
--   ride parent lifecycle via ON DELETE CASCADE -- touchpoints are
--   not independently soft-deletable.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.project_touchpoints CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TYPE  IF EXISTS public.project_type CASCADE;
DROP TYPE  IF EXISTS public.project_status CASCADE;
DROP TYPE  IF EXISTS public.project_touchpoint_type CASCADE;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
CREATE TYPE public.project_type AS ENUM (
  'agent_bd',
  'home_tour',
  'happy_hour',
  'campaign',
  'listing',
  'other'
);

CREATE TYPE public.project_status AS ENUM (
  'active',
  'paused',
  'closed'
);

CREATE TYPE public.project_touchpoint_type AS ENUM (
  'email',
  'event',
  'voice_memo',
  'contact_note'
);

-- ------------------------------------------------------------
-- projects: polymorphic parent for touchpoints
-- ------------------------------------------------------------
CREATE TABLE public.projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               public.project_type NOT NULL,
  title              TEXT NOT NULL,
  status             public.project_status NOT NULL DEFAULT 'active',
  owner_contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_projects_status_active ON public.projects (status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_owner         ON public.projects (owner_contact_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_type          ON public.projects (type)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.projects IS
  'Polymorphic project entity. Links arbitrary touchpoints (emails, events, contacts, notes) under one initiative. Soft-delete via deleted_at per standing rule 3.';

-- ------------------------------------------------------------
-- project_touchpoints: polymorphic children
-- ------------------------------------------------------------
CREATE TABLE public.project_touchpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  touchpoint_type public.project_touchpoint_type NOT NULL,
  entity_id       UUID NOT NULL,
  entity_table    TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_touchpoints_project   ON public.project_touchpoints (project_id, occurred_at DESC NULLS LAST);
CREATE INDEX idx_touchpoints_entity    ON public.project_touchpoints (entity_table, entity_id);
CREATE INDEX idx_touchpoints_type      ON public.project_touchpoints (touchpoint_type);

COMMENT ON TABLE public.project_touchpoints IS
  'Polymorphic touchpoint rows linking a project to any domain entity. entity_table + entity_id = untyped FK. Application layer enforces integrity. Cascade deletes with parent project.';

-- ------------------------------------------------------------
-- updated_at trigger for projects
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_projects_updated_at();

-- ------------------------------------------------------------
-- RLS: alex-only, same pattern as Phase 1.3.1
-- ------------------------------------------------------------
ALTER TABLE public.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_projects_all"      ON public.projects;
DROP POLICY IF EXISTS "alex_touchpoints_all"   ON public.project_touchpoints;

CREATE POLICY "alex_projects_all" ON public.projects
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_touchpoints_all" ON public.project_touchpoints
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_touchpoints TO authenticated;

GRANT USAGE ON TYPE public.project_type            TO authenticated, service_role;
GRANT USAGE ON TYPE public.project_status          TO authenticated, service_role;
GRANT USAGE ON TYPE public.project_touchpoint_type TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.projects;             -- expect 0
-- SELECT count(*) FROM public.project_touchpoints;  -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('projects','project_touchpoints')
-- ORDER BY tablename, polname;
-- -- expect 2 rows
--
-- SELECT unnest(enum_range(NULL::public.project_type));
-- -- expect 6 rows: agent_bd, home_tour, happy_hour, campaign, listing, other
--
-- SELECT unnest(enum_range(NULL::public.project_status));
-- -- expect 3 rows: active, paused, closed
--
-- SELECT unnest(enum_range(NULL::public.project_touchpoint_type));
-- -- expect 4 rows: email, event, voice_memo, contact_note
--
-- ============================================================
