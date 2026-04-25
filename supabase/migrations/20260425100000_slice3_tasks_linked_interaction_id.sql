-- ================================================================
-- SLICE 3 / Wave 1: tasks.linked_interaction_id audit linkage
-- Restores cross-entity audit linkage between completed follow-up
-- tasks and the interaction that resolved them. The column was lost
-- in Slice 2C when follow_ups was merged into tasks (the original
-- follow_ups.completed_via_interaction_id did not migrate).
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_interaction_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_linked_interaction_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_linked_interaction_id_fkey
      FOREIGN KEY (linked_interaction_id)
      REFERENCES public.activity_events(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_linked_interaction_id
  ON public.tasks(linked_interaction_id)
  WHERE linked_interaction_id IS NOT NULL;

COMMIT;
