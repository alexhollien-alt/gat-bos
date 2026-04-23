-- Slice 2A: Drop spine tables and the trigger that writes into cycle_state.
-- Execute manually in Supabase SQL Editor. Claude does NOT run this.
--
-- Trigger must be dropped before cycle_state is dropped.
-- All 5 tables use IF EXISTS so the statement is idempotent.

DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions;

DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.focus_queue CASCADE;
DROP TABLE IF EXISTS public.cycle_state CASCADE;
DROP TABLE IF EXISTS public.signals CASCADE;
DROP TABLE IF EXISTS public.spine_inbox CASCADE;
