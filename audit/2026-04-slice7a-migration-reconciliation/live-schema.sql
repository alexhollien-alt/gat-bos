--
-- PostgreSQL database dump
--

\restrict aEMe5ULBgGfqgjf1QaFhr2ynJfX3p8RwVgzBGHRR5guGZSYD9TUjh52cPcVqKKZ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: deal_stage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.deal_stage AS ENUM (
    'under_contract',
    'in_escrow',
    'clear_to_close',
    'closed',
    'fell_through'
);


ALTER TYPE public.deal_stage OWNER TO postgres;

--
-- Name: design_asset_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.design_asset_type AS ENUM (
    'flyer',
    'brochure',
    'door_hanger',
    'eddm',
    'postcard',
    'social',
    'presentation',
    'other'
);


ALTER TYPE public.design_asset_type OWNER TO postgres;

--
-- Name: email_draft_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.email_draft_status AS ENUM (
    'generated',
    'approved',
    'sent',
    'discarded',
    'revised'
);


ALTER TYPE public.email_draft_status OWNER TO postgres;

--
-- Name: event_occurrence_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_occurrence_status AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'canceled'
);


ALTER TYPE public.event_occurrence_status OWNER TO postgres;

--
-- Name: event_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_source AS ENUM (
    'gcal_pull',
    'dashboard_create'
);


ALTER TYPE public.event_source OWNER TO postgres;

--
-- Name: follow_up_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.follow_up_status AS ENUM (
    'pending',
    'completed',
    'snoozed',
    'cancelled'
);


ALTER TYPE public.follow_up_status OWNER TO postgres;

--
-- Name: interaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.interaction_type AS ENUM (
    'call',
    'text',
    'email',
    'meeting',
    'broker_open',
    'lunch',
    'note',
    'email_sent',
    'email_received',
    'event'
);


ALTER TYPE public.interaction_type OWNER TO postgres;

--
-- Name: material_request_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.material_request_priority AS ENUM (
    'standard',
    'rush'
);


ALTER TYPE public.material_request_priority OWNER TO postgres;

--
-- Name: material_request_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.material_request_status AS ENUM (
    'draft',
    'submitted',
    'in_production',
    'complete'
);


ALTER TYPE public.material_request_status OWNER TO postgres;

--
-- Name: material_request_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.material_request_type AS ENUM (
    'print_ready',
    'design_help',
    'template_request'
);


ALTER TYPE public.material_request_type OWNER TO postgres;

--
-- Name: message_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.message_event_type AS ENUM (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained'
);


ALTER TYPE public.message_event_type OWNER TO postgres;

--
-- Name: message_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.message_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'bounced',
    'opened',
    'clicked',
    'failed'
);


ALTER TYPE public.message_status OWNER TO postgres;

--
-- Name: opportunity_stage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.opportunity_stage AS ENUM (
    'prospect',
    'under_contract',
    'in_escrow',
    'closed',
    'fell_through'
);


ALTER TYPE public.opportunity_stage OWNER TO postgres;

--
-- Name: product_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_type AS ENUM (
    'flyer',
    'brochure',
    'door_hanger',
    'eddm',
    'postcard',
    'other'
);


ALTER TYPE public.product_type OWNER TO postgres;

--
-- Name: project_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_status AS ENUM (
    'active',
    'paused',
    'closed'
);


ALTER TYPE public.project_status OWNER TO postgres;

--
-- Name: project_touchpoint_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_touchpoint_type AS ENUM (
    'email',
    'event',
    'voice_memo',
    'contact_note',
    'listing_setup'
);


ALTER TYPE public.project_touchpoint_type OWNER TO postgres;

--
-- Name: project_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_type AS ENUM (
    'agent_bd',
    'home_tour',
    'happy_hour',
    'campaign',
    'listing',
    'other'
);


ALTER TYPE public.project_type OWNER TO postgres;

--
-- Name: template_kind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.template_kind AS ENUM (
    'transactional',
    'campaign',
    'newsletter'
);


ALTER TYPE public.template_kind OWNER TO postgres;

--
-- Name: template_send_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.template_send_mode AS ENUM (
    'resend',
    'gmail',
    'both'
);


ALTER TYPE public.template_send_mode OWNER TO postgres;

--
-- Name: compute_relationship_health_score(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_relationship_health_score(p_contact_id uuid) RETURNS TABLE(score numeric, touchpoint_count integer, last_touchpoint_at timestamp with time zone, half_life_days numeric)
    LANGUAGE plpgsql STABLE
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


ALTER FUNCTION public.compute_relationship_health_score(p_contact_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION compute_relationship_health_score(p_contact_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.compute_relationship_health_score(p_contact_id uuid) IS 'Pure scoring function. score = SUM( weight * EXP(-LN(2) * age_days / half_life_days) ). Clamps at max_age_days. Skips soft-deleted projects and future-dated touchpoints. STABLE so it can be inlined into read queries.';


--
-- Name: current_day_ai_spend_usd(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_day_ai_spend_usd() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM public.ai_usage_log
  WHERE deleted_at IS NULL
    AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'America/Phoenix') AT TIME ZONE 'America/Phoenix';
$$;


ALTER FUNCTION public.current_day_ai_spend_usd() OWNER TO postgres;

--
-- Name: FUNCTION current_day_ai_spend_usd(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.current_day_ai_spend_usd() IS 'Slice 6: returns running USD spend for today (America/Phoenix calendar day). Used by src/lib/ai/_budget.ts to enforce AI_DAILY_BUDGET_USD.';


--
-- Name: increment_rate_limit(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count;
$$;


ALTER FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) OWNER TO postgres;

--
-- Name: FUNCTION increment_rate_limit(p_key text, p_window_start timestamp with time zone); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) IS 'Atomic upsert+increment for the Supabase-backed sliding-window rate limiter. Returns the post-increment count for (key, window_start). Service-role only.';


--
-- Name: recompute_all_relationship_health_scores(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer DEFAULT 500) RETURNS integer
    LANGUAGE plpgsql
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


ALTER FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer) OWNER TO postgres;

--
-- Name: FUNCTION recompute_all_relationship_health_scores(p_batch_limit integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer) IS 'Full-table recompute for continuous time decay. Invoked by the Vercel cron edge function on a daily cadence. Paginate with p_batch_limit + OFFSET at the caller if the contact population grows past ~2k.';


--
-- Name: recompute_relationship_health_on_touchpoint(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recompute_relationship_health_on_touchpoint() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.recompute_relationship_health_on_touchpoint() OWNER TO postgres;

--
-- Name: FUNCTION recompute_relationship_health_on_touchpoint(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.recompute_relationship_health_on_touchpoint() IS 'AFTER trigger on project_touchpoints. Resolves the affected contact via projects.owner_contact_id and upserts their score. Handles project reassignment (UPDATE where project_id changed to a different owner) by recomputing both old and new contact.';


--
-- Name: refresh_agent_relationship_health(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_agent_relationship_health() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_relationship_health;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.refresh_agent_relationship_health() OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: set_attendees_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_attendees_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_attendees_updated_at() OWNER TO postgres;

--
-- Name: set_email_drafts_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_email_drafts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_email_drafts_updated_at() OWNER TO postgres;

--
-- Name: set_event_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_event_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_event_templates_updated_at() OWNER TO postgres;

--
-- Name: set_events_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_events_updated_at() OWNER TO postgres;

--
-- Name: set_projects_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_projects_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$                                                                                                                                                                                                                                 
  BEGIN
    NEW.updated_at = NOW();                                                                                                                                                                                                             
    RETURN NEW;            
  END;                                                                                                                                                                                                                                  
  $$;


ALTER FUNCTION public.set_projects_updated_at() OWNER TO postgres;

--
-- Name: set_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_templates_updated_at() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: spine_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spine_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end
$$;


ALTER FUNCTION public.spine_touch_updated_at() OWNER TO postgres;

--
-- Name: spine_update_cycle_on_interaction(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spine_update_cycle_on_interaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_contact_tier text;
  v_default_days integer;
  v_cadence_days integer;
begin
  if new.contact_id is null then
    return new;
  end if;

  -- Look up tier from contacts to pick a default cadence.
  select tier into v_contact_tier
  from public.contacts where id = new.contact_id;

  v_default_days := case coalesce(v_contact_tier, '')
    when '1' then 7
    when 'tier1' then 7
    when 'A' then 7
    when '2' then 14
    when 'tier2' then 14
    when 'B' then 14
    when '3' then 30
    when 'tier3' then 30
    when 'C' then 30
    else 30
  end;

  -- Upsert cycle_state for this contact and recompute next_due_at.
  insert into public.cycle_state (contact_id, user_id, last_touched_at, next_due_at, current_streak_days, status)
  values (
    new.contact_id,
    coalesce(new.user_id, auth.uid()),
    new.created_at,
    new.created_at + make_interval(days => v_default_days),
    0,
    'active'
  )
  on conflict (contact_id) do update
  set last_touched_at = excluded.last_touched_at,
      next_due_at = excluded.last_touched_at + make_interval(
        days => coalesce(public.cycle_state.cadence_days, v_default_days)
      ),
      current_streak_days = 0,
      updated_at = now();

  return new;
end
$$;


ALTER FUNCTION public.spine_update_cycle_on_interaction() OWNER TO postgres;

--
-- Name: touch_rep_pulse_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_rep_pulse_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only update timestamp if rep_pulse actually changed
  IF NEW.rep_pulse IS DISTINCT FROM OLD.rep_pulse THEN
    NEW.rep_pulse_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.touch_rep_pulse_updated_at() OWNER TO postgres;

--
-- Name: update_message_log_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_message_log_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_status public.message_status;
  new_status public.message_status;
  rank_current int;
  rank_new int;
BEGIN
  SELECT status INTO current_status
  FROM public.messages_log
  WHERE id = NEW.message_log_id;

  IF current_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_status IN ('bounced', 'failed') THEN
    RETURN NEW;
  END IF;

  new_status := CASE NEW.event_type
    WHEN 'sent' THEN 'sent'::public.message_status
    WHEN 'delivered' THEN 'delivered'::public.message_status
    WHEN 'opened' THEN 'opened'::public.message_status
    WHEN 'clicked' THEN 'clicked'::public.message_status
    WHEN 'bounced' THEN 'bounced'::public.message_status
    WHEN 'complained' THEN 'bounced'::public.message_status
  END;

  rank_current := CASE current_status
    WHEN 'queued' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3
    WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 99
    WHEN 'failed' THEN 99
    ELSE 0
  END;

  rank_new := CASE new_status
    WHEN 'sent' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3
    WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 99
    ELSE 0
  END;

  IF rank_new > rank_current THEN
    UPDATE public.messages_log
    SET status = new_status
    WHERE id = NEW.message_log_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_message_log_status() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

--
-- Name: upsert_relationship_health_score(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) RETURNS void
    LANGUAGE plpgsql
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


ALTER FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION upsert_relationship_health_score(p_contact_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) IS 'Recomputes and writes a single contact''s score. Called by the touchpoint trigger and by the daily recompute job. Soft-deletes the score row if the contact is soft-deleted.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    owner_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    request_id uuid,
    created_by text DEFAULT 'alex'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT activities_type_check CHECK ((type = ANY (ARRAY['note'::text, 'call'::text, 'text'::text, 'email'::text, 'meeting'::text, 'broker_open'::text, 'lunch'::text, 'event'::text, 'system'::text])))
);


ALTER TABLE public.activities OWNER TO postgres;

--
-- Name: activity_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    verb text NOT NULL,
    object_table text NOT NULL,
    object_id uuid NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.activity_events OWNER TO postgres;

--
-- Name: agent_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    contact_id uuid NOT NULL,
    period text NOT NULL,
    escrows_opened integer DEFAULT 0 NOT NULL,
    escrows_closed integer DEFAULT 0 NOT NULL,
    referral_source text,
    revenue numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_metrics_escrows_closed_check CHECK ((escrows_closed >= 0)),
    CONSTRAINT agent_metrics_escrows_opened_check CHECK ((escrows_opened >= 0))
);


ALTER TABLE public.agent_metrics OWNER TO postgres;

--
-- Name: TABLE agent_metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.agent_metrics IS 'Per-agent business outcomes by period. UNIQUE (contact_id, period). revenue column is optional/sensitive.';


--
-- Name: ai_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_cache (
    feature text NOT NULL,
    cache_key text NOT NULL,
    value jsonb NOT NULL,
    model text,
    expires_at timestamp with time zone,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.ai_cache OWNER TO postgres;

--
-- Name: TABLE ai_cache; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ai_cache IS 'Slice 6: per-feature durable result cache. expires_at NULL = TTL-less. cache_key is sha256 hex of normalized input (helper: src/lib/ai/_cache.ts cacheKey()).';


--
-- Name: COLUMN ai_cache.value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_cache.value IS 'Cached response payload. Shape determined by the capability writing it.';


--
-- Name: COLUMN ai_cache.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_cache.expires_at IS 'When NULL, the entry has no TTL and persists until soft-deleted. When set, _cache.cacheGet() returns null if now() > expires_at.';


--
-- Name: ai_usage_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cache_read_tokens integer DEFAULT 0 NOT NULL,
    cache_creation_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_usage_log OWNER TO postgres;

--
-- Name: TABLE ai_usage_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ai_usage_log IS 'Slice 6: per-call audit + cost tracking for Claude API. Feature column is enum-style text for forward-compat (morning-brief, capture-parse, draft-generate, inbox-score, etc.).';


--
-- Name: COLUMN ai_usage_log.cost_usd; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_usage_log.cost_usd IS 'Computed at write time from src/lib/ai/_pricing.ts rate table. numeric(10,6) supports up to 9999.999999.';


--
-- Name: COLUMN ai_usage_log.context; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_usage_log.context IS 'Free-form jsonb for capability-specific metadata (cache_hit boolean, prompt_version, error info on failure rows, etc.).';


--
-- Name: api_usage_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    feature_key text NOT NULL,
    executor_model text NOT NULL,
    adviser_called boolean DEFAULT false NOT NULL,
    adviser_call_count integer DEFAULT 0 NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cost_estimate_cents numeric(10,4) DEFAULT 0 NOT NULL,
    duration_ms integer,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.api_usage_log OWNER TO postgres;

--
-- Name: attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    rsvp_status text DEFAULT 'invited'::text NOT NULL,
    invited_at timestamp with time zone,
    responded_at timestamp with time zone,
    recorded_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT attendees_rsvp_status_check CHECK ((rsvp_status = ANY (ARRAY['invited'::text, 'accepted'::text, 'declined'::text, 'attended'::text, 'no_show'::text])))
);


ALTER TABLE public.attendees OWNER TO postgres;

--
-- Name: TABLE attendees; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attendees IS 'Per-event-occurrence attendance. Doubles as touchpoint store: when recorded_at + notes are set, the row counts as a post-event touchpoint for that contact.';


--
-- Name: campaign_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    next_action_at timestamp with time zone,
    CONSTRAINT campaign_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'removed'::text])))
);


