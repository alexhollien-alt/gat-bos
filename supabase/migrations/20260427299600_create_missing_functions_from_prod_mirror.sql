-- 7A.5 fix: create the 1 prod enum + 6 prod functions/triggers that have no
-- local CREATE migration.
--
-- Source: ~/audit/2026-04-30-slice7a5-reconciliation/prod-schema.sql, identified
-- by the Phase 3.2 first-pass diff (audit/2026-04-30-slice7a5-reconciliation/
-- phase3-schema-diff.txt) as objects present in prod but absent from local
-- migration history. They were applied to prod via paste-and-mirror outside any
-- captured migration version. Mirroring here so `supabase db reset` against
-- fresh local Docker can replay end-to-end.
--
-- Numbered AFTER 20260427299500_create_missing_tables_from_prod_mirror.sql so
-- the underlying tables (relationship_health_scores, project_touchpoints,
-- attendees, event_templates, etc.) exist before any function references them.
--
-- Idempotency:
--   - CREATE TYPE wrapped in DO block with EXCEPTION on duplicate_object.
--   - CREATE OR REPLACE FUNCTION is natively idempotent.
--   - CREATE OR REPLACE TRIGGER is PG 14+ native idempotency, matches prod source.
--
-- This migration will be marked applied in prod via
-- `supabase migration repair --status applied` per the 7A.5 reconciliation plan,
-- so prod (where the enum, functions, and triggers already exist) is unaffected.
--
-- Function bodies are byte-equivalent to the prod-schema.sql source. Do NOT
-- refactor or "improve" them in this migration; gap-only mirror.

