-- 7A.5 fix: create the 7 prod tables that have no local CREATE migration.
--
-- Source: ~/audit/2026-04-30-slice7a5-reconciliation/prod-schema.sql, identified
-- by ~/audit/2026-04-30-slice7a5-reconciliation/missing-creates.txt as having
-- "(NO source found in prod-only either)" -- they were applied to prod via
-- paste-and-mirror outside any captured migration version. Mirroring here so
-- `supabase db reset` against fresh local Docker can replay end-to-end.
--
-- Idempotent via CREATE TABLE IF NOT EXISTS + DO blocks for constraints.
-- This migration will be marked applied in prod via
-- `supabase migration repair --status applied` per the 7A.5 reconciliation plan,
-- so prod (where the tables already exist) is unaffected.

CREATE TABLE IF NOT EXISTS public.attendees (
    id           uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id     uuid NOT NULL,
    contact_id   uuid NOT NULL,
    rsvp_status  text DEFAULT 'invited'::text NOT NULL,
    invited_at   timestamp with time zone,
    responded_at timestamp with time zone,
    recorded_at  timestamp with time zone,
    notes        text,
    created_at   timestamp with time zone DEFAULT now() NOT NULL,
    updated_at   timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at   timestamp with time zone,
    -- user_id is added by 20260427300200_slice7a_attendees_user_id.sql; do not duplicate.
    CONSTRAINT attendees_rsvp_status_check CHECK ((rsvp_status = ANY (ARRAY['invited'::text, 'accepted'::text, 'declined'::text, 'attended'::text, 'no_show'::text])))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendees_pkey') THEN
    ALTER TABLE public.attendees ADD CONSTRAINT attendees_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_templates (
    id               uuid DEFAULT gen_random_uuid() NOT NULL,
    name             text NOT NULL,
    owner_contact_id uuid NOT NULL,
    week_of_month    integer NOT NULL,
    day_of_week      integer NOT NULL,
    start_time       time without time zone NOT NULL,
    end_time         time without time zone NOT NULL,
    location_type    text NOT NULL,
    default_location text,
    lender_flag      text DEFAULT 'none'::text NOT NULL,
    notes            text,
    rrule            text,
    active           boolean DEFAULT true NOT NULL,
    created_at       timestamp with time zone DEFAULT now() NOT NULL,
    updated_at       timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at       timestamp with time zone,
    -- user_id is added by 20260427300600_slice7a_event_templates_user_id.sql; do not duplicate.
    CONSTRAINT event_templates_day_of_week_check    CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT event_templates_fixed_has_location   CHECK (((location_type <> 'fixed'::text) OR (default_location IS NOT NULL))),
    CONSTRAINT event_templates_lender_flag_check    CHECK ((lender_flag = ANY (ARRAY['alex'::text, 'stephanie'::text, 'christine'::text, 'none'::text]))),
    CONSTRAINT event_templates_location_type_check  CHECK ((location_type = ANY (ARRAY['fixed'::text, 'rotating'::text]))),
    CONSTRAINT event_templates_time_order           CHECK ((end_time > start_time)),
    CONSTRAINT event_templates_week_of_month_check  CHECK (((week_of_month >= 1) AND (week_of_month <= 5)))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_templates_pkey') THEN
    ALTER TABLE public.event_templates ADD CONSTRAINT event_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.relationship_health_config (
    id               smallint DEFAULT 1 NOT NULL,
    half_life_days   numeric(8,2) DEFAULT 45.00 NOT NULL,
    max_age_days     numeric(8,2) DEFAULT 730.00 NOT NULL,
    updated_at       timestamp with time zone DEFAULT now() NOT NULL,
    -- user_id is added by 20260427301200_slice7a_relationship_health_config_user_id.sql; do not duplicate.
    CONSTRAINT half_life_positive                       CHECK ((half_life_days > (0)::numeric)),
    CONSTRAINT max_age_positive                         CHECK ((max_age_days > (0)::numeric)),
    CONSTRAINT relationship_health_config_singleton     CHECK ((id = 1))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_health_config_pkey') THEN
    ALTER TABLE public.relationship_health_config ADD CONSTRAINT relationship_health_config_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.relationship_health_scores (
    contact_id          uuid NOT NULL,
    score               numeric(10,4) DEFAULT 0 NOT NULL,
    touchpoint_count    integer DEFAULT 0 NOT NULL,
    last_touchpoint_at  timestamp with time zone,
    half_life_days      numeric(8,2) NOT NULL,
    computed_at         timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at          timestamp with time zone,
    -- user_id is added by 20260429001601_slice7a_relationship_health_scores_user_id_from_prod_mirror.sql; do not duplicate.
    CONSTRAINT score_non_negative CHECK ((score >= (0)::numeric))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_health_scores_pkey') THEN
    ALTER TABLE public.relationship_health_scores ADD CONSTRAINT relationship_health_scores_pkey PRIMARY KEY (contact_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.relationship_health_touchpoint_weights (
    touchpoint_type public.project_touchpoint_type NOT NULL,
    weight          numeric(6,2) NOT NULL,
    updated_at      timestamp with time zone DEFAULT now() NOT NULL,
    -- user_id is added by 20260427301400_slice7a_relationship_health_touchpoint_weights_user_id.sql; do not duplicate.
    CONSTRAINT weight_non_negative CHECK ((weight >= (0)::numeric))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_health_touchpoint_weights_pkey') THEN
    ALTER TABLE public.relationship_health_touchpoint_weights ADD CONSTRAINT relationship_health_touchpoint_weights_pkey PRIMARY KEY (touchpoint_type);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id         uuid,
    contact_id      uuid,
    title           text NOT NULL,
    request_type    public.material_request_type DEFAULT 'print_ready'::public.material_request_type NOT NULL,
    status          public.material_request_status DEFAULT 'draft'::public.material_request_status NOT NULL,
    priority        public.material_request_priority DEFAULT 'standard'::public.material_request_priority NOT NULL,
    notes           text,
    submitted_at    timestamp with time zone,
    completed_at    timestamp with time zone,
    created_at      timestamp with time zone DEFAULT now(),
    updated_at      timestamp with time zone DEFAULT now(),
    deleted_at      timestamp with time zone,
    source          text DEFAULT 'internal'::text NOT NULL,
    listing_data    jsonb,
    submitter_name  text,
    submitter_email text,
    submitter_phone text
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_pkey') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ticket_items (
    id           uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id   uuid NOT NULL,
    product_type public.product_type DEFAULT 'flyer'::public.product_type NOT NULL,
    quantity     integer DEFAULT 1 NOT NULL,
    design_url   text,
    description  text,
    created_at   timestamp with time zone DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_items_pkey') THEN
    ALTER TABLE public.ticket_items ADD CONSTRAINT ticket_items_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_items_ticket_id_fkey') THEN
    ALTER TABLE public.ticket_items
      ADD CONSTRAINT ticket_items_ticket_id_fkey
      FOREIGN KEY (request_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;
END $$;
