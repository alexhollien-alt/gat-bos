-- ================================================================
-- SLICE 2C: Interactions -> View over activity_events
-- Renames the interactions table to interactions_legacy (preserving
-- the 2 existing rows), then creates a VIEW named interactions that
-- exposes a compatible interface via UNION ALL.
--
-- Part A: interactions_legacy (legacy rows -- preserved)
-- Part B: activity_events WHERE verb LIKE 'interaction.%' (Slice 1+)
--
-- NOTE: All 6 INSERT callers must be updated in Plan 003 to write
--   to interactions_legacy directly (views are not insertable):
--     - src/lib/captures/promote.ts
--     - src/app/(app)/actions/page.tsx
--     - src/components/dashboard/task-list.tsx (x2)
--     - src/components/interactions/interaction-modal.tsx
--     - src/app/api/intake/route.ts
--     - src/app/api/webhooks/resend/route.ts
--   See BLOCKERS.md.
--
-- NOTE: 2 Realtime subscriptions also need their `table:` name flipped
--   from "interactions" to "interactions_legacy" so writes still fire
--   change events:
--     - src/app/(app)/contacts/page.tsx
--     - src/components/dashboard/task-list.tsx
--
-- NOTE: interactions_legacy is NOT dropped here. The view's Part A
--   references it; dropping breaks the view. Drop deferred to Slice 3
--   after promote.ts and the other writers migrate to writeEvent().
-- ================================================================

BEGIN;

-- Rename interactions -> interactions_legacy
-- Guard: skip if interactions_legacy already exists (idempotent re-run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'interactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'interactions_legacy'
  ) THEN
    ALTER TABLE public.interactions RENAME TO interactions_legacy;
  END IF;
END $$;

-- Create (or replace) the interactions view
-- Part A: all legacy rows (the 2 existing interactions rows)
-- Part B: Slice 1+ rows written via writeEvent() with interaction verbs
CREATE OR REPLACE VIEW public.interactions AS
  SELECT
    il.id,
    il.user_id,
    il.contact_id,
    il.type::text                                       AS type,
    il.summary,
    il.occurred_at,
    il.created_at,
    il.direction,
    il.duration_minutes,
    NULL::timestamptz                                   AS deleted_at
  FROM public.interactions_legacy il
  UNION ALL
  SELECT
    ae.id,
    ae.user_id,
    (ae.context->>'contact_id')::uuid                  AS contact_id,
    REPLACE(ae.verb, 'interaction.', '')               AS type,
    COALESCE(ae.context->>'summary',
             ae.context->>'note', '')                  AS summary,
    ae.occurred_at,
    ae.created_at,
    ae.context->>'direction'                           AS direction,
    (ae.context->>'duration_minutes')::int             AS duration_minutes,
    ae.deleted_at
  FROM public.activity_events ae
  WHERE ae.verb LIKE 'interaction.%'
    AND ae.deleted_at IS NULL;

COMMIT;
