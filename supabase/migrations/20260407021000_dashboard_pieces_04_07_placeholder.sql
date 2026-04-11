-- Placeholder for dashboard pieces applied directly via Supabase SQL editor on 2026-04-07.
-- The actual DDL for these pieces lives in:
--   supabase/_archive/dashboard-piece*-*.sql
-- and was applied out-of-band before the Supabase MCP went read-only (2026-04-08).
--
-- This file exists so `supabase migration repair --status applied 20260407021000`
-- can resolve a local path, keeping the local and remote migration histories
-- consistent without re-running DDL that is already live.
--
-- Do not add statements to this file. The Phase 1 migration
-- (20260410000100_phase21_rls_lockdown.sql) formalizes the pieces-5-through-8
-- work as an idempotent re-application; earlier pieces are archived as
-- historical record only.

-- intentionally no-op
SELECT 1;
