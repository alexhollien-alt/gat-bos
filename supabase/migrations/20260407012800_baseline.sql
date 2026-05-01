--
-- PostgreSQL database dump
--


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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: deal_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deal_stage AS ENUM (
    'under_contract',
    'in_escrow',
    'clear_to_close',
    'closed',
    'fell_through'
);


--
-- Name: design_asset_type; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: follow_up_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_up_status AS ENUM (
    'pending',
    'completed',
    'snoozed',
    'cancelled'
);


--
-- Name: interaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_type AS ENUM (
    'call',
    'text',
    'email',
    'meeting',
    'broker_open',
    'lunch',
    'note'
);


--
-- Name: material_request_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_request_priority AS ENUM (
    'standard',
    'rush'
);


--
-- Name: material_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_request_status AS ENUM (
    'draft',
    'submitted',
    'in_production',
    'complete'
);


--
-- Name: material_request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_request_type AS ENUM (
    'print_ready',
    'design_help',
    'template_request'
);


--
-- Name: opportunity_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.opportunity_stage AS ENUM (
    'prospect',
    'under_contract',
    'in_escrow',
    'closed',
    'fell_through'
);


--
-- Name: product_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_type AS ENUM (
    'flyer',
    'brochure',
    'door_hanger',
    'eddm',
    'postcard',
    'other'
);


