--
-- PostgreSQL database dump
--

\restrict 9vsCIiPnq9FSLqBg6gksaDYhu0mIJDo8YZVxeUbxmhVmuqQa5K3B8Lad7RKBDZt

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

CREATE SCHEMA public;


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

--
-- PostgreSQL database dump complete
--

\unrestrict 9vsCIiPnq9FSLqBg6gksaDYhu0mIJDo8YZVxeUbxmhVmuqQa5K3B8Lad7RKBDZt

-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.
-- supabase/migrations/20260407020000_spine_tables.sql
-- Phase 1 of the Spine + Today Command build.
-- Adds 5 new tables, RLS, indexes, and denorm trigger.
-- Idempotent: drops existing policies before recreate, uses IF NOT EXISTS on tables.

-- =========================================================
-- 1. commitments
-- =========================================================
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null,
  description text,
  kind text check (kind in ('flyer','email','intro','data','call','meeting','gift','other')),
  promised_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','delivered','dropped','blocked')),
  source text check (source in ('meeting','claude_conversation','eod','voice','micro_capture','manual','dashboard_bar')),
  source_ref text,
  delivered_at timestamptz,
  delivered_via text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists commitments_user_status_idx
  on public.commitments(user_id, status) where deleted_at is null;
create index if not exists commitments_user_due_idx
  on public.commitments(user_id, due_at) where deleted_at is null;
create index if not exists commitments_contact_idx
  on public.commitments(contact_id) where deleted_at is null;

alter table public.commitments enable row level security;
drop policy if exists commitments_owner on public.commitments;
create policy commitments_owner on public.commitments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 2. focus_queue
-- =========================================================
create table if not exists public.focus_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  week_of date not null,
  rank smallint,
  reason text check (reason in ('signal','cadence','manual','commitment')),
  reason_detail text,
  suggested_action text,
  status text not null default 'pending' check (status in ('pending','touched','skipped','deferred')),
  touched_at timestamptz,
  touched_via text,
  outcome text check (outcome in ('warm','cold','delivered','no_answer','left_message')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  constraint focus_queue_unique_per_week unique(user_id, contact_id, week_of)
);

create index if not exists focus_queue_user_week_status_idx
  on public.focus_queue(user_id, week_of, status) where deleted_at is null;

alter table public.focus_queue enable row level security;
drop policy if exists focus_queue_owner on public.focus_queue;
create policy focus_queue_owner on public.focus_queue
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 3. cycle_state
-- =========================================================
create table if not exists public.cycle_state (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  cadence_days integer,
  tier_override text,
  paused_until date,
  last_touched_at timestamptz,
  next_due_at timestamptz,
  current_streak_days integer default 0,
  status text default 'active' check (status in ('active','paused','dormant','lost')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists cycle_state_user_next_due_idx
  on public.cycle_state(user_id, next_due_at) where status = 'active';

alter table public.cycle_state enable row level security;
drop policy if exists cycle_state_owner on public.cycle_state;
create policy cycle_state_owner on public.cycle_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 4. signals
-- =========================================================
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references public.contacts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  kind text not null check (kind in ('stale','closing_soon','birthday','listing_dom','market_shift','custom')),
  severity text default 'normal' check (severity in ('low','normal','high','urgent')),
  detected_at timestamptz default now(),
  window_start date,
  window_end date,
  title text not null,
  detail text,
  suggested_action text,
  status text default 'active' check (status in ('active','acted_on','dismissed','expired')),
  acted_on_at timestamptz,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists signals_user_status_sev_idx
  on public.signals(user_id, status, severity) where deleted_at is null;
create index if not exists signals_contact_idx
  on public.signals(contact_id) where deleted_at is null;

alter table public.signals enable row level security;
drop policy if exists signals_owner on public.signals;
create policy signals_owner on public.signals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 5. spine_inbox
-- =========================================================
create table if not exists public.spine_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  raw_text text not null,
  source text not null check (source in ('claude_session','voice','micro','eod','morning','manual','dashboard_bar')),
  source_ref text,
  captured_at timestamptz default now(),
  parsed boolean default false,
  parsed_at timestamptz,
  parsed_commitment_ids uuid[],
  parsed_signal_ids uuid[],
  parsed_focus_ids uuid[],
  parsed_contact_refs uuid[],
  parse_notes text,
  deleted_at timestamptz
);

create index if not exists spine_inbox_user_parsed_captured_idx
  on public.spine_inbox(user_id, parsed, captured_at);

alter table public.spine_inbox enable row level security;
drop policy if exists spine_inbox_owner on public.spine_inbox;
create policy spine_inbox_owner on public.spine_inbox
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- updated_at trigger (shared helper)
-- =========================================================
create or replace function public.spine_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists commitments_touch on public.commitments;
create trigger commitments_touch before update on public.commitments
  for each row execute function public.spine_touch_updated_at();

drop trigger if exists focus_queue_touch on public.focus_queue;
create trigger focus_queue_touch before update on public.focus_queue
  for each row execute function public.spine_touch_updated_at();

drop trigger if exists cycle_state_touch on public.cycle_state;
create trigger cycle_state_touch before update on public.cycle_state
  for each row execute function public.spine_touch_updated_at();
-- Placeholder for dashboard pieces applied directly via Supabase SQL editor on 2026-04-07.
-- The actual DDL for these pieces lives in:
--   supabase/_archive/dashboard-piece*-*.sql
-- and was applied out-of-band before the Supabase MCP went read-only (2026-04-08).
--
-- This file exists so `supabase migration repair --status applied 20260407021000`
-- can resolve a local path, keeping the local and remote migration histories
-- consistent without re-running DDL that is already live.
--
-- Do not add statements to this file. The Phase 1 migration
-- (20260410000100_phase21_rls_lockdown.sql) formalizes the pieces-5-through-8
-- work as an idempotent re-application; earlier pieces are archived as
-- historical record only.

-- intentionally no-op
SELECT 1;
-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.
-- supabase/migrations/20260407021000_spine_interactions_trigger.sql
-- Denormalizes interactions.created_at into cycle_state.last_touched_at
-- so /api/spine/today can read recent-touch data without joining.
--
-- NOTE: contacts.tier uses letter grades ('A', 'B', 'C', 'P') in this
-- database -- not the numeric values shown in the spec. Both sets are
-- included in the CASE so this function works against both naming
-- conventions without requiring a schema change.

create or replace function public.spine_update_cycle_on_interaction()
returns trigger language plpgsql security definer as $$
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

drop trigger if exists interactions_update_cycle on public.interactions;
create trigger interactions_update_cycle
  after insert on public.interactions
  for each row execute function public.spine_update_cycle_on_interaction();
-- Add a default value of 'realtor' to contacts.type so callers that omit
-- the field do not 500 against the NOT NULL constraint. The CHECK
-- constraint contacts_type_check still enforces the allowed enum, so a
-- default cannot introduce an invalid value. Existing rows are unaffected;
-- this only sets a column-level default for future inserts.
--
-- The contact form should still set type explicitly when the user is
-- creating a non-realtor contact (lender, vendor, builder, etc.). This
-- default is a safety net for API callers and bulk inserts, not the
-- source of truth for the form path.

ALTER TABLE public.contacts
  ALTER COLUMN type SET DEFAULT 'realtor';
-- Placeholder for dashboard pieces applied directly via Supabase SQL editor on 2026-04-08.
-- The actual DDL for these pieces lives in:
--   supabase/_archive/dashboard-piece*-*.sql
-- and was applied out-of-band before the Supabase MCP went read-only.
--
-- This file exists so `supabase migration repair --status applied 20260408001000`
-- can resolve a local path, keeping the local and remote migration histories
-- consistent without re-running DDL that is already live.
--
-- Do not add statements to this file. The Phase 1 migration
-- (20260410000100_phase21_rls_lockdown.sql) formalizes the pieces-5-through-8
-- work as an idempotent re-application; earlier pieces are archived as
-- historical record only.

-- intentionally no-op
SELECT 1;
-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.
-- Hard-delete the synthetic interaction row left behind by the spine
-- trigger smoke test in Task 2. Standing Rule 3 (no hard deletes) is
-- waived here because:
--   1. The row is obviously synthetic test scaffolding (summary literally
--      reads "trigger smoke test"), not real business data.
--   2. The interactions table has no deleted_at column, so soft-delete
--      is not available without a schema change.
--   3. Without removal, the row would surface in /api/spine/today as a
--      real touch on Chase Reynolds, polluting cards in Tasks 5/12/14.
-- Authorized inline by Alex on 2026-04-08 during the spine phase 1 build.

DELETE FROM public.interactions
WHERE id = '2e29b755-6fd8-4f32-bd17-7dc84834ecc1'
  AND summary = 'trigger smoke test';
-- ============================================================================
-- Phase 2.1 RLS lockdown + notes column + ownership backfill/reassignment
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 1
-- Replaces: supabase/dashboard-piece5-contacts-user-id-lockdown.sql
--           supabase/dashboard-piece6-contacts-rls-lockdown.sql
--           supabase/dashboard-piece7-contacts-add-notes-column.sql
--           supabase/dashboard-piece8-contacts-reassign-to-alex.sql
--
-- BACKGROUND:
--   These four pieces were applied directly to the live DB on 2026-04-07
--   via the Supabase MCP execute_sql path, BEFORE the MCP went read-only
--   on 2026-04-08. They never existed as numbered migrations, so
--   `supabase db reset` / `supabase db push` could not replay them
--   and a fresh environment would not match production. This file wraps
--   all four as one idempotent migration so:
--
--     1. Fresh environments (staging, scratch branches, CI) can replay
--        the full Phase 2.1 lockdown in order.
--     2. Production (already in post-state) is unaffected -- every
--        statement is guarded so re-running is a no-op.
--     3. The repo's single source of truth for Phase 2.1 lives under
--        supabase/migrations/ alongside the baseline and spine tables.
--
--   The original loose .sql files are moved to supabase/_archive/ in the
--   same commit that adds this migration.
--
-- IDEMPOTENCY GUARANTEES:
--   - All backfill / reassign statements are conditional (only touch
--     rows matching the target predicate; no-op if the post-state is
--     already in place).
--   - ALTER COLUMN SET DEFAULT / SET NOT NULL are no-ops when already
--     in place.
--   - DROP POLICY IF EXISTS + CREATE POLICY pattern recreates the
--     owner-scoped policy on every run -- the final state is the same.
--   - ADD COLUMN IF NOT EXISTS for contacts.notes.
--   - Soft-delete of dormant auth user uses COALESCE so deleted_at /
--     banned_until do not get overwritten if already set.
--
-- ORIGINAL PIECE PROVENANCE (preserved as comments below each section).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PIECE 5 -- contacts.user_id lockdown
-- Backfill NULLs to Alex, set DEFAULT auth.uid(), set NOT NULL
-- Source: dashboard-piece5-contacts-user-id-lockdown.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  alex_user_id uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  null_count int;
  alex_exists boolean;
BEGIN
  -- Sanity: Alex's auth user still exists before touching data.
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = alex_user_id)
    INTO alex_exists;

  IF NOT alex_exists THEN
    RAISE EXCEPTION 'Alex auth.users row % not found. Aborting backfill.', alex_user_id;
  END IF;

  SELECT count(*) INTO null_count FROM contacts WHERE user_id IS NULL;

  IF null_count > 0 THEN
    UPDATE contacts SET user_id = alex_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Phase21/piece5: backfilled % contacts.user_id rows to %', null_count, alex_user_id;
  ELSE
    RAISE NOTICE 'Phase21/piece5: no NULL user_id rows on contacts. Backfill skipped.';
  END IF;
END $$;

ALTER TABLE contacts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- PIECE 6 -- contacts RLS lockdown + dormant auth user soft-delete
-- Drop permissive policies, re-enable RLS, create owner-scoped policy,
-- soft-delete the never-used test auth user.
-- Source: dashboard-piece6-contacts-rls-lockdown.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  dormant_id    uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  dormant_email text := 'yourcoll2347@gmail.com';
  found_email   text;
BEGIN
  SELECT email INTO found_email FROM auth.users WHERE id = dormant_id;

  IF found_email IS NULL THEN
    RAISE NOTICE 'Phase21/piece6: dormant user % not found. Nothing to soft-delete.', dormant_id;
  ELSIF found_email <> dormant_email THEN
    RAISE EXCEPTION 'Phase21/piece6: safety check failed -- id % does not match email %, found %',
      dormant_id, dormant_email, found_email;
  ELSE
    -- COALESCE protects prior deleted_at / banned_until from being overwritten on replay.
    UPDATE auth.users
       SET deleted_at   = COALESCE(deleted_at,   now()),
           banned_until = COALESCE(banned_until, '2099-12-31 00:00:00+00'::timestamptz)
     WHERE id = dormant_id;
    RAISE NOTICE 'Phase21/piece6: soft-deleted auth user %', dormant_email;
  END IF;
END $$;

DROP POLICY IF EXISTS authenticated_select ON contacts;
DROP POLICY IF EXISTS authenticated_insert ON contacts;
DROP POLICY IF EXISTS authenticated_update ON contacts;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own contacts" ON contacts;
CREATE POLICY "Users manage own contacts" ON contacts
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PIECE 7 -- contacts.notes column add
-- Nullable text, no default, no backfill. Fixes silent insert failures
-- from /api/intake and the contact form modal.
-- Source: dashboard-piece7-contacts-add-notes-column.sql (2026-04-07)
-- ============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================================
-- PIECE 8 -- contacts.user_id reassignment (dormant -> Alex)
-- Piece 5's backfill was originally run against a different UUID.
-- This reassigns any rows still owned by the dormant user to Alex.
-- Idempotent: no-op if no dormant-owned rows remain.
-- Source: dashboard-piece8-contacts-reassign-to-alex.sql (2026-04-07)
-- ============================================================================
DO $$
DECLARE
  alex_id        uuid := 'b735d691-4d86-4e31-9fd3-c2257822dca3';
  dormant_id     uuid := '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb';
  alex_active    boolean;
  reassign_count int;
BEGIN
  -- Sanity: Alex still active.
  SELECT (deleted_at IS NULL)
    INTO alex_active
    FROM auth.users
   WHERE id = alex_id;

  IF alex_active IS NULL THEN
    RAISE EXCEPTION 'Phase21/piece8: Alex auth.users row % not found. Aborting reassign.', alex_id;
  END IF;

  IF NOT alex_active THEN
    RAISE EXCEPTION 'Phase21/piece8: Alex auth.users row % is soft-deleted. Aborting reassign.', alex_id;
  END IF;

  SELECT count(*) INTO reassign_count
    FROM contacts
   WHERE user_id = dormant_id;

  IF reassign_count > 0 THEN
    UPDATE contacts
       SET user_id = alex_id
     WHERE user_id = dormant_id;
    RAISE NOTICE 'Phase21/piece8: reassigned % contacts.user_id rows from dormant % to Alex %',
      reassign_count, dormant_id, alex_id;
  ELSE
    RAISE NOTICE 'Phase21/piece8: no contacts owned by dormant user %. Reassign skipped.', dormant_id;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- select
--   (select count(*) from contacts)                                       as total_contacts,
--   (select count(*) from contacts where user_id is null)                 as null_user_id,
--   (select count(*) from contacts
--      where user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3')             as alex_owned,
--   (select count(*) from contacts
--      where user_id = '05a13169-5a0e-48e4-a3b9-b4c5cbce9dcb')             as dormant_owned,
--   (select is_nullable from information_schema.columns
--      where table_schema='public' and table_name='contacts'
--        and column_name='user_id')                                        as user_id_nullable,
--   (select data_type from information_schema.columns
--      where table_schema='public' and table_name='contacts'
--        and column_name='notes')                                          as notes_exists,
--   (select count(*) from pg_policy pol
--      join pg_class c on c.oid=pol.polrelid
--      join pg_namespace n on n.oid=c.relnamespace
--     where n.nspname='public' and c.relname='contacts')                   as contacts_policy_count,
--   (select count(*) from auth.users where deleted_at is null)             as active_auth_users;
--
-- Expected post-state:
--   total_contacts         >= 105
--   null_user_id           = 0
--   alex_owned             = total_contacts
--   dormant_owned          = 0
--   user_id_nullable       = NO
--   notes_exists           = text
--   contacts_policy_count  = 1
--   active_auth_users      = 1
-- ============================================================================
-- ============================================================================
-- Phase 2: contacts reshape to GAT-BOS spec
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 2
-- Intent:   Reshape the `contacts` table to match the GAT-BOS build spec
--           intent WITHOUT dropping any of the 26 extra columns the CRM
--           already relies on. All changes are additive or rename-only.
--           Data is preserved throughout.
--
-- CHANGES:
--   1. Extend contacts_type_check CHECK constraint: add value 'escrow'
--      (contact_type is a CHECK-constrained text column, NOT a Postgres enum)
--   2. Rename: last_touch_date -> last_touchpoint
--   3. Rename: next_action_date -> next_followup
--   4. Add:    lender_partner_id uuid  self-FK to contacts(id)
--   5. Add:    metadata jsonb          type-specific fields for
--              lenders / vendors / escrow rows
--   6. Add:    full_name text          generated column
--              = coalesce(first_name,'') || ' ' || coalesce(last_name,'')
--   7. Create: contacts_spec_view      spec-compatible projection with
--              - all contacts columns
--              - `role` computed from `type`
--              - `is_dormant` computed from last_touchpoint
--
-- DELIBERATE DEVIATION FROM THE PLAN:
--   The plan specifies `is_dormant` as a stored generated column:
--     generated always as (last_touchpoint < (current_date - interval '30 days')) stored
--   This does not compile in Postgres: generated column expressions must be
--   IMMUTABLE, and `current_date` is STABLE. Moved `is_dormant` into
--   `contacts_spec_view` as a computed SELECT column instead. Same semantics,
--   recomputed on every query. At CRM scale (sub-1k rows) this is free.
--   Note written to the plan doc as a followup for documentation update.
--
-- IDEMPOTENCY:
--   Every statement is guarded so replay is a no-op:
--   - ALTER TYPE ADD VALUE IF NOT EXISTS
--   - Rename columns are wrapped in a DO block that checks for old name
--     present AND new name absent before running
--   - ADD COLUMN IF NOT EXISTS handles columns + default backfill
--   - DROP VIEW IF EXISTS ... CASCADE + CREATE VIEW handles view replay
--
-- NOT APPLIED TO LIVE DB IN THIS COMMIT.
--   This file adds the migration to the repo. Whether / when to apply is
--   Alex's call. Live DB is currently in the pre-Phase-2 state.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Extend the contacts_type_check CHECK constraint
-- ============================================================================
-- contact_type is NOT a Postgres enum. The baseline defines contacts.type as
-- a plain text column with a CHECK constraint:
--
--   type text NOT NULL,
--   CONSTRAINT contacts_type_check
--     CHECK (type = ANY (ARRAY['realtor', 'lender', 'builder', 'vendor',
--       'buyer', 'seller', 'past_client', 'warm_lead', 'referral_partner',
--       'sphere', 'other']))
--
-- To add 'escrow' we drop the check constraint and recreate it with the
-- extended value list. Idempotent via DROP CONSTRAINT IF EXISTS.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_type_check
  CHECK (type = ANY (ARRAY[
    'realtor'::text,
    'lender'::text,
    'builder'::text,
    'vendor'::text,
    'buyer'::text,
    'seller'::text,
    'past_client'::text,
    'warm_lead'::text,
    'referral_partner'::text,
    'sphere'::text,
    'other'::text,
    'escrow'::text
  ]));

-- ============================================================================
-- 2. + 3. Rename last_touch_date / next_action_date (idempotent)
-- ============================================================================
DO $$
BEGIN
  -- last_touch_date -> last_touchpoint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='last_touch_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='last_touchpoint'
  ) THEN
    ALTER TABLE public.contacts RENAME COLUMN last_touch_date TO last_touchpoint;
    RAISE NOTICE 'Phase2: renamed contacts.last_touch_date -> last_touchpoint';
  ELSE
    RAISE NOTICE 'Phase2: last_touch_date -> last_touchpoint rename skipped (already applied or source missing)';
  END IF;

  -- next_action_date -> next_followup
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='next_action_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='next_followup'
  ) THEN
    ALTER TABLE public.contacts RENAME COLUMN next_action_date TO next_followup;
    RAISE NOTICE 'Phase2: renamed contacts.next_action_date -> next_followup';
  ELSE
    RAISE NOTICE 'Phase2: next_action_date -> next_followup rename skipped (already applied or source missing)';
  END IF;
