-- Slice 7C.5 -- Portal read RPCs
--
-- Closes BLOCKERS.md [2026-05-02]. The /portal/[slug]/dashboard sections
-- (touchpoints, messages, upcoming events) currently render empty states
-- because their backing tables (project_touchpoints, messages_log, events)
-- are gated by 7B account-scoping RLS to the account owner (Alex). The
-- authenticated portal session belongs to an agent contact, not Alex, so
-- direct reads return zero rows.
--
-- This migration introduces three SECURITY DEFINER RPCs that run with
-- table-owner privileges and bypass RLS, but only after verifying the
-- calling session's JWT email matches the agent contact resolved by
-- p_slug. That binding mirrors requirePortalSession.ts -- the slug is the
-- routing key, the JWT email is the authentication key, and rows return
-- only when both align.
--
-- Mirror pattern of 20260501180000_slice7b_public_agent_rpc.sql:
--   - LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public
--   - REVOKE ALL FROM PUBLIC, GRANT EXECUTE TO authenticated
--   - NOTIFY pgrst, 'reload schema' at end
--
-- Idempotent: DROP FUNCTION IF EXISTS before CREATE OR REPLACE so signature
-- changes apply cleanly on replay.

DROP FUNCTION IF EXISTS public.get_portal_touchpoints(text);
DROP FUNCTION IF EXISTS public.get_portal_messages(text);
DROP FUNCTION IF EXISTS public.get_portal_upcoming_events(text);

-- ----------------------------------------------------------------------------
-- 1. get_portal_touchpoints(p_slug)
-- ----------------------------------------------------------------------------
-- Returns recent project_touchpoints for the agent contact resolved by
-- p_slug. A touchpoint belongs to the agent if EITHER:
--   (a) the parent project's owner_contact_id matches the agent, OR
--   (b) the touchpoint is polymorphically linked to the agent via
--       entity_table = 'contacts' AND entity_id = agent_id.
-- Both touchpoint and parent project must be live (deleted_at IS NULL).
-- Returns at most 20 rows, ordered by occurred_at DESC NULLS LAST.
CREATE OR REPLACE FUNCTION public.get_portal_touchpoints(p_slug text)
RETURNS TABLE (
  id              uuid,
  project_id      uuid,
  project_title   text,
  touchpoint_type public.project_touchpoint_type,
  occurred_at     timestamptz,
  due_at          timestamptz,
  note            text,
  created_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agent AS (
    SELECT c.id, c.email
      FROM public.contacts c
     WHERE c.slug = p_slug
       AND c.type = 'agent'
       AND c.deleted_at IS NULL
       AND c.email IS NOT NULL
       AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     LIMIT 1
  )
  SELECT
    pt.id,
    pt.project_id,
    p.title AS project_title,
    pt.touchpoint_type,
    pt.occurred_at,
    pt.due_at,
    pt.note,
    pt.created_at
  FROM public.project_touchpoints pt
  JOIN public.projects p ON p.id = pt.project_id
  JOIN agent a ON TRUE
  WHERE pt.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      p.owner_contact_id = a.id
      OR (pt.entity_table = 'contacts' AND pt.entity_id = a.id)
    )
  ORDER BY pt.occurred_at DESC NULLS LAST, pt.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_portal_touchpoints(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_touchpoints(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. get_portal_messages(p_slug)
-- ----------------------------------------------------------------------------
-- Returns recent messages_log rows addressed to the agent. messages_log has
-- no contact_id column; the binding is recipient_email = agent.email,
-- which is also the session-authorization key. Includes only live rows.
-- Returns at most 20 rows, newest first.
CREATE OR REPLACE FUNCTION public.get_portal_messages(p_slug text)
RETURNS TABLE (
  id                  uuid,
  template_id         uuid,
  template_name       text,
  recipient_email     text,
  send_mode           public.template_send_mode,
  status              public.message_status,
  sent_at             timestamptz,
  created_at          timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agent AS (
    SELECT c.email
      FROM public.contacts c
     WHERE c.slug = p_slug
       AND c.type = 'agent'
       AND c.deleted_at IS NULL
       AND c.email IS NOT NULL
       AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     LIMIT 1
  )
  SELECT
    ml.id,
    ml.template_id,
    t.name AS template_name,
    ml.recipient_email,
    ml.send_mode,
    ml.status,
    ml.sent_at,
    ml.created_at
  FROM public.messages_log ml
  LEFT JOIN public.templates t ON t.id = ml.template_id
  JOIN agent a ON lower(ml.recipient_email) = lower(a.email)
  WHERE ml.deleted_at IS NULL
  ORDER BY ml.sent_at DESC NULLS LAST, ml.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_portal_messages(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_messages(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_portal_upcoming_events(p_slug)
-- ----------------------------------------------------------------------------
-- Returns future events the agent is attending. An event belongs to the
-- agent if EITHER:
--   (a) events.contact_id = agent.id (single-contact event), OR
--   (b) there is a live attendees row joining the event to the agent
--       (contact_id = agent.id, deleted_at IS NULL).
-- Future = start_at >= now(). Live = events.deleted_at IS NULL.
-- Returns at most 20 rows, soonest first.
CREATE OR REPLACE FUNCTION public.get_portal_upcoming_events(p_slug text)
RETURNS TABLE (
  id          uuid,
  title       text,
  description text,
  start_at    timestamptz,
  end_at      timestamptz,
  location    text,
  rsvp_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agent AS (
    SELECT c.id
      FROM public.contacts c
     WHERE c.slug = p_slug
       AND c.type = 'agent'
       AND c.deleted_at IS NULL
       AND c.email IS NOT NULL
       AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     LIMIT 1
  )
  SELECT
    e.id,
    e.title,
    e.description,
    e.start_at,
    e.end_at,
    e.location,
    att.rsvp_status
  FROM public.events e
  JOIN agent a ON TRUE
  LEFT JOIN public.attendees att
    ON att.event_id = e.id
   AND att.contact_id = a.id
   AND att.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
    AND e.start_at >= now()
    AND (
      e.contact_id = a.id
      OR att.id IS NOT NULL
    )
  ORDER BY e.start_at ASC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_portal_upcoming_events(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_upcoming_events(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