--
-- Name: refresh_agent_relationship_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_agent_relationship_health() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_relationship_health;
  RETURN NULL;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: touch_rep_pulse_updated_at(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    type text NOT NULL,
    brokerage text,
    title text,
    license_number text,
    stage text DEFAULT 'new'::text NOT NULL,
    source text,
    tags text[] DEFAULT '{}'::text[],
    last_touch_date timestamp with time zone,
    next_action text,
    next_action_date timestamp with time zone,
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
    CONSTRAINT contacts_rep_pulse_check CHECK (((rep_pulse >= 1) AND (rep_pulse <= 10))),
    CONSTRAINT contacts_stage_check CHECK ((stage = ANY (ARRAY['new'::text, 'warm'::text, 'active_partner'::text, 'advocate'::text, 'dormant'::text]))),
    CONSTRAINT contacts_temperature_check CHECK (((health_score >= 0) AND (health_score <= 100))),
    CONSTRAINT contacts_tier_check CHECK ((tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'P'::text]))),
    CONSTRAINT contacts_type_check CHECK ((type = ANY (ARRAY['realtor'::text, 'lender'::text, 'builder'::text, 'vendor'::text, 'buyer'::text, 'seller'::text, 'past_client'::text, 'warm_lead'::text, 'referral_partner'::text, 'sphere'::text, 'other'::text])))
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    opportunity_id uuid,
    contact_id uuid NOT NULL,
    property_address text NOT NULL,
    property_city text,
    property_state text DEFAULT 'AZ'::text,
    property_zip text,
    buyer_name text,
    seller_name text,
    sale_price numeric(12,2),
    earnest_money numeric(12,2),
    commission_rate numeric(5,4),
    escrow_number text,
    escrow_company text,
    escrow_officer text,
    title_company text DEFAULT 'Great American Title Agency'::text,
    lender_name text,
    lender_partner_id uuid,
    stage public.deal_stage DEFAULT 'under_contract'::public.deal_stage,
    contract_date date,
    escrow_open_date date,
    scheduled_close_date date,
    actual_close_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    type public.interaction_type NOT NULL,
    summary text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    direction text,
    duration_minutes integer,
    CONSTRAINT interactions_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: agent_relationship_health; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.agent_relationship_health AS
 WITH interaction_stats AS (
         SELECT interactions.contact_id,
            count(*) AS total_interactions,
            count(*) FILTER (WHERE (interactions.occurred_at >= (now() - '30 days'::interval))) AS interactions_30d,
            count(*) FILTER (WHERE (interactions.occurred_at >= (now() - '90 days'::interval))) AS interactions_90d,
            count(*) FILTER (WHERE ((interactions.occurred_at >= (now() - '90 days'::interval)) AND (interactions.direction = 'inbound'::text))) AS inbound_90d,
            max(interactions.occurred_at) AS last_contact_at
           FROM public.interactions
          GROUP BY interactions.contact_id
        ), deal_stats AS (
         SELECT deals.contact_id,
            count(*) FILTER (WHERE ((deals.stage = 'closed'::public.deal_stage) AND (deals.actual_close_date >= (now() - '90 days'::interval)))) AS deals_closed_90d,
            count(*) FILTER (WHERE ((deals.stage = 'closed'::public.deal_stage) AND (deals.actual_close_date >= (now() - '180 days'::interval)) AND (deals.actual_close_date < (now() - '90 days'::interval)))) AS deals_closed_prev_90d,
            count(*) FILTER (WHERE (deals.stage = ANY (ARRAY['under_contract'::public.deal_stage, 'in_escrow'::public.deal_stage, 'clear_to_close'::public.deal_stage]))) AS active_deals
           FROM public.deals
          WHERE (deals.deleted_at IS NULL)
          GROUP BY deals.contact_id
        ), component_scores AS (
         SELECT c.id AS contact_id,
            c.user_id,
            COALESCE((EXTRACT(day FROM (now() - i.last_contact_at)))::integer, 999) AS days_since_contact,
            i.last_contact_at,
            COALESCE(i.total_interactions, (0)::bigint) AS total_interactions,
            COALESCE(i.interactions_30d, (0)::bigint) AS interactions_30d,
            COALESCE(i.interactions_90d, (0)::bigint) AS interactions_90d,
            COALESCE(i.inbound_90d, (0)::bigint) AS inbound_90d,
            COALESCE(d.deals_closed_90d, (0)::bigint) AS deals_closed_90d,
            COALESCE(d.deals_closed_prev_90d, (0)::bigint) AS deals_closed_prev_90d,
            COALESCE(d.active_deals, (0)::bigint) AS active_deals,
            (GREATEST((0)::numeric, LEAST((100)::numeric, ((100)::numeric - ((GREATEST(0, (COALESCE((EXTRACT(day FROM (now() - i.last_contact_at)))::integer, 999) - 7)))::numeric * (100.0 / 53.0))))))::integer AS recency_score,
            (
                CASE
                    WHEN ((COALESCE(d.deals_closed_prev_90d, (0)::bigint) = 0) AND (COALESCE(d.deals_closed_90d, (0)::bigint) > 0)) THEN (100)::bigint
                    WHEN (COALESCE(d.deals_closed_prev_90d, (0)::bigint) = 0) THEN (50)::bigint
                    ELSE GREATEST((0)::bigint, LEAST((100)::bigint, (50 + (((COALESCE(d.deals_closed_90d, (0)::bigint) - d.deals_closed_prev_90d) * 100) / d.deals_closed_prev_90d))))
                END)::integer AS deal_trend_score,
            (LEAST((100)::bigint, (COALESCE(i.interactions_30d, (0)::bigint) * 10)))::integer AS frequency_score,
            (
                CASE
                    WHEN (COALESCE(i.interactions_90d, (0)::bigint) = 0) THEN (0)::bigint
                    ELSE ((COALESCE(i.inbound_90d, (0)::bigint) * 100) / i.interactions_90d)
                END)::integer AS responsiveness_score
           FROM ((public.contacts c
             LEFT JOIN interaction_stats i ON ((i.contact_id = c.id)))
             LEFT JOIN deal_stats d ON ((d.contact_id = c.id)))
          WHERE (c.deleted_at IS NULL)
        )
 SELECT contact_id,
    user_id,
    days_since_contact,
    last_contact_at,
    recency_score,
    deal_trend_score,
    frequency_score,
    responsiveness_score,
    (GREATEST((0)::numeric, LEAST((100)::numeric, round((((((recency_score)::numeric * 0.40) + ((deal_trend_score)::numeric * 0.30)) + ((frequency_score)::numeric * 0.20)) + ((responsiveness_score)::numeric * 0.10))))))::integer AS computed_health_score,
        CASE
            WHEN (deals_closed_90d > deals_closed_prev_90d) THEN 'up'::text
            WHEN (deals_closed_90d < deals_closed_prev_90d) THEN 'down'::text
            ELSE 'flat'::text
        END AS trend_direction,
    total_interactions,
    interactions_30d,
    deals_closed_90d,
    active_deals,
    now() AS computed_at
   FROM component_scores
  WITH NO DATA;