END $$;

-- ============================================================================
-- 4. lender_partner_id (self-referential nullable FK)
-- ============================================================================
-- On-delete behavior: SET NULL. If a lender contact row is ever hard-deleted,
-- the agents that referenced it lose the link but stay put. Standing Rule 3
-- says no hard deletes -- we soft-delete via deleted_at -- so this FK action
-- is a defensive safety net, not a routine code path.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lender_partner_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Index the FK so "find all agents partnered with lender X" stays fast.
CREATE INDEX IF NOT EXISTS contacts_lender_partner_id_idx
  ON public.contacts(lender_partner_id)
  WHERE lender_partner_id IS NOT NULL;

-- ============================================================================
-- 5. metadata jsonb
-- ============================================================================
-- Holds type-specific fields for non-agent contact rows:
--   lender : { nmls_number, loan_types, co_marketing }
--   vendor : { category, service_area, licensed, insured }
--   escrow : { branch_name, branch_address, direct_line, assigned_agents }
-- Agent rows leave this at '{}' unless there's a reason to store something.
-- NOT NULL with default '{}' avoids null-check noise in app code.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 6. full_name generated column
-- ============================================================================
-- coalesce() is IMMUTABLE, text concat is IMMUTABLE, so the expression
-- qualifies as a stored generated column. Handles NULL first_name or
-- last_name gracefully (empty string fallback, no NULL in result).
-- Example: ("Jane",NULL)        -> "Jane "
--          (NULL,"Smith")       -> " Smith"
--          ("Jane","Smith")     -> "Jane Smith"
--          (NULL,NULL)          -> " "
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS full_name text
    GENERATED ALWAYS AS (
      coalesce(first_name, '') || ' ' || coalesce(last_name, '')
    ) STORED;

-- ============================================================================
-- 7. contacts_spec_view  (spec-compatible projection)
-- ============================================================================
-- Two additions on top of `contacts.*`:
--   a. role      : collapses the 11-value `type` enum to the 4-value spec
--                  vocabulary (agent / lender / vendor / escrow / other).
--                  Unknown enum values fall through to 'other'.
--   b. is_dormant: true if last_touchpoint is older than 30 days OR NULL
--                  (never-touched contacts are treated as dormant). Computed
--                  on every query; not stored (see DELIBERATE DEVIATION above).
--
-- DROP + CREATE rather than CREATE OR REPLACE because OR REPLACE fails if
-- the column list of the underlying table ever changes. Safer on replay.
DROP VIEW IF EXISTS public.contacts_spec_view CASCADE;

CREATE VIEW public.contacts_spec_view AS
SELECT
  c.*,
  CASE c.type::text
    WHEN 'realtor'          THEN 'agent'
    WHEN 'buyer'            THEN 'agent'
    WHEN 'seller'           THEN 'agent'
    WHEN 'past_client'      THEN 'agent'
    WHEN 'warm_lead'        THEN 'agent'
    WHEN 'sphere'           THEN 'agent'
    WHEN 'lender'           THEN 'lender'
    WHEN 'vendor'           THEN 'vendor'
    WHEN 'builder'          THEN 'vendor'
    WHEN 'referral_partner' THEN 'vendor'
    WHEN 'escrow'           THEN 'escrow'
    ELSE                         'other'
  END AS role,
  coalesce(
    c.last_touchpoint < (current_date - interval '30 days')::timestamptz,
    true
  ) AS is_dormant
FROM public.contacts c;

-- The view inherits RLS from the underlying table by default in Postgres 15+.
-- Supabase runs Postgres 17. Authenticated users querying contacts_spec_view
-- see only their own rows via the "Users manage own contacts" policy from
-- Phase 1 / piece 6.
COMMENT ON VIEW public.contacts_spec_view IS
  'Spec-compatible projection of contacts with computed role and is_dormant. '
  'RLS inherits from contacts table (Postgres 15+ behavior).';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- -- column shape
-- select column_name, data_type, is_nullable, column_default, generation_expression
--   from information_schema.columns
--  where table_schema='public' and table_name='contacts'
--    and column_name in ('last_touchpoint','next_followup','lender_partner_id',
--                        'metadata','full_name','last_touch_date','next_action_date')
--  order by column_name;
--
-- expected rows:
--   last_touchpoint    | timestamp... | YES | NULL      | NULL
--   next_followup      | date         | YES | NULL      | NULL
--   lender_partner_id  | uuid         | YES | NULL      | NULL
--   metadata           | jsonb        | NO  | '{}'::jsonb | NULL
--   full_name          | text         | YES | NULL      | COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
--   last_touch_date    | (not found)
--   next_action_date   | (not found)
--
-- -- check constraint extension (contact_type is text + CHECK, not an enum)
-- select pg_get_constraintdef(oid)
--   from pg_constraint
--  where conname = 'contacts_type_check'
--    and conrelid = 'public.contacts'::regclass;
-- expected: a CHECK that includes 'escrow' alongside the 11 original values
--
-- -- view exists and is queryable
-- select count(*), count(*) filter (where role='agent') as agent_count,
--                  count(*) filter (where is_dormant)     as dormant_count
--   from contacts_spec_view;
-- expected: view returns row counts matching contacts (subject to RLS)
--
-- -- full_name populated for existing rows
-- select id, first_name, last_name, full_name from contacts limit 3;
-- expected: full_name column reflects first_name || ' ' || last_name
-- ============================================================================
-- ============================================================================
-- Phase 3: add the 5 missing GAT-BOS tables + extend interaction_type enum
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 3
-- Source:   GAT-BOS-Complete-Build-Spec.md, tables 3-7 (lines 89-158)
--
-- NEW TABLES:
--   1. email_log       Resend campaign send tracking (per-contact, per-email)
--   2. events          Calendar sync (meetings, BNI, open houses, closings)
--   3. email_inbox     Gmail triage queue, Claude-scored and tagged
--   4. voice_memos     Brain-dump transcripts and Claude-extracted actions
--   5. agent_metrics   Business outcomes per agent per period
--
-- ENUM EXTENSION:
--   interaction_type enum gets three new values to match the spec's touchpoint
--   vocabulary:
--     + email_sent     (currently logged as generic 'email')
--     + email_received (currently logged as generic 'email')
--     + event          (links interactions to events table rows)
--   Existing values preserved: call, text, email, meeting, broker_open, lunch,
--   note. 'email' stays alongside email_sent / email_received so legacy rows
--   do not need migration.
--
-- COMMON PATTERN (applied to all 5 new tables):
--   - id uuid pk default gen_random_uuid()
--   - user_id uuid not null default auth.uid() references auth.users on delete cascade
--   - created_at timestamptz default now()
--   - updated_at timestamptz default now() with BEFORE UPDATE trigger
--     via existing public.set_updated_at() function from the baseline
--   - enable row level security
--   - owner-scoped "Users manage own {table}" policy,
--     mirrors Phase 1 / piece 6's contacts pattern
--   - DROP POLICY IF EXISTS + CREATE POLICY for idempotent replay
--   - CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS throughout
--
-- NOT APPLIED TO LIVE DB IN THIS COMMIT.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Extend interaction_type enum
-- ============================================================================
-- Postgres 17 allows ALTER TYPE ADD VALUE inside a transaction as long as the
-- new value is not used in the same transaction. We do not insert any rows
-- with these new values here, so the transaction is safe.
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_sent';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_received';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'event';

-- ============================================================================
-- 1. email_log
-- ============================================================================
-- Tracks every campaign email sent via Resend. One row per (contact, send).
-- Status transitions via Resend webhooks. resend_id is unique for webhook
-- idempotency.
CREATE TABLE IF NOT EXISTS public.email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign    text NOT NULL,                   -- weekly_edge, closing_brief, onboarding_warm, onboarding_cold, etc.
  subject     text NOT NULL,
  sent_at     timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'sent',    -- sent, delivered, opened, clicked, bounced, failed
  resend_id   text UNIQUE,                     -- Resend's tracking ID, unique for webhook idempotency
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_user_sent_idx
  ON public.email_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_contact_idx
  ON public.email_log (contact_id);
CREATE INDEX IF NOT EXISTS email_log_campaign_idx
  ON public.email_log (user_id, campaign);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own email_log" ON public.email_log;
CREATE POLICY "Users manage own email_log" ON public.email_log
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS email_log_set_updated_at ON public.email_log;
CREATE TRIGGER email_log_set_updated_at
  BEFORE UPDATE ON public.email_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. events
