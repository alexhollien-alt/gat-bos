-- Slice 4 Task 1 -- templates table.
--
-- Single-tenant template library for the new messaging abstraction
-- (sendMessage at src/lib/messaging/send.ts in Task 3). Each template
-- carries a slug + version pair so a future revision can land without
-- breaking past sends; the messaging layer resolves by max(version)
-- among rows where deleted_at IS NULL.
--
-- send_mode chooses the adapter (Resend, Gmail, or both -- "both"
-- routes the live send through Gmail and writes a fallback Resend
-- send for instrumentation, see Task 3 spec). kind classifies the
-- template intent.
--
-- RLS is Alex-only via auth.jwt() ->> 'email'. No service-role-only
-- carve-out: server-side senders use service_role and bypass RLS;
-- the policy gates direct browser-client access to Alex's session.

BEGIN;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_send_mode') THEN
    CREATE TYPE public.template_send_mode AS ENUM ('resend', 'gmail', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_kind') THEN
    CREATE TYPE public.template_kind AS ENUM ('transactional', 'campaign', 'newsletter');
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  send_mode   public.template_send_mode NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  body_text   TEXT NOT NULL,
  kind        public.template_kind NOT NULL,
  version     INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Unique on (slug, version) so versioning works -- a new revision
-- inserts a new row with the same slug + bumped version, and the
-- resolver picks max(version) where deleted_at IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_slug_version
  ON public.templates (slug, version);

-- Lookup-by-slug helper for the resolver. Partial-indexed on the
-- live rows so soft-deleted versions don't clutter the scan.
CREATE INDEX IF NOT EXISTS idx_templates_slug_live
  ON public.templates (slug, version DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.templates IS
  'Single-tenant template library for the messaging abstraction. Versioned by (slug, version). Soft-delete via deleted_at per standing rule 3. RLS Alex-only.';

-- ------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_templates_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_templates_all" ON public.templates;

CREATE POLICY "alex_templates_all" ON public.templates
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;

GRANT USAGE ON TYPE public.template_send_mode TO authenticated, service_role;
GRANT USAGE ON TYPE public.template_kind      TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT to_regclass('public.templates') IS NOT NULL AS templates_present;  -- expect true
--
-- SELECT polname FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'templates';
-- -- expect: alex_templates_all
--
-- SELECT typname, enum_range(NULL::public.template_send_mode);  -- expect resend,gmail,both
-- SELECT typname, enum_range(NULL::public.template_kind);       -- expect transactional,campaign,newsletter
--
-- SELECT count(*) FROM public.templates;  -- expect 0
