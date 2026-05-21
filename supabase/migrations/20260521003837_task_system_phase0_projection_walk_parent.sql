-- Task System Phase 0 -- projection fix: walk parent_id for relational nodes.
--
-- Bug: node_events.contact_id / project_id were NULL for interaction / event /
-- task rows because the original trigger only set those columns when the
-- activity_event.object_id WAS directly a contact or project node. For
-- relational types (interaction, event, task) the object_id is the relational
-- node itself; the contact / project lives one parent_id step up.
--
-- Gate 4 morning brief queries (overdue contacts joined to interaction history,
-- stale projects joined to event log) need these columns populated.
--
-- Fix: walk parent_id one level. Phase 0 hierarchy is shallow enough that one
-- step covers every documented case:
--   interaction -> parent is always contact
--   event       -> parent is contact OR project
--   task        -> parent is project OR area (area produces no link)
--
-- Both the AFTER INSERT trigger and the rebuild function are replaced in
-- lockstep so manual replay matches live projection.
--
-- Idempotent: CREATE OR REPLACE only.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Replace projection trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_activity_to_node_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type        text;
  v_node_id     uuid;
  v_node_type   text;
  v_parent_id   uuid;
  v_parent_type text;
  v_contact_id  uuid;
  v_project_id  uuid;
