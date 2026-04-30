-- Add missing standard lifecycle timestamps across remediation surface.
-- Audit source: ~/crm/audit/live-schema.sql (40 tables inventoried 2026-04-29).
-- Skips rate_limits (ephemeral counter, no lifecycle).
-- Standard tuple: created_at (default now()), updated_at (default now() + trigger),
-- deleted_at (nullable, soft-delete per Standing Rule 3).
-- Idempotent via ADD COLUMN IF NOT EXISTS and DROP TRIGGER IF EXISTS guards.

BEGIN;

-- ---------------------------------------------------------------------------
-- created_at additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.relationship_health_config
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.relationship_health_scores
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.relationship_health_touchpoint_weights
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- updated_at additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ai_cache                  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ai_usage_log              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.api_usage_log             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.emails                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.error_logs                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.inbox_items               ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.message_events            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.messages_log              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.morning_briefs            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.oauth_tokens              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.project_touchpoints       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.relationship_health_scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ticket_items              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill updated_at = created_at where the row predated this migration.
-- The DEFAULT now() above stamps all existing rows with the migration time;
-- align them with their created_at so updated_at is meaningful from day one.
UPDATE public.activity_events            SET updated_at = created_at;
UPDATE public.ai_usage_log               SET updated_at = created_at;
UPDATE public.api_usage_log              SET updated_at = created_at;
UPDATE public.emails                     SET updated_at = created_at;
UPDATE public.error_logs                 SET updated_at = created_at;
UPDATE public.inbox_items                SET updated_at = created_at;
UPDATE public.message_events             SET updated_at = created_at;
UPDATE public.messages_log               SET updated_at = created_at;
UPDATE public.morning_briefs             SET updated_at = created_at;
UPDATE public.oauth_tokens               SET updated_at = created_at;
UPDATE public.project_touchpoints        SET updated_at = created_at;
UPDATE public.relationship_health_scores SET updated_at = computed_at;
UPDATE public.ticket_items               SET updated_at = created_at;
-- ai_cache has no created_at to align against; leave at default now().

-- ---------------------------------------------------------------------------
-- deleted_at additions (soft-delete per Standing Rule 3)
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_metrics                          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.captures                               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.email_drafts                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.emails                                 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.email_log                              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.error_logs                             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.inbox_items                            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.oauth_tokens                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.relationship_health_config             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.relationship_health_touchpoint_weights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.ticket_items                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- updated_at triggers (uses public.set_updated_at() defined in baseline)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  trigger_tables text[] := ARRAY[
    'activity_events',
    'ai_cache',
    'ai_usage_log',
    'api_usage_log',
    'emails',
    'error_logs',
    'inbox_items',
    'message_events',
    'messages_log',
    'morning_briefs',
    'oauth_tokens',
    'project_touchpoints',
    'relationship_health_scores',
    'ticket_items'
  ];
BEGIN
  FOREACH t IN ARRAY trigger_tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END
$$;

COMMIT;