--
-- Name: agent_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agent_health WITH (security_invoker='true') AS
 SELECT c.id AS contact_id,
    c.user_id,
    COALESCE(NULLIF(c.health_score, 0), arh.computed_health_score, 0) AS health_score,
        CASE
            WHEN ((c.health_score IS NOT NULL) AND (c.health_score > 0)) THEN 'manual'::text
            WHEN (arh.computed_health_score IS NOT NULL) THEN 'computed'::text
            ELSE 'none'::text
        END AS health_score_source,
    arh.computed_health_score,
    arh.recency_score,
    arh.deal_trend_score,
    arh.frequency_score,
    arh.responsiveness_score,
    arh.trend_direction,
    arh.days_since_contact,
    arh.last_contact_at,
    arh.total_interactions,
    arh.interactions_30d,
    arh.deals_closed_90d,
    arh.active_deals,
    arh.computed_at AS health_computed_at
   FROM (public.contacts c
     LEFT JOIN public.agent_relationship_health arh ON ((arh.contact_id = c.id)))
  WHERE (c.deleted_at IS NULL);


--
-- Name: campaign_enrollments; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT campaign_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'removed'::text])))
);


--
-- Name: campaign_step_completions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: campaign_steps; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT campaign_steps_awareness_level_check CHECK ((awareness_level = ANY (ARRAY['unaware'::text, 'problem_aware'::text, 'solution_aware'::text, 'product_aware'::text, 'most_aware'::text]))),
    CONSTRAINT campaign_steps_step_goal_check CHECK ((step_goal = ANY (ARRAY['hook'::text, 'problem'::text, 'agitate'::text, 'credibility'::text, 'solution'::text, 'proof'::text, 'objections'::text, 'offer'::text, 'urgency'::text, 'cta'::text]))),
    CONSTRAINT campaign_steps_step_type_check CHECK ((step_type = ANY (ARRAY['email'::text, 'call'::text, 'text'::text, 'mail'::text, 'social'::text, 'task'::text])))
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: design_assets; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    reason text NOT NULL,
    due_date date NOT NULL,
    status public.follow_up_status DEFAULT 'pending'::public.follow_up_status NOT NULL,
    priority text DEFAULT 'medium'::text,
    snoozed_until timestamp with time zone,
    completed_at timestamp with time zone,
    completed_via_interaction_id uuid,
    created_via text DEFAULT 'manual'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT follow_ups_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: intake_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    raw_input text NOT NULL,
    parsed_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    target_table text,
    target_id uuid,
    error_message text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT intake_queue_source_check CHECK ((source = ANY (ARRAY['voice_dump'::text, 'meeting_note'::text, 'listing_intake'::text, 'email_parse'::text, 'manual'::text]))),
    CONSTRAINT intake_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'needs_review'::text])))
);


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: material_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_request_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    product_type public.product_type DEFAULT 'flyer'::public.product_type NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    design_url text,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: material_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_requests (
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


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
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
    deleted_at timestamp with time zone
);


--
-- Name: referral_partners; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    property_address text,
    internal_notes text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    listing_id uuid,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'waiting_on_agent'::text, 'complete'::text, 'cancelled'::text]))),
    CONSTRAINT requests_type_check CHECK ((type = ANY (ARRAY['open_house_kit'::text, 'just_listed_postcard'::text, 'just_sold_postcard'::text, 'farming_list_pull'::text, 'social_media_graphics'::text, 'brochure'::text, 'sign_rider'::text, 'buyer_guide'::text, 'seller_guide'::text, 'data_report'::text, 'custom_marketing'::text, 'calculator_resource'::text, 'title_support'::text, 'eddm_mailer'::text, 'door_hanger'::text, 'flyer'::text, 'other'::text])))
);


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'snoozed'::text, 'cancelled'::text])))
);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: campaign_enrollments campaign_enrollments_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: campaign_enrollments campaign_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_pkey PRIMARY KEY (id);


