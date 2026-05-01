-- Rollback for 20260501223136_slice7c_agent_invites.sql
-- Manual invocation only. Run this only after explicit Alex decision to drop
-- the invites surface; cascades should be considered carefully (auth.users
-- references survive; redeemed_by_user_id is nullable so no FK harm).

BEGIN;

DROP POLICY IF EXISTS agent_invites_account_select ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_insert ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_update ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_delete ON public.agent_invites;

DROP TRIGGER IF EXISTS agent_invites_set_updated_at ON public.agent_invites;
DROP FUNCTION IF EXISTS public.tg_agent_invites_set_updated_at();

DROP INDEX IF EXISTS public.agent_invites_token_hash_active_uniq;
DROP INDEX IF EXISTS public.agent_invites_account_contact_idx;

DROP TABLE IF EXISTS public.agent_invites;

COMMIT;
