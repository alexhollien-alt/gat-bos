-- Slice 4 Task 9 -- hard-drop _deprecated_requests.
--
-- Pre-condition gate (verified via Supabase MCP read before paste):
--   COUNT(*) FROM public._deprecated_requests  = 0
--   COUNT(*) FROM public.activities WHERE request_id IS NOT NULL = 0
--
-- _deprecated_requests was the orphan stub renamed from `requests` in
-- Slice 3B (soft-deprecate per Standing Rule 3). One inbound FK
-- survives by OID from activities.request_id; CASCADE removes that
-- column-level dependency in the same statement.
--
-- LATER.md practice rule (2026-04-25 morning brief incident): every
-- DROP TABLE in this codebase is gated by an explicit row-count
-- assertion on both the dropped table and any inbound FK source. The
-- gate above is in place; if either count drifts above 0 after this
-- commit but before the paste-and-execute step, abort and re-plan.

DROP TABLE public._deprecated_requests CASCADE;