BEGIN
  v_type := CASE NEW.verb
    WHEN 'capture.created'              THEN 'captured'
    WHEN 'capture.promoted.task'        THEN 'task_created'
    WHEN 'capture.promoted.contact'     THEN 'contact_created'
    WHEN 'capture.promoted.touchpoint'  THEN 'interaction_logged'
    WHEN 'capture.promoted.event'       THEN 'event_logged'
    WHEN 'interaction.call'             THEN 'interaction_logged'
    WHEN 'interaction.text'             THEN 'interaction_logged'
    WHEN 'interaction.email'            THEN 'interaction_logged'
    WHEN 'interaction.meeting'          THEN 'interaction_logged'
    WHEN 'interaction.broker_open'      THEN 'interaction_logged'
    WHEN 'interaction.lunch'            THEN 'interaction_logged'
    WHEN 'interaction.note'             THEN 'interaction_logged'
    WHEN 'interaction.event'            THEN 'interaction_logged'
    WHEN 'deliverable.shipped'          THEN 'shipped'
    WHEN 'deliverable.briefed'          THEN 'briefed'
    WHEN 'project.updated'              THEN 'project_touched'
    WHEN 'transaction.opened'           THEN 'transaction.opened'
    WHEN 'transaction.under_contract'   THEN 'transaction.under_contract'
    WHEN 'transaction.in_escrow'        THEN 'transaction.in_escrow'
    WHEN 'transaction.closed'           THEN 'transaction.closed'
    WHEN 'transaction.fell_through'     THEN 'transaction.fell_through'
    WHEN 'brief_sent'                   THEN 'brief_sent'
    ELSE NULL
  END;

  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.object_table = 'nodes' THEN
    v_node_id := NEW.object_id;
  ELSE
    BEGIN
      v_node_id := NULLIF(NEW.context->>'node_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_node_id := NULL;
    END;
  END IF;

  -- Look up the node's own type AND parent_id in one read.
  IF v_node_id IS NOT NULL THEN
    SELECT type, parent_id INTO v_node_type, v_parent_id
    FROM public.nodes
    WHERE id = v_node_id;

    -- Direct case: node IS a contact or project (capture.promoted.contact, project node touched, etc.)
    IF v_node_type = 'contact' THEN
      v_contact_id := v_node_id;
    ELSIF v_node_type = 'project' THEN
      v_project_id := v_node_id;
    END IF;

    -- Walk one parent step for relational types (interaction, event, task).
    -- Phase 0 hierarchy is shallow; one step covers every documented case.
    IF v_parent_id IS NOT NULL THEN
      SELECT type INTO v_parent_type
      FROM public.nodes
      WHERE id = v_parent_id;

      IF v_parent_type = 'contact' THEN
        v_contact_id := COALESCE(v_contact_id, v_parent_id);
      ELSIF v_parent_type = 'project' THEN
        v_project_id := COALESCE(v_project_id, v_parent_id);
      END IF;
    END IF;
  END IF;

  -- Fall back to explicit context hints when node walk did not produce a value.
  IF v_contact_id IS NULL THEN
    BEGIN
      v_contact_id := NULLIF(NEW.context->>'contact_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_contact_id := NULL;
    END;
  END IF;

  IF v_project_id IS NULL THEN
    BEGIN
      v_project_id := NULLIF(NEW.context->>'project_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_project_id := NULL;
    END;
  END IF;

  INSERT INTO public.node_events (
    id, activity_id, user_id, contact_id, project_id, node_id,
    type, occurred_at, summary, metadata
  )
  VALUES (
    NEW.id, NEW.id, NEW.user_id, v_contact_id, v_project_id, v_node_id,
    v_type, NEW.occurred_at, NEW.context->>'summary', NEW.context
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Replace rebuild function (must match trigger logic in lockstep).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_node_events_from_activity()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  TRUNCATE public.node_events;

  INSERT INTO public.node_events (
    id, activity_id, user_id, contact_id, project_id, node_id,
    type, occurred_at, summary, metadata
  )
  SELECT
    ae.id,
    ae.id,
    ae.user_id,
    -- contact_id: direct (node is contact) OR walked (parent is contact) OR context hint
    COALESCE(
      (SELECT n.id FROM public.nodes n
        WHERE n.id = CASE WHEN ae.object_table='nodes' THEN ae.object_id
                          ELSE NULLIF(ae.context->>'node_id','')::uuid END
          AND n.type = 'contact'),
      (SELECT p.id FROM public.nodes child
        JOIN public.nodes p ON p.id = child.parent_id
        WHERE child.id = CASE WHEN ae.object_table='nodes' THEN ae.object_id
                              ELSE NULLIF(ae.context->>'node_id','')::uuid END
          AND p.type = 'contact'),
      NULLIF(ae.context->>'contact_id','')::uuid
    ),
    -- project_id: direct (node is project) OR walked (parent is project) OR context hint
    COALESCE(
      (SELECT n.id FROM public.nodes n
        WHERE n.id = CASE WHEN ae.object_table='nodes' THEN ae.object_id
                          ELSE NULLIF(ae.context->>'node_id','')::uuid END
          AND n.type = 'project'),
      (SELECT p.id FROM public.nodes child
        JOIN public.nodes p ON p.id = child.parent_id
        WHERE child.id = CASE WHEN ae.object_table='nodes' THEN ae.object_id
                              ELSE NULLIF(ae.context->>'node_id','')::uuid END
          AND p.type = 'project'),
      NULLIF(ae.context->>'project_id','')::uuid
    ),
    CASE WHEN ae.object_table='nodes' THEN ae.object_id
         ELSE NULLIF(ae.context->>'node_id','')::uuid END,
    CASE ae.verb
      WHEN 'capture.created'              THEN 'captured'
      WHEN 'capture.promoted.task'        THEN 'task_created'
      WHEN 'capture.promoted.contact'     THEN 'contact_created'
      WHEN 'capture.promoted.touchpoint'  THEN 'interaction_logged'
      WHEN 'capture.promoted.event'       THEN 'event_logged'
      WHEN 'interaction.call'             THEN 'interaction_logged'
      WHEN 'interaction.text'             THEN 'interaction_logged'
      WHEN 'interaction.email'            THEN 'interaction_logged'
      WHEN 'interaction.meeting'          THEN 'interaction_logged'
      WHEN 'interaction.broker_open'      THEN 'interaction_logged'
      WHEN 'interaction.lunch'            THEN 'interaction_logged'
      WHEN 'interaction.note'             THEN 'interaction_logged'
      WHEN 'interaction.event'            THEN 'interaction_logged'
      WHEN 'deliverable.shipped'          THEN 'shipped'
      WHEN 'deliverable.briefed'          THEN 'briefed'
      WHEN 'project.updated'              THEN 'project_touched'
      WHEN 'transaction.opened'           THEN 'transaction.opened'
      WHEN 'transaction.under_contract'   THEN 'transaction.under_contract'
      WHEN 'transaction.in_escrow'        THEN 'transaction.in_escrow'
      WHEN 'transaction.closed'           THEN 'transaction.closed'
      WHEN 'transaction.fell_through'     THEN 'transaction.fell_through'
      WHEN 'brief_sent'                   THEN 'brief_sent'
    END,
    ae.occurred_at,
    ae.context->>'summary',
    ae.context
  FROM public.activity_events ae
  WHERE ae.deleted_at IS NULL
    AND ae.verb IN (
      'capture.created','capture.promoted.task','capture.promoted.contact',
      'capture.promoted.touchpoint','capture.promoted.event',
      'interaction.call','interaction.text','interaction.email',
      'interaction.meeting','interaction.broker_open','interaction.lunch',
      'interaction.note','interaction.event',
      'deliverable.shipped','deliverable.briefed','project.updated',
      'transaction.opened','transaction.under_contract','transaction.in_escrow',
      'transaction.closed','transaction.fell_through','brief_sent'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