ALTER TABLE public.campaign_enrollments OWNER TO postgres;

--
-- Name: campaign_step_completions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_step_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    step_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_by uuid,
    email_sent_at timestamp with time zone,
    email_delivered boolean DEFAULT false,
    email_opened boolean DEFAULT false,
    resend_message_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.campaign_step_completions OWNER TO postgres;

--
-- Name: campaign_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    step_number integer DEFAULT 1 NOT NULL,
    step_type text DEFAULT 'email'::text NOT NULL,
    title text NOT NULL,
    content text,
    delay_days integer DEFAULT 0 NOT NULL,
    email_subject text,
    email_body_html text,
    awareness_level text,
    step_goal text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    template_slug text,
    CONSTRAINT campaign_steps_awareness_level_check CHECK ((awareness_level = ANY (ARRAY['unaware'::text, 'problem_aware'::text, 'solution_aware'::text, 'product_aware'::text, 'most_aware'::text]))),
    CONSTRAINT campaign_steps_step_goal_check CHECK ((step_goal = ANY (ARRAY['hook'::text, 'problem'::text, 'agitate'::text, 'credibility'::text, 'solution'::text, 'proof'::text, 'objections'::text, 'offer'::text, 'urgency'::text, 'cta'::text]))),
    CONSTRAINT campaign_steps_step_type_check CHECK ((step_type = ANY (ARRAY['email'::text, 'call'::text, 'text'::text, 'mail'::text, 'social'::text, 'task'::text])))
);


ALTER TABLE public.campaign_steps OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'drip'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    step_count integer DEFAULT 0 NOT NULL,
    enrolled_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT campaigns_type_check CHECK ((type = ANY (ARRAY['drip'::text, 'marketing'::text])))
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: captures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.captures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_text text NOT NULL,
    parsed_intent text,
    parsed_contact_id uuid,
    parsed_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    transcript text,
    metadata jsonb,
    suggested_target jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT captures_parsed_intent_check CHECK (((parsed_intent IS NULL) OR (parsed_intent = ANY (ARRAY['interaction'::text, 'follow_up'::text, 'ticket'::text, 'note'::text, 'unprocessed'::text])))),
    CONSTRAINT captures_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'spine_inbox'::text, 'voice_memo'::text, 'intake'::text, 'email_inbox'::text, 'audio'::text]))),
    CONSTRAINT captures_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'promoted'::text, 'discarded'::text])))
);


ALTER TABLE public.captures OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    type text DEFAULT 'realtor'::text NOT NULL,
    brokerage text,
    title text,
    license_number text,
    stage text DEFAULT 'new'::text NOT NULL,
    source text,
    tags text[] DEFAULT '{}'::text[],
    last_touchpoint timestamp with time zone,
    next_action text,
    next_followup timestamp with time zone,
    internal_note text,
    instagram_handle text,
    linkedin_url text,
    website_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    headshot_url text,
    brokerage_logo_url text,
    agent_logo_url text,
    brand_colors jsonb,
    palette text,
    font_kit text,
    farm_area text,
    farm_zips text[],
    health_score integer DEFAULT 0,
    rep_pulse integer,
    tier text,
    preferred_channel text,
    referred_by text,
    escrow_officer text,
    contact_md_path text,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    rep_pulse_updated_at timestamp with time zone,
    notes text,
    lender_partner_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    full_name text GENERATED ALWAYS AS (((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text))) STORED,
    CONSTRAINT contacts_rep_pulse_check CHECK (((rep_pulse >= 1) AND (rep_pulse <= 10))),
    CONSTRAINT contacts_stage_check CHECK ((stage = ANY (ARRAY['new'::text, 'warm'::text, 'active_partner'::text, 'advocate'::text, 'dormant'::text]))),
    CONSTRAINT contacts_temperature_check CHECK (((health_score >= 0) AND (health_score <= 100))),
    CONSTRAINT contacts_tier_check CHECK ((tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'P'::text]))),
    CONSTRAINT contacts_type_check CHECK ((type = ANY (ARRAY['realtor'::text, 'lender'::text, 'builder'::text, 'vendor'::text, 'buyer'::text, 'seller'::text, 'past_client'::text, 'warm_lead'::text, 'referral_partner'::text, 'sphere'::text, 'other'::text, 'escrow'::text])))
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: contacts_spec_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.contacts_spec_view AS
 SELECT id,
    first_name,
    last_name,
    email,
    phone,
    type,
    brokerage,
    title,
    license_number,
    stage,
    source,
    tags,
    last_touchpoint,
    next_action,
    next_followup,
    internal_note,
    instagram_handle,
    linkedin_url,
    website_url,
    created_at,
    updated_at,
    deleted_at,
    headshot_url,
    brokerage_logo_url,
    agent_logo_url,
    brand_colors,
    palette,
    font_kit,
    farm_area,
    farm_zips,
    health_score,
    rep_pulse,
    tier,
    preferred_channel,
    referred_by,
    escrow_officer,
    contact_md_path,
    user_id,
    rep_pulse_updated_at,
    notes,
    lender_partner_id,
    metadata,
    full_name,
        CASE type
            WHEN 'realtor'::text THEN 'agent'::text
            WHEN 'buyer'::text THEN 'agent'::text
            WHEN 'seller'::text THEN 'agent'::text
            WHEN 'past_client'::text THEN 'agent'::text
            WHEN 'warm_lead'::text THEN 'agent'::text
            WHEN 'sphere'::text THEN 'agent'::text
            WHEN 'lender'::text THEN 'lender'::text
            WHEN 'vendor'::text THEN 'vendor'::text
            WHEN 'builder'::text THEN 'vendor'::text
            WHEN 'referral_partner'::text THEN 'vendor'::text
            WHEN 'escrow'::text THEN 'escrow'::text
            ELSE 'other'::text
        END AS role,
    COALESCE((last_touchpoint < ((CURRENT_DATE - '30 days'::interval))::timestamp with time zone), true) AS is_dormant
   FROM public.contacts c;


