-- Phase 3 of ~/.claude/plans/idempotent-toasting-tome.md (Option A).
-- Reserves a known constant UUID for system-attributed activity_events rows.
-- Used as the terminal fallback in actor_id resolution chains where
-- auth.uid() and the owning row's user_id are both unresolvable.
--
-- The UUID 00000000-0000-0000-0000-000000000017 is synthetic and never
-- collides with gen_random_uuid() output. activity_events.actor_id has no
-- FK constraint, so no insert into auth.users or contacts is required.

CREATE OR REPLACE FUNCTION public.system_actor_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000017'::uuid;
$$;

COMMENT ON FUNCTION public.system_actor_id() IS
  'Reserved actor_id constant for system-emitted activity_events when no human actor is resolvable. See Phase 3 plan.';