-- ============================================================================
-- 1. ENUM event_occurrence_status
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE "public"."event_occurrence_status" AS ENUM (
        'scheduled',
        'confirmed',
        'completed',
        'canceled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TYPE "public"."event_occurrence_status" OWNER TO "postgres";

-- ============================================================================
-- 2. compute_relationship_health_score (pure scoring, no internal deps)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."compute_relationship_health_score"("p_contact_id" "uuid") RETURNS TABLE("score" numeric, "touchpoint_count" integer, "last_touchpoint_at" timestamp with time zone, "half_life_days" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_half_life   NUMERIC(8,2);
  v_max_age     NUMERIC(8,2);
BEGIN
  SELECT cfg.half_life_days, cfg.max_age_days
    INTO v_half_life, v_max_age
  FROM public.relationship_health_config cfg
  WHERE cfg.id = 1;

  RETURN QUERY
  WITH contact_touchpoints AS (
    SELECT
      tp.touchpoint_type,
      tp.occurred_at,
      EXTRACT(EPOCH FROM (NOW() - tp.occurred_at)) / 86400.0 AS age_days
    FROM public.project_touchpoints tp
    JOIN public.projects  p ON p.id = tp.project_id
    WHERE p.owner_contact_id = p_contact_id
      AND p.deleted_at      IS NULL
      AND tp.occurred_at    IS NOT NULL
      AND tp.occurred_at    <= NOW()
      AND tp.occurred_at    >= NOW() - (v_max_age || ' days')::INTERVAL
  ),
  decayed AS (
    SELECT
      ct.touchpoint_type,
      ct.occurred_at,
      w.weight * EXP( -LN(2.0) * ct.age_days / v_half_life ) AS contribution
    FROM contact_touchpoints ct
    JOIN public.relationship_health_touchpoint_weights w
      ON w.touchpoint_type = ct.touchpoint_type
  )
  SELECT
    COALESCE(ROUND(SUM(d.contribution)::NUMERIC, 4), 0)::NUMERIC(10,4),
    COUNT(*)::INTEGER,
    MAX(d.occurred_at),
    v_half_life
  FROM decayed d;
END;
$$;


ALTER FUNCTION "public"."compute_relationship_health_score"("p_contact_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_relationship_health_score"("p_contact_id" "uuid") IS 'Pure scoring function. score = SUM( weight * EXP(-LN(2) * age_days / half_life_days) ). Clamps at max_age_days. Skips soft-deleted projects and future-dated touchpoints. STABLE so it can be inlined into read queries.';

-- ============================================================================
-- 3. upsert_relationship_health_score (calls compute_relationship_health_score)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."upsert_relationship_health_score"("p_contact_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_score              NUMERIC(10,4);
  v_count              INTEGER;
  v_last_touchpoint    TIMESTAMPTZ;
  v_half_life          NUMERIC(8,2);
  v_contact_deleted_at TIMESTAMPTZ;
BEGIN
  -- Skip soft-deleted contacts.
  SELECT c.deleted_at INTO v_contact_deleted_at
  FROM public.contacts c
  WHERE c.id = p_contact_id;

  IF v_contact_deleted_at IS NOT NULL THEN
    -- Soft-delete the score row, do not recompute.
    UPDATE public.relationship_health_scores
       SET deleted_at = COALESCE(deleted_at, NOW())
     WHERE contact_id = p_contact_id;
    RETURN;
  END IF;

  SELECT s.score, s.touchpoint_count, s.last_touchpoint_at, s.half_life_days
    INTO v_score, v_count, v_last_touchpoint, v_half_life
  FROM public.compute_relationship_health_score(p_contact_id) s;

  INSERT INTO public.relationship_health_scores
    (contact_id, score, touchpoint_count, last_touchpoint_at, half_life_days, computed_at, deleted_at)
  VALUES
    (p_contact_id, v_score, v_count, v_last_touchpoint, v_half_life, NOW(), NULL)
  ON CONFLICT (contact_id) DO UPDATE
    SET score              = EXCLUDED.score,
        touchpoint_count   = EXCLUDED.touchpoint_count,
        last_touchpoint_at = EXCLUDED.last_touchpoint_at,
        half_life_days     = EXCLUDED.half_life_days,
        computed_at        = EXCLUDED.computed_at,
        deleted_at         = NULL;  -- restore if previously soft-deleted
END;
$$;


ALTER FUNCTION "public"."upsert_relationship_health_score"("p_contact_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_relationship_health_score"("p_contact_id" "uuid") IS 'Recomputes and writes a single contact''s score. Called by the touchpoint trigger and by the daily recompute job. Soft-deletes the score row if the contact is soft-deleted.';

-- ============================================================================
-- 4. recompute_all_relationship_health_scores (calls upsert)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."recompute_all_relationship_health_scores"("p_batch_limit" integer DEFAULT 500) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_contact_id UUID;
  v_processed  INTEGER := 0;
BEGIN
  FOR v_contact_id IN
    SELECT c.id
    FROM public.contacts c
    WHERE c.deleted_at IS NULL
    ORDER BY c.id
    LIMIT p_batch_limit
  LOOP
    PERFORM public.upsert_relationship_health_score(v_contact_id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;


ALTER FUNCTION "public"."recompute_all_relationship_health_scores"("p_batch_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recompute_all_relationship_health_scores"("p_batch_limit" integer) IS 'Full-table recompute for continuous time decay. Invoked by the Vercel cron edge function on a daily cadence. Paginate with p_batch_limit + OFFSET at the caller if the contact population grows past ~2k.';

-- ============================================================================
-- 5. recompute_relationship_health_on_touchpoint (trigger fn, calls upsert)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."recompute_relationship_health_on_touchpoint"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_old_contact UUID;
  v_new_contact UUID;
BEGIN
  -- Resolve affected contact(s) via project.owner_contact_id.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT p.owner_contact_id INTO v_old_contact
    FROM public.projects p WHERE p.id = OLD.project_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT p.owner_contact_id INTO v_new_contact
    FROM public.projects p WHERE p.id = NEW.project_id;
  END IF;

  IF v_old_contact IS NOT NULL THEN
    PERFORM public.upsert_relationship_health_score(v_old_contact);
  END IF;

  IF v_new_contact IS NOT NULL AND v_new_contact IS DISTINCT FROM v_old_contact THEN
    PERFORM public.upsert_relationship_health_score(v_new_contact);
  END IF;

  RETURN NULL;  -- AFTER trigger, result ignored
END;
$$;


ALTER FUNCTION "public"."recompute_relationship_health_on_touchpoint"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recompute_relationship_health_on_touchpoint"() IS 'AFTER trigger on project_touchpoints. Resolves the affected contact via projects.owner_contact_id and upserts their score. Handles project reassignment (UPDATE where project_id changed to a different owner) by recomputing both old and new contact.';

-- ============================================================================
-- 6. set_attendees_updated_at (standalone trigger fn)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."set_attendees_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_attendees_updated_at"() OWNER TO "postgres";

-- ============================================================================
-- 7. set_event_templates_updated_at (standalone trigger fn)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."set_event_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_event_templates_updated_at"() OWNER TO "postgres";

-- ============================================================================
-- 8. CREATE TRIGGERs (bind trigger functions to their tables)
-- ============================================================================

CREATE OR REPLACE TRIGGER "trg_attendees_updated_at" BEFORE UPDATE ON "public"."attendees" FOR EACH ROW EXECUTE FUNCTION "public"."set_attendees_updated_at"();

CREATE OR REPLACE TRIGGER "trg_event_templates_updated_at" BEFORE UPDATE ON "public"."event_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_templates_updated_at"();

CREATE OR REPLACE TRIGGER "trg_touchpoint_recompute_health" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_touchpoints" FOR EACH ROW EXECUTE FUNCTION "public"."recompute_relationship_health_on_touchpoint"();