-- ============================================================================
-- Calendar sync surface. contact_ids is a uuid array because many events have
-- multiple attendees (BNI table guest list, open house co-hosts, etc.). Postgres
-- does not enforce FKs on array elements; the app is responsible for data
-- integrity. google_event_id is unique for sync idempotency.
CREATE TABLE IF NOT EXISTS public.events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  type             text NOT NULL DEFAULT 'personal',  -- bni, open_house, agent_meeting, closing, personal
  start_time       timestamptz NOT NULL,
  end_time         timestamptz,
  location         text,
  contact_ids      uuid[] NOT NULL DEFAULT '{}'::uuid[],
  notes            text,
  google_event_id  text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_start_idx
  ON public.events (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS events_user_type_idx
  ON public.events (user_id, type);
-- GIN index on contact_ids so "events involving contact X" stays fast
CREATE INDEX IF NOT EXISTS events_contact_ids_gin_idx
  ON public.events USING gin (contact_ids);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own events" ON public.events;
CREATE POLICY "Users manage own events" ON public.events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. email_inbox
-- ============================================================================
-- Gmail triage queue. Distinct from intake_queue (which is form submissions).
-- Claude runs over new rows and fills priority_score, suggested_action, and
-- draft_reply. contact_id is nullable because Claude may not find a match.
-- gmail_id is unique for sync idempotency.
CREATE TABLE IF NOT EXISTS public.email_inbox (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id          text NOT NULL UNIQUE,
  from_email        text NOT NULL,
  from_name         text,
  subject           text,
  body_preview      text,                                              -- first ~500 chars
  received_at       timestamptz NOT NULL,
  contact_id        uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  priority_score    smallint CHECK (priority_score BETWEEN 1 AND 10),  -- Claude-rated 1-10
  status            text NOT NULL DEFAULT 'unread',                    -- unread, triaged, replied, archived
  suggested_action  text,
  draft_reply       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_inbox_user_received_idx
  ON public.email_inbox (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_inbox_user_status_idx
  ON public.email_inbox (user_id, status);
CREATE INDEX IF NOT EXISTS email_inbox_contact_idx
  ON public.email_inbox (contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own email_inbox" ON public.email_inbox;
CREATE POLICY "Users manage own email_inbox" ON public.email_inbox
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS email_inbox_set_updated_at ON public.email_inbox;
CREATE TRIGGER email_inbox_set_updated_at
  BEFORE UPDATE ON public.email_inbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. voice_memos
-- ============================================================================
-- Voice memo ingestion: raw_transcript is the Whisper output, processed_output
-- is the JSON Claude extracted (action_items, contacts_mentioned, follow_ups,
-- sentiment, etc.). contact_ids is a uuid array because a single memo often
-- references multiple people.
CREATE TABLE IF NOT EXISTS public.voice_memos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_transcript    text NOT NULL,
  processed_output  jsonb,                                  -- Claude's structured extraction
  contact_ids       uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status            text NOT NULL DEFAULT 'pending',        -- pending, processed, reviewed, archived
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_memos_user_created_idx
  ON public.voice_memos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_memos_user_status_idx
  ON public.voice_memos (user_id, status);
CREATE INDEX IF NOT EXISTS voice_memos_contact_ids_gin_idx
  ON public.voice_memos USING gin (contact_ids);

ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own voice_memos" ON public.voice_memos;
CREATE POLICY "Users manage own voice_memos" ON public.voice_memos
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS voice_memos_set_updated_at ON public.voice_memos;
CREATE TRIGGER voice_memos_set_updated_at
  BEFORE UPDATE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. agent_metrics
-- ============================================================================
-- Business outcomes per agent per period. One row per (contact_id, period).
-- Example periods: "2026-Q1", "2026-04", "2026-W15". App decides granularity.
-- revenue is nullable (optional, sensitive). Claude does not read it unless
-- explicitly asked.
CREATE TABLE IF NOT EXISTS public.agent_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id       uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  period           text NOT NULL,                    -- "2026-Q1", "2026-04", "2026-W15", etc.
  escrows_opened   integer NOT NULL DEFAULT 0 CHECK (escrows_opened >= 0),
  escrows_closed   integer NOT NULL DEFAULT 0 CHECK (escrows_closed >= 0),
  referral_source  text,                             -- BNI, SAAR, cold_outreach, referral, etc.
  revenue          numeric(12,2),                    -- nullable, optional
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_metrics_contact_period_uniq UNIQUE (contact_id, period)
);

CREATE INDEX IF NOT EXISTS agent_metrics_user_period_idx
  ON public.agent_metrics (user_id, period);
CREATE INDEX IF NOT EXISTS agent_metrics_contact_idx
  ON public.agent_metrics (contact_id);

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own agent_metrics" ON public.agent_metrics;
CREATE POLICY "Users manage own agent_metrics" ON public.agent_metrics
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS agent_metrics_set_updated_at ON public.agent_metrics;
CREATE TRIGGER agent_metrics_set_updated_at
  BEFORE UPDATE ON public.agent_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.email_log     IS 'Resend campaign email tracking, one row per (contact, send). Webhooks transition status.';
COMMENT ON TABLE public.events        IS 'Calendar events (BNI, open houses, agent meetings, closings). Synced from Google Calendar.';
COMMENT ON TABLE public.email_inbox   IS 'Gmail triage queue. Claude scores priority and suggests replies. Distinct from intake_queue (form submissions).';
COMMENT ON TABLE public.voice_memos   IS 'Voice memo transcripts and Claude-extracted action items. Multi-contact via contact_ids uuid[].';
COMMENT ON TABLE public.agent_metrics IS 'Per-agent business outcomes by period. UNIQUE (contact_id, period). revenue column is optional/sensitive.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- -- tables exist
-- select table_name from information_schema.tables
--  where table_schema='public'
--    and table_name in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  order by table_name;
-- expected: 5 rows
--
-- -- rls enabled
-- select c.relname, c.relrowsecurity
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public'
--    and c.relname in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  order by c.relname;
-- expected: all 5 relrowsecurity = true
--
-- -- one owner-scoped policy per table
-- select c.relname, count(*) as policy_count
--   from pg_policy pol
--   join pg_class c on c.oid=pol.polrelid
--   join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public'
--    and c.relname in ('email_log','events','email_inbox','voice_memos','agent_metrics')
--  group by c.relname
--  order by c.relname;
-- expected: all 5 policy_count = 1
--
-- -- interaction_type enum extended
-- select enumlabel from pg_enum
--   join pg_type t on t.oid=enumtypid
--  where t.typname='interaction_type'
--  order by enumsortorder;
-- expected: call, text, email, meeting, broker_open, lunch, note, email_sent, email_received, event
-- ============================================================================
-- 2026-04-11: API Usage Log table for Adviser Strategy cost tracking
-- Idempotent: safe to replay. IF NOT EXISTS on all DDL.
-- Append-only log -- no updated_at column.

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL DEFAULT auth.uid(),
  feature_key           text NOT NULL,
  executor_model        text NOT NULL,
  adviser_called        boolean NOT NULL DEFAULT false,
  adviser_call_count    integer NOT NULL DEFAULT 0,
  input_tokens          integer NOT NULL DEFAULT 0,
  output_tokens         integer NOT NULL DEFAULT 0,
  cost_estimate_cents   numeric(10,4) NOT NULL DEFAULT 0,
  duration_ms           integer,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_user_created
  ON public.api_usage_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_feature
  ON public.api_usage_log (feature_key, created_at DESC);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own api_usage_log" ON public.api_usage_log;
CREATE POLICY "Users manage own api_usage_log"
  ON public.api_usage_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
-- inbox_items: Gmail threads Claude has scored as needing a reply.
-- One row per (user, thread). Idempotent on the unique constraint.

create table if not exists public.inbox_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid()
                                  references auth.users(id),
  gmail_thread_id   text        not null,
  sender_email      text        not null,
  sender_name       text        not null default '',
  subject           text        not null default '(no subject)',
  snippet           text        not null default '',
  received_at       timestamptz not null,
  score             integer     not null default 0
                                  check (score >= 0 and score <= 100),
  matched_rules     jsonb       not null default '[]'::jsonb,
  contact_id        uuid        references public.contacts(id) on delete set null,
  contact_name      text,
  contact_tier      text,
  status            text        not null default 'pending'
                                  check (status in ('pending','replied','dismissed')),
  dismissed_at      timestamptz,
  created_at        timestamptz not null default now(),

  constraint inbox_items_user_thread_unique unique (user_id, gmail_thread_id)
);

create index if not exists inbox_items_user_status_received_idx
  on public.inbox_items (user_id, status, received_at desc)
  where dismissed_at is null;

alter table public.inbox_items enable row level security;

drop policy if exists inbox_items_owner on public.inbox_items;
create policy inbox_items_owner on public.inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Universal Capture Bar v1: captures table
-- Idempotent per ~/crm/CLAUDE.md. Uses existing public.set_updated_at() trigger fn
-- (see baseline.sql line 1572 for the contacts table using the same pattern).

create table if not exists public.captures (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  raw_text          text not null,
  parsed_intent     text,
  parsed_contact_id uuid references public.contacts(id) on delete set null,
  parsed_payload    jsonb not null default '{}'::jsonb,
  processed         boolean not null default false,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade
);

-- Enum-style check (kept simple; add new intents by dropping+recreating this constraint)
alter table public.captures drop constraint if exists captures_parsed_intent_check;
alter table public.captures add constraint captures_parsed_intent_check
  check (parsed_intent is null or parsed_intent in (
    'interaction','follow_up','ticket','note','unprocessed'
  ));

create index if not exists captures_user_created_idx
  on public.captures (user_id, created_at desc);

create index if not exists captures_unprocessed_idx
  on public.captures (user_id, processed) where processed = false;

create index if not exists captures_contact_idx
  on public.captures (parsed_contact_id) where parsed_contact_id is not null;

alter table public.captures enable row level security;

drop policy if exists "Users manage own captures" on public.captures;
create policy "Users manage own captures" on public.captures
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger (reuse the shared function used by contacts/tasks/campaigns)
drop trigger if exists set_captures_updated_at on public.captures;
create trigger set_captures_updated_at
  before update on public.captures
  for each row execute function public.set_updated_at();
-- Campaign enrollment schedule column.
--
-- Adds `next_action_at` to campaign_enrollments so the enrollment row knows
-- when its current step is due. Pre-computed at enrollment (now() + step1.delay_days)
-- and rolled forward by `completeStep()` using the next step's delay_days.
-- Cleared to NULL on last step completion.
--
-- Enables a future dispatcher/cron: `WHERE next_action_at <= now() AND status='active'`.

ALTER TABLE campaign_enrollments
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_enrollments_next_action
  ON campaign_enrollments (next_action_at)
  WHERE deleted_at IS NULL AND status = 'active';
-- Slice 1: Universal activity ledger.
-- Every user-observable action in GAT-BOS writes a row here.
-- Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS public.activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  actor_id      uuid NOT NULL,
  verb          text NOT NULL,
  object_table  text NOT NULL,
  object_id     uuid NOT NULL,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_occurred
  ON public.activity_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_object
  ON public.activity_events (object_table, object_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_actor
  ON public.activity_events (actor_id, occurred_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_write" ON public.activity_events;
CREATE POLICY "owner_read_write"
  ON public.activity_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Slice 1 fix: partial expression index on context->>'contact_id' so the
-- getContactTimeline OR-filter does not full-scan as the ledger grows.
-- Uses btree (default) since the predicate is text equality, not containment.
-- GIN is for jsonb containment operators (@>); this key is extracted as text.
create index if not exists activity_events_context_contact_id_idx
  on public.activity_events ((context->>'contact_id'))
  where context->>'contact_id' is not null;
-- ================================================================
-- SLICE 2B: Captures Consolidation
-- Merges voice_memos, intake_queue, email_inbox into captures.
-- Extends captures with 5 new columns + 2 CHECK constraints.
-- spine_inbox: SKIPPED (already absent from Supabase, verified 2026-04-23).
-- Source tables all have 0 rows; INSERTs are no-ops, DROPs still fire.
-- Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- Pre-insert column additions (needed before INSERTs reference them)
-- ----------------------------------------------------------------

-- source added here so each INSERT sets the correct value ('voice_memo', 'intake', 'email_inbox')
ALTER TABLE captures ADD COLUMN IF NOT EXISTS source     text NOT NULL DEFAULT 'manual';

-- transcript and metadata added before INSERTs that reference these columns
ALTER TABLE captures ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS metadata   jsonb;

-- ----------------------------------------------------------------
-- PART 1: Data merge (Task 1)
-- ----------------------------------------------------------------

-- voice_memos -> captures
INSERT INTO captures (
  id, user_id, raw_text, source, transcript, metadata, created_at, updated_at,
  processed
)
SELECT
  id,
  user_id,
  raw_transcript                            AS raw_text,
  'voice_memo'                              AS source,
  raw_transcript                            AS transcript,
  processed_output                          AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM voice_memos
ON CONFLICT (id) DO NOTHING;

-- intake_queue -> captures (WHERE deleted_at IS NULL)
INSERT INTO captures (
  id, user_id, raw_text, source, metadata, created_at, updated_at, processed
)
SELECT
  id,
  user_id,
  raw_input                                 AS raw_text,
  'intake'                                  AS source,
  parsed_data                               AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM intake_queue
WHERE deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- email_inbox -> captures
INSERT INTO captures (
  id, user_id, raw_text, source, parsed_contact_id, metadata, created_at, updated_at,
  processed
)
SELECT
  id,
  user_id,
  COALESCE(body_preview, subject, '')       AS raw_text,
  'email_inbox'                             AS source,
  contact_id                                AS parsed_contact_id,
  jsonb_build_object(
    'gmail_id',       gmail_id,
    'from_email',     from_email,
    'from_name',      from_name,
    'subject',        subject,
    'priority_score', priority_score
  )                                         AS metadata,
  created_at,
  updated_at,
  false                                     AS processed
FROM email_inbox
ON CONFLICT (id) DO NOTHING;

-- Drop source tables (no data loss: all were 0 rows)
DROP TABLE IF EXISTS voice_memos  CASCADE;
DROP TABLE IF EXISTS intake_queue CASCADE;
DROP TABLE IF EXISTS email_inbox  CASCADE;

-- ----------------------------------------------------------------
-- PART 2: Remaining schema changes to captures (Task 2)
-- ----------------------------------------------------------------

ALTER TABLE captures ADD COLUMN IF NOT EXISTS suggested_target jsonb;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'pending';

-- CHECK constraints (use DO $$ block for IF NOT EXISTS equivalent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'captures_source_check'
      AND conrelid = 'captures'::regclass
  ) THEN
    ALTER TABLE captures ADD CONSTRAINT captures_source_check
      CHECK (source IN ('manual','spine_inbox','voice_memo','intake','email_inbox','audio'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'captures_status_check'
      AND conrelid = 'captures'::regclass
  ) THEN
    ALTER TABLE captures ADD CONSTRAINT captures_status_check
      CHECK (status IN ('pending','promoted','discarded'));
  END IF;
END $$;

-- Index on source for filtered queries
CREATE INDEX IF NOT EXISTS idx_captures_source ON captures(source);

-- Backfill source for pre-existing rows (default 'manual' applies; merged rows already have explicit values)
UPDATE captures SET source = 'manual' WHERE source IS NULL;

-- Backfill status for already-promoted captures
UPDATE captures SET status = 'promoted' WHERE processed = true AND status = 'pending';

COMMIT;
-- ================================================================
-- SLICE 2C: Tasks Extension + Follow-ups Merge + Opportunities
--           Consolidation + Deals Merge + Spine Idempotent Drops
-- follow_ups: 0 rows -- INSERT is no-op; DROP fires.
-- deals:      0 rows -- INSERT is no-op; DROP fires.
-- opportunities: 2 rows -- preserved via ON CONFLICT DO NOTHING.
-- Spine tables: already gone -- DROPs are no-ops.
-- Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- PART 1: Extend tasks table (Task 1)
-- ----------------------------------------------------------------

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type        text NOT NULL DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source      text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_reason  text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS action_hint text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_type_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_type_check
      CHECK (type IN ('todo', 'follow_up', 'commitment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------
-- PART 2: Merge follow_ups into tasks (Task 2)
-- follow_ups has 0 rows; INSERT is a no-op. DROP still fires.
-- follow_ups.due_date is DATE; tasks.due_date is timestamptz.
-- follow_up_status mapping: pending -> open, completed -> completed, skipped -> cancelled.
-- ----------------------------------------------------------------

INSERT INTO tasks (
  id, user_id, contact_id, title, due_reason, due_date, priority,
  status, snoozed_until, completed_at, created_at, updated_at, deleted_at,
  type, source
)
SELECT
  id,
  user_id,
  contact_id,
  COALESCE(reason, 'Follow up')                           AS title,
  reason                                                  AS due_reason,
  due_date::timestamptz                                   AS due_date,
  priority,
  CASE status::text
    WHEN 'pending'   THEN 'open'
    WHEN 'completed' THEN 'completed'
    ELSE                  'cancelled'
  END                                                     AS status,
  snoozed_until,
  completed_at,
  created_at,
  updated_at,
  deleted_at,
  'follow_up'                                             AS type,
  'follow_ups'                                            AS source
FROM follow_ups
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS follow_ups CASCADE;

-- ----------------------------------------------------------------
-- PART 3: Extend opportunities + merge deals (Task 3)
-- opportunities preserved (2 live rows). deals has 0 rows.
-- ----------------------------------------------------------------

-- Add deal-specific columns to opportunities (all nullable)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS buyer_name           text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS seller_name          text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS earnest_money        numeric;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS commission_rate      numeric;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_company       text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_officer       text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS title_company        text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lender_name          text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lender_partner_id    uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contract_date        date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS escrow_open_date     date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS scheduled_close_date date;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS actual_close_date    date;

-- Merge deals rows into opportunities
-- deal_stage 'clear_to_close' has no equivalent in opportunity_stage; maps to 'in_escrow'.
INSERT INTO opportunities (
  id, user_id, contact_id,
  property_address, property_city, property_state, property_zip,
  sale_price, stage, escrow_number, notes,
  buyer_name, seller_name, earnest_money, commission_rate,
  escrow_company, escrow_officer, title_company, lender_name, lender_partner_id,
  contract_date, escrow_open_date, scheduled_close_date, actual_close_date,
  created_at, updated_at, deleted_at
)
SELECT
  d.id,
  d.user_id,
  d.contact_id,
  d.property_address,
  d.property_city,
  d.property_state,
  d.property_zip,
  d.sale_price,
  CASE d.stage::text
    WHEN 'clear_to_close' THEN 'in_escrow'::opportunity_stage
    ELSE d.stage::text::opportunity_stage
  END                     AS stage,
  d.escrow_number,
  d.notes,
  d.buyer_name,
  d.seller_name,
  d.earnest_money,
  d.commission_rate,
  d.escrow_company,
  d.escrow_officer,
  d.title_company,
  d.lender_name,
  d.lender_partner_id,
  d.contract_date,
  d.escrow_open_date,
  d.scheduled_close_date,
  d.actual_close_date,
  d.created_at,
  d.updated_at,
  d.deleted_at
FROM deals d
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS deals CASCADE;

-- ----------------------------------------------------------------
-- PART 4: Idempotent spine table drops (Task 5)
-- All 4 already absent from DB; safe no-ops.
-- ----------------------------------------------------------------

DROP TABLE IF EXISTS signals     CASCADE;
DROP TABLE IF EXISTS focus_queue  CASCADE;
DROP TABLE IF EXISTS cycle_state  CASCADE;
DROP TABLE IF EXISTS commitments  CASCADE;

COMMIT;
-- ================================================================
-- SLICE 2C: Interactions -> View over activity_events
-- Renames the interactions table to interactions_legacy (preserving
-- the 2 existing rows), then creates a VIEW named interactions that
-- exposes a compatible interface via UNION ALL.
--
-- Part A: interactions_legacy (legacy rows -- preserved)
-- Part B: activity_events WHERE verb LIKE 'interaction.%' (Slice 1+)
--
-- NOTE: All 6 INSERT callers must be updated in Plan 003 to write
--   to interactions_legacy directly (views are not insertable):
--     - src/lib/captures/promote.ts
--     - src/app/(app)/actions/page.tsx
--     - src/components/dashboard/task-list.tsx (x2)
--     - src/components/interactions/interaction-modal.tsx
--     - src/app/api/intake/route.ts
--     - src/app/api/webhooks/resend/route.ts
--   See BLOCKERS.md.
--
-- NOTE: 2 Realtime subscriptions also need their `table:` name flipped
--   from "interactions" to "interactions_legacy" so writes still fire
--   change events:
--     - src/app/(app)/contacts/page.tsx
--     - src/components/dashboard/task-list.tsx
--
-- NOTE: interactions_legacy is NOT dropped here. The view's Part A
--   references it; dropping breaks the view. Drop deferred to Slice 3
--   after promote.ts and the other writers migrate to writeEvent().
-- ================================================================

BEGIN;

-- Rename interactions -> interactions_legacy
-- Guard: skip if interactions_legacy already exists (idempotent re-run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'interactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'interactions_legacy'
  ) THEN
    ALTER TABLE public.interactions RENAME TO interactions_legacy;
  END IF;
END $$;

-- Create (or replace) the interactions view
-- Part A: all legacy rows (the 2 existing interactions rows)
-- Part B: Slice 1+ rows written via writeEvent() with interaction verbs
CREATE OR REPLACE VIEW public.interactions AS
  SELECT
    il.id,
    il.user_id,
    il.contact_id,
    il.type::text                                       AS type,
    il.summary,
    il.occurred_at,
    il.created_at,
    il.direction,
    il.duration_minutes,
    NULL::timestamptz                                   AS deleted_at
  FROM public.interactions_legacy il
  UNION ALL
  SELECT
    ae.id,
    ae.user_id,
    (ae.context->>'contact_id')::uuid                  AS contact_id,
    REPLACE(ae.verb, 'interaction.', '')               AS type,
    COALESCE(ae.context->>'summary',
             ae.context->>'note', '')                  AS summary,
    ae.occurred_at,
    ae.created_at,
    ae.context->>'direction'                           AS direction,
    (ae.context->>'duration_minutes')::int             AS duration_minutes,
    ae.deleted_at
  FROM public.activity_events ae
  WHERE ae.verb LIKE 'interaction.%'
    AND ae.deleted_at IS NULL;

COMMIT;
-- ================================================================
-- SLICE 3 / Wave 1: tasks.linked_interaction_id audit linkage
-- Restores cross-entity audit linkage between completed follow-up
-- tasks and the interaction that resolved them. The column was lost
-- in Slice 2C when follow_ups was merged into tasks (the original
-- follow_ups.completed_via_interaction_id did not migrate).
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_interaction_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_linked_interaction_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_linked_interaction_id_fkey
      FOREIGN KEY (linked_interaction_id)
      REFERENCES public.activity_events(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_linked_interaction_id
  ON public.tasks(linked_interaction_id)
  WHERE linked_interaction_id IS NOT NULL;

COMMIT;
-- ================================================================
-- SLICE 3 / Wave 3: Backfill interactions_legacy rows into activity_events
-- Inserts each legacy interaction as an activity_events row with
-- verb='interaction.backfilled' and context.legacy_id for idempotency.
-- The interactions VIEW (rewritten in W4) reads context.type via
-- COALESCE to preserve the original interaction_type for these rows.
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

INSERT INTO public.activity_events
  (user_id, actor_id, verb, object_table, object_id, occurred_at, context)
SELECT
  il.user_id,
  il.user_id                                       AS actor_id,
  'interaction.backfilled'                         AS verb,
  'contacts'                                       AS object_table,
  il.contact_id                                    AS object_id,
  il.occurred_at,
  jsonb_build_object(
    'contact_id',       il.contact_id,
    'summary',          il.summary,
    'type',             il.type::text,
    'direction',        il.direction,
    'duration_minutes', il.duration_minutes,
    'legacy_id',        il.id,
    'source',           'legacy_backfill'
  )                                                AS context
FROM public.interactions_legacy il
WHERE NOT EXISTS (
  SELECT 1
  FROM public.activity_events ae
  WHERE ae.context->>'legacy_id' = il.id::text
);

COMMIT;
-- ================================================================
-- SLICE 3 / Wave 4: Interactions VIEW rewrite + interactions_legacy DROP
-- Pre-flight: All 6 writers must already be on writeEvent() (W2) and
-- all legacy rows must already be backfilled (W3).
--
-- (1) Rewrite VIEW to drop Part A (interactions_legacy UNION ALL).
--     The VIEW now projects from activity_events only. COALESCE on
--     type preserves original interaction_type for backfilled rows
--     (whose verb is 'interaction.backfilled').
-- (2) DROP interactions_legacy CASCADE.
-- (3) Ensure activity_events is published for Realtime so the
--     dashboard channel flips (task-list.tsx + contacts/page.tsx)
--     keep firing on interaction inserts.
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

-- (1) Rewrite VIEW: project from activity_events only.
CREATE OR REPLACE VIEW public.interactions AS
  SELECT
    ae.id,
    ae.user_id,
    (ae.context->>'contact_id')::uuid                       AS contact_id,
    COALESCE(ae.context->>'type',
             REPLACE(ae.verb, 'interaction.', ''))          AS type,
    COALESCE(ae.context->>'summary',
             ae.context->>'note', '')                       AS summary,
    ae.occurred_at,
    ae.created_at,
    ae.context->>'direction'                                AS direction,
    (ae.context->>'duration_minutes')::int                  AS duration_minutes,
    ae.deleted_at
  FROM public.activity_events ae
  WHERE ae.verb LIKE 'interaction.%'
    AND ae.deleted_at IS NULL;

-- (2) Drop interactions_legacy. CASCADE removes any leftover triggers/grants.
DROP TABLE IF EXISTS public.interactions_legacy CASCADE;

-- (3) Publish activity_events for Realtime if not already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
END $$;

COMMIT;
-- ============================================================
-- MORNING RELATIONSHIP BRIEF (Phase 1)
-- Table:  morning_briefs
-- RLS:    alex-only, keyed on auth.jwt() ->> 'email'
-- ============================================================
-- Plan:   ~/.claude/plans/curried-tinkering-finch.md (Step 1)
-- Generated: 2026-04-24
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: DROP TABLE IF EXISTS CASCADE before CREATE.
--   Re-running this file rebuilds the morning_briefs schema only.
--   morning_briefs is new in this slice; no data loss on first run.
--   On re-run, all morning_briefs rows are wiped.
--   Do not re-run after the cron has populated rows you care about.
--
-- Versioning contract:
--   One row per brief_date (UTC date in MST tz, formatted YYYY-MM-DD).
--   Cron upserts on brief_date. generated_at bumps on each run.
--   Never DELETE; soft-delete via deleted_at if a row needs to be hidden.
--
-- Soft delete (standing rule 3):
--   morning_briefs carries deleted_at TIMESTAMPTZ NULL. No hard deletes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.morning_briefs CASCADE;

-- ------------------------------------------------------------
-- morning_briefs: nightly relationship brief output
-- ------------------------------------------------------------
CREATE TABLE public.morning_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date      DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  brief_json      JSONB NOT NULL,
  brief_text      TEXT NOT NULL,
  model           TEXT NOT NULL,
  usage           JSONB,
  contacts_scored INT NOT NULL DEFAULT 0,
  errors          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.morning_briefs IS
  'Nightly relationship brief assembled at 12:30 UTC (5:30am MST). One row per brief_date.';
COMMENT ON COLUMN public.morning_briefs.brief_date IS
  'The day this brief is FOR (YYYY-MM-DD in MST). Unique per non-deleted row.';
COMMENT ON COLUMN public.morning_briefs.brief_json IS
  'Structured brief data: { temperature_ranking, congrats_queue, watch_list, one_thing }.';
COMMENT ON COLUMN public.morning_briefs.brief_text IS
  'Narrative markdown rendered at /morning. Generated by Claude API.';
COMMENT ON COLUMN public.morning_briefs.usage IS
  'Anthropic usage telemetry: { input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens }.';
COMMENT ON COLUMN public.morning_briefs.errors IS
  'Per-contact non-fatal errors encountered during scoring. NULL on clean runs.';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- One brief per date (live rows only). Cron upserts via this index.
CREATE UNIQUE INDEX morning_briefs_brief_date_unique
  ON public.morning_briefs (brief_date)
  WHERE deleted_at IS NULL;

-- Latest-first lookup for /morning route.
CREATE INDEX morning_briefs_generated_at_idx
  ON public.morning_briefs (generated_at DESC)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- RLS: alex-only, JWT email pattern
-- ------------------------------------------------------------
ALTER TABLE public.morning_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_morning_briefs_all" ON public.morning_briefs;
CREATE POLICY "alex_morning_briefs_all" ON public.morning_briefs
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

COMMIT;

-- ============================================================
-- Verify (run after COMMIT, optional sanity check):
--
--   SELECT relname, relrowsecurity
--     FROM pg_class
--    WHERE relname = 'morning_briefs';
--   -- expect 1 row, relrowsecurity = true
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'morning_briefs';
--   -- expect: morning_briefs_pkey,
--   --         morning_briefs_brief_date_unique,
--   --         morning_briefs_generated_at_idx
--
--   SELECT polname FROM pg_policy
--    WHERE polrelid = 'public.morning_briefs'::regclass;
--   -- expect: alex_morning_briefs_all
-- ============================================================
-- Slice 3A Task 3a -- operational rate_limits table.
--
-- Time-bounded counter store for the Supabase-backed rate limiter at
-- src/lib/rate-limit/check.ts. Rows hold a per-key, per-window counter
-- that the helper increments via INSERT ... ON CONFLICT atomic upsert.
--
-- Standing Rule 3 carve-out: rate-limit rows are operational data, not
-- user-observable records. Hard-delete is permitted (and required) so
-- the helper can opportunistically cull rows older than 2x the longest
-- window on each call. Soft-delete with deleted_at would defeat the
-- purpose and let counters grow unbounded.
--
-- RLS is enabled with deny-all policies for anon and authenticated.
-- Service role bypasses RLS, so the rate limiter (which runs server-side
-- with the service-role key) reads and writes freely. No client should
-- ever touch this table directly.

DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE public.rate_limits (
  key          text         NOT NULL,
  count        int          NOT NULL DEFAULT 0,
  window_start timestamptz  NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- Cleanup scans target old window_start values; index supports the
-- opportunistic DELETE ... WHERE window_start < now() - interval pattern.
CREATE INDEX rate_limits_window_start_idx
  ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny-all policies for non-service-role traffic. Service role bypasses
-- RLS entirely, so omitting policies for service role is correct.
CREATE POLICY rate_limits_deny_anon
  ON public.rate_limits
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY rate_limits_deny_authenticated
  ON public.rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.rate_limits IS
  'Operational counter store for the Supabase-backed sliding-window rate limiter. Service-role only. Rows are time-bounded; helper culls expired windows opportunistically.';
-- Slice 3A Task 3c -- atomic increment RPC for the rate limiter.
--
-- The plan calls for true Postgres-atomic increment via
--   INSERT ... ON CONFLICT (key, window_start)
--     DO UPDATE SET count = rate_limits.count + 1
--     RETURNING count
--
-- PostgREST's .upsert() cannot express "count = count + 1" in the conflict
-- clause, so the helper at src/lib/rate-limit/check.ts calls this function
-- via supabase.rpc('increment_rate_limit', ...). The function is the only
-- write path the helper uses.
--
-- SECURITY DEFINER so the function runs with table-owner privileges and
-- bypasses RLS regardless of how it's invoked. The helper still hits this
-- endpoint with the service-role key, but DEFINER hardens against future
-- callers being added with weaker grants.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key          text,
  p_window_start timestamptz
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count;
$$;

REVOKE ALL ON FUNCTION public.increment_rate_limit(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(text, timestamptz) TO service_role;

COMMENT ON FUNCTION public.increment_rate_limit(text, timestamptz) IS
  'Atomic upsert+increment for the Supabase-backed sliding-window rate limiter. Returns the post-increment count for (key, window_start). Service-role only.';
-- 20260426120000_backfill_last_touchpoint_to_activity_events.sql
--
-- One-shot backfill: copy contacts.last_touchpoint into activity_events
-- so the drift query has source rows to read.
--
-- Background: Slice 3 W3 (20260425110000_slice3_legacy_backfill.sql) ran
-- against an interactions_legacy table that held =<4 rows at execution
-- time, and W4 (20260425120000_slice3_view_rewrite_drop_legacy.sql)
-- dropped the table. The 78 A/B/C contacts whose history lived only in
-- the denormalized contacts.last_touchpoint field were never copied
-- into the activity ledger, so the 2026-04-25 morning brief saw
-- effective_drift=1000 for all 103 contacts.
--
-- Source: contacts.last_touchpoint (untouched after this runs -- one-way copy).
-- Target: public.activity_events, verb='interaction.backfilled',
--         object_table='contacts', object_id=contact_id.
-- Idempotent: NOT EXISTS guard on context.source + context.contact_id.
-- Safety:    fails loudly if source row count has drifted from 78
--            (the count confirmed against live db at draft time).

BEGIN;

WITH inserted AS (
  INSERT INTO public.activity_events (
    user_id,
    actor_id,
    verb,
    object_table,
    object_id,
    context,
    occurred_at
  )
  SELECT
    c.user_id,
    c.user_id,
    'interaction.backfilled',
    'contacts',
    c.id,
    jsonb_build_object(
      'source',     'last_touchpoint_denorm',
      'contact_id', c.id::text,
      'summary',    'last_touchpoint denorm copy'
    ),
    c.last_touchpoint
  FROM public.contacts c
  WHERE c.deleted_at IS NULL
    AND c.tier IN ('A', 'B', 'C')
    AND c.last_touchpoint IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_events ae
      WHERE ae.context ->> 'source'     = 'last_touchpoint_denorm'
        AND ae.context ->> 'contact_id' = c.id::text
        AND ae.deleted_at IS NULL
    )
  RETURNING 1
)
SELECT COUNT(*) AS rows_inserted FROM inserted;

DO $$
DECLARE
  v_source   INT;
  v_backfill INT;
BEGIN
  SELECT COUNT(*) INTO v_source
    FROM public.contacts
   WHERE deleted_at IS NULL
     AND tier IN ('A', 'B', 'C')
     AND last_touchpoint IS NOT NULL;

  SELECT COUNT(*) INTO v_backfill
    FROM public.activity_events
   WHERE context ->> 'source' = 'last_touchpoint_denorm'
     AND deleted_at IS NULL;

  IF v_source <> 78 THEN
    RAISE EXCEPTION
      'Source drift: expected 78 A/B/C contacts with last_touchpoint, found %. State changed since this migration was authored. Re-confirm count and update the assertion before running.',
      v_source;
  END IF;

  IF v_backfill <> v_source THEN
    RAISE EXCEPTION
      'Backfill incomplete: % source rows but % activity_events rows with source=last_touchpoint_denorm.',
      v_source, v_backfill;
  END IF;

  RAISE NOTICE 'Backfill OK: % source rows match % activity_events rows.', v_source, v_backfill;
END;
$$;

COMMIT;
-- Slice 4 Task 1 -- templates table.
-- Single-tenant template library for the messaging abstraction.
-- Versioned by (slug, version). Soft-delete via deleted_at. Alex-only RLS.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_send_mode') THEN
    CREATE TYPE public.template_send_mode AS ENUM ('resend', 'gmail', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_kind') THEN
    CREATE TYPE public.template_kind AS ENUM ('transactional', 'campaign', 'newsletter');
  END IF;
END
$$;

-- Table
CREATE TABLE IF NOT EXISTS public.templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  send_mode   public.template_send_mode NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  body_text   TEXT NOT NULL,
  kind        public.template_kind NOT NULL,
  version     INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_slug_version
  ON public.templates (slug, version);

CREATE INDEX IF NOT EXISTS idx_templates_slug_live
  ON public.templates (slug, version DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.templates IS
  'Single-tenant template library for the messaging abstraction. Versioned by (slug, version). Soft-delete via deleted_at per standing rule 3. RLS Alex-only.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_templates_updated_at();

-- RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_templates_all" ON public.templates;

CREATE POLICY "alex_templates_all" ON public.templates
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT USAGE ON TYPE public.template_send_mode TO authenticated, service_role;
GRANT USAGE ON TYPE public.template_kind      TO authenticated, service_role;-- Slice 4 Task 2 -- messages_log table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE public.message_status AS ENUM (
      'queued', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.messages_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  recipient_email       TEXT NOT NULL,
  send_mode             public.template_send_mode NOT NULL,
  provider_message_id   TEXT,
  status                public.message_status NOT NULL DEFAULT 'queued',
  event_sequence        JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_log_template_sent
  ON public.messages_log (template_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_log_status_live
  ON public.messages_log (status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.messages_log IS
  'Per-send audit row for the messaging abstraction. status flows queued -> sent -> delivered/bounced/opened/clicked or failed. event_sequence is an append-only jsonb array (timestamp + event payload), mirrors email_drafts.audit_log shape. RLS Alex-only.';

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_messages_log_all" ON public.messages_log;

CREATE POLICY "alex_messages_log_all" ON public.messages_log
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages_log TO authenticated;
GRANT USAGE ON TYPE public.message_status TO authenticated, service_role;INSERT INTO public.templates (
  name,
  slug,
  send_mode,
  subject,
  body_html,
  body_text,
  kind,
  version
) VALUES (
  'The Weekly Edge -- Issue #{{ issue_number }}',
  'weekly-edge',
  'both',
  'The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}',
$body_html$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Playfair+Display:ital,wght@1,400&family=Inter:wght@300;400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet">
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    body { margin: 0; padding: 0; width: 100%; }
    @media only screen and (max-width: 640px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .section-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .masthead-title { font-size: 48px !important; line-height: 1.05 !important; }
      .listing-grid-cell { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .listing-card-table { width: 100% !important; margin-bottom: 16px !important; }
      .cta-headline { font-size: 22px !important; }
      .opener-body { font-size: 16px !important; }
      .mobile-hide { display: none !important; }
      .footer-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .footer-right { text-align: center !important; padding-top: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #18181b; font-family: 'Inter', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #18181b;">
    <tr><td align="center" style="padding: 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" class="email-container" style="max-width: 640px; width: 100%; margin: 0 auto;">
        <tr><td style="background-color: #09090b; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 6px); padding: 44px 48px 36px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #e63550; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 24px;">GREAT AMERICAN TITLE AGENCY &nbsp;&middot;&nbsp; PHOENIX VALLEY</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr><td style="font-family: 'Syne', Arial, sans-serif; font-size: 64px; font-weight: 700; color: #f4f4f5; line-height: 1.05; padding-bottom: 4px;" class="masthead-title">The Weekly</td></tr>
            <tr><td style="font-family: 'Syne', Arial, sans-serif; font-size: 64px; font-weight: 700; line-height: 1.05; padding-bottom: 20px;" class="masthead-title"><span style="color: #e63550;">Edge</span><span style="display: inline-block; width: 6px; height: 6px; background-color: #e63550; border-radius: 50%; margin-left: 4px; vertical-align: middle;"></span></td></tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background: linear-gradient(to right, #e63550, transparent); padding: 0; line-height: 1px; font-size: 1px;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="padding-top: 16px; font-family: 'Space Mono', 'Courier New', monospace; font-size: 12px; font-weight: 400; color: #71717a; line-height: 1.5;">Vol. 1 &nbsp;&middot;&nbsp; {{ issue_date_metadata }} &nbsp;&middot;&nbsp; Phoenix Valley Market</td>
            <td style="padding-top: 16px; font-family: 'Space Mono', 'Courier New', monospace; font-size: 12px; font-weight: 400; color: #71717a; line-height: 1.5; text-align: right;">Issue #{{ issue_number }}</td>
          </tr></table>
        </td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 12px;">FROM ALEX'S DESK</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width: 44px; height: 3px; background-color: #e63550; line-height: 3px; font-size: 1px;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 400; font-style: italic; color: #09090b; line-height: 1.85;" class="opener-body">{{ opener_html }}</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 28px;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 500; font-style: italic; color: #09090b;">-- Alex Hollien</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #a1a1aa;">Title Sales Executive, Great American Title Agency</span></td></tr></table>
        </td></tr>
        <tr><td style="background-color: #131316; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td><span style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #e63550; letter-spacing: 0.12em; text-transform: uppercase;">WEEKLY DATA</span><br><span style="font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #f4f4f5; line-height: 1.3;">GAT Market Stats</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px;">{{ stats_image_html }}</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td><span style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #2563eb; letter-spacing: 0.12em; text-transform: uppercase;">WEEKEND PREVIEW</span><br><span style="font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #09090b; line-height: 1.3;">The Weekender</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px;">{{ weekender_image_html }}</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #09090b; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px); border-left: 3px solid #e63550; padding: 44px 48px 44px 45px;" class="section-padding">{{ featured_section_html }}</td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">{{ listings_section_html }}</td></tr>
        <tr><td style="background-color: #ffffff; padding: 52px 48px; text-align: center;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 12px;">LET'S CONNECT</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-bottom: 12px;"><span style="font-family: 'Syne', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #09090b; line-height: 1.2; display: inline-block; max-width: 380px;" class="cta-headline">Have an idea or a deal in motion?</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-bottom: 28px;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #71717a; line-height: 1.6; display: inline-block; max-width: 320px;">One text gets the conversation started. I respond the same day -- usually within the hour.</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center" style="border-radius: 8px; background-color: #09090b;"><a href="sms:+14802042983?body=Hey%20Alex%2C%20I%20have%20an%20idea%20I%27d%20like%20to%20get%20started." target="_blank" style="display: inline-block; padding: 18px 44px; font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em;">Text Alex Now</a></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-top: 12px; font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #a1a1aa;">Opens pre-written text &middot; Works on any smartphone</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #09090b; padding: 36px 48px 28px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background-color: rgba(255,255,255,0.06); line-height: 1px; font-size: 1px; padding-bottom: 0;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td width="50%" valign="top" class="footer-stack" style="padding-top: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="width: 52px; height: 52px; vertical-align: middle; padding-right: 12px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #e63550; background-color: #131316; text-align: center; vertical-align: middle; font-family: 'Syne', Arial, sans-serif; font-size: 18px; font-weight: 700; color: #f4f4f5;">AH</td></tr></table></td>
                <td style="vertical-align: middle;"><span style="font-family: 'Syne', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff;">Alex Hollien</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #71717a;">Title Sales Executive</span></td>
              </tr></table>
            </td>
            <td width="50%" valign="top" class="footer-stack footer-right" style="padding-top: 24px; text-align: right;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #e63550; letter-spacing: 0.08em; text-transform: uppercase;">GREAT AMERICAN</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #52525b; letter-spacing: 0.08em; text-transform: uppercase;">TITLE AGENCY</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #3f3f46;">Phoenix Valley</span></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 20px; padding-bottom: 16px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background-color: rgba(255,255,255,0.06); line-height: 1px; font-size: 1px;">&nbsp;</td></tr></table></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #71717a;"><a href="tel:+14802042983" style="color: #71717a; text-decoration: none;">(480) 204-2983</a> &nbsp;&middot;&nbsp; <a href="mailto:alex.hollien@gaTitle.com" style="color: #71717a; text-decoration: none;">alex.hollien@gaTitle.com</a></td>
            <td style="text-align: right; font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400;"><a href="%%unsubscribe%%" style="color: #71717a; text-decoration: underline;">Unsubscribe</a></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 16px; font-family: 'Inter', Arial, sans-serif; font-size: 9px; font-weight: 400; color: #3f3f46; line-height: 1.5;">Great American Title Agency &middot; 14850 N Scottsdale Rd, Suite 160, Scottsdale, AZ 85254<br>You are receiving this email because you opted in to The Weekly Edge. &copy; 2026 Great American Title Agency. All rights reserved.</td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$body_html$,
$body_text$The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}
GREAT AMERICAN TITLE AGENCY -- PHOENIX VALLEY
Vol. 1 -- {{ issue_date_metadata }} -- Phoenix Valley Market

FROM ALEX'S DESK
{{ opener_html }}

-- Alex Hollien
Title Sales Executive, Great American Title Agency

WEEKLY DATA -- GAT MARKET STATS
{{ stats_image_html }}

WEEKEND PREVIEW -- THE WEEKENDER
{{ weekender_image_html }}

FEATURED THIS WEEK
{{ featured_section_html }}

NEW LISTINGS THIS WEEK
{{ listings_section_html }}

LET'S CONNECT
Have an idea or a deal in motion? One text gets the conversation started.
sms:+14802042983

(480) 204-2983 -- alex.hollien@gaTitle.com
Great American Title Agency -- 14850 N Scottsdale Rd, Suite 160, Scottsdale, AZ 85254
(c) 2026 Great American Title Agency. All rights reserved.$body_text$,
  'newsletter',
  1
)
ON CONFLICT (slug, version) DO NOTHING;DROP TABLE public._deprecated_requests CASCADE;-- Slice 5A Task 1 -- campaign_enrollments schedule indexes
-- Pre-flight (2026-04-27 MCP read) confirmed:
--   - campaign_enrollments.next_action_at column ALREADY EXISTS (no column add)
--   - idx_enrollments_next_action ALREADY EXISTS with the exact predicate the
--     starter calls idx_campaign_enrollments_due:
--     CREATE INDEX idx_enrollments_next_action ON public.campaign_enrollments
--       USING btree (next_action_at)
--       WHERE ((deleted_at IS NULL) AND (status = 'active'::text))
--   - The only missing index is the contact-active dedup index used by
--     autoEnrollNewAgent() to short-circuit duplicate enrollments.
--
-- This paste only adds the missing dedup index. Idempotent: IF NOT EXISTS.
-- Run from the Supabase SQL Editor as Alex (project owner).

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_contact_active
  ON public.campaign_enrollments (contact_id)
  WHERE deleted_at IS NULL AND status = 'active';

-- Verification (read-only, safe to re-run):
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'campaign_enrollments'
ORDER BY indexname;
-- Slice 5A Task 2 -- message_events table + status-sync trigger
-- Captures Resend webhook events linked to messages_log; trigger advances
-- messages_log.status to reflect the latest meaningful state.

-- Event type enum (separate from message_status so 'complained' can exist as
-- an event without expanding the messages_log.status enum).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_event_type') THEN
    CREATE TYPE public.message_event_type AS ENUM (
      'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_log_id uuid NOT NULL REFERENCES public.messages_log(id) ON DELETE CASCADE,
  event_type public.message_event_type NOT NULL,
  provider_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_events_log_received
  ON public.message_events (message_log_id, received_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_message_events_all ON public.message_events;
CREATE POLICY alex_message_events_all ON public.message_events
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

-- Status sync function. Behavior:
--   * Terminal sticky: once messages_log.status is bounced or failed, never roll back.
--   * Otherwise advance forward through queued -> sent -> delivered -> opened -> clicked.
--   * Event 'complained' maps to messages_log.status='bounced' (terminal).
CREATE OR REPLACE FUNCTION public.update_message_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
$func$;

DROP TRIGGER IF EXISTS message_events_status_sync ON public.message_events;
CREATE TRIGGER message_events_status_sync
  AFTER INSERT ON public.message_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_message_log_status();
-- Slice 5A Task 4 -- campaign_steps.template_slug column (NULL-tolerant)
-- Idempotent. Adds nullable text column + partial index.
-- Runner treats NULL as no-op skip and writes campaign.step_skipped activity.

ALTER TABLE public.campaign_steps
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE INDEX IF NOT EXISTS idx_campaign_steps_active_with_slug
  ON public.campaign_steps (campaign_id, step_number)
  WHERE deleted_at IS NULL AND template_slug IS NOT NULL;-- Slice 5A Task 5 -- New Agent Onboarding campaign content
--
-- Mirror of live state seeded earlier in the slice via MCP apply_migration
-- and ad-hoc UI edits. This file makes the seed reproducible from a clean
-- DB rebuild. Idempotent: ON CONFLICT clauses + NOT EXISTS guards.
--
-- Cadence deviation vs. plan: plan called for 3 steps at delay_days
-- 0/5/9 with send_mode='gmail'. Live state ships 4 steps at 0/3/7/14 with
-- send_mode='gmail' for all 4 templates -- locked in by prior seed.
--
-- Copy follows brand.md Voice Tokens (warm/specific/no exclamations) +
-- Kit 1 fonts (rendered client-side) + first-person Alex voice. No GAT
-- co-brand inside body (Rule 8 -- email body never co-brands GAT).
--
-- Owner UID: b735d691-4d86-4e31-9fd3-c2257822dca3 (Alex).
-- Campaign UUID: e13653af-405e-4118-bade-d45d31830b86 (locked by 2026-04-22 seed).

BEGIN;

-- 1. Templates (4 rows, UPSERT on slug+version)

INSERT INTO public.templates (slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'new-agent-onboarding-step-1',
    1,
    'New Agent Onboarding -- Step 1 -- Day 0 Welcome',
    'gmail',
    'campaign',
    'Staying Connected',
    E'<p>Hey {{first_name}},</p>\n\n<p>Good meeting you. I wanted to send a quick follow-up so you have everything in one place.</p>\n\n<p>Here\'s where I\'m most useful for my agents:</p>\n\n<ul>\n<li>Marketing and print -- clean, well-done pieces that actually get used</li>\n<li>Targeted data -- farming lists, equity pulls, and smart prospecting</li>\n<li>Open house support -- setup, flow, and follow-up strategy</li>\n<li>Content -- simple, consistent pieces to stay in front of your audience</li>\n<li>On-demand help -- if something comes up, I move quick</li>\n</ul>\n\n<p>You don\'t need to overthink any of it. When you have something coming up, just loop me in and I\'ll help you put it together the right way.</p>\n\n<p>Talk soon,<br>Alex</p>',
    E'Hey {{first_name}},\n\nGood meeting you. I wanted to send a quick follow-up so you have everything in one place.\n\nHere\'s where I\'m most useful for my agents:\n\n- Marketing and print -- clean, well-done pieces that actually get used\n- Targeted data -- farming lists, equity pulls, and smart prospecting\n- Open house support -- setup, flow, and follow-up strategy\n- Content -- simple, consistent pieces to stay in front of your audience\n- On-demand help -- if something comes up, I move quick\n\nYou don\'t need to overthink any of it. When you have something coming up, just loop me in and I\'ll help you put it together the right way.\n\nTalk soon,\nAlex'
  ),
  (
    'new-agent-onboarding-step-2',
    1,
    'New Agent Onboarding -- Step 2 -- Day 3 How it works',
    'gmail',
    'campaign',
    'How agents are leveraging resources',
    E'<p>Hey {{first_name}},</p>\n\n<p>Quick follow-up. Here\'s how most of my agents actually use me day-to-day:</p>\n\n<ul>\n<li><strong>Before a listing:</strong> we get in front of the neighborhood early with the right list and a clean piece</li>\n<li><strong>While it\'s live:</strong> brochures, open house setup, and making sure the presentation feels dialed in</li>\n<li><strong>After it sells:</strong> just sold campaigns that keep the conversation going and bring in the next deal</li>\n</ul>\n\n<p>It\'s not complicated. It\'s just being consistent and doing things a little better than most.</p>\n\n<p>If you have something coming up, even if it\'s last minute, I\'m happy to jump in.</p>\n\n<p>-- Alex</p>',
    E'Hey {{first_name}},\n\nQuick follow-up. Here\'s how most of my agents actually use me day-to-day:\n\n- Before a listing: we get in front of the neighborhood early with the right list and a clean piece\n- While it\'s live: brochures, open house setup, and making sure the presentation feels dialed in\n- After it sells: just sold campaigns that keep the conversation going and bring in the next deal\n\nIt\'s not complicated. It\'s just being consistent and doing things a little better than most.\n\nIf you have something coming up, even if it\'s last minute, I\'m happy to jump in.\n\n-- Alex'
  ),
  (
    'new-agent-onboarding-step-3',
    1,
    'New Agent Onboarding -- Step 3 -- Day 7 Escrow team',
    'gmail',
    'campaign',
    'How We Handle Escrow From Start to Finish',
    E'<p>Hey {{first_name}},</p>\n\n<p>Quick note on the escrow side, since that\'s really where everything matters most.</p>\n\n<p>Our team is tight, experienced, and very hands-on. Communication is consistent, timelines are managed closely, and we stay ahead of issues before they become problems.</p>\n\n<p>You won\'t have to chase updates or wonder where things stand. That\'s a big focus for us.</p>\n\n<p>If you ever want to loop us in early on a file or just have a quick question before something goes live, we\'re always available.</p>\n\n<p>-- Alex</p>',
    E'Hey {{first_name}},\n\nQuick note on the escrow side, since that\'s really where everything matters most.\n\nOur team is tight, experienced, and very hands-on. Communication is consistent, timelines are managed closely, and we stay ahead of issues before they become problems.\n\nYou won\'t have to chase updates or wonder where things stand. That\'s a big focus for us.\n\nIf you ever want to loop us in early on a file or just have a quick question before something goes live, we\'re always available.\n\n-- Alex'
  ),
  (
    'new-agent-onboarding-step-4',
    1,
    'New Agent Onboarding -- Step 4 -- Day 14 Value example',
    'gmail',
    'campaign',
    'What''s been working lately',
    E'<p>Hey {{first_name}},</p>\n\n<p>One thing that\'s been working really well lately: agents taking one listing and getting multiple uses out of it.</p>\n\n<p>Instead of a single post or flyer, we turn it into:</p>\n\n<ul>\n<li>A strong brochure</li>\n<li>A targeted mailer to the area</li>\n<li>A few clean social pieces</li>\n</ul>\n\n<p>Nothing overbuilt. Just making sure the property actually gets seen and remembered.</p>\n\n<p>If you have something coming up, I\'m happy to help you map something out around it.</p>\n\n<p>-- Alex</p>',
    E'Hey {{first_name}},\n\nOne thing that\'s been working really well lately: agents taking one listing and getting multiple uses out of it.\n\nInstead of a single post or flyer, we turn it into:\n\n- A strong brochure\n- A targeted mailer to the area\n- A few clean social pieces\n\nNothing overbuilt. Just making sure the property actually gets seen and remembered.\n\nIf you have something coming up, I\'m happy to help you map something out around it.\n\n-- Alex'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name      = EXCLUDED.name,
  send_mode = EXCLUDED.send_mode,
  kind      = EXCLUDED.kind,
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();

-- 2. Campaign row (idempotent on locked UUID)

INSERT INTO public.campaigns (id, name, description, type, status, user_id)
VALUES (
  'e13653af-405e-4118-bade-d45d31830b86',
  'New Agent Onboarding',
  'Day 0 / 3 / 7 / 14 nurture sequence triggered when a new realtor contact is created.',
  'drip',
  'active',
  'b735d691-4d86-4e31-9fd3-c2257822dca3'
)
ON CONFLICT (id) DO UPDATE
SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  type        = EXCLUDED.type,
  status      = EXCLUDED.status,
  updated_at  = now();

-- 3. Campaign steps (4 rows, NOT EXISTS guard on campaign_id + step_number)

INSERT INTO public.campaign_steps (campaign_id, step_number, step_type, title, content, delay_days, email_subject, email_body_html, template_slug, user_id)
SELECT
  'e13653af-405e-4118-bade-d45d31830b86'::uuid,
  v.step_number,
  'email',
  v.title,
  v.content,
  v.delay_days,
  v.email_subject,
  v.email_body_html,
  v.template_slug,
  'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
FROM (VALUES
  (
    1,
    'Day 0 -- Welcome',
    'Initial welcome email sent immediately when a new agent is added.',
    0,
    'Staying Connected',
    E'<p>Hey {{first_name}},</p>\n\n<p>Good meeting you. I wanted to send a quick follow-up so you have everything in one place.</p>\n\n<p>Here\'s where I\'m most useful for my agents:</p>\n\n<ul>\n<li>Marketing and print -- clean, well-done pieces that actually get used</li>\n<li>Targeted data -- farming lists, equity pulls, and smart prospecting</li>\n<li>Open house support -- setup, flow, and follow-up strategy</li>\n<li>Content -- simple, consistent pieces to stay in front of your audience</li>\n<li>On-demand help -- if something comes up, I move quick</li>\n</ul>\n\n<p>You don\'t need to overthink any of it. When you have something coming up, just loop me in and I\'ll help you put it together the right way.</p>\n\n<p>Talk soon,<br>Alex</p>',
    'new-agent-onboarding-step-1'
  ),
  (
    2,
    'Day 3 -- How it works',
    'Explains how agents actually use Alex day to day.',
    3,
    'How agents are leveraging resources',
    E'<p>Hey {{first_name}},</p>\n\n<p>Quick follow-up. Here\'s how most of my agents actually use me day-to-day:</p>\n\n<ul>\n<li><strong>Before a listing:</strong> we get in front of the neighborhood early with the right list and a clean piece</li>\n<li><strong>While it\'s live:</strong> brochures, open house setup, and making sure the presentation feels dialed in</li>\n<li><strong>After it sells:</strong> just sold campaigns that keep the conversation going and bring in the next deal</li>\n</ul>\n\n<p>It\'s not complicated. It\'s just being consistent and doing things a little better than most.</p>\n\n<p>If you have something coming up, even if it\'s last minute, I\'m happy to jump in.</p>\n\n<p>-- Alex</p>',
    'new-agent-onboarding-step-2'
  ),
  (
    3,
    'Day 7 -- Escrow team',
    'Introduces the escrow team and sets expectations on communication.',
    7,
    'How We Handle Escrow From Start to Finish',
    E'<p>Hey {{first_name}},</p>\n\n<p>Quick note on the escrow side, since that\'s really where everything matters most.</p>\n\n<p>Our team is tight, experienced, and very hands-on. Communication is consistent, timelines are managed closely, and we stay ahead of issues before they become problems.</p>\n\n<p>You won\'t have to chase updates or wonder where things stand. That\'s a big focus for us.</p>\n\n<p>If you ever want to loop us in early on a file or just have a quick question before something goes live, we\'re always available.</p>\n\n<p>-- Alex</p>',
    'new-agent-onboarding-step-3'
  ),
  (
    4,
    'Day 14 -- Value example',
    'Closes the sequence with a concrete example of how Alex maximizes a listing.',
    14,
    'What''s been working lately',
    E'<p>Hey {{first_name}},</p>\n\n<p>One thing that\'s been working really well lately: agents taking one listing and getting multiple uses out of it.</p>\n\n<p>Instead of a single post or flyer, we turn it into:</p>\n\n<ul>\n<li>A strong brochure</li>\n<li>A targeted mailer to the area</li>\n<li>A few clean social pieces</li>\n</ul>\n\n<p>Nothing overbuilt. Just making sure the property actually gets seen and remembered.</p>\n\n<p>If you have something coming up, I\'m happy to help you map something out around it.</p>\n\n<p>-- Alex</p>',
    'new-agent-onboarding-step-4'
  )
) AS v(step_number, title, content, delay_days, email_subject, email_body_html, template_slug)
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_steps cs
  WHERE cs.campaign_id = 'e13653af-405e-4118-bade-d45d31830b86'::uuid
    AND cs.step_number = v.step_number
    AND cs.deleted_at IS NULL
);

-- 4. Sync campaigns.step_count (denorm)

UPDATE public.campaigns
SET step_count = (
  SELECT COUNT(*) FROM public.campaign_steps
  WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86'::uuid
    AND deleted_at IS NULL
)
WHERE id = 'e13653af-405e-4118-bade-d45d31830b86'::uuid;

COMMIT;

-- Verification:
SELECT slug, kind, send_mode, version, length(body_html) AS html_len
FROM public.templates
WHERE slug LIKE 'new-agent-onboarding%' AND deleted_at IS NULL
ORDER BY slug;

SELECT id, name, type, status, step_count
FROM public.campaigns
WHERE id = 'e13653af-405e-4118-bade-d45d31830b86'::uuid;

SELECT step_number, title, delay_days, template_slug
FROM public.campaign_steps
WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86'::uuid
  AND deleted_at IS NULL
ORDER BY step_number;
-- Slice 5A Task 6 -- Agent Nurture campaign content
--
-- Mirror of live state seeded earlier in the slice via MCP apply_migration
-- and ad-hoc UI edits. This file makes the seed reproducible from a clean
-- DB rebuild. Idempotent: ON CONFLICT clauses + NOT EXISTS guards.
--
-- Cadence per plan: 2 steps at delay_days 0/30, send_mode='gmail'. Live
-- state matches plan exactly.
--
-- Copy follows brand.md Voice Tokens (warm/specific/no exclamations) +
-- Kit 1 fonts (rendered client-side) + first-person Alex voice. Templates
-- ship with Rule 1 [PLACEHOLDER:] markers for rotating recap items + city
-- token; Alex resolves per-send via the drafts UI before approve-and-send.
--
-- Owner UID: b735d691-4d86-4e31-9fd3-c2257822dca3 (Alex).
-- Campaign UUID: 85af274e-ae78-4a32-9915-fefb952dda43 (locked by 2026-04-27 seed).

BEGIN;

-- 1. Templates (2 rows, UPSERT on slug+version)

INSERT INTO public.templates (slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'agent-nurture-step-1',
    1,
    'Agent Nurture -- Step 1 -- Monthly recap',
    'gmail',
    'campaign',
    E'A few things I\'ve put together lately',
    E'<p>Hey {{first_name}},</p>\n\n<p>Wanted to share a quick rundown of what I\'ve been putting together for agents this month. Some of it might spark an idea for something coming up on your end.</p>\n\n<p>Recent pieces:</p>\n\n<ul>\n<li>[PLACEHOLDER: rotating recap item 1, e.g. "A just-listed brochure for an Optima Camelview unit"]</li>\n<li>[PLACEHOLDER: rotating recap item 2, e.g. "A neighborhood farming postcard for a Paradise Valley listing"]</li>\n<li>[PLACEHOLDER: rotating recap item 3, e.g. "A landing page for a $4M Silverleaf property"]</li>\n</ul>\n\n<p>If anything hits, just send me the listing and I\'ll come back with a plan. No pressure either way.</p>\n\n<p>-- Alex</p>',
    E'Hey {{first_name}},\n\nWanted to share a quick rundown of what I\'ve been putting together for agents this month. Some of it might spark an idea for something coming up on your end.\n\nRecent pieces:\n\n- [PLACEHOLDER: rotating recap item 1, e.g. "A just-listed brochure for an Optima Camelview unit"]\n- [PLACEHOLDER: rotating recap item 2, e.g. "A neighborhood farming postcard for a Paradise Valley listing"]\n- [PLACEHOLDER: rotating recap item 3, e.g. "A landing page for a $4M Silverleaf property"]\n\nIf anything hits, just send me the listing and I\'ll come back with a plan. No pressure either way.\n\n-- Alex'
  ),
  (
    'agent-nurture-step-2',
    1,
    'Agent Nurture -- Step 2 -- 30-day soft re-engage',
    'gmail',
    'campaign',
    'Coffee soon?',
    E'<p>Hey {{first_name}},</p>\n\n<p>Wanted to check in. It\'s been a minute, and I\'d like to hear what\'s on your plate over the next few months. Any listings on deck, anything you\'re working through, anything I could help map out.</p>\n\n<p>I keep my schedule pretty open for short coffee stops in [PLACEHOLDER: city or area, e.g. "Old Town Scottsdale"]. If you\'re up for one, send me a couple windows and I\'ll work around you.</p>\n\n<p>-- Alex</p>',
    E'Hey {{first_name}},\n\nWanted to check in. It\'s been a minute, and I\'d like to hear what\'s on your plate over the next few months. Any listings on deck, anything you\'re working through, anything I could help map out.\n\nI keep my schedule pretty open for short coffee stops in [PLACEHOLDER: city or area, e.g. "Old Town Scottsdale"]. If you\'re up for one, send me a couple windows and I\'ll work around you.\n\n-- Alex'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name      = EXCLUDED.name,
  send_mode = EXCLUDED.send_mode,
  kind      = EXCLUDED.kind,
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();

-- 2. Campaign row (idempotent on locked UUID)

INSERT INTO public.campaigns (id, name, description, type, status, user_id)
VALUES (
  '85af274e-ae78-4a32-9915-fefb952dda43',
  'Agent Nurture',
  'Monthly recap touch + 30-day soft re-engagement. Manual enrollment until a post-onboarding hook is wired in a later slice.',
  'drip',
  'active',
  'b735d691-4d86-4e31-9fd3-c2257822dca3'
)
ON CONFLICT (id) DO UPDATE
SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  type        = EXCLUDED.type,
  status      = EXCLUDED.status,
  updated_at  = now();

-- 3. Campaign steps (2 rows, NOT EXISTS guard on campaign_id + step_number)

INSERT INTO public.campaign_steps (campaign_id, step_number, step_type, title, delay_days, email_subject, template_slug, user_id)
SELECT
  '85af274e-ae78-4a32-9915-fefb952dda43'::uuid,
  v.step_number,
  'email',
  v.title,
  v.delay_days,
  v.email_subject,
  v.template_slug,
  'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
FROM (VALUES
  (
    1,
    'Day 0 -- Monthly recap',
    0,
    E'A few things I\'ve put together lately',
    'agent-nurture-step-1'
  ),
  (
    2,
    'Day 30 -- Soft re-engage',
    30,
    'Coffee soon?',
    'agent-nurture-step-2'
  )
) AS v(step_number, title, delay_days, email_subject, template_slug)
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_steps cs
  WHERE cs.campaign_id = '85af274e-ae78-4a32-9915-fefb952dda43'::uuid
    AND cs.step_number = v.step_number
    AND cs.deleted_at IS NULL
);

-- 4. Sync campaigns.step_count (denorm; live row currently shows 0)

UPDATE public.campaigns
SET step_count = (
  SELECT COUNT(*) FROM public.campaign_steps
  WHERE campaign_id = '85af274e-ae78-4a32-9915-fefb952dda43'::uuid
    AND deleted_at IS NULL
)
WHERE id = '85af274e-ae78-4a32-9915-fefb952dda43'::uuid;

COMMIT;

-- Verification:
SELECT slug, kind, send_mode, version, length(body_html) AS html_len
FROM public.templates
WHERE slug LIKE 'agent-nurture-%' AND deleted_at IS NULL
ORDER BY slug;

SELECT id, name, type, status, step_count
FROM public.campaigns
WHERE id = '85af274e-ae78-4a32-9915-fefb952dda43'::uuid;

SELECT step_number, title, delay_days, template_slug
FROM public.campaign_steps
WHERE campaign_id = '85af274e-ae78-4a32-9915-fefb952dda43'::uuid
  AND deleted_at IS NULL
ORDER BY step_number;

-- Remaining placeholders:
--   - agent-nurture-step-1 body: 3x [PLACEHOLDER: rotating recap item N] resolved per-send
--     by Alex in the drafts UI before approve-and-send.
--   - agent-nurture-step-2 body: 1x [PLACEHOLDER: city or area] resolved per-send by Alex.
-- These are template tokens by design (Rule 1 fill-and-flag), not unresolved spec gaps.
-- Slice 5B Task 7b -- Schema deltas (consolidated)
--
-- Mirror of paste-file PASTE-INTO-SUPABASE-slice5b-schema-deltas.sql, executed
-- in Supabase SQL Editor on 2026-04-27. This file makes the deltas reproducible
-- from a clean DB rebuild. Idempotent: ADD COLUMN IF NOT EXISTS, ADD VALUE
-- IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, NOT-NULL guard via DO block.
--
-- Covers:
--   1. project_touchpoints: due_at, deleted_at, user_id (NOT NULL after
--      backfill to alex@alexhollienco.com), last_reminded_at
--   2. project_touchpoints: partial indexes on (due_at), (last_reminded_at)
--      WHERE deleted_at IS NULL
--   3. project_touchpoint_type enum: ADD VALUE 'listing_setup' (G2 path-a)
--   4. tasks: ADD project_id uuid REFERENCES projects(id) ON DELETE SET NULL
--      + partial index WHERE deleted_at IS NULL AND project_id IS NOT NULL
--
-- RLS unchanged: project_touchpoints.alex_touchpoints_all and tasks.users-manage-own
-- both pre-exist (audited 2026-04-27).
--
-- Postgres restriction: ALTER TYPE ... ADD VALUE must run outside any
-- transaction that later references the new value. We add it first
-- (autocommit), then wrap the remaining deltas in BEGIN/COMMIT.

ALTER TYPE public.project_touchpoint_type ADD VALUE IF NOT EXISTS 'listing_setup';

BEGIN;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS due_at timestamptz NULL;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id);

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz NULL;

UPDATE public.project_touchpoints
SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'
WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_touchpoints'
      AND column_name = 'user_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.project_touchpoints ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_touchpoints_due_at
  ON public.project_touchpoints (due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_touchpoints_last_reminded_at
  ON public.project_touchpoints (last_reminded_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON public.tasks (project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

COMMIT;
-- Slice 5B Task 3a -- Listing-launch template seeds
--
-- Mirror of paste-file PASTE-INTO-SUPABASE-slice5b-listing-templates.sql,
-- executed in Supabase SQL Editor on 2026-04-27. Reproducible from a clean
-- DB rebuild.
--
-- Two templates fired by the project-created hook on type='listing'. Land
-- in email_drafts attached to the project; Alex (or the agent) personalizes
-- before approve-and-send.
--
-- Voice: warm, specific, neighbor/sphere addressed. No banned words. No
-- exclamation marks. No em dashes. Brand.md Voice Tokens. Kit 1 fonts.
--
-- Tokens: {{first_name}}, {{agent_first_name}}, {{property_address}},
-- plus [PLACEHOLDER:] markers Alex resolves per-listing at draft time.

BEGIN;

INSERT INTO public.templates (slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'listing-launch-invite',
    1,
    'Listing Launch -- Neighbor invite',
    'gmail',
    'transactional',
    E'Bringing {{property_address}} to market',
    E'<p>Hey {{first_name}},</p>\n\n<p>Wanted you to be among the first to know. {{agent_first_name}} just brought {{property_address}} to market, and given how close you are, it felt right to send a heads-up before it hits the public sites.</p>\n\n<p>A few quick notes on the home:</p>\n\n<ul>\n<li>[PLACEHOLDER: property highlight 1, e.g. "4 bed, 3 bath, 2,840 sq ft on a corner lot"]</li>\n<li>[PLACEHOLDER: property highlight 2, e.g. "Refinished oak floors and a kitchen rebuilt in 2024"]</li>\n<li>[PLACEHOLDER: property highlight 3, e.g. "Walkable to the park and the elementary"]</li>\n</ul>\n\n<p>If you know someone who has been watching the neighborhood, feel free to forward. And if you ever want a quiet read on what your own home would do in this market, {{agent_first_name}} can pull that together for you anytime.</p>\n\n<p>Showings start [PLACEHOLDER: first showing date and time]. Open house [PLACEHOLDER: open house date or "TBD"].</p>\n\n<p>Talk soon,<br>{{agent_first_name}}</p>',
    E'Hey {{first_name}},\n\nWanted you to be among the first to know. {{agent_first_name}} just brought {{property_address}} to market, and given how close you are, it felt right to send a heads-up before it hits the public sites.\n\nA few quick notes on the home:\n\n- [PLACEHOLDER: property highlight 1, e.g. "4 bed, 3 bath, 2,840 sq ft on a corner lot"]\n- [PLACEHOLDER: property highlight 2, e.g. "Refinished oak floors and a kitchen rebuilt in 2024"]\n- [PLACEHOLDER: property highlight 3, e.g. "Walkable to the park and the elementary"]\n\nIf you know someone who has been watching the neighborhood, feel free to forward. And if you ever want a quiet read on what your own home would do in this market, {{agent_first_name}} can pull that together for you anytime.\n\nShowings start [PLACEHOLDER: first showing date and time]. Open house [PLACEHOLDER: open house date or "TBD"].\n\nTalk soon,\n{{agent_first_name}}'
  ),
  (
    'listing-launch-social',
    1,
    'Listing Launch -- Social caption',
    'gmail',
    'transactional',
    E'Social caption -- {{property_address}}',
    E'<p><strong>Caption (Instagram, LinkedIn, Facebook):</strong></p>\n\n<p>Just listed -- {{property_address}}.</p>\n\n<p>[PLACEHOLDER: one-line lifestyle hook, e.g. "Quiet street, big sky, and a kitchen built for slow mornings."]</p>\n\n<p>[PLACEHOLDER: 2-3 spec bullets, e.g. "4 bed | 3 bath | 2,840 sq ft | $1.275M"]</p>\n\n<p>DM for the full tour or a private showing.</p>\n\n<p><em>Hashtags:</em> [PLACEHOLDER: 4-6 location and lifestyle tags, e.g. "#scottsdalerealestate #oldtownliving #justlisted"]</p>\n\n<hr>\n\n<p><strong>Story version (15-second hook):</strong></p>\n\n<p>[PLACEHOLDER: single line, e.g. "Tour day at {{property_address}}. Swipe up for the gallery."]</p>',
    E'Caption (Instagram, LinkedIn, Facebook):\n\nJust listed -- {{property_address}}.\n\n[PLACEHOLDER: one-line lifestyle hook, e.g. "Quiet street, big sky, and a kitchen built for slow mornings."]\n\n[PLACEHOLDER: 2-3 spec bullets, e.g. "4 bed | 3 bath | 2,840 sq ft | $1.275M"]\n\nDM for the full tour or a private showing.\n\nHashtags: [PLACEHOLDER: 4-6 location and lifestyle tags, e.g. "#scottsdalerealestate #oldtownliving #justlisted"]\n\n---\n\nStory version (15-second hook):\n\n[PLACEHOLDER: single line, e.g. "Tour day at {{property_address}}. Swipe up for the gallery."]'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name      = EXCLUDED.name,
  send_mode = EXCLUDED.send_mode,
  kind      = EXCLUDED.kind,
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();

COMMIT;

-- Remaining placeholders (Rule 1):
--   listing-launch-invite: 5 [PLACEHOLDER:] tokens for per-listing details
--   listing-launch-social: 4 [PLACEHOLDER:] tokens for caption + hashtags
-- All intentional, resolved per-listing in the drafts UI before send.
-- Slice 5B Task 7a -- Daily touchpoint summary template seed
--
-- Mirror of paste-file PASTE-INTO-SUPABASE-slice5b-daily-summary-template.sql,
-- executed in Supabase SQL Editor on 2026-04-27. Reproducible from clean DB.
--
-- Fired by /api/cron/touchpoint-reminder (`0 12 * * *` UTC, 5am MST).
-- Tokens: {{date}}, {{count_total}}, {{rows_html}}, {{overflow_count}},
-- {{rows_text}}. Resolved by cron route before sendMessage.
--
-- Kit 1 fonts (email default), inlined for client compatibility. Brand
-- voice: warm, specific. No banned words, no exclamations, no em dashes.
--
-- Idempotency: ON CONFLICT (slug, version) DO UPDATE.

BEGIN;

INSERT INTO public.templates (slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'daily-touchpoint-summary',
    1,
    'Daily Touchpoint Summary',
    'resend',
    'transactional',
    E'Touchpoints due this week -- {{date}}',
    E'<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Touchpoints due this week</title>\n</head>\n<body style="margin:0;padding:0;background:#f7f7f5;font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;margin:0 0 8px 0;">{{date}}</p>\n  <h1 style="font-family:\'Instrument Serif\',Georgia,serif;font-size:32px;line-height:1.2;color:#0a0a0a;margin:0 0 24px 0;font-weight:400;">Here is what is due this week</h1>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 24px 0;">{{count_total}} touchpoints and tasks are due this week or overdue. The list below is sorted by due date.</p>\n  <ul style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0a0a0a;padding-left:20px;margin:0 0 24px 0;">\n    {{rows_html}}\n  </ul>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#666666;margin:0 0 24px 0;">{{overflow_count}}</p>\n  <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#999999;margin:0;">Sent each morning at 5am MST from GAT-BOS. Open the dashboard to act on any item.</p>\n</div>\n</body>\n</html>',
    E'{{date}}\n\nHere is what is due this week\n\n{{count_total}} touchpoints and tasks are due this week or overdue. The list below is sorted by due date.\n\n{{rows_text}}\n\n{{overflow_count}}\n\n---\nSent each morning at 5am MST from GAT-BOS. Open the dashboard to act on any item.'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name      = EXCLUDED.name,
  send_mode = EXCLUDED.send_mode,
  kind      = EXCLUDED.kind,
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();

COMMIT;
-- ============================================================
-- SLICE 6 TASK 1 -- ai_usage_log + current_day_ai_spend_usd RPC
-- ============================================================
-- Plan:   Slice 6 (AI Layer Consolidation + Budget Guard)
-- Branch: gsd/012-slice-6-ai-consolidation-budget-guard
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--   After paste, MCP autonomously runs NOTIFY pgrst, 'reload schema'.
--
-- Idempotent. Safe to re-run. CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS pattern matches Slice 4-5B precedent.
--
-- Soft delete (standing rule 3): deleted_at column. No hard deletes.
-- RLS: Alex-only via auth.jwt() ->> 'email' = 'alex@alexhollienco.com'.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ai_usage_log: per-call audit row for every Claude API call
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature                 text NOT NULL,
  model                   text NOT NULL,
  input_tokens            integer NOT NULL DEFAULT 0,
  output_tokens           integer NOT NULL DEFAULT 0,
  cache_read_tokens       integer NOT NULL DEFAULT 0,
  cache_creation_tokens   integer NOT NULL DEFAULT 0,
  cost_usd                numeric(10,6) NOT NULL DEFAULT 0,
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  context                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id                 uuid NOT NULL,
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_log IS
  'Slice 6: per-call audit + cost tracking for Claude API. Feature column is enum-style text for forward-compat (morning-brief, capture-parse, draft-generate, inbox-score, etc.).';
COMMENT ON COLUMN public.ai_usage_log.cost_usd IS
  'Computed at write time from src/lib/ai/_pricing.ts rate table. numeric(10,6) supports up to 9999.999999.';
COMMENT ON COLUMN public.ai_usage_log.context IS
  'Free-form jsonb for capability-specific metadata (cache_hit boolean, prompt_version, error info on failure rows, etc.).';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_occurred_at
  ON public.ai_usage_log (occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_occurred_at
  ON public.ai_usage_log (feature, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- RLS: Alex-only
-- ------------------------------------------------------------
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_usage_log_all ON public.ai_usage_log;
CREATE POLICY alex_ai_usage_log_all ON public.ai_usage_log
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- RPC: current_day_ai_spend_usd
--
-- Returns running USD spend for today in America/Phoenix tz.
-- SECURITY DEFINER so the budget guard can read aggregate spend
-- without granting per-row SELECT. The function exposes a single
-- scalar; callers cannot use it to enumerate rows.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_day_ai_spend_usd()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM public.ai_usage_log
  WHERE deleted_at IS NULL
    AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'America/Phoenix') AT TIME ZONE 'America/Phoenix';
$func$;

COMMENT ON FUNCTION public.current_day_ai_spend_usd() IS
  'Slice 6: returns running USD spend for today (America/Phoenix calendar day). Used by src/lib/ai/_budget.ts to enforce AI_DAILY_BUDGET_USD.';

-- Tighten grants. Authenticated callers (Alex via the app) can call;
-- anon cannot.
REVOKE ALL ON FUNCTION public.current_day_ai_spend_usd() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO service_role;

COMMIT;

-- ============================================================
-- Verify (optional sanity checks):
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_usage_log';
--   -- expect: ai_usage_log, t
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'ai_usage_log' ORDER BY indexname;
--   -- expect: ai_usage_log_pkey, idx_ai_usage_log_feature_occurred_at, idx_ai_usage_log_occurred_at
--
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_usage_log'::regclass;
--   -- expect: alex_ai_usage_log_all
--
--   SELECT public.current_day_ai_spend_usd();
--   -- expect: 0 (or running total if rows already exist)
-- ============================================================
-- ============================================================
-- SLICE 6 TASK 2 -- ai_cache (per-feature durable result cache)
-- ============================================================
-- Plan:   Slice 6 (AI Layer Consolidation + Budget Guard)
-- Branch: gsd/012-slice-6-ai-consolidation-budget-guard
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--   After paste, MCP autonomously runs NOTIFY pgrst, 'reload schema'.
--
-- Distinct from Anthropic's prompt cache (5-min server-side TTL,
-- automatic). ai_cache is a per-feature durable result cache
-- across runs (e.g. morning-brief computed today's prompt cache
-- hash, don't re-hit Anthropic if the same input fires within
-- the day). Helper at src/lib/ai/_cache.ts.
--
-- Soft delete (standing rule 3): deleted_at column. No hard deletes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ai_cache: durable result cache, keyed (feature, cache_key)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_cache (
  feature      text NOT NULL,
  cache_key    text NOT NULL,
  value        jsonb NOT NULL,
  model        text,
  expires_at   timestamptz,
  accessed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  PRIMARY KEY (feature, cache_key)
);

COMMENT ON TABLE public.ai_cache IS
  'Slice 6: per-feature durable result cache. expires_at NULL = TTL-less. cache_key is sha256 hex of normalized input (helper: src/lib/ai/_cache.ts cacheKey()).';
COMMENT ON COLUMN public.ai_cache.value IS
  'Cached response payload. Shape determined by the capability writing it.';
COMMENT ON COLUMN public.ai_cache.expires_at IS
  'When NULL, the entry has no TTL and persists until soft-deleted. When set, _cache.cacheGet() returns null if now() > expires_at.';

-- ------------------------------------------------------------
-- Index for cleanup (find expired live rows)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature_expires_at
  ON public.ai_cache (feature, expires_at)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- RLS: Alex-only
-- ------------------------------------------------------------
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_cache_all ON public.ai_cache;
CREATE POLICY alex_ai_cache_all ON public.ai_cache
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

COMMIT;

-- ============================================================
-- Verify (optional sanity checks):
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_cache';
--   -- expect: ai_cache, t
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'ai_cache' ORDER BY indexname;
--   -- expect: ai_cache_pkey, idx_ai_cache_feature_expires_at
--
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_cache'::regclass;
--   -- expect: alex_ai_cache_all
-- ============================================================
-- Slice 7A Task 0b -- accounts table foundation (forward)
-- Creates public.accounts, seeds Alex's row, enables RLS, applies owner policies.
-- OWNER_USER_ID resolved at plan time: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

CREATE TABLE public.accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE INDEX accounts_owner_user_id_active_idx
  ON public.accounts (owner_user_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: owner reads own account row.
-- Columns covered (audit clarity): id, name, slug, owner_user_id, created_at, updated_at, deleted_at.
CREATE POLICY accounts_owner_select
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_select ON public.accounts IS
  'Slice 7A: owner reads own account row. Columns: id, name, slug, owner_user_id, created_at, updated_at, deleted_at.';

-- UPDATE policy: owner mutates own account row.
-- Columns covered: name, slug, owner_user_id, deleted_at.
CREATE POLICY accounts_owner_update
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING      (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_update ON public.accounts IS
  'Slice 7A: owner updates own account row. Columns: name, slug, owner_user_id, deleted_at.';

-- DELETE policy: owner soft/hard deletes own account row.
CREATE POLICY accounts_owner_delete
  ON public.accounts
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_delete ON public.accounts IS
  'Slice 7A: owner deletes own account row. Soft delete preferred (set deleted_at).';

-- INSERT not policy-permitted. Account creation lives in 7B+ admin tooling.

INSERT INTO public.accounts (name, slug, owner_user_id)
VALUES ('Alex Hollien', 'alex-hollien', 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid);

COMMIT;

-- Verification (run after commit):
--   SELECT id, name, slug, owner_user_id FROM public.accounts;
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.accounts'::regclass ORDER BY polname;
-- Slice 7A Task 0b-suppl-1 -- ai_cache.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.ai_cache ADD COLUMN user_id uuid;

UPDATE public.ai_cache
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.ai_cache ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.ai_cache ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.ai_cache
  ADD CONSTRAINT ai_cache_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX ai_cache_user_id_idx ON public.ai_cache (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.ai_cache WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='ai_cache' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task B-1 -- ai_cache RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_ai_cache_all with column-based
-- ai_cache_user_isolation. Pre-req: 20260427300100_slice7a_ai_cache_user_id.sql.
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_cache_all ON public.ai_cache;

CREATE POLICY ai_cache_user_isolation
  ON public.ai_cache
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY ai_cache_user_isolation ON public.ai_cache IS
  'Slice 7A: replaces email-based alex_ai_cache_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_cache'::regclass;
--   -- expect: ai_cache_user_isolation (and ONLY that)
-- Slice 7A Task B-2 -- ai_usage_log RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_ai_usage_log_all with column-based
-- ai_usage_log_user_isolation. user_id was pre-existing on this table
-- (one of 3 tables with user_id per pre-flight finding 3.d -- no Phase A
-- user_id add-column migration needed).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_usage_log_all ON public.ai_usage_log;

CREATE POLICY ai_usage_log_user_isolation
  ON public.ai_usage_log
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY ai_usage_log_user_isolation ON public.ai_usage_log IS
  'Slice 7A: replaces email-based alex_ai_usage_log_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_usage_log'::regclass;
--   -- expect: ai_usage_log_user_isolation (and ONLY that)
-- Slice 7A Task B-3 -- attendees RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_attendees_all with column-based
-- attendees_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-2 / 20260427300200_slice7a_attendees_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_attendees_all ON public.attendees;

CREATE POLICY attendees_user_isolation
  ON public.attendees
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY attendees_user_isolation ON public.attendees IS
  'Slice 7A: replaces email-based alex_attendees_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.attendees'::regclass;
--   -- expect: attendees_user_isolation (and ONLY that)
-- Slice 7A Task 0b-suppl-2 -- attendees.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.attendees ADD COLUMN user_id uuid;

UPDATE public.attendees
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.attendees ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.attendees ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.attendees
  ADD CONSTRAINT attendees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX attendees_user_id_idx ON public.attendees (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.attendees WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='attendees' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task B-4 -- email_drafts RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_drafts_all with column-based
-- email_drafts_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-3 / 20260427300300_slice7a_email_drafts_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_drafts_all ON public.email_drafts;

CREATE POLICY email_drafts_user_isolation
  ON public.email_drafts
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY email_drafts_user_isolation ON public.email_drafts IS
  'Slice 7A: replaces email-based alex_drafts_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.email_drafts'::regclass;
--   -- expect: email_drafts_user_isolation (and ONLY that)
-- Slice 7A Task B-5 -- emails RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_emails_all with column-based
-- emails_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-4 / 20260427300400_slice7a_emails_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_emails_all ON public.emails;

CREATE POLICY emails_user_isolation
  ON public.emails
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY emails_user_isolation ON public.emails IS
  'Slice 7A: replaces email-based alex_emails_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.emails'::regclass;
--   -- expect: emails_user_isolation (and ONLY that)
-- ============================================================
-- SLICE 7A TASK B-6 -- error_logs RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 6 of 21
--
-- Replaces email-based alex_error_logs_all with column-based
-- error_logs_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-5 / 20260427300500_slice7a_error_logs_user_id.sql).
--
-- *** SMOKE GATE after this commit (#6 of 21) ***
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-error_logs-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_error_logs_all ON public.error_logs;

CREATE POLICY error_logs_user_isolation
  ON public.error_logs
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY error_logs_user_isolation ON public.error_logs IS
  'Slice 7A: replaces email-based alex_error_logs_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.error_logs'::regclass;
--   -- expect: error_logs_user_isolation (and ONLY that)
-- ============================================================
-- ============================================================
-- SLICE 7A TASK B-7 -- event_templates RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 7 of 21
--
-- Replaces email-based alex_event_templates_all with column-based
-- event_templates_user_isolation. user_id was added in Phase A
-- (20260427300600_slice7a_event_templates_user_id.sql).
--
-- Mid-slice smoke gate (#9) deferred to Phase C harness.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-event_templates-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_event_templates_all ON public.event_templates;

CREATE POLICY event_templates_user_isolation
  ON public.event_templates
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY event_templates_user_isolation ON public.event_templates IS
  'Slice 7A: replaces email-based alex_event_templates_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.event_templates'::regclass;
--   -- expect: event_templates_user_isolation (and ONLY that)
-- ============================================================
-- ============================================================
-- SLICE 7A TASK B-8 -- events RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 8 of 21
--
-- Replaces email-based alex_events_all with column-based
-- events_user_isolation. user_id was added in Phase A
-- (20260427300700_slice7a_events_user_id.sql).
--
-- Mid-slice smoke gate (#9) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-events-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_events_all ON public.events;

CREATE POLICY events_user_isolation
  ON public.events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY events_user_isolation ON public.events IS
  'Slice 7A: replaces email-based alex_events_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.events'::regclass;
--   -- expect: events_user_isolation (and ONLY that)
-- ============================================================
-- ============================================================
-- SLICE 7A TASK B-9 -- message_events RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 9 of 21
--
-- Replaces email-based alex_message_events_all with column-based
-- message_events_user_isolation. user_id was added in Phase A
-- (20260427300800_slice7a_message_events_user_id.sql).
--
-- Mid-slice smoke gate (#9) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-message_events-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_message_events_all ON public.message_events;

CREATE POLICY message_events_user_isolation
  ON public.message_events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY message_events_user_isolation ON public.message_events IS
  'Slice 7A: replaces email-based alex_message_events_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.message_events'::regclass;
--   -- expect: message_events_user_isolation (and ONLY that)
-- ============================================================
-- Slice 7A Task 0b-suppl-3 -- email_drafts.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.email_drafts ADD COLUMN user_id uuid;

UPDATE public.email_drafts
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.email_drafts ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.email_drafts ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX email_drafts_user_id_idx ON public.email_drafts (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.email_drafts WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='email_drafts' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-4 -- emails.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.emails ADD COLUMN user_id uuid;

UPDATE public.emails
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.emails ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.emails ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.emails
  ADD CONSTRAINT emails_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX emails_user_id_idx ON public.emails (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.emails WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='emails' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-5 -- error_logs.user_id add-column (forward)
-- Mirrors PASTE-INTO-SUPABASE-7a-error_logs-add-user-id.sql executed against
-- Supabase. Pattern: NULLABLE add -> backfill from OWNER_USER_ID ->
-- SET NOT NULL -> SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.error_logs ADD COLUMN user_id uuid;

UPDATE public.error_logs
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.error_logs ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.error_logs ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.error_logs
  ADD CONSTRAINT error_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX error_logs_user_id_idx ON public.error_logs (user_id);

COMMIT;
-- Slice 7A Task 0b-suppl-6 -- event_templates.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.event_templates ADD COLUMN user_id uuid;

UPDATE public.event_templates
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.event_templates ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.event_templates ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.event_templates
  ADD CONSTRAINT event_templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX event_templates_user_id_idx ON public.event_templates (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.event_templates WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='event_templates' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-7 -- events.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.events ADD COLUMN user_id uuid;

UPDATE public.events
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.events ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.events ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX events_user_id_idx ON public.events (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.events WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='events' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-8 -- message_events.user_id add-column (forward, idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- Repair pattern: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS so re-runs are safe.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.message_events ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.message_events
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.message_events ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.message_events ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.message_events
  DROP CONSTRAINT IF EXISTS message_events_user_id_fkey;

ALTER TABLE public.message_events
  ADD CONSTRAINT message_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS message_events_user_id_idx
  ON public.message_events (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.message_events WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='message_events' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-9 -- messages_log.user_id add-column (forward, idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- Repair pattern: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS so re-runs are safe.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.messages_log ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.messages_log
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.messages_log ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.messages_log ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.messages_log
  DROP CONSTRAINT IF EXISTS messages_log_user_id_fkey;

ALTER TABLE public.messages_log
  ADD CONSTRAINT messages_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS messages_log_user_id_idx
  ON public.messages_log (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.messages_log WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='messages_log' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-10 -- morning_briefs.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.morning_briefs ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.morning_briefs
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.morning_briefs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.morning_briefs ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.morning_briefs
  DROP CONSTRAINT IF EXISTS morning_briefs_user_id_fkey;

ALTER TABLE public.morning_briefs
  ADD CONSTRAINT morning_briefs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS morning_briefs_user_id_idx
  ON public.morning_briefs (user_id);

COMMIT;
-- Slice 7A Task 0b-suppl-11 -- projects.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.projects
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS projects_user_id_idx
  ON public.projects (user_id);

COMMIT;
-- Slice 7A Task 0b-suppl-12 -- relationship_health_config.user_id add-column (forward, idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- Repair pattern: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS so re-runs are safe.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.relationship_health_config ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.relationship_health_config
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.relationship_health_config ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.relationship_health_config ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.relationship_health_config
  DROP CONSTRAINT IF EXISTS relationship_health_config_user_id_fkey;

ALTER TABLE public.relationship_health_config
  ADD CONSTRAINT relationship_health_config_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS relationship_health_config_user_id_idx
  ON public.relationship_health_config (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.relationship_health_config WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='relationship_health_config' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-13 -- relationship_health_scores.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.relationship_health_scores ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.relationship_health_scores
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.relationship_health_scores ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.relationship_health_scores ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.relationship_health_scores
  DROP CONSTRAINT IF EXISTS relationship_health_scores_user_id_fkey;

ALTER TABLE public.relationship_health_scores
  ADD CONSTRAINT relationship_health_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS relationship_health_scores_user_id_idx
  ON public.relationship_health_scores (user_id);

COMMIT;
-- Slice 7A Task 0b-suppl-14 -- relationship_health_touchpoint_weights.user_id add-column (forward, idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- Repair pattern: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS so re-runs are safe.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.relationship_health_touchpoint_weights ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.relationship_health_touchpoint_weights
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.relationship_health_touchpoint_weights ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.relationship_health_touchpoint_weights ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.relationship_health_touchpoint_weights
  DROP CONSTRAINT IF EXISTS relationship_health_touchpoint_weights_user_id_fkey;

ALTER TABLE public.relationship_health_touchpoint_weights
  ADD CONSTRAINT relationship_health_touchpoint_weights_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS relationship_health_touchpoint_weights_user_id_idx
  ON public.relationship_health_touchpoint_weights (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.relationship_health_touchpoint_weights WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='relationship_health_touchpoint_weights' AND column_name='user_id';
--   -- expect 'auth.uid()'
-- Slice 7A Task 0b-suppl-15 -- templates.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.templates
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.templates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.templates ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_user_id_fkey;

ALTER TABLE public.templates
  ADD CONSTRAINT templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS templates_user_id_idx
  ON public.templates (user_id);

COMMIT;
-- Add missing standard lifecycle timestamps across remediation surface.
-- Audit source: ~/crm/audit/live-schema.sql (40 tables inventoried 2026-04-29).
-- Skips rate_limits (ephemeral counter, no lifecycle).
-- Standard tuple: created_at (default now()), updated_at (default now() + trigger),
-- deleted_at (nullable, soft-delete per Standing Rule 3).
-- Idempotent via ADD COLUMN IF NOT EXISTS and DROP TRIGGER IF EXISTS guards.

BEGIN;

-- ---------------------------------------------------------------------------
-- created_at additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.relationship_health_config
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.relationship_health_scores
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.relationship_health_touchpoint_weights
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- updated_at additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ai_cache                  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ai_usage_log              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.api_usage_log             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.emails                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.error_logs                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.inbox_items               ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.message_events            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.messages_log              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.morning_briefs            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.oauth_tokens              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.project_touchpoints       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.relationship_health_scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ticket_items              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill updated_at = created_at where the row predated this migration.
-- The DEFAULT now() above stamps all existing rows with the migration time;
-- align them with their created_at so updated_at is meaningful from day one.
UPDATE public.activity_events            SET updated_at = created_at;
UPDATE public.ai_usage_log               SET updated_at = created_at;
UPDATE public.api_usage_log              SET updated_at = created_at;
UPDATE public.emails                     SET updated_at = created_at;
UPDATE public.error_logs                 SET updated_at = created_at;
UPDATE public.inbox_items                SET updated_at = created_at;
UPDATE public.message_events             SET updated_at = created_at;
UPDATE public.messages_log               SET updated_at = created_at;
UPDATE public.morning_briefs             SET updated_at = created_at;
UPDATE public.oauth_tokens               SET updated_at = created_at;
UPDATE public.project_touchpoints        SET updated_at = created_at;
UPDATE public.relationship_health_scores SET updated_at = computed_at;
UPDATE public.ticket_items               SET updated_at = created_at;
-- ai_cache has no created_at to align against; leave at default now().

-- ---------------------------------------------------------------------------
-- deleted_at additions (soft-delete per Standing Rule 3)
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_metrics                          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.captures                               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.email_drafts                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.emails                                 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.email_log                              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.error_logs                             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.inbox_items                            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.oauth_tokens                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.relationship_health_config             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.relationship_health_touchpoint_weights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.ticket_items                           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- updated_at triggers (uses public.set_updated_at() defined in baseline)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  trigger_tables text[] := ARRAY[
    'activity_events',
    'ai_cache',
    'ai_usage_log',
    'api_usage_log',
    'emails',
    'error_logs',
    'inbox_items',
    'message_events',
    'messages_log',
    'morning_briefs',
    'oauth_tokens',
    'project_touchpoints',
    'relationship_health_scores',
    'ticket_items'
  ];
BEGIN
  FOREACH t IN ARRAY trigger_tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END
$$;

COMMIT;
-- ============================================================
-- PHASE 1.3.1 -- GMAIL MVP SCHEMA
-- Tables: emails, email_drafts, oauth_tokens, error_logs
-- Enum:   email_draft_status
-- RLS:    alex-only, keyed on auth.jwt() email claim (single-user system)
-- ============================================================
-- Spec:  ~/Downloads/GAT-BOS-Phase-1.3.1-Gmail-MVP-Specification.md
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 2)
-- Generated: 2026-04-16
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file fully rebuilds the schema. No data loss risk
-- on first run (tables are new); on re-run, all Phase 1.3.1 data
-- is wiped. Do not re-run after Phase 3 populates emails.
--
-- RLS approach:
--   Spec section "Row-Level Security" uses auth.uid() = '{{ALEX_UUID}}'.
--   Spec section "API Route Protection" gates on email == alex@alexhollienco.com.
--   We keep policies keyed on auth.jwt() ->> 'email' to match the route
--   protection contract exactly, avoid hardcoding a UUID, and stay
--   single-user-clean. Server-side inserts from the cron route bypass
--   RLS via service_role key (standard Supabase pattern).
--
-- OAuth token encryption:
--   access_token + refresh_token stored as TEXT in this migration.
--   Application-level encryption via Supabase Vault lands in Phase 3
--   when the OAuth callback handler writes tokens. Do not insert
--   real tokens until Phase 3 encryption is wired.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.email_drafts CASCADE;
DROP TABLE IF EXISTS public.emails CASCADE;
DROP TABLE IF EXISTS public.oauth_tokens CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TYPE  IF EXISTS public.email_draft_status CASCADE;

-- ------------------------------------------------------------
-- Enum: email_draft_status
-- ------------------------------------------------------------
CREATE TYPE public.email_draft_status AS ENUM (
  'generated',
  'approved',
  'sent',
  'discarded',
  'revised'
);

-- ------------------------------------------------------------
-- emails: synced from Gmail, filtered to contacts + RE domains
-- ------------------------------------------------------------
CREATE TABLE public.emails (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_id           TEXT UNIQUE NOT NULL,
  gmail_thread_id    TEXT,
  from_email         TEXT NOT NULL,
  from_name          TEXT,
  subject            TEXT NOT NULL,
  body_plain         TEXT,
  body_html          TEXT,
  snippet            TEXT,
  is_unread          BOOLEAN NOT NULL DEFAULT TRUE,
  is_contact_match   BOOLEAN NOT NULL DEFAULT FALSE,
  contact_id         UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_domain     TEXT,
  is_potential_re_pro BOOLEAN NOT NULL DEFAULT FALSE,
  labels             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emails_contact_id      ON public.emails (contact_id);
CREATE INDEX idx_emails_unread_recent   ON public.emails (is_unread, created_at DESC);
CREATE INDEX idx_emails_from_email      ON public.emails (from_email);

COMMENT ON TABLE public.emails IS
  'Gmail messages synced via /api/gmail/sync. Filtered to contacts + RE domain pattern. Upsert on gmail_id; duplicate syncs update synced_at only.';

-- ------------------------------------------------------------
-- email_drafts: Claude-generated responses + approval history
-- ------------------------------------------------------------
CREATE TABLE public.email_drafts (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id                     UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  draft_subject                TEXT,
  draft_body_plain             TEXT,
  draft_body_html              TEXT,
  status                       public.email_draft_status NOT NULL DEFAULT 'generated',
  escalation_flag              TEXT CHECK (escalation_flag IN ('marlene', 'agent_followup') OR escalation_flag IS NULL),
  escalation_reason            TEXT,
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  approved_at                  TIMESTAMPTZ,
  approved_by                  TEXT,
  sent_at                      TIMESTAMPTZ,
  sent_via                     TEXT CHECK (sent_via IN ('resend', 'gmail_draft') OR sent_via IS NULL),
  revisions_count              INT NOT NULL DEFAULT 0,
  created_in_gmail_draft_id    TEXT,
  created_in_obsidian_file_path TEXT,
  audit_log                    JSONB NOT NULL DEFAULT jsonb_build_object('event_sequence', '[]'::jsonb, 'metadata', '{}'::jsonb),
  metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drafts_email_id        ON public.email_drafts (email_id);
CREATE INDEX idx_drafts_status_recent   ON public.email_drafts (status, created_at DESC);
CREATE INDEX idx_drafts_expires_at      ON public.email_drafts (expires_at);

COMMENT ON TABLE public.email_drafts IS
  'Claude-generated drafts + full audit trail. expires_at = generated_at + 30 min. Phase 5 rejects sends on expired drafts. One active draft per email_id; re-generating an existing generated/approved draft is a no-op per spec idempotency rule.';

-- ------------------------------------------------------------
-- oauth_tokens: Google OAuth credentials (single user, single provider for now)
-- ------------------------------------------------------------
CREATE TABLE public.oauth_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL DEFAULT 'alex',
  provider       TEXT NOT NULL DEFAULT 'google',
  access_token   TEXT,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ,
  scopes         TEXT[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at   TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.oauth_tokens IS
  'OAuth refresh/access tokens. NOT YET encrypted at column level -- Phase 3 wraps writes in Supabase Vault. Do not insert real tokens until Phase 3 lands.';

-- ------------------------------------------------------------
-- error_logs: system failures captured from API routes
-- ------------------------------------------------------------
CREATE TABLE public.error_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint       TEXT,
  error_code     INT,
  error_message  TEXT,
  context        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_error_logs_recent     ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON public.error_logs (resolved, created_at DESC) WHERE resolved = FALSE;

COMMENT ON TABLE public.error_logs IS
  'System error capture for Phase 3/4/5 API routes. context JSONB holds draft_id, email_id, gmail API response, retry attempt count.';

-- ------------------------------------------------------------
-- updated_at trigger for email_drafts
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_email_drafts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_drafts_updated_at ON public.email_drafts;
CREATE TRIGGER trg_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_email_drafts_updated_at();

-- ------------------------------------------------------------
-- RLS: single-user system, alex-only via JWT email claim
-- ------------------------------------------------------------
ALTER TABLE public.emails        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_emails_all"       ON public.emails;
DROP POLICY IF EXISTS "alex_drafts_all"       ON public.email_drafts;
DROP POLICY IF EXISTS "alex_oauth_tokens_all" ON public.oauth_tokens;
DROP POLICY IF EXISTS "alex_error_logs_all"   ON public.error_logs;

CREATE POLICY "alex_emails_all" ON public.emails
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_drafts_all" ON public.email_drafts
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_oauth_tokens_all" ON public.oauth_tokens
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_error_logs_all" ON public.error_logs
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants: authenticated role gets full CRUD (RLS does the gating);
-- service_role bypasses RLS for server-side cron + OAuth callback.
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_tokens  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs    TO authenticated;

GRANT USAGE ON TYPE public.email_draft_status TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.emails;         -- expect 0
-- SELECT count(*) FROM public.email_drafts;   -- expect 0
-- SELECT count(*) FROM public.oauth_tokens;   -- expect 0
-- SELECT count(*) FROM public.error_logs;     -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('emails','email_drafts','oauth_tokens','error_logs')
-- ORDER BY tablename, polname;
-- -- expect 4 rows, one policy per table
--
-- SELECT unnest(enum_range(NULL::public.email_draft_status));
-- -- expect 5 rows: generated, approved, sent, discarded, revised
--
-- ============================================================
-- ============================================================
-- PHASE 1.3.2-C -- OBSERVATION INSTRUMENTATION
-- View:  email_drafts_observation
-- RLS:   alex-only via security_invoker (inherits from email_drafts,
--        emails, contacts policies already enabled in earlier phases)
-- ============================================================
-- Plan: ~/.claude/plans/phase-1.3.2.md (Phase C)
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: DROP VIEW IF EXISTS ... CASCADE before CREATE. Re-running
-- fully rebuilds the view. No data loss (view only; zero storage).
--
-- Columns (per plan Phase C task 1):
--   draft_id, contact_id, contact_tier, escalation_flag,
--   action_taken, generated_at, acted_at,
--   time_to_action_seconds, was_revised
--
-- action_taken derivation (from audit_log.event_sequence):
--   sent_via_resend       -> 'send_now'
--   sent_via_gmail_draft  -> 'create_gmail_draft'
--   user_discarded        -> 'discarded'
--   (no terminal event)   -> NULL (still pending / expired without action)
--
-- was_revised: true when any user_revised event appears in event_sequence.
--
-- RLS: security_invoker=true so the view executes as the querying role.
-- email_drafts + emails + contacts RLS policies gate access. service_role
-- bypasses RLS (used by readout helpers) per standard Supabase pattern.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.email_drafts_observation CASCADE;

-- ------------------------------------------------------------
-- email_drafts_observation: per-draft readout surface for Phase E
-- ------------------------------------------------------------
CREATE VIEW public.email_drafts_observation
WITH (security_invoker = 'true') AS
WITH terminal AS (
  SELECT
    d.id AS draft_id,
    (
      SELECT ev
      FROM jsonb_array_elements(
             COALESCE(d.audit_log -> 'event_sequence', '[]'::jsonb)
           ) AS ev
      WHERE ev ->> 'event' IN (
        'sent_via_resend',
        'sent_via_gmail_draft',
        'user_discarded'
      )
      ORDER BY (ev ->> 'timestamp')::timestamptz DESC
      LIMIT 1
    ) AS terminal_ev,
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
             COALESCE(d.audit_log -> 'event_sequence', '[]'::jsonb)
           ) AS ev
      WHERE ev ->> 'event' = 'user_revised'
    ) AS was_revised
  FROM public.email_drafts d
)
SELECT
  d.id                             AS draft_id,
  e.contact_id                     AS contact_id,
  c.tier                           AS contact_tier,
  d.escalation_flag                AS escalation_flag,
  CASE t.terminal_ev ->> 'event'
    WHEN 'sent_via_resend'      THEN 'send_now'
    WHEN 'sent_via_gmail_draft' THEN 'create_gmail_draft'
    WHEN 'user_discarded'       THEN 'discarded'
    ELSE NULL
  END                              AS action_taken,
  d.generated_at                   AS generated_at,
  CASE
    WHEN t.terminal_ev IS NOT NULL
    THEN (t.terminal_ev ->> 'timestamp')::timestamptz
    ELSE NULL
  END                              AS acted_at,
  CASE
    WHEN t.terminal_ev IS NOT NULL
    THEN EXTRACT(
           EPOCH FROM (
             (t.terminal_ev ->> 'timestamp')::timestamptz - d.generated_at
           )
         )::int
    ELSE NULL
  END                              AS time_to_action_seconds,
  COALESCE(t.was_revised, false)   AS was_revised
FROM public.email_drafts d
JOIN public.emails       e ON e.id = d.email_id
LEFT JOIN public.contacts c ON c.id = e.contact_id
LEFT JOIN terminal       t ON t.draft_id = d.id;

COMMENT ON VIEW public.email_drafts_observation IS
  'Phase 1.3.2-C per-draft readout surface. Joins email_drafts -> emails -> contacts for tier context and derives action_taken from the terminal event in audit_log.event_sequence. security_invoker=true so RLS on the underlying tables applies; alex-only in single-user mode.';

GRANT SELECT ON public.email_drafts_observation TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.email_drafts_observation;
-- -- expect the same count as public.email_drafts for the current session.
--
-- SELECT action_taken, count(*)
-- FROM public.email_drafts_observation
-- GROUP BY 1 ORDER BY 1 NULLS FIRST;
-- -- expect rows like: (null, N), ('discarded', N), ('send_now', N),
-- --                   ('create_gmail_draft', N)
--
-- SELECT contact_tier, count(*)
-- FROM public.email_drafts_observation
-- GROUP BY 1 ORDER BY 1 NULLS FIRST;
-- -- expect tier distribution across A/B/C/P/null.
--
-- ============================================================
-- ============================================================
-- PHASE 1.4 -- PROJECTS DATA MODEL
-- Tables: projects, project_touchpoints
-- Enums:  project_type, project_status
-- RLS:    alex-only, keyed on auth.jwt() ->> 'email'
-- ============================================================
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 6)
-- Generated: 2026-04-18
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file rebuilds Phase 1.4 schema only. projects and
-- project_touchpoints are new in 1.4; no data loss on first run. On
-- re-run, all Phase 1.4 data is wiped. Do not re-run after real
-- projects exist.
--
-- Polymorphism:
--   project_touchpoints.entity_table + entity_id form a polymorphic
--   pointer into emails / email_drafts / events / contacts / notes.
--   No cross-table FK enforcement -- application layer owns integrity.
--   (Plan Phase 6 accepts this trade.)
--
-- Soft delete (standing rule 3):
--   projects carry deleted_at TIMESTAMPTZ NULL. project_touchpoints
--   ride parent lifecycle via ON DELETE CASCADE -- touchpoints are
--   not independently soft-deletable.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.project_touchpoints CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TYPE  IF EXISTS public.project_type CASCADE;
DROP TYPE  IF EXISTS public.project_status CASCADE;
DROP TYPE  IF EXISTS public.project_touchpoint_type CASCADE;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
CREATE TYPE public.project_type AS ENUM (
  'agent_bd',
  'home_tour',
  'happy_hour',
  'campaign',
  'listing',
  'other'
);

CREATE TYPE public.project_status AS ENUM (
  'active',
  'paused',
  'closed'
);

CREATE TYPE public.project_touchpoint_type AS ENUM (
  'email',
  'event',
  'voice_memo',
  'contact_note'
);

-- ------------------------------------------------------------
-- projects: polymorphic parent for touchpoints
-- ------------------------------------------------------------
CREATE TABLE public.projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               public.project_type NOT NULL,
  title              TEXT NOT NULL,
  status             public.project_status NOT NULL DEFAULT 'active',
  owner_contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_projects_status_active ON public.projects (status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_owner         ON public.projects (owner_contact_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_type          ON public.projects (type)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.projects IS
  'Polymorphic project entity. Links arbitrary touchpoints (emails, events, contacts, notes) under one initiative. Soft-delete via deleted_at per standing rule 3.';

-- ------------------------------------------------------------
-- project_touchpoints: polymorphic children
-- ------------------------------------------------------------
CREATE TABLE public.project_touchpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  touchpoint_type public.project_touchpoint_type NOT NULL,
  entity_id       UUID NOT NULL,
  entity_table    TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_touchpoints_project   ON public.project_touchpoints (project_id, occurred_at DESC NULLS LAST);
CREATE INDEX idx_touchpoints_entity    ON public.project_touchpoints (entity_table, entity_id);
CREATE INDEX idx_touchpoints_type      ON public.project_touchpoints (touchpoint_type);

COMMENT ON TABLE public.project_touchpoints IS
  'Polymorphic touchpoint rows linking a project to any domain entity. entity_table + entity_id = untyped FK. Application layer enforces integrity. Cascade deletes with parent project.';

-- ------------------------------------------------------------
-- updated_at trigger for projects
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_projects_updated_at();

-- ------------------------------------------------------------
-- RLS: alex-only, same pattern as Phase 1.3.1
-- ------------------------------------------------------------
ALTER TABLE public.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_projects_all"      ON public.projects;
DROP POLICY IF EXISTS "alex_touchpoints_all"   ON public.project_touchpoints;

CREATE POLICY "alex_projects_all" ON public.projects
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

CREATE POLICY "alex_touchpoints_all" ON public.project_touchpoints
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_touchpoints TO authenticated;

GRANT USAGE ON TYPE public.project_type            TO authenticated, service_role;
GRANT USAGE ON TYPE public.project_status          TO authenticated, service_role;
GRANT USAGE ON TYPE public.project_touchpoint_type TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.projects;             -- expect 0
-- SELECT count(*) FROM public.project_touchpoints;  -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('projects','project_touchpoints')
-- ORDER BY tablename, polname;
-- -- expect 2 rows
--
-- SELECT unnest(enum_range(NULL::public.project_type));
-- -- expect 6 rows: agent_bd, home_tour, happy_hour, campaign, listing, other
--
-- SELECT unnest(enum_range(NULL::public.project_status));
-- -- expect 3 rows: active, paused, closed
--
-- SELECT unnest(enum_range(NULL::public.project_touchpoint_type));
-- -- expect 4 rows: email, event, voice_memo, contact_note
--
-- ============================================================
-- ============================================================
-- PHASE 1.5 -- CALENDAR BIDIRECTIONAL SYNC
-- Table:  events
-- Enum:   event_source
-- RLS:    alex-only, keyed on auth.jwt() ->> 'email'
-- ============================================================
-- Plan:  ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 7)
-- Generated: 2026-04-18
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: every CREATE is preceded by DROP IF EXISTS CASCADE.
-- Re-running this file rebuilds Phase 1.5 schema only. events is new
-- in 1.5; no data loss on first run. On re-run, all Phase 1.5 data
-- is wiped. Do not re-run after real events are synced.
--
-- Bidirectional sync contract:
--   source='gcal_pull'       -- row origin is Google Calendar; inbound
--                               cron upserts on gcal_event_id; GCal
--                               wins (overwrites local fields).
--   source='dashboard_create'-- row originated in GAT-BOS; /api/calendar/create
--                               inserts locally first, then calls
--                               events.insert on GCal and backfills
--                               gcal_event_id. Dashboard is canonical.
--
-- Soft delete (standing rule 3):
--   events carry deleted_at TIMESTAMPTZ NULL. No hard deletes.
--
-- FK scoping:
--   project_id REFERENCES projects(id) ON DELETE SET NULL
--   contact_id REFERENCES contacts(id) ON DELETE SET NULL
--   Both nullable; an event can stand alone without a project or contact.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.events CASCADE;
DROP TYPE  IF EXISTS public.event_source CASCADE;

-- ------------------------------------------------------------
-- Enum: event_source
-- ------------------------------------------------------------
CREATE TYPE public.event_source AS ENUM (
  'gcal_pull',
  'dashboard_create'
);

-- ------------------------------------------------------------
-- events: calendar entries, bidirectionally synced with Google Calendar
-- ------------------------------------------------------------
CREATE TABLE public.events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gcal_event_id  TEXT UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  location       TEXT,
  attendees      JSONB NOT NULL DEFAULT '[]'::jsonb,
  project_id     UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  source         public.event_source NOT NULL,
  synced_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- gcal_event_id is NULL for dashboard-created events between local
-- insert and successful outbound events.insert. Partial unique already
-- enforced by UNIQUE constraint (NULLs are distinct in Postgres).

CREATE INDEX idx_events_start_at      ON public.events (start_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_events_gcal_event_id ON public.events (gcal_event_id)
  WHERE gcal_event_id IS NOT NULL;
CREATE INDEX idx_events_project       ON public.events (project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;
CREATE INDEX idx_events_contact       ON public.events (contact_id)
  WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
CREATE INDEX idx_events_today_window  ON public.events (start_at, end_at)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.events IS
  'Calendar events, bidirectionally synced with Google Calendar. source=gcal_pull rows are overwritten by hourly cron (GCal wins). source=dashboard_create rows are created locally, then mirrored to GCal and backfilled with gcal_event_id. Soft-delete via deleted_at per standing rule 3.';

-- ------------------------------------------------------------
-- updated_at trigger for events
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_events_updated_at();

-- ------------------------------------------------------------
-- RLS: alex-only, same pattern as Phase 1.3.1 and 1.4
-- ------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_events_all" ON public.events;

CREATE POLICY "alex_events_all" ON public.events
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

GRANT USAGE ON TYPE public.event_source TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.events;   -- expect 0
--
-- SELECT polname, tablename
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'events'
-- ORDER BY polname;
-- -- expect 1 row: alex_events_all
--
-- SELECT unnest(enum_range(NULL::public.event_source));
-- -- expect 2 rows: gcal_pull, dashboard_create
--
-- \d+ public.events
-- -- confirm indexes + FKs to projects and contacts
--
-- ============================================================
-- Phase 9 -- add email_drafts to supabase_realtime publication.
-- Root cause: Phase 1.3.1 migration created email_drafts and the DraftsPending
-- component (src/components/today/drafts-pending.tsx) subscribes to postgres_changes
-- on public.email_drafts via channel 'drafts_pending_today', but the table was never
-- added to supabase_realtime, so the subscription connects successfully yet never
-- receives INSERT/UPDATE/DELETE events. Idempotent per repo convention.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_drafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_drafts;
    RAISE NOTICE 'Added email_drafts to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'email_drafts already in supabase_realtime publication.';
  END IF;
END $$;
-- Slice 2A: Drop spine tables and the trigger that writes into cycle_state.
-- Execute manually in Supabase SQL Editor. Claude does NOT run this.
--
-- Trigger must be dropped before cycle_state is dropped.
-- All 5 tables use IF EXISTS so the statement is idempotent.

DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions;

DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.focus_queue CASCADE;
DROP TABLE IF EXISTS public.cycle_state CASCADE;
DROP TABLE IF EXISTS public.signals CASCADE;
DROP TABLE IF EXISTS public.spine_inbox CASCADE;
