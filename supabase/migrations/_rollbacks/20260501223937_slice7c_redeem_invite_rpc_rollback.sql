-- Rollback for 20260501223937_slice7c_redeem_invite_rpc.sql
-- Manually invoked. Drops the RPC; agent_invites table is left intact (its
-- own rollback companion handles that scope).

BEGIN;

DROP FUNCTION IF EXISTS public.redeem_agent_invite(text);

COMMIT;
