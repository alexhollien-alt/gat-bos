-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260430063743
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260430063743. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- ============================================================
-- SLICE 7A TASK B-15 -- relationship_health_config READ RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 15 of 21
--
-- Replaces email-based rhc_alex_read (SELECT) with column-based
-- rhc_user_isolation_read. user_id was added by suppl-12 add-column
-- migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid,
-- is_nullable=NO, default=auth.uid(), 1 row, 0 NULL user_ids.
--
-- Mid-slice smoke gate (#15 cluster) deferred per skip-mid-slice authorization.
--
-- B-16 (rhc_alex_write -> rhc_user_isolation_write) lands as paired commit.
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhc_alex_read ON public.relationship_health_config;

CREATE POLICY rhc_user_isolation_read
  ON public.relationship_health_config
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY rhc_user_isolation_read ON public.relationship_health_config IS
  'Slice 7A: replaces email-based rhc_alex_read; column user_id checked against auth.uid().';

COMMIT;