ALTER VIEW public.contacts_spec_view OWNER TO postgres;

--
-- Name: VIEW contacts_spec_view; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.contacts_spec_view IS 'Spec-compatible projection of contacts with computed role and is_dormant. RLS inherits from contacts table (Postgres 15+ behavior).';


--
-- Name: design_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.design_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    asset_type public.design_asset_type DEFAULT 'flyer'::public.design_asset_type NOT NULL,
    listing_address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.design_assets OWNER TO postgres;

--
-- Name: email_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id uuid NOT NULL,
    draft_subject text,
    draft_body_plain text,
    draft_body_html text,
    status public.email_draft_status DEFAULT 'generated'::public.email_draft_status NOT NULL,
    escalation_flag text,
    escalation_reason text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    approved_by text,
    sent_at timestamp with time zone,
    sent_via text,
    revisions_count integer DEFAULT 0 NOT NULL,
    created_in_gmail_draft_id text,
    created_in_obsidian_file_path text,
    audit_log jsonb DEFAULT jsonb_build_object('event_sequence', '[]'::jsonb, 'metadata', '{}'::jsonb) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT email_drafts_escalation_flag_check CHECK (((escalation_flag = ANY (ARRAY['marlene'::text, 'agent_followup'::text])) OR (escalation_flag IS NULL))),
    CONSTRAINT email_drafts_sent_via_check CHECK (((sent_via = ANY (ARRAY['resend'::text, 'gmail_draft'::text])) OR (sent_via IS NULL)))
);


ALTER TABLE public.email_drafts OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gmail_id text NOT NULL,
    gmail_thread_id text,
    from_email text NOT NULL,
    from_name text,
    subject text NOT NULL,
    body_plain text,
    body_html text,
    snippet text,
    is_unread boolean DEFAULT true NOT NULL,
    is_contact_match boolean DEFAULT false NOT NULL,
    contact_id uuid,
    contact_domain text,
    is_potential_re_pro boolean DEFAULT false NOT NULL,
    labels jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    last_checked_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: email_drafts_observation; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.email_drafts_observation WITH (security_invoker='true') AS
 WITH terminal AS (
         SELECT d_1.id AS draft_id,
            ( SELECT ev.value AS ev
                   FROM jsonb_array_elements(COALESCE((d_1.audit_log -> 'event_sequence'::text), '[]'::jsonb)) ev(value)
                  WHERE ((ev.value ->> 'event'::text) = ANY (ARRAY['sent_via_resend'::text, 'sent_via_gmail_draft'::text, 'user_discarded'::text]))
                  ORDER BY ((ev.value ->> 'timestamp'::text))::timestamp with time zone DESC
                 LIMIT 1) AS terminal_ev,
            (EXISTS ( SELECT 1
                   FROM jsonb_array_elements(COALESCE((d_1.audit_log -> 'event_sequence'::text), '[]'::jsonb)) ev(value)
                  WHERE ((ev.value ->> 'event'::text) = 'user_revised'::text))) AS was_revised
           FROM public.email_drafts d_1
        )
 SELECT d.id AS draft_id,
    e.contact_id,
    c.tier AS contact_tier,
    d.escalation_flag,
        CASE (t.terminal_ev ->> 'event'::text)
            WHEN 'sent_via_resend'::text THEN 'send_now'::text
            WHEN 'sent_via_gmail_draft'::text THEN 'create_gmail_draft'::text
            WHEN 'user_discarded'::text THEN 'discarded'::text
            ELSE NULL::text
        END AS action_taken,
    d.generated_at,
        CASE
            WHEN (t.terminal_ev IS NOT NULL) THEN ((t.terminal_ev ->> 'timestamp'::text))::timestamp with time zone
            ELSE NULL::timestamp with time zone
        END AS acted_at,
        CASE
            WHEN (t.terminal_ev IS NOT NULL) THEN (EXTRACT(epoch FROM (((t.terminal_ev ->> 'timestamp'::text))::timestamp with time zone - d.generated_at)))::integer
            ELSE NULL::integer
        END AS time_to_action_seconds,
    COALESCE(t.was_revised, false) AS was_revised
   FROM (((public.email_drafts d
     JOIN public.emails e ON ((e.id = d.email_id)))
     LEFT JOIN public.contacts c ON ((c.id = e.contact_id)))
     LEFT JOIN terminal t ON ((t.draft_id = d.id)));


ALTER VIEW public.email_drafts_observation OWNER TO postgres;

--
-- Name: VIEW email_drafts_observation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.email_drafts_observation IS 'Phase 1.3.2-C per-draft readout surface. Joins email_drafts -> emails -> contacts for tier context and derives action_taken from the terminal event in audit_log.event_sequence. security_invoker=true so RLS on the underlying tables applies; alex-only in single-user mode.';


--
-- Name: email_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    contact_id uuid NOT NULL,
    campaign text NOT NULL,
    subject text NOT NULL,
    sent_at timestamp with time zone NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    resend_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_log OWNER TO postgres;

--
-- Name: TABLE email_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_log IS 'Resend campaign email tracking, one row per (contact, send). Webhooks transition status.';


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint text,
    error_code integer,
    error_message text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.error_logs OWNER TO postgres;

--
-- Name: event_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_contact_id uuid NOT NULL,
    week_of_month integer NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    location_type text NOT NULL,
    default_location text,
    lender_flag text DEFAULT 'none'::text NOT NULL,
    notes text,
    rrule text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT event_templates_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT event_templates_fixed_has_location CHECK (((location_type <> 'fixed'::text) OR (default_location IS NOT NULL))),
    CONSTRAINT event_templates_lender_flag_check CHECK ((lender_flag = ANY (ARRAY['alex'::text, 'stephanie'::text, 'christine'::text, 'none'::text]))),
    CONSTRAINT event_templates_location_type_check CHECK ((location_type = ANY (ARRAY['fixed'::text, 'rotating'::text]))),
    CONSTRAINT event_templates_time_order CHECK ((end_time > start_time)),
    CONSTRAINT event_templates_week_of_month_check CHECK (((week_of_month >= 1) AND (week_of_month <= 5)))
);


ALTER TABLE public.event_templates OWNER TO postgres;

--
-- Name: TABLE event_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.event_templates IS 'Recurring event definitions. Each row is one of the 9 GAT Event Cycle events. Occurrences land in events with event_template_id set.';


--
-- Name: COLUMN event_templates.location_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_templates.location_type IS '"fixed" = default_location used as-is for every occurrence. "rotating" = monthly location_override required on each events row.';


--
-- Name: COLUMN event_templates.rrule; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_templates.rrule IS 'Optional RFC 5545 RRULE string, reserved for future GCal outbound. NULL means week_of_month + day_of_week are canonical.';


--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gcal_event_id text,
    title text NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    location text,
    attendees jsonb DEFAULT '[]'::jsonb NOT NULL,
    project_id uuid,
    contact_id uuid,
    source public.event_source NOT NULL,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    event_template_id uuid,
    location_override text,
    occurrence_status public.event_occurrence_status DEFAULT 'scheduled'::public.event_occurrence_status NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: TABLE events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.events IS 'Calendar events, bidirectionally synced with Google Calendar. source=gcal_pull rows are overwritten by hourly cron (GCal wins). source=dashboard_create rows are created locally, then mirrored to GCal and backfilled with gcal_event_id. Soft-delete via deleted_at per standing rule 3.';


--
-- Name: COLUMN events.event_template_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.events.event_template_id IS 'FK to event_templates when this occurrence was spawned from a recurring template. NULL for one-off events (Phase 1.5 GCal-sync path).';


--
-- Name: COLUMN events.location_override; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.events.location_override IS 'Per-occurrence address when the parent template has location_type=rotating. Resolved by Step 7 monthly confirm flow. For fixed templates, leave NULL and read from event_templates.default_location.';


--
-- Name: COLUMN events.occurrence_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.events.occurrence_status IS 'Occurrence lifecycle: scheduled -> confirmed (rotating: location set) -> completed / canceled. Independent of Phase 1.5 source enum.';


--
-- Name: inbox_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inbox_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    gmail_thread_id text NOT NULL,
    sender_email text NOT NULL,
    sender_name text DEFAULT ''::text NOT NULL,
    subject text DEFAULT '(no subject)'::text NOT NULL,
    snippet text DEFAULT ''::text NOT NULL,
    received_at timestamp with time zone NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    matched_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    contact_id uuid,
    contact_name text,
    contact_tier text,
    status text DEFAULT 'pending'::text NOT NULL,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inbox_items_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT inbox_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'replied'::text, 'dismissed'::text])))
);


ALTER TABLE public.inbox_items OWNER TO postgres;

--
-- Name: interactions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.interactions AS
 SELECT id,
    user_id,
    ((context ->> 'contact_id'::text))::uuid AS contact_id,
    COALESCE((context ->> 'type'::text), replace(verb, 'interaction.'::text, ''::text)) AS type,
    COALESCE((context ->> 'summary'::text), (context ->> 'note'::text), ''::text) AS summary,
    occurred_at,
    created_at,
    (context ->> 'direction'::text) AS direction,
    ((context ->> 'duration_minutes'::text))::integer AS duration_minutes,
    deleted_at
   FROM public.activity_events ae
  WHERE ((verb ~~ 'interaction.%'::text) AND (deleted_at IS NULL));