--
-- Name: campaign_step_completions campaign_step_completions_enrollment_id_step_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_enrollment_id_step_id_key UNIQUE (enrollment_id, step_id);


--
-- Name: campaign_step_completions campaign_step_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_pkey PRIMARY KEY (id);


--
-- Name: campaign_steps campaign_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_email_unique UNIQUE (email);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: design_assets design_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: intake_queue intake_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_queue
    ADD CONSTRAINT intake_queue_pkey PRIMARY KEY (id);


--
-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: material_request_items material_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_pkey PRIMARY KEY (id);


--
-- Name: material_requests material_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: referral_partners referral_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_activities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_contact ON public.activities USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_activities_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_created ON public.activities USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_activities_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_user ON public.activities USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_arh_cold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arh_cold ON public.agent_relationship_health USING btree (user_id, days_since_contact DESC) WHERE (days_since_contact > 14);


--
-- Name: idx_arh_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_arh_contact ON public.agent_relationship_health USING btree (contact_id);


--
-- Name: idx_arh_user_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arh_user_score ON public.agent_relationship_health USING btree (user_id, computed_health_score DESC);


--
-- Name: idx_campaign_enrollments_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_enrollments_campaign ON public.campaign_enrollments USING btree (campaign_id);


--
-- Name: idx_campaign_enrollments_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_enrollments_contact ON public.campaign_enrollments USING btree (contact_id);


--
-- Name: idx_campaign_enrollments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_enrollments_user ON public.campaign_enrollments USING btree (user_id);


--
-- Name: idx_campaign_step_completions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_step_completions_user ON public.campaign_step_completions USING btree (user_id);


--
-- Name: idx_campaign_steps_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_steps_campaign ON public.campaign_steps USING btree (campaign_id);


--
-- Name: idx_campaign_steps_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_steps_user ON public.campaign_steps USING btree (user_id);


--
-- Name: idx_campaigns_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_user ON public.campaigns USING btree (user_id);


