-- Phase 5 of ~/.claude/plans/idempotent-toasting-tome.md
-- Agent portal slice 0: token-gated read-only per-agent page.
--
-- Adds a `portal_token uuid` column to public.contacts. The token is the
-- agent's bearer credential for the /agent/<token> public page; whoever
-- holds the URL gets read-only access to the agent's last-5 deliverables
-- and open transactions. No magic-link, no session, no RLS-by-user.
--
-- Distinct from Slice 7C's agent_invites: those are one-time-use magic
-- links that bootstrap a real auth session for the per-account portal at
-- /portal/<account-slug>. Phase 5 tokens are non-expiring, per-contact,
-- and grant only the public-agent read surface.
--
-- Existing rows backfill with gen_random_uuid() via DEFAULT. New rows
-- also get a token by default; no application code needs to set it.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Unique index on active rows so token lookups are O(1) and collisions are
-- caught at insert time. Partial so soft-deleted rows can re-use a token
-- without conflict if a contact is restored or re-keyed downstream.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_portal_token_active_uniq
  ON public.contacts (portal_token)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.contacts.portal_token IS
  'Phase 5 of idempotent-toasting-tome: bearer token for /agent/<token> public read-only portal. Non-expiring. Holder of URL is authorized.';