ALTER VIEW public.interactions OWNER TO postgres;

--
-- Name: listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    property_address text NOT NULL,
    city text,
    state text DEFAULT 'AZ'::text,
    zip text,
    property_type text DEFAULT 'single_family'::text NOT NULL,
    price numeric(12,2),
    beds integer,
    baths numeric(3,1),
    sqft integer,
    year_built integer,
    lot_size text,
    mls_number text,
    mls_status text,
    listing_url text,
    photo_urls text[] DEFAULT '{}'::text[],
    virtual_tour_url text,
    headline text,
    description text,
    list_date date,
    close_date date,
    status text DEFAULT 'intake'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT listings_mls_status_check CHECK ((mls_status = ANY (ARRAY['coming_soon'::text, 'active'::text, 'pending'::text, 'sold'::text, 'withdrawn'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT listings_property_type_check CHECK ((property_type = ANY (ARRAY['single_family'::text, 'condo'::text, 'townhome'::text, 'lot'::text, 'commercial'::text, 'multi_family'::text, 'other'::text]))),
    CONSTRAINT listings_status_check CHECK ((status = ANY (ARRAY['intake'::text, 'active'::text, 'pending'::text, 'closed'::text, 'cancelled'::text, 'withdrawn'::text])))
);


ALTER TABLE public.listings OWNER TO postgres;

--
-- Name: message_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_log_id uuid NOT NULL,
    event_type public.message_event_type NOT NULL,
    provider_message_id text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.message_events OWNER TO postgres;

--
-- Name: messages_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    recipient_email text NOT NULL,
    send_mode public.template_send_mode NOT NULL,
    provider_message_id text,
    status public.message_status DEFAULT 'queued'::public.message_status NOT NULL,
    event_sequence jsonb DEFAULT '[]'::jsonb NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.messages_log OWNER TO postgres;

--
-- Name: TABLE messages_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.messages_log IS 'Per-send audit row for the messaging abstraction. status flows queued -> sent -> delivered/bounced/opened/clicked or failed. event_sequence is an append-only jsonb array (timestamp + event payload), mirrors email_drafts.audit_log shape. RLS Alex-only.';


--
-- Name: morning_briefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.morning_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brief_date date NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    brief_json jsonb NOT NULL,
    brief_text text NOT NULL,
    model text NOT NULL,
    usage jsonb,
    contacts_scored integer DEFAULT 0 NOT NULL,
    errors jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.morning_briefs OWNER TO postgres;

--
-- Name: TABLE morning_briefs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.morning_briefs IS 'Nightly relationship brief assembled at 12:30 UTC (5:30am MST). One row per brief_date.';


--
-- Name: COLUMN morning_briefs.brief_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.morning_briefs.brief_date IS 'The day this brief is FOR (YYYY-MM-DD in MST). Unique per non-deleted row.';


--
-- Name: COLUMN morning_briefs.brief_json; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.morning_briefs.brief_json IS 'Structured brief data: { temperature_ranking, congrats_queue, watch_list, one_thing }.';


--
-- Name: COLUMN morning_briefs.brief_text; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.morning_briefs.brief_text IS 'Narrative markdown rendered at /morning. Generated by Claude API.';


--
-- Name: COLUMN morning_briefs.usage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.morning_briefs.usage IS 'Anthropic usage telemetry: { input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens }.';


--
-- Name: COLUMN morning_briefs.errors; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.morning_briefs.errors IS 'Per-contact non-fatal errors encountered during scoring. NULL on clean runs.';


--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text DEFAULT 'alex'::text NOT NULL,
    provider text DEFAULT 'google'::text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE public.oauth_tokens OWNER TO postgres;

--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    property_address text NOT NULL,
    property_city text,
    property_state text DEFAULT 'AZ'::text,
    property_zip text,
    sale_price numeric(12,2),
    stage public.opportunity_stage DEFAULT 'prospect'::public.opportunity_stage,
    escrow_number text,
    opened_at date,
    expected_close_date date,
    closed_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid DEFAULT auth.uid() NOT NULL,
    deleted_at timestamp with time zone,
    buyer_name text,
    seller_name text,
    earnest_money numeric,
    commission_rate numeric,
    escrow_company text,
    escrow_officer text,
    title_company text,
    lender_name text,
    lender_partner_id uuid,
    contract_date date,
    escrow_open_date date,
    scheduled_close_date date,
    actual_close_date date
);


ALTER TABLE public.opportunities OWNER TO postgres;

--
-- Name: project_touchpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_touchpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    touchpoint_type public.project_touchpoint_type NOT NULL,
    entity_id uuid NOT NULL,
    entity_table text NOT NULL,
    occurred_at timestamp with time zone,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    due_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id uuid NOT NULL,
    last_reminded_at timestamp with time zone
);


ALTER TABLE public.project_touchpoints OWNER TO postgres;

--
-- Name: TABLE project_touchpoints; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.project_touchpoints IS 'Polymorphic touchpoint rows linking a project to any domain entity. entity_table + entity_id = untyped FK. Application layer enforces integrity. Cascade deletes with parent project.';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.project_type NOT NULL,
    title text NOT NULL,
    status public.project_status DEFAULT 'active'::public.project_status NOT NULL,
    owner_contact_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.projects IS 'Polymorphic project entity. Links arbitrary touchpoints (emails, events, contacts, notes) under one initiative. Soft-delete via deleted_at per standing rule 3.';


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone NOT NULL
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: TABLE rate_limits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rate_limits IS 'Operational counter store for the Supabase-backed sliding-window rate limiter. Service-role only. Rows are time-bounded; helper culls expired windows opportunistically.';


--
-- Name: referral_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    company_name text,
    email text,
    phone text,
    website text,
    category text NOT NULL,
    service_area text,
    specialties text[] DEFAULT '{}'::text[],
    trust_level integer,
    relationship_notes text,
    ideal_use_cases text,
    last_referred_at timestamp with time zone,
    referral_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT referral_partners_category_check CHECK ((category = ANY (ARRAY['lender'::text, 'inspector'::text, 'contractor'::text, 'photographer'::text, 'stager'::text, 'handyman'::text, 'cleaner'::text, 'insurance'::text, 'home_warranty'::text, 'moving_company'::text, 'landscaper'::text, 'pool_service'::text, 'hvac'::text, 'plumber'::text, 'electrician'::text, 'title_support'::text, 'other'::text]))),
    CONSTRAINT referral_partners_trust_level_check CHECK (((trust_level >= 1) AND (trust_level <= 5)))
);


ALTER TABLE public.referral_partners OWNER TO postgres;

--
-- Name: relationship_health_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.relationship_health_config (
    id smallint DEFAULT 1 NOT NULL,
    half_life_days numeric(8,2) DEFAULT 45.00 NOT NULL,
    max_age_days numeric(8,2) DEFAULT 730.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT half_life_positive CHECK ((half_life_days > (0)::numeric)),
    CONSTRAINT max_age_positive CHECK ((max_age_days > (0)::numeric)),
    CONSTRAINT relationship_health_config_singleton CHECK ((id = 1))
);


ALTER TABLE public.relationship_health_config OWNER TO postgres;

--
-- Name: TABLE relationship_health_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.relationship_health_config IS 'Singleton config for relationship health decay. half_life_days = days for a touchpoint weight to decay to 50%. max_age_days clamps the window -- touchpoints older than this contribute zero.';


--
-- Name: relationship_health_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.relationship_health_scores (
    contact_id uuid NOT NULL,
    score numeric(10,4) DEFAULT 0 NOT NULL,
    touchpoint_count integer DEFAULT 0 NOT NULL,
    last_touchpoint_at timestamp with time zone,
    half_life_days numeric(8,2) NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT score_non_negative CHECK ((score >= (0)::numeric))
);


ALTER TABLE public.relationship_health_scores OWNER TO postgres;

--
-- Name: TABLE relationship_health_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.relationship_health_scores IS 'Denormalized per-contact relationship health score. Maintained by trigger on project_touchpoints and by the daily recompute edge function. Published to supabase_realtime so the dashboard sees score deltas live.';


--
-- Name: relationship_health_touchpoint_weights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.relationship_health_touchpoint_weights (
    touchpoint_type public.project_touchpoint_type NOT NULL,
    weight numeric(6,2) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT weight_non_negative CHECK ((weight >= (0)::numeric))
);


ALTER TABLE public.relationship_health_touchpoint_weights OWNER TO postgres;

--
-- Name: TABLE relationship_health_touchpoint_weights; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.relationship_health_touchpoint_weights IS 'Base weight per touchpoint_type before exponential decay is applied. Add a new row when project_touchpoint_type gains a variant.';


--
-- Name: resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    type text NOT NULL,
    url text,
    content text,
    file_path text,
    tags text[] DEFAULT '{}'::text[],
    usage_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT resources_category_check CHECK ((category = ANY (ARRAY['email_template'::text, 'drip_copy'::text, 'script'::text, 'canva_template'::text, 'qr_resource'::text, 'title_resource'::text, 'calculator'::text, 'app_link'::text, 'social_content'::text, 'checklist'::text, 'marketing_example'::text, 'guide'::text, 'other'::text]))),
    CONSTRAINT resources_type_check CHECK ((type = ANY (ARRAY['link'::text, 'file'::text, 'text_snippet'::text])))
);


ALTER TABLE public.resources OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    title text NOT NULL,
    description text,
    due_date timestamp with time zone,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_rule text,
    completed_at timestamp with time zone,
    snoozed_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    type text DEFAULT 'todo'::text NOT NULL,
    source text,
    due_reason text,
    action_hint text,
    linked_interaction_id uuid,
    project_id uuid,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'snoozed'::text, 'cancelled'::text]))),
    CONSTRAINT tasks_type_check CHECK ((type = ANY (ARRAY['todo'::text, 'follow_up'::text, 'commitment'::text])))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    send_mode public.template_send_mode NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_text text NOT NULL,
    kind public.template_kind NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.templates OWNER TO postgres;

