-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.
-- Hard-delete the synthetic interaction row left behind by the spine
-- trigger smoke test in Task 2. Standing Rule 3 (no hard deletes) is
-- waived here because:
--   1. The row is obviously synthetic test scaffolding (summary literally
--      reads "trigger smoke test"), not real business data.
--   2. The interactions table has no deleted_at column, so soft-delete
--      is not available without a schema change.
--   3. Without removal, the row would surface in /api/spine/today as a
--      real touch on Chase Reynolds, polluting cards in Tasks 5/12/14.
-- Authorized inline by Alex on 2026-04-08 during the spine phase 1 build.

DELETE FROM public.interactions
WHERE id = '2e29b755-6fd8-4f32-bd17-7dc84834ecc1'
  AND summary = 'trigger smoke test';
