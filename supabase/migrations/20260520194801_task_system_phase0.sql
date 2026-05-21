-- Task System Phase 0
--
-- New tables:
--   nodes        -- core typed-by-enum entity (task|project|area|contact|interaction|event)
--   tags         -- flat namespace
--   node_tags    -- M:N join
--   cadences     -- relationship cadence engine (tier-driven)
--   node_events  -- read-optimized projection of activity_events
--
-- Trigger:
--   project_activity_to_node_events -- AFTER INSERT on activity_events,
--     filters by verb whitelist, denormalizes contact_id/project_id/node_id.
--
-- Function:
--   rebuild_node_events_from_activity -- manual replay tool.
--
-- Seeds: the 5 fixed Areas (Section 3.5 of handoff doc) with stable UUIDs.
--
-- Decisions resolved 2026-05-20 (see /Users/alex/.claude/plans/read-claude-code-brief-md-and-gatbos-tas-lovely-pretzel.md):
--   - Renamed spec `events` -> `node_events` (existing public.events untouched).
--   - activity_events is canonical; node_events is a derived projection.
--   - Verb whitelist mirrored at src/lib/task-system/projected-verbs.ts.
--     If they drift, the trigger silently skips verbs the application
--     thinks should project. Compare lists when adding a verb.
--   - Cadence side-effects (last_touched_at, next_due_at) on interaction
--     insert live in the application layer at /api/captures, NOT in this
--     trigger. The trigger handles only the immutable log projection.
--
-- Idempotent: IF NOT EXISTS, DROP IF EXISTS, ON CONFLICT DO NOTHING.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nodes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('task','project','area','contact','interaction','event')),
  title           text NOT NULL,
  body            text,
  status          text,
  user_id         uuid NOT NULL,
  parent_id       uuid REFERENCES public.nodes(id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_touched_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_type         ON public.nodes (type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_parent       ON public.nodes (parent_id) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_last_touched ON public.nodes (last_touched_at DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_user_type    ON public.nodes (user_id, type) WHERE deleted_at IS NULL;

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nodes_owner_read_write" ON public.nodes;
CREATE POLICY "nodes_owner_read_write"
  ON public.nodes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_nodes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nodes_updated_at ON public.nodes;
CREATE TRIGGER trg_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_nodes_updated_at();

-- ---------------------------------------------------------------------------
-- 2. tags + node_tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.node_tags (
  node_id  uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES public.tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (node_id, tag_id)
);

ALTER TABLE public.tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_authenticated_read_write" ON public.tags;
CREATE POLICY "tags_authenticated_read_write"
  ON public.tags
  FOR ALL
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "node_tags_owner_read_write" ON public.node_tags;
CREATE POLICY "node_tags_owner_read_write"
  ON public.node_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      WHERE n.id = node_tags.node_id
        AND n.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      WHERE n.id = node_tags.node_id
        AND n.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. cadences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadences (
  contact_id      uuid PRIMARY KEY REFERENCES public.nodes(id) ON DELETE CASCADE,
  tier            int NOT NULL CHECK (tier IN (1,2,3)),
  target_days     int NOT NULL,
  last_touched_at timestamptz,
  next_due_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadences_next_due ON public.cadences (next_due_at) WHERE next_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cadences_tier     ON public.cadences (tier, next_due_at);

ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadences_owner_read_write" ON public.cadences;
CREATE POLICY "cadences_owner_read_write"
  ON public.cadences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      WHERE n.id = cadences.contact_id
        AND n.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      WHERE n.id = cadences.contact_id
        AND n.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.touch_cadences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cadences_updated_at ON public.cadences;
CREATE TRIGGER trg_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_cadences_updated_at();

-- ---------------------------------------------------------------------------
-- 4. node_events -- projection of activity_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.node_events (
  id            uuid PRIMARY KEY,
  activity_id   uuid NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  contact_id    uuid REFERENCES public.nodes(id),
  project_id    uuid REFERENCES public.nodes(id),
  node_id       uuid REFERENCES public.nodes(id),
  type          text NOT NULL,
  occurred_at   timestamptz NOT NULL,
  summary       text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_node_events_contact   ON public.node_events (contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_node_events_project   ON public.node_events (project_id, occurred_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_node_events_user_type ON public.node_events (user_id, type, occurred_at DESC);

ALTER TABLE public.node_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "node_events_owner_read_write" ON public.node_events;
CREATE POLICY "node_events_owner_read_write"
  ON public.node_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Projection trigger
--
-- AFTER INSERT on activity_events. Whitelist below MUST stay in sync with
-- src/lib/task-system/projected-verbs.ts. The rebuild function (Section 6)
-- inlines the same whitelist; if you change one, change all three.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_activity_to_node_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type       text;
  v_node_id    uuid;
  v_node_type  text;
  v_contact_id uuid;
  v_project_id uuid;
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

  -- Verb not in whitelist; skip projection.
  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve node_id: object_table='nodes' wins, else context.node_id.
  IF NEW.object_table = 'nodes' THEN
    v_node_id := NEW.object_id;
  ELSE
    BEGIN
      v_node_id := NULLIF(NEW.context->>'node_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_node_id := NULL;
    END;
  END IF;

  -- Resolve contact_id / project_id from node type when node_id is a node.
  IF v_node_id IS NOT NULL THEN
    SELECT type INTO v_node_type
    FROM public.nodes
    WHERE id = v_node_id;

    IF v_node_type = 'contact' THEN
      v_contact_id := v_node_id;
    ELSIF v_node_type = 'project' THEN
      v_project_id := v_node_id;
    END IF;
  END IF;

  -- Fall back to explicit context hints.
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

DROP TRIGGER IF EXISTS trg_project_activity_to_node_events ON public.activity_events;
CREATE TRIGGER trg_project_activity_to_node_events
  AFTER INSERT ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.project_activity_to_node_events();

-- ---------------------------------------------------------------------------
-- 6. Rebuild function -- replays activity_events -> node_events.
--
-- TRUNCATE is destructive but node_events is derived state, so it is safe by
-- design. Never automate. See docs/task-system/projection-rebuild.md.
-- Usage: SELECT public.rebuild_node_events_from_activity();
-- Returns row count.
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
    -- contact_id: node is a contact, or context.contact_id
    COALESCE(
      (SELECT n.id FROM public.nodes n
        WHERE n.id = (CASE WHEN ae.object_table='nodes' THEN ae.object_id
                           ELSE NULLIF(ae.context->>'node_id','')::uuid END)
          AND n.type = 'contact'),
      NULLIF(ae.context->>'contact_id','')::uuid
    ),
    -- project_id: node is a project, or context.project_id
    COALESCE(
      (SELECT n.id FROM public.nodes n
        WHERE n.id = (CASE WHEN ae.object_table='nodes' THEN ae.object_id
                           ELSE NULLIF(ae.context->>'node_id','')::uuid END)
          AND n.type = 'project'),
      NULLIF(ae.context->>'project_id','')::uuid
    ),
    -- node_id raw
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

-- ---------------------------------------------------------------------------
-- 7. Seed the 5 fixed Areas.
--
-- Stable UUIDs so IDs are reproducible across environments and rebuilds.
-- user_id resolved from the single active account's owner_user_id, matching
-- the slice7b_seed_agents pattern (pre-7C single-tenant assumption).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT owner_user_id INTO v_user_id
  FROM public.accounts
  WHERE deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'task_system_phase0: no active account found in public.accounts; cannot seed Areas';
  END IF;

  INSERT INTO public.nodes (id, type, title, status, user_id, metadata, last_touched_at)
  VALUES
    ('a0000001-0000-4000-8000-000000000001'::uuid, 'area', 'Sales Production',   'live', v_user_id,
       jsonb_build_object('what_good_looks_like', 'Title orders open, escrow files clean, transaction-level work moving on schedule.', 'seeded', true),
       now()),
    ('a0000002-0000-4000-8000-000000000002'::uuid, 'area', 'Agent Partnerships', 'live', v_user_id,
       jsonb_build_object('what_good_looks_like', 'All 25 active agents touched within their tier cadence. Zero Tier 1 agents past 14 days without contact.', 'seeded', true),
       now()),
    ('a0000003-0000-4000-8000-000000000003'::uuid, 'area', 'GAT-BOS Build',      'live', v_user_id,
       jsonb_build_object('what_good_looks_like', 'Platform shipping in coherent slices. Tooling time under 30 min per week per Principle 15.', 'seeded', true),
       now()),
    ('a0000004-0000-4000-8000-000000000004'::uuid, 'area', 'BNI / SAAR / WCR',   'live', v_user_id,
       jsonb_build_object('what_good_looks_like', 'Roles attended, events worked, referrals tracked back to deals.', 'seeded', true),
       now()),
    ('a0000005-0000-4000-8000-000000000005'::uuid, 'area', 'Personal',           'live', v_user_id,
       jsonb_build_object('what_good_looks_like', 'Family, fitness, finances trending the right way.', 'seeded', true),
       now())
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