--
-- Name: TABLE templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.templates IS 'Single-tenant template library for the messaging abstraction. Versioned by (slug, version). Soft-delete via deleted_at per standing rule 3. RLS Alex-only.';


--
-- Name: ticket_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    product_type public.product_type DEFAULT 'flyer'::public.product_type NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    design_url text,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ticket_items OWNER TO postgres;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    contact_id uuid,
    title text NOT NULL,
    request_type public.material_request_type DEFAULT 'print_ready'::public.material_request_type NOT NULL,
    status public.material_request_status DEFAULT 'draft'::public.material_request_status NOT NULL,
    priority public.material_request_priority DEFAULT 'standard'::public.material_request_priority NOT NULL,
    notes text,
    submitted_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    source text DEFAULT 'internal'::text NOT NULL,
    listing_data jsonb,
    submitter_name text,
    submitter_email text,
    submitter_phone text
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_slug_key UNIQUE (slug);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);


--
-- Name: agent_metrics agent_metrics_contact_period_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_contact_period_uniq UNIQUE (contact_id, period);


--
-- Name: agent_metrics agent_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_pkey PRIMARY KEY (id);


--
-- Name: ai_cache ai_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_cache
    ADD CONSTRAINT ai_cache_pkey PRIMARY KEY (feature, cache_key);


--
-- Name: ai_usage_log ai_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);


--
-- Name: api_usage_log api_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_usage_log
    ADD CONSTRAINT api_usage_log_pkey PRIMARY KEY (id);


--
-- Name: attendees attendees_event_contact_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_event_contact_unique UNIQUE (event_id, contact_id);


--
-- Name: attendees attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_pkey PRIMARY KEY (id);


--
-- Name: campaign_enrollments campaign_enrollments_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: campaign_enrollments campaign_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_pkey PRIMARY KEY (id);


--
-- Name: campaign_step_completions campaign_step_completions_enrollment_id_step_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_enrollment_id_step_id_key UNIQUE (enrollment_id, step_id);


--
-- Name: campaign_step_completions campaign_step_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_pkey PRIMARY KEY (id);


--
-- Name: campaign_steps campaign_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: captures captures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_email_unique UNIQUE (email);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: design_assets design_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_pkey PRIMARY KEY (id);


--
-- Name: email_drafts email_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_pkey PRIMARY KEY (id);


--
-- Name: email_log email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);


--
-- Name: email_log email_log_resend_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_resend_id_key UNIQUE (resend_id);


