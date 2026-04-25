-- ================================================================
-- SLICE 3 / Wave 4: Interactions VIEW rewrite + interactions_legacy DROP
-- Pre-flight: All 6 writers must already be on writeEvent() (W2) and
-- all legacy rows must already be backfilled (W3).
--
-- (1) Rewrite VIEW to drop Part A (interactions_legacy UNION ALL).
--     The VIEW now projects from activity_events only. COALESCE on
--     type preserves original interaction_type for backfilled rows
--     (whose verb is 'interaction.backfilled').
-- (2) DROP interactions_legacy CASCADE.
-- (3) Ensure activity_events is published for Realtime so the
--     dashboard channel flips (task-list.tsx + contacts/page.tsx)
--     keep firing on interaction inserts.
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

-- (1) Rewrite VIEW: project from activity_events only.
CREATE OR REPLACE VIEW public.interactions AS
  SELECT
    ae.id,
    ae.user_id,
    (ae.context->>'contact_id')::uuid                       AS contact_id,
    COALESCE(ae.context->>'type',
             REPLACE(ae.verb, 'interaction.', ''))          AS type,
    COALESCE(ae.context->>'summary',
             ae.context->>'note', '')                       AS summary,
    ae.occurred_at,
    ae.created_at,
    ae.context->>'direction'                                AS direction,
    (ae.context->>'duration_minutes')::int                  AS duration_minutes,
    ae.deleted_at
  FROM public.activity_events ae
  WHERE ae.verb LIKE 'interaction.%'
    AND ae.deleted_at IS NULL;

-- (2) Drop interactions_legacy. CASCADE removes any leftover triggers/grants.
DROP TABLE IF EXISTS public.interactions_legacy CASCADE;

-- (3) Publish activity_events for Realtime if not already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
END $$;

COMMIT;