--
-- Name: idx_contacts_last_touch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_last_touch ON public.contacts USING btree (last_touch_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_next_action_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_next_action_date ON public.contacts USING btree (next_action_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_stage ON public.contacts USING btree (stage) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_temperature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_temperature ON public.contacts USING btree (health_score DESC);


--
-- Name: idx_contacts_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tier ON public.contacts USING btree (tier) WHERE (tier IS NOT NULL);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (type) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_user ON public.contacts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_deals_close_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_close_date ON public.deals USING btree (scheduled_close_date) WHERE ((deleted_at IS NULL) AND (stage = ANY (ARRAY['in_escrow'::public.deal_stage, 'clear_to_close'::public.deal_stage])));


--
-- Name: idx_deals_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_contact ON public.deals USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_deals_lender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_lender ON public.deals USING btree (lender_partner_id) WHERE ((lender_partner_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_deals_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_opportunity ON public.deals USING btree (opportunity_id) WHERE (opportunity_id IS NOT NULL);


--
-- Name: idx_deals_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_stage ON public.deals USING btree (user_id, stage) WHERE ((deleted_at IS NULL) AND (stage <> ALL (ARRAY['closed'::public.deal_stage, 'fell_through'::public.deal_stage])));


--
-- Name: idx_deals_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_user_active ON public.deals USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_design_assets_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_assets_contact ON public.design_assets USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_design_assets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_assets_user ON public.design_assets USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_follow_ups_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_contact ON public.follow_ups USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_follow_ups_snoozed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_snoozed ON public.follow_ups USING btree (snoozed_until) WHERE ((status = 'snoozed'::public.follow_up_status) AND (deleted_at IS NULL));


--
-- Name: idx_follow_ups_user_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_user_pending ON public.follow_ups USING btree (user_id, due_date) WHERE ((status = 'pending'::public.follow_up_status) AND (deleted_at IS NULL));


--
-- Name: idx_intake_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_queue_created ON public.intake_queue USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_intake_queue_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_queue_source ON public.intake_queue USING btree (source) WHERE (deleted_at IS NULL);


--
-- Name: idx_intake_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_queue_status ON public.intake_queue USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_intake_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_queue_user ON public.intake_queue USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_interactions_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_contact ON public.interactions USING btree (contact_id);


--
-- Name: idx_interactions_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_occurred ON public.interactions USING btree (user_id, occurred_at DESC);


--
-- Name: idx_listings_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_contact ON public.listings USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_mls; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_mls ON public.listings USING btree (mls_number) WHERE ((deleted_at IS NULL) AND (mls_number IS NOT NULL));


--
-- Name: idx_listings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_status ON public.listings USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_user ON public.listings USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_listings_zip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_zip ON public.listings USING btree (zip) WHERE (deleted_at IS NULL);


--
-- Name: idx_material_request_items_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_request_items_request ON public.material_request_items USING btree (request_id);


--
-- Name: idx_material_requests_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_contact ON public.material_requests USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_material_requests_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_source ON public.material_requests USING btree (source) WHERE (deleted_at IS NULL);


--
-- Name: idx_material_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_status ON public.material_requests USING btree (user_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_material_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_user ON public.material_requests USING btree (user_id);


--
-- Name: idx_opportunities_close; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_close ON public.opportunities USING btree (expected_close_date) WHERE (stage = 'in_escrow'::public.opportunity_stage);


--
-- Name: idx_opportunities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_contact ON public.opportunities USING btree (contact_id);


--
-- Name: idx_opportunities_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_stage ON public.opportunities USING btree (stage) WHERE (stage <> ALL (ARRAY['closed'::public.opportunity_stage, 'fell_through'::public.opportunity_stage]));


--
-- Name: idx_opportunities_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_user ON public.opportunities USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_category ON public.referral_partners USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_trust; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_trust ON public.referral_partners USING btree (trust_level DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_partners_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_user ON public.referral_partners USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_contact ON public.requests USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_listing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_listing ON public.requests USING btree (listing_id) WHERE ((deleted_at IS NULL) AND (listing_id IS NOT NULL));


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_user ON public.requests USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_category ON public.resources USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_tags ON public.resources USING gin (tags) WHERE (deleted_at IS NULL);


--
-- Name: idx_resources_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_user ON public.resources USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_step_completions_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_completions_enrollment ON public.campaign_step_completions USING btree (enrollment_id);


--
-- Name: idx_step_completions_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_completions_step ON public.campaign_step_completions USING btree (step_id);


--
-- Name: idx_tasks_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_contact ON public.tasks USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date) WHERE ((deleted_at IS NULL) AND (status = 'open'::text));


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user ON public.tasks USING btree (user_id);


--
-- Name: contacts contacts_rep_pulse_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contacts_rep_pulse_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_rep_pulse_updated_at();


--
-- Name: deals deals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: design_assets design_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER design_assets_updated_at BEFORE UPDATE ON public.design_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: follow_ups follow_ups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER follow_ups_updated_at BEFORE UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: material_requests material_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER material_requests_updated_at BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: opportunities opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: deals refresh_arh_on_deal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refresh_arh_on_deal AFTER INSERT OR DELETE OR UPDATE ON public.deals FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_agent_relationship_health();


--
-- Name: interactions refresh_arh_on_interaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refresh_arh_on_interaction AFTER INSERT OR DELETE OR UPDATE ON public.interactions FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_agent_relationship_health();


--
-- Name: campaign_enrollments set_campaign_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_campaign_enrollments_updated_at BEFORE UPDATE ON public.campaign_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_step_completions set_campaign_step_completions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_campaign_step_completions_updated_at BEFORE UPDATE ON public.campaign_step_completions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_steps set_campaign_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_campaign_steps_updated_at BEFORE UPDATE ON public.campaign_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaigns set_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: intake_queue set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.intake_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: listings set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: referral_partners set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.referral_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: requests set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: resources set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tasks set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: activities activities_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- Name: activities activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_enrollments campaign_enrollments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_enrollments campaign_enrollments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_enrollments campaign_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_enrollments
    ADD CONSTRAINT campaign_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.campaign_steps(id) ON DELETE CASCADE;


--
-- Name: campaign_step_completions campaign_step_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_step_completions
    ADD CONSTRAINT campaign_step_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_steps campaign_steps_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_steps campaign_steps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_steps
    ADD CONSTRAINT campaign_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: deals deals_lender_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_lender_partner_id_fkey FOREIGN KEY (lender_partner_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: deals deals_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;


--
-- Name: deals deals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: design_assets design_assets_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: design_assets design_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_completed_via_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_completed_via_interaction_id_fkey FOREIGN KEY (completed_via_interaction_id) REFERENCES public.interactions(id) ON DELETE SET NULL;


--
-- Name: follow_ups follow_ups_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: intake_queue intake_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_queue
    ADD CONSTRAINT intake_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: listings listings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: material_request_items material_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.material_requests(id) ON DELETE CASCADE;


--
-- Name: material_requests material_requests_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: material_requests material_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referral_partners referral_partners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: requests requests_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: requests requests_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: requests requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resources resources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: material_requests Allow anonymous intake inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous intake inserts" ON public.material_requests FOR INSERT WITH CHECK ((source = 'intake'::text));


--
-- Name: material_request_items Allow anonymous intake item inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous intake item inserts" ON public.material_request_items FOR INSERT WITH CHECK ((request_id IN ( SELECT material_requests.id
   FROM public.material_requests
  WHERE (material_requests.source = 'intake'::text))));


--
-- Name: activities Users manage own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own activities" ON public.activities TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_enrollments Users manage own campaign_enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own campaign_enrollments" ON public.campaign_enrollments TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_step_completions Users manage own campaign_step_completions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own campaign_step_completions" ON public.campaign_step_completions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_steps Users manage own campaign_steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own campaign_steps" ON public.campaign_steps TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaigns Users manage own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own campaigns" ON public.campaigns TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: contacts Users manage own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own contacts" ON public.contacts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: deals Users manage own deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own deals" ON public.deals USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: design_assets Users manage own design assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own design assets" ON public.design_assets USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: follow_ups Users manage own follow_ups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own follow_ups" ON public.follow_ups USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: intake_queue Users manage own intake_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own intake_queue" ON public.intake_queue TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: interactions Users manage own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own interactions" ON public.interactions USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: listings Users manage own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own listings" ON public.listings TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: material_request_items Users manage own material request items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own material request items" ON public.material_request_items USING ((request_id IN ( SELECT material_requests.id
   FROM public.material_requests
  WHERE (material_requests.user_id = auth.uid())))) WITH CHECK ((request_id IN ( SELECT material_requests.id
   FROM public.material_requests
  WHERE (material_requests.user_id = auth.uid()))));


--
-- Name: material_requests Users manage own material requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own material requests" ON public.material_requests USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: opportunities Users manage own opportunities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own opportunities" ON public.opportunities USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: referral_partners Users manage own referral_partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own referral_partners" ON public.referral_partners TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: requests Users manage own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own requests" ON public.requests TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: resources Users manage own resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own resources" ON public.resources TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: tasks Users manage own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own tasks" ON public.tasks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_step_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_step_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

--
-- Name: design_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_ups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: intake_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intake_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: material_request_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;

--
-- Name: material_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

--
-- Name: resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 7A.5 fix: populate agent_relationship_health so subsequent migrations
-- whose DML fires the refresh_arh_on_* triggers don't fail with
-- "CONCURRENTLY cannot be used when the materialized view is not populated".
REFRESH MATERIALIZED VIEW public.agent_relationship_health;

--
-- PostgreSQL database dump complete
--