--
-- Name: emails emails_gmail_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_gmail_id_key UNIQUE (gmail_id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: event_templates event_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_templates
    ADD CONSTRAINT event_templates_pkey PRIMARY KEY (id);


--
-- Name: events events_gcal_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_gcal_event_id_key UNIQUE (gcal_event_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: inbox_items inbox_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_pkey PRIMARY KEY (id);


--
-- Name: inbox_items inbox_items_user_thread_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_user_thread_unique UNIQUE (user_id, gmail_thread_id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: message_events message_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_events
    ADD CONSTRAINT message_events_pkey PRIMARY KEY (id);


--
-- Name: messages_log messages_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages_log
    ADD CONSTRAINT messages_log_pkey PRIMARY KEY (id);


--
-- Name: morning_briefs morning_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.morning_briefs
    ADD CONSTRAINT morning_briefs_pkey PRIMARY KEY (id);


--
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: oauth_tokens oauth_tokens_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: project_touchpoints project_touchpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_touchpoints
    ADD CONSTRAINT project_touchpoints_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key, window_start);


--
-- Name: referral_partners referral_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_pkey PRIMARY KEY (id);


--
-- Name: relationship_health_config relationship_health_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_config
    ADD CONSTRAINT relationship_health_config_pkey PRIMARY KEY (id);


--
-- Name: relationship_health_scores relationship_health_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_scores
    ADD CONSTRAINT relationship_health_scores_pkey PRIMARY KEY (contact_id);


--
-- Name: relationship_health_touchpoint_weights relationship_health_touchpoint_weights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_touchpoint_weights
    ADD CONSTRAINT relationship_health_touchpoint_weights_pkey PRIMARY KEY (touchpoint_type);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: ticket_items ticket_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: accounts_owner_user_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_owner_user_id_active_idx ON public.accounts USING btree (owner_user_id) WHERE (deleted_at IS NULL);


--
-- Name: agent_metrics_contact_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agent_metrics_contact_idx ON public.agent_metrics USING btree (contact_id);


--
-- Name: agent_metrics_user_period_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agent_metrics_user_period_idx ON public.agent_metrics USING btree (user_id, period);


--
-- Name: ai_cache_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_cache_user_id_idx ON public.ai_cache USING btree (user_id);


--
-- Name: attendees_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX attendees_user_id_idx ON public.attendees USING btree (user_id);


--
-- Name: captures_contact_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX captures_contact_idx ON public.captures USING btree (parsed_contact_id) WHERE (parsed_contact_id IS NOT NULL);


--
-- Name: captures_unprocessed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX captures_unprocessed_idx ON public.captures USING btree (user_id, processed) WHERE (processed = false);


--
-- Name: captures_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX captures_user_created_idx ON public.captures USING btree (user_id, created_at DESC);


--
-- Name: contacts_lender_partner_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contacts_lender_partner_id_idx ON public.contacts USING btree (lender_partner_id) WHERE (lender_partner_id IS NOT NULL);


--
-- Name: email_drafts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_drafts_user_id_idx ON public.email_drafts USING btree (user_id);


--
-- Name: email_log_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_log_campaign_idx ON public.email_log USING btree (user_id, campaign);


--
-- Name: email_log_contact_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_log_contact_idx ON public.email_log USING btree (contact_id);


--
-- Name: email_log_user_sent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_log_user_sent_idx ON public.email_log USING btree (user_id, sent_at DESC);


--
-- Name: emails_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX emails_user_id_idx ON public.emails USING btree (user_id);


--
-- Name: error_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX error_logs_user_id_idx ON public.error_logs USING btree (user_id);


--
-- Name: event_templates_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_templates_user_id_idx ON public.event_templates USING btree (user_id);


--
-- Name: events_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX events_user_id_idx ON public.events USING btree (user_id);


--
-- Name: idx_activities_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_contact ON public.activities USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_activities_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_created ON public.activities USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_activities_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_user ON public.activities USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_activity_events_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_actor ON public.activity_events USING btree (actor_id, occurred_at DESC);


--
-- Name: idx_activity_events_object; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_object ON public.activity_events USING btree (object_table, object_id, occurred_at DESC);


--
-- Name: idx_activity_events_user_occurred; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_user_occurred ON public.activity_events USING btree (user_id, occurred_at DESC);


--
-- Name: idx_ai_cache_feature_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_cache_feature_expires_at ON public.ai_cache USING btree (feature, expires_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_ai_usage_log_feature_occurred_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_usage_log_feature_occurred_at ON public.ai_usage_log USING btree (feature, occurred_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_ai_usage_log_occurred_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_usage_log_occurred_at ON public.ai_usage_log USING btree (occurred_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_api_usage_log_feature; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_usage_log_feature ON public.api_usage_log USING btree (feature_key, created_at DESC);


--
-- Name: idx_api_usage_log_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_usage_log_user_created ON public.api_usage_log USING btree (user_id, created_at DESC);


--
-- Name: idx_attendees_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendees_contact ON public.attendees USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_attendees_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendees_event ON public.attendees USING btree (event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_attendees_recorded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendees_recorded ON public.attendees USING btree (recorded_at) WHERE ((deleted_at IS NULL) AND (recorded_at IS NOT NULL));


--
-- Name: idx_campaign_enrollments_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_enrollments_campaign ON public.campaign_enrollments USING btree (campaign_id);


--
-- Name: idx_campaign_enrollments_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_enrollments_contact ON public.campaign_enrollments USING btree (contact_id);


--
-- Name: idx_campaign_enrollments_contact_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_enrollments_contact_active ON public.campaign_enrollments USING btree (contact_id) WHERE ((deleted_at IS NULL) AND (status = 'active'::text));


--
-- Name: idx_campaign_enrollments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_enrollments_user ON public.campaign_enrollments USING btree (user_id);


--
-- Name: idx_campaign_step_completions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_step_completions_user ON public.campaign_step_completions USING btree (user_id);


--
-- Name: idx_campaign_steps_active_with_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_steps_active_with_slug ON public.campaign_steps USING btree (campaign_id, step_number) WHERE ((deleted_at IS NULL) AND (template_slug IS NOT NULL));


--
-- Name: idx_campaign_steps_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_steps_campaign ON public.campaign_steps USING btree (campaign_id);


--
-- Name: idx_campaign_steps_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_steps_user ON public.campaign_steps USING btree (user_id);


--
-- Name: idx_campaigns_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_user ON public.campaigns USING btree (user_id);


--
-- Name: idx_captures_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_captures_source ON public.captures USING btree (source);


--
-- Name: idx_contacts_last_touch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_last_touch ON public.contacts USING btree (last_touchpoint) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_next_action_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_next_action_date ON public.contacts USING btree (next_followup) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_stage ON public.contacts USING btree (stage) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_temperature; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_temperature ON public.contacts USING btree (health_score DESC);


--
-- Name: idx_contacts_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_tier ON public.contacts USING btree (tier) WHERE (tier IS NOT NULL);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (type) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_user ON public.contacts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_design_assets_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_design_assets_contact ON public.design_assets USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_design_assets_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_design_assets_user ON public.design_assets USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_drafts_email_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drafts_email_id ON public.email_drafts USING btree (email_id);


--
-- Name: idx_drafts_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drafts_expires_at ON public.email_drafts USING btree (expires_at);


--
-- Name: idx_drafts_status_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drafts_status_recent ON public.email_drafts USING btree (status, created_at DESC);


--
-- Name: idx_emails_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_contact_id ON public.emails USING btree (contact_id);


--
-- Name: idx_emails_from_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_from_email ON public.emails USING btree (from_email);


--
-- Name: idx_emails_unread_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_unread_recent ON public.emails USING btree (is_unread, created_at DESC);


--
-- Name: idx_enrollments_next_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollments_next_action ON public.campaign_enrollments USING btree (next_action_at) WHERE ((deleted_at IS NULL) AND (status = 'active'::text));


--
-- Name: idx_error_logs_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_error_logs_recent ON public.error_logs USING btree (created_at DESC);


--
-- Name: idx_error_logs_unresolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_error_logs_unresolved ON public.error_logs USING btree (resolved, created_at DESC) WHERE (resolved = false);


--
-- Name: idx_event_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_event_templates_active ON public.event_templates USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_event_templates_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_event_templates_owner ON public.event_templates USING btree (owner_contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_events_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_contact ON public.events USING btree (contact_id) WHERE ((deleted_at IS NULL) AND (contact_id IS NOT NULL));


--
-- Name: idx_events_gcal_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_gcal_event_id ON public.events USING btree (gcal_event_id) WHERE (gcal_event_id IS NOT NULL);


--
-- Name: idx_events_occurrence_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_occurrence_status ON public.events USING btree (occurrence_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_events_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_project ON public.events USING btree (project_id) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_events_start_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_start_at ON public.events USING btree (start_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_events_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_template ON public.events USING btree (event_template_id) WHERE ((deleted_at IS NULL) AND (event_template_id IS NOT NULL));


--
-- Name: idx_events_today_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_today_window ON public.events USING btree (start_at, end_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_contact ON public.listings USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_mls; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_mls ON public.listings USING btree (mls_number) WHERE ((deleted_at IS NULL) AND (mls_number IS NOT NULL));


--
-- Name: idx_listings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_status ON public.listings USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_user ON public.listings USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_zip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_zip ON public.listings USING btree (zip) WHERE (deleted_at IS NULL);


--
-- Name: idx_message_events_log_received; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_events_log_received ON public.message_events USING btree (message_log_id, received_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_messages_log_status_live; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_log_status_live ON public.messages_log USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_messages_log_template_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_log_template_sent ON public.messages_log USING btree (template_id, sent_at DESC);


--
-- Name: idx_opportunities_close; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_close ON public.opportunities USING btree (expected_close_date) WHERE (stage = 'in_escrow'::public.opportunity_stage);


--
-- Name: idx_opportunities_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_contact ON public.opportunities USING btree (contact_id);


--
-- Name: idx_opportunities_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_stage ON public.opportunities USING btree (stage) WHERE (stage <> ALL (ARRAY['closed'::public.opportunity_stage, 'fell_through'::public.opportunity_stage]));


--
-- Name: idx_opportunities_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_user ON public.opportunities USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_project_touchpoints_due_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_touchpoints_due_at ON public.project_touchpoints USING btree (due_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_project_touchpoints_last_reminded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_touchpoints_last_reminded_at ON public.project_touchpoints USING btree (last_reminded_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_owner ON public.projects USING btree (owner_contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_status_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_status_active ON public.projects USING btree (status, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_type ON public.projects USING btree (type) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_partners_category ON public.referral_partners USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_trust; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_partners_trust ON public.referral_partners USING btree (trust_level DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_partners_user ON public.referral_partners USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_category ON public.resources USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_tags ON public.resources USING gin (tags) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_user ON public.resources USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_rhs_computed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rhs_computed_at ON public.relationship_health_scores USING btree (computed_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_rhs_score_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rhs_score_desc ON public.relationship_health_scores USING btree (score DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_step_completions_enrollment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_step_completions_enrollment ON public.campaign_step_completions USING btree (enrollment_id);


--
-- Name: idx_step_completions_step; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_step_completions_step ON public.campaign_step_completions USING btree (step_id);


--
-- Name: idx_tasks_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_contact ON public.tasks USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date) WHERE ((deleted_at IS NULL) AND (status = 'open'::text));


--
-- Name: idx_tasks_linked_interaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_linked_interaction_id ON public.tasks USING btree (linked_interaction_id) WHERE (linked_interaction_id IS NOT NULL);


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_type ON public.tasks USING btree (type) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_user ON public.tasks USING btree (user_id);


--
-- Name: idx_templates_slug_live; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_slug_live ON public.templates USING btree (slug, version DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_templates_slug_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_templates_slug_version ON public.templates USING btree (slug, version);


--
-- Name: idx_ticket_items_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_items_ticket ON public.ticket_items USING btree (request_id);


--
-- Name: idx_tickets_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_contact ON public.tickets USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_tickets_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_source ON public.tickets USING btree (source) WHERE (deleted_at IS NULL);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (user_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_tickets_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_user ON public.tickets USING btree (user_id);


--
-- Name: idx_touchpoints_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_touchpoints_entity ON public.project_touchpoints USING btree (entity_table, entity_id);


--
-- Name: idx_touchpoints_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_touchpoints_project ON public.project_touchpoints USING btree (project_id, occurred_at DESC NULLS LAST);


--
-- Name: idx_touchpoints_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_touchpoints_type ON public.project_touchpoints USING btree (touchpoint_type);


--
-- Name: inbox_items_user_status_received_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inbox_items_user_status_received_idx ON public.inbox_items USING btree (user_id, status, received_at DESC) WHERE (dismissed_at IS NULL);


--
-- Name: message_events_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_events_user_id_idx ON public.message_events USING btree (user_id);


--
-- Name: messages_log_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX messages_log_user_id_idx ON public.messages_log USING btree (user_id);


--
-- Name: morning_briefs_brief_date_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX morning_briefs_brief_date_unique ON public.morning_briefs USING btree (brief_date) WHERE (deleted_at IS NULL);


--
-- Name: morning_briefs_generated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX morning_briefs_generated_at_idx ON public.morning_briefs USING btree (generated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: morning_briefs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX morning_briefs_user_id_idx ON public.morning_briefs USING btree (user_id);


--
-- Name: projects_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_user_id_idx ON public.projects USING btree (user_id);


--
-- Name: rate_limits_window_start_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rate_limits_window_start_idx ON public.rate_limits USING btree (window_start);


--
-- Name: relationship_health_config_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX relationship_health_config_user_id_idx ON public.relationship_health_config USING btree (user_id);


--
-- Name: relationship_health_scores_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX relationship_health_scores_user_id_idx ON public.relationship_health_scores USING btree (user_id);


--
-- Name: relationship_health_touchpoint_weights_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX relationship_health_touchpoint_weights_user_id_idx ON public.relationship_health_touchpoint_weights USING btree (user_id);


--
-- Name: templates_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX templates_user_id_idx ON public.templates USING btree (user_id);


--
-- Name: accounts accounts_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agent_metrics agent_metrics_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER agent_metrics_set_updated_at BEFORE UPDATE ON public.agent_metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts contacts_rep_pulse_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER contacts_rep_pulse_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_rep_pulse_updated_at();


--
-- Name: design_assets design_assets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER design_assets_updated_at BEFORE UPDATE ON public.design_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: email_log email_log_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER email_log_set_updated_at BEFORE UPDATE ON public.email_log FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tickets material_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER material_requests_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: message_events message_events_status_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER message_events_status_sync AFTER INSERT ON public.message_events FOR EACH ROW EXECUTE FUNCTION public.update_message_log_status();


--
-- Name: opportunities opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: campaign_enrollments set_campaign_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_campaign_enrollments_updated_at BEFORE UPDATE ON public.campaign_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_step_completions set_campaign_step_completions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_campaign_step_completions_updated_at BEFORE UPDATE ON public.campaign_step_completions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_steps set_campaign_steps_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_campaign_steps_updated_at BEFORE UPDATE ON public.campaign_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaigns set_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: captures set_captures_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_captures_updated_at BEFORE UPDATE ON public.captures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: listings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: referral_partners set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.referral_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: resources set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tasks set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendees trg_attendees_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_attendees_updated_at BEFORE UPDATE ON public.attendees FOR EACH ROW EXECUTE FUNCTION public.set_attendees_updated_at();


--
-- Name: email_drafts trg_email_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_email_drafts_updated_at BEFORE UPDATE ON public.email_drafts FOR EACH ROW EXECUTE FUNCTION public.set_email_drafts_updated_at();


--
-- Name: event_templates trg_event_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_event_templates_updated_at BEFORE UPDATE ON public.event_templates FOR EACH ROW EXECUTE FUNCTION public.set_event_templates_updated_at();


--
-- Name: events trg_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_events_updated_at();


--
-- Name: projects trg_projects_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_projects_updated_at();


--
-- Name: templates trg_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_templates_updated_at();


--
-- Name: project_touchpoints trg_touchpoint_recompute_health; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_touchpoint_recompute_health AFTER INSERT OR DELETE OR UPDATE ON public.project_touchpoints FOR EACH ROW EXECUTE FUNCTION public.recompute_relationship_health_on_touchpoint();


--
-- Name: accounts accounts_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: activities activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_metrics agent_metrics_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: agent_metrics agent_metrics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_cache ai_cache_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_cache
    ADD CONSTRAINT ai_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: attendees attendees_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: attendees attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: attendees attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: campaign_enrollments campaign_enrollments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_enrollments campaign_enrollments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_enrollments campaign_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.campaign_steps(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_steps campaign_steps_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_steps campaign_steps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: captures captures_parsed_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_parsed_contact_id_fkey FOREIGN KEY (parsed_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: captures captures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_lender_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_lender_partner_id_fkey FOREIGN KEY (lender_partner_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: design_assets design_assets_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: design_assets design_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_drafts email_drafts_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE CASCADE;


--
-- Name: email_drafts email_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: email_log email_log_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: email_log email_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: emails emails_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: error_logs error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: event_templates event_templates_owner_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_templates
    ADD CONSTRAINT event_templates_owner_contact_id_fkey FOREIGN KEY (owner_contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: event_templates event_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_templates
    ADD CONSTRAINT event_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: events events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: events events_event_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_event_template_id_fkey FOREIGN KEY (event_template_id) REFERENCES public.event_templates(id) ON DELETE SET NULL;


--
-- Name: events events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: inbox_items inbox_items_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: inbox_items inbox_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: listings listings_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: listings listings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tickets material_requests_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT material_requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: tickets material_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT material_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_events message_events_message_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_events
    ADD CONSTRAINT message_events_message_log_id_fkey FOREIGN KEY (message_log_id) REFERENCES public.messages_log(id) ON DELETE CASCADE;


--
-- Name: message_events message_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_events
    ADD CONSTRAINT message_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: messages_log messages_log_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages_log
    ADD CONSTRAINT messages_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE RESTRICT;


--
-- Name: messages_log messages_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages_log
    ADD CONSTRAINT messages_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: morning_briefs morning_briefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.morning_briefs
    ADD CONSTRAINT morning_briefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: opportunities opportunities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_touchpoints project_touchpoints_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_touchpoints
    ADD CONSTRAINT project_touchpoints_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_touchpoints project_touchpoints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_touchpoints
    ADD CONSTRAINT project_touchpoints_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: projects projects_owner_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_contact_id_fkey FOREIGN KEY (owner_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: referral_partners referral_partners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: relationship_health_config relationship_health_config_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_config
    ADD CONSTRAINT relationship_health_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: relationship_health_scores relationship_health_scores_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_scores
    ADD CONSTRAINT relationship_health_scores_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: relationship_health_scores relationship_health_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_scores
    ADD CONSTRAINT relationship_health_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: relationship_health_touchpoint_weights relationship_health_touchpoint_weights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationship_health_touchpoint_weights
    ADD CONSTRAINT relationship_health_touchpoint_weights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: resources resources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_linked_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_linked_interaction_id_fkey FOREIGN KEY (linked_interaction_id) REFERENCES public.activity_events(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_items ticket_items_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_ticket_id_fkey FOREIGN KEY (request_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets Allow anonymous intake inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous intake inserts" ON public.tickets FOR INSERT WITH CHECK ((source = 'intake'::text));


--
-- Name: ticket_items Allow anonymous intake item inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous intake item inserts" ON public.ticket_items FOR INSERT WITH CHECK ((request_id IN ( SELECT tickets.id
   FROM public.tickets
  WHERE (tickets.source = 'intake'::text))));


--
-- Name: activities Users manage own activities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own activities" ON public.activities TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: agent_metrics Users manage own agent_metrics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own agent_metrics" ON public.agent_metrics TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: api_usage_log Users manage own api_usage_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own api_usage_log" ON public.api_usage_log USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: campaign_enrollments Users manage own campaign_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own campaign_enrollments" ON public.campaign_enrollments TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_step_completions Users manage own campaign_step_completions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own campaign_step_completions" ON public.campaign_step_completions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_steps Users manage own campaign_steps; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own campaign_steps" ON public.campaign_steps TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaigns Users manage own campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own campaigns" ON public.campaigns TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: captures Users manage own captures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own captures" ON public.captures TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: contacts Users manage own contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own contacts" ON public.contacts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: design_assets Users manage own design assets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own design assets" ON public.design_assets USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: email_log Users manage own email_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own email_log" ON public.email_log TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: listings Users manage own listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own listings" ON public.listings TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: opportunities Users manage own opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own opportunities" ON public.opportunities USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: referral_partners Users manage own referral_partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own referral_partners" ON public.referral_partners TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: resources Users manage own resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own resources" ON public.resources TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: tasks Users manage own tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own tasks" ON public.tasks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: ticket_items Users manage own ticket items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own ticket items" ON public.ticket_items USING ((request_id IN ( SELECT tickets.id
   FROM public.tickets
  WHERE (tickets.user_id = auth.uid())))) WITH CHECK ((request_id IN ( SELECT tickets.id
   FROM public.tickets
  WHERE (tickets.user_id = auth.uid()))));


--
-- Name: tickets Users manage own tickets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own tickets" ON public.tickets USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts accounts_owner_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY accounts_owner_delete ON public.accounts FOR DELETE TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: POLICY accounts_owner_delete ON accounts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY accounts_owner_delete ON public.accounts IS 'Slice 7A: owner deletes own account row. Soft delete preferred (set deleted_at).';


--
-- Name: accounts accounts_owner_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY accounts_owner_select ON public.accounts FOR SELECT TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: POLICY accounts_owner_select ON accounts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY accounts_owner_select ON public.accounts IS 'Slice 7A: owner reads own account row. Columns: id, name, slug, owner_user_id, created_at, updated_at, deleted_at.';


--
-- Name: accounts accounts_owner_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY accounts_owner_update ON public.accounts FOR UPDATE TO authenticated USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: POLICY accounts_owner_update ON accounts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY accounts_owner_update ON public.accounts IS 'Slice 7A: owner updates own account row. Columns: name, slug, owner_user_id, deleted_at.';


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_cache ai_cache_user_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ai_cache_user_isolation ON public.ai_cache TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: POLICY ai_cache_user_isolation ON ai_cache; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY ai_cache_user_isolation ON public.ai_cache IS 'Slice 7A: replaces email-based alex_ai_cache_all; column user_id checked against auth.uid().';


--
-- Name: ai_usage_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_log alex_ai_usage_log_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_ai_usage_log_all ON public.ai_usage_log USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: attendees alex_attendees_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_attendees_all ON public.attendees TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: email_drafts alex_drafts_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_drafts_all ON public.email_drafts TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: emails alex_emails_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_emails_all ON public.emails TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: error_logs alex_error_logs_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_error_logs_all ON public.error_logs TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: event_templates alex_event_templates_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_event_templates_all ON public.event_templates TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: events alex_events_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_events_all ON public.events TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: message_events alex_message_events_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_message_events_all ON public.message_events USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: messages_log alex_messages_log_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_messages_log_all ON public.messages_log TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: morning_briefs alex_morning_briefs_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_morning_briefs_all ON public.morning_briefs TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: oauth_tokens alex_oauth_tokens_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_oauth_tokens_all ON public.oauth_tokens TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: projects alex_projects_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_projects_all ON public.projects TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: templates alex_templates_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_templates_all ON public.templates TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: project_touchpoints alex_touchpoints_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alex_touchpoints_all ON public.project_touchpoints TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: api_usage_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: attendees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_enrollments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_step_completions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_step_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_steps; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: captures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: design_assets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: email_drafts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: emails; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

--
-- Name: error_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: event_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_items inbox_items_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inbox_items_owner ON public.inbox_items USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: message_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

--
-- Name: morning_briefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.morning_briefs ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_events owner_read_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY owner_read_write ON public.activity_events USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: project_touchpoints; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_touchpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits rate_limits_deny_anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limits_deny_anon ON public.rate_limits TO anon USING (false) WITH CHECK (false);


--
-- Name: rate_limits rate_limits_deny_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limits_deny_authenticated ON public.rate_limits TO authenticated USING (false) WITH CHECK (false);


--
-- Name: referral_partners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship_health_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.relationship_health_config ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship_health_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.relationship_health_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship_health_touchpoint_weights; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.relationship_health_touchpoint_weights ENABLE ROW LEVEL SECURITY;

--
-- Name: resources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship_health_config rhc_alex_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhc_alex_read ON public.relationship_health_config FOR SELECT USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: relationship_health_config rhc_alex_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhc_alex_write ON public.relationship_health_config USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: relationship_health_scores rhs_alex_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhs_alex_read ON public.relationship_health_scores FOR SELECT USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: relationship_health_scores rhs_alex_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhs_alex_write ON public.relationship_health_scores USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: relationship_health_touchpoint_weights rhw_alex_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhw_alex_read ON public.relationship_health_touchpoint_weights FOR SELECT USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: relationship_health_touchpoint_weights rhw_alex_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rhw_alex_write ON public.relationship_health_touchpoint_weights USING (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'alex@alexhollienco.com'::text));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TYPE email_draft_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.email_draft_status TO authenticated;
GRANT ALL ON TYPE public.email_draft_status TO service_role;


--
-- Name: TYPE event_occurrence_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.event_occurrence_status TO authenticated;
GRANT ALL ON TYPE public.event_occurrence_status TO service_role;


--
-- Name: TYPE event_source; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.event_source TO authenticated;
GRANT ALL ON TYPE public.event_source TO service_role;


--
-- Name: TYPE message_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.message_status TO authenticated;
GRANT ALL ON TYPE public.message_status TO service_role;


--
-- Name: TYPE project_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.project_status TO authenticated;
GRANT ALL ON TYPE public.project_status TO service_role;


--
-- Name: TYPE project_touchpoint_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.project_touchpoint_type TO authenticated;
GRANT ALL ON TYPE public.project_touchpoint_type TO service_role;


--
-- Name: TYPE project_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.project_type TO authenticated;
GRANT ALL ON TYPE public.project_type TO service_role;


--
-- Name: TYPE template_kind; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.template_kind TO authenticated;
GRANT ALL ON TYPE public.template_kind TO service_role;


--
-- Name: TYPE template_send_mode; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.template_send_mode TO authenticated;
GRANT ALL ON TYPE public.template_send_mode TO service_role;


--
-- Name: FUNCTION compute_relationship_health_score(p_contact_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.compute_relationship_health_score(p_contact_id uuid) TO anon;
GRANT ALL ON FUNCTION public.compute_relationship_health_score(p_contact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.compute_relationship_health_score(p_contact_id uuid) TO service_role;


--
-- Name: FUNCTION current_day_ai_spend_usd(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_day_ai_spend_usd() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_day_ai_spend_usd() TO anon;
GRANT ALL ON FUNCTION public.current_day_ai_spend_usd() TO authenticated;
GRANT ALL ON FUNCTION public.current_day_ai_spend_usd() TO service_role;


--
-- Name: FUNCTION increment_rate_limit(p_key text, p_window_start timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.increment_rate_limit(p_key text, p_window_start timestamp with time zone) TO service_role;


--
-- Name: FUNCTION recompute_all_relationship_health_scores(p_batch_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer) TO anon;
GRANT ALL ON FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.recompute_all_relationship_health_scores(p_batch_limit integer) TO service_role;


--
-- Name: FUNCTION recompute_relationship_health_on_touchpoint(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recompute_relationship_health_on_touchpoint() TO anon;
GRANT ALL ON FUNCTION public.recompute_relationship_health_on_touchpoint() TO authenticated;
GRANT ALL ON FUNCTION public.recompute_relationship_health_on_touchpoint() TO service_role;


--
-- Name: FUNCTION refresh_agent_relationship_health(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_agent_relationship_health() TO anon;
GRANT ALL ON FUNCTION public.refresh_agent_relationship_health() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_agent_relationship_health() TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION set_attendees_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_attendees_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_attendees_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_attendees_updated_at() TO service_role;


--
-- Name: FUNCTION set_email_drafts_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_email_drafts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_email_drafts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_email_drafts_updated_at() TO service_role;


--
-- Name: FUNCTION set_event_templates_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_event_templates_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_event_templates_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_event_templates_updated_at() TO service_role;


--
-- Name: FUNCTION set_events_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_events_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_events_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_events_updated_at() TO service_role;


--
-- Name: FUNCTION set_projects_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_projects_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_projects_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_projects_updated_at() TO service_role;


--
-- Name: FUNCTION set_templates_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_templates_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_templates_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_templates_updated_at() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION spine_touch_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spine_touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.spine_touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.spine_touch_updated_at() TO service_role;


--
-- Name: FUNCTION spine_update_cycle_on_interaction(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spine_update_cycle_on_interaction() TO anon;
GRANT ALL ON FUNCTION public.spine_update_cycle_on_interaction() TO authenticated;
GRANT ALL ON FUNCTION public.spine_update_cycle_on_interaction() TO service_role;


--
-- Name: FUNCTION touch_rep_pulse_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.touch_rep_pulse_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_rep_pulse_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_rep_pulse_updated_at() TO service_role;


--
-- Name: FUNCTION update_message_log_status(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_message_log_status() TO anon;
GRANT ALL ON FUNCTION public.update_message_log_status() TO authenticated;
GRANT ALL ON FUNCTION public.update_message_log_status() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: FUNCTION upsert_relationship_health_score(p_contact_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) TO anon;
GRANT ALL ON FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_relationship_health_score(p_contact_id uuid) TO service_role;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT ALL ON TABLE public.accounts TO service_role;


--
-- Name: TABLE activities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activities TO anon;
GRANT ALL ON TABLE public.activities TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;


--
-- Name: TABLE activity_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_events TO anon;
GRANT ALL ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;


--
-- Name: TABLE agent_metrics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_metrics TO anon;
GRANT ALL ON TABLE public.agent_metrics TO authenticated;
GRANT ALL ON TABLE public.agent_metrics TO service_role;


--
-- Name: TABLE ai_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_cache TO anon;
GRANT ALL ON TABLE public.ai_cache TO authenticated;
GRANT ALL ON TABLE public.ai_cache TO service_role;


--
-- Name: TABLE ai_usage_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_usage_log TO anon;
GRANT ALL ON TABLE public.ai_usage_log TO authenticated;
GRANT ALL ON TABLE public.ai_usage_log TO service_role;


--
-- Name: TABLE api_usage_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_usage_log TO anon;
GRANT ALL ON TABLE public.api_usage_log TO authenticated;
GRANT ALL ON TABLE public.api_usage_log TO service_role;


--
-- Name: TABLE attendees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attendees TO anon;
GRANT ALL ON TABLE public.attendees TO authenticated;
GRANT ALL ON TABLE public.attendees TO service_role;


--
-- Name: TABLE campaign_enrollments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaign_enrollments TO anon;
GRANT ALL ON TABLE public.campaign_enrollments TO authenticated;
GRANT ALL ON TABLE public.campaign_enrollments TO service_role;


--
-- Name: TABLE campaign_step_completions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaign_step_completions TO anon;
GRANT ALL ON TABLE public.campaign_step_completions TO authenticated;
GRANT ALL ON TABLE public.campaign_step_completions TO service_role;


--
-- Name: TABLE campaign_steps; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaign_steps TO anon;
GRANT ALL ON TABLE public.campaign_steps TO authenticated;
GRANT ALL ON TABLE public.campaign_steps TO service_role;


--
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaigns TO anon;
GRANT ALL ON TABLE public.campaigns TO authenticated;
GRANT ALL ON TABLE public.campaigns TO service_role;


--
-- Name: TABLE captures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.captures TO anon;
GRANT ALL ON TABLE public.captures TO authenticated;
GRANT ALL ON TABLE public.captures TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE contacts_spec_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contacts_spec_view TO anon;
GRANT ALL ON TABLE public.contacts_spec_view TO authenticated;
GRANT ALL ON TABLE public.contacts_spec_view TO service_role;


--
-- Name: TABLE design_assets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.design_assets TO anon;
GRANT ALL ON TABLE public.design_assets TO authenticated;
GRANT ALL ON TABLE public.design_assets TO service_role;


--
-- Name: TABLE email_drafts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_drafts TO anon;
GRANT ALL ON TABLE public.email_drafts TO authenticated;
GRANT ALL ON TABLE public.email_drafts TO service_role;


--
-- Name: TABLE emails; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.emails TO anon;
GRANT ALL ON TABLE public.emails TO authenticated;
GRANT ALL ON TABLE public.emails TO service_role;


--
-- Name: TABLE email_drafts_observation; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_drafts_observation TO anon;
GRANT ALL ON TABLE public.email_drafts_observation TO authenticated;
GRANT ALL ON TABLE public.email_drafts_observation TO service_role;


--
-- Name: TABLE email_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_log TO anon;
GRANT ALL ON TABLE public.email_log TO authenticated;
GRANT ALL ON TABLE public.email_log TO service_role;


--
-- Name: TABLE error_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.error_logs TO anon;
GRANT ALL ON TABLE public.error_logs TO authenticated;
GRANT ALL ON TABLE public.error_logs TO service_role;


--
-- Name: TABLE event_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_templates TO anon;
GRANT ALL ON TABLE public.event_templates TO authenticated;
GRANT ALL ON TABLE public.event_templates TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE inbox_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inbox_items TO anon;
GRANT ALL ON TABLE public.inbox_items TO authenticated;
GRANT ALL ON TABLE public.inbox_items TO service_role;


--
-- Name: TABLE interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.interactions TO anon;
GRANT ALL ON TABLE public.interactions TO authenticated;
GRANT ALL ON TABLE public.interactions TO service_role;


--
-- Name: TABLE listings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listings TO anon;
GRANT ALL ON TABLE public.listings TO authenticated;
GRANT ALL ON TABLE public.listings TO service_role;


--
-- Name: TABLE message_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_events TO anon;
GRANT ALL ON TABLE public.message_events TO authenticated;
GRANT ALL ON TABLE public.message_events TO service_role;


--
-- Name: TABLE messages_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages_log TO anon;
GRANT ALL ON TABLE public.messages_log TO authenticated;
GRANT ALL ON TABLE public.messages_log TO service_role;


--
-- Name: TABLE morning_briefs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.morning_briefs TO anon;
GRANT ALL ON TABLE public.morning_briefs TO authenticated;
GRANT ALL ON TABLE public.morning_briefs TO service_role;


--
-- Name: TABLE oauth_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.oauth_tokens TO anon;
GRANT ALL ON TABLE public.oauth_tokens TO authenticated;
GRANT ALL ON TABLE public.oauth_tokens TO service_role;


--
-- Name: TABLE opportunities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.opportunities TO anon;
GRANT ALL ON TABLE public.opportunities TO authenticated;
GRANT ALL ON TABLE public.opportunities TO service_role;


--
-- Name: TABLE project_touchpoints; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_touchpoints TO anon;
GRANT ALL ON TABLE public.project_touchpoints TO authenticated;
GRANT ALL ON TABLE public.project_touchpoints TO service_role;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE referral_partners; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.referral_partners TO anon;
GRANT ALL ON TABLE public.referral_partners TO authenticated;
GRANT ALL ON TABLE public.referral_partners TO service_role;


--
-- Name: TABLE relationship_health_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.relationship_health_config TO anon;
GRANT ALL ON TABLE public.relationship_health_config TO authenticated;
GRANT ALL ON TABLE public.relationship_health_config TO service_role;


--
-- Name: TABLE relationship_health_scores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.relationship_health_scores TO anon;
GRANT ALL ON TABLE public.relationship_health_scores TO authenticated;
GRANT ALL ON TABLE public.relationship_health_scores TO service_role;


--
-- Name: TABLE relationship_health_touchpoint_weights; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.relationship_health_touchpoint_weights TO anon;
GRANT ALL ON TABLE public.relationship_health_touchpoint_weights TO authenticated;
GRANT ALL ON TABLE public.relationship_health_touchpoint_weights TO service_role;


--
-- Name: TABLE resources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resources TO anon;
GRANT ALL ON TABLE public.resources TO authenticated;
GRANT ALL ON TABLE public.resources TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: TABLE templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.templates TO anon;
GRANT ALL ON TABLE public.templates TO authenticated;
GRANT ALL ON TABLE public.templates TO service_role;


--
-- Name: TABLE ticket_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_items TO anon;
GRANT ALL ON TABLE public.ticket_items TO authenticated;
GRANT ALL ON TABLE public.ticket_items TO service_role;


--
-- Name: TABLE tickets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tickets TO anon;
GRANT ALL ON TABLE public.tickets TO authenticated;
GRANT ALL ON TABLE public.tickets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict aEMe5ULBgGfqgjf1QaFhr2ynJfX3p8RwVgzBGHRR5guGZSYD9TUjh52cPcVqKKZ

