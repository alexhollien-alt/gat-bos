-- 20260430999700_slice7a5_full_prod_mirror.sql
--
-- Slice 7A.5 third mirror migration. Override of the "no 3rd mirror migration"
-- rule from phase3-classification.md, authorized 2026-05-01.
--
-- Closes the bidirectional gap between local and prod schema after
-- 299500 (tables) + 299600 (functions) + add_missing_timestamps left ~266
-- normalized lines of drift. Re-timestamped to 20260430999700 to run AFTER
-- 20260429194551_add_missing_timestamps.sql so its DROPs are not undone.
--
-- Two halves:
--   Half A -- ADDS: things prod has and local lacks (after 299500/299600)
--     A1. events columns event_template_id, location_override, occurrence_status
--     A2. indexes on events, event_templates, attendees, relationship_health_scores
--     A3. UNIQUE attendees_event_contact_unique
--     A4. FKs (attendees x2, event_templates, events, relationship_health_scores)
--     A5. GRANT ON TYPE event_occurrence_status to authenticated, service_role
--     A6. COMMENTs prod has but local lacks (event_templates, events, attendees,
--         relationship_health_*)
--     A7. Replace local's short events comment with prod's full version
--     A8. Tickets parity: indexes idx_tickets_*, idx_ticket_items_ticket
--     A9. Tickets parity: trigger material_requests_updated_at on tickets
--    A10. Tickets parity: FKs material_requests_contact_id_fkey + _user_id_fkey
--    A11. Tickets parity: 4 policies (intake + Users manage own) + RLS
--    A12. ai_usage_log parity: idx_ai_usage_log_feature_occurred_at, idx_ai_usage_log_occurred_at
--    A13. set_projects_updated_at function whitespace match (prod has indented body)
--
--   Half B -- DROPS: things local has and prod lacks
--     B1. Tables: spine_inbox, requests, material_request_items, material_requests
--     B2. Trigger events_set_updated_at on events (prod has no such trigger)
--     B3. set_updated_at triggers on tables prod doesn't have them on (re-do
--         post add_missing_timestamps)
--     B4. updated_at columns on tables prod doesn't have them on
--     B5. deleted_at columns on tables prod doesn't have them on
--     B6. created_at columns added by add_missing_timestamps to relationship_health_*
--         (prod doesn't have those NOT NULL created_at columns)
--     B7. COMMENTs local has but prod lacks (email_drafts, emails, error_logs,
--         oauth_tokens)
--     B8. Local-only index activity_events_context_contact_id_idx
--
-- This migration is LOCAL-REPLAY-ONLY. It will be repaired-as-applied against
-- prod (`supabase migration repair 20260430999700 --status applied`) so that
-- prod's schema_migrations table records it without executing any DDL against
-- prod -- prod is already in this state, so the migration is a no-op there.

BEGIN;

-- =============================================================================
-- HALF B (PHASE 1): drop legacy tables FIRST so their constraint names free up
-- before Half A creates the same constraint names on tickets.
-- material_requests_contact_id_fkey + material_requests_user_id_fkey are
-- declared on tickets in prod but were created on material_requests in the
-- baseline migration. With material_requests still in place, the IF NOT EXISTS
-- guards in Half A would short-circuit and skip the FK on tickets.
-- =============================================================================

DROP TABLE IF EXISTS public.spine_inbox CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.material_request_items CASCADE;
DROP TABLE IF EXISTS public.material_requests CASCADE;

-- =============================================================================
-- HALF A: ADDS
-- =============================================================================

-- A1. events columns -----------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_template_id uuid;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_override text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS occurrence_status public.event_occurrence_status
    DEFAULT 'scheduled'::public.event_occurrence_status NOT NULL;

-- A2. indexes ------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_template
  ON public.events USING btree (event_template_id)
  WHERE ((deleted_at IS NULL) AND (event_template_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_events_occurrence_status
  ON public.events USING btree (occurrence_status)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_event_templates_active
  ON public.event_templates USING btree (active)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_event_templates_owner
  ON public.event_templates USING btree (owner_contact_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_attendees_contact
  ON public.attendees USING btree (contact_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_attendees_event
  ON public.attendees USING btree (event_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_attendees_recorded
  ON public.attendees USING btree (recorded_at)
  WHERE ((deleted_at IS NULL) AND (recorded_at IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_rhs_computed_at
  ON public.relationship_health_scores USING btree (computed_at)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_rhs_score_desc
  ON public.relationship_health_scores USING btree (score DESC)
  WHERE (deleted_at IS NULL);

-- A3. UNIQUE constraint on attendees ------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendees_event_contact_unique'
  ) THEN
    ALTER TABLE public.attendees
      ADD CONSTRAINT attendees_event_contact_unique
      UNIQUE (event_id, contact_id);
  END IF;
END $$;

-- A4. Foreign keys -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendees_contact_id_fkey') THEN
    ALTER TABLE public.attendees
      ADD CONSTRAINT attendees_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendees_event_id_fkey') THEN
    ALTER TABLE public.attendees
      ADD CONSTRAINT attendees_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_templates_owner_contact_id_fkey') THEN
    ALTER TABLE public.event_templates
      ADD CONSTRAINT event_templates_owner_contact_id_fkey
      FOREIGN KEY (owner_contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_event_template_id_fkey') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_template_id_fkey
      FOREIGN KEY (event_template_id) REFERENCES public.event_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_health_scores_contact_id_fkey') THEN
    ALTER TABLE public.relationship_health_scores
      ADD CONSTRAINT relationship_health_scores_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- A5. GRANT on enum type --------------------------------------------------------

GRANT ALL ON TYPE public.event_occurrence_status TO authenticated;
GRANT ALL ON TYPE public.event_occurrence_status TO service_role;

-- A6 + A7. Comments -- ADD prod's, REPLACE local's short events comment --------

COMMENT ON TABLE public.attendees IS
  'Per-event-occurrence attendance. Doubles as touchpoint store: when recorded_at + notes are set, the row counts as a post-event touchpoint for that contact.';

COMMENT ON TABLE public.event_templates IS
  'Recurring event definitions. Each row is one of the 9 GAT Event Cycle events. Occurrences land in events with event_template_id set.';

COMMENT ON COLUMN public.event_templates.location_type IS
  '"fixed" = default_location used as-is for every occurrence. "rotating" = monthly location_override required on each events row.';

COMMENT ON COLUMN public.event_templates.rrule IS
  'Optional RFC 5545 RRULE string, reserved for future GCal outbound. NULL means week_of_month + day_of_week are canonical.';

COMMENT ON TABLE public.events IS
  'Calendar events, bidirectionally synced with Google Calendar. source=gcal_pull rows are overwritten by hourly cron (GCal wins). source=dashboard_create rows are created locally, then mirrored to GCal and backfilled with gcal_event_id. Soft-delete via deleted_at per standing rule 3.';

COMMENT ON COLUMN public.events.event_template_id IS
  'FK to event_templates when this occurrence was spawned from a recurring template. NULL for one-off events (Phase 1.5 GCal-sync path).';

COMMENT ON COLUMN public.events.location_override IS
  'Per-occurrence address when the parent template has location_type=rotating. Resolved by Step 7 monthly confirm flow. For fixed templates, leave NULL and read from event_templates.default_location.';

COMMENT ON COLUMN public.events.occurrence_status IS
  'Occurrence lifecycle: scheduled -> confirmed (rotating: location set) -> completed / canceled. Independent of Phase 1.5 source enum.';

COMMENT ON TABLE public.relationship_health_config IS
  'Singleton config for relationship health decay. half_life_days = days for a touchpoint weight to decay to 50%. max_age_days clamps the window -- touchpoints older than this contribute zero.';

COMMENT ON TABLE public.relationship_health_scores IS
  'Denormalized per-contact relationship health score. Maintained by trigger on project_touchpoints and by the daily recompute edge function. Published to supabase_realtime so the dashboard sees score deltas live.';

COMMENT ON TABLE public.relationship_health_touchpoint_weights IS
  'Base weight per touchpoint_type before exponential decay is applied. Add a new row when project_touchpoint_type gains a variant.';

-- A8. Tickets parity -- indexes ------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket
  ON public.ticket_items USING btree (request_id);

CREATE INDEX IF NOT EXISTS idx_tickets_contact
  ON public.tickets USING btree (contact_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_tickets_source
  ON public.tickets USING btree (source)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON public.tickets USING btree (user_id, status)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_tickets_user
  ON public.tickets USING btree (user_id);

-- A9. Tickets parity -- trigger -----------------------------------------------

DROP TRIGGER IF EXISTS material_requests_updated_at ON public.tickets;
CREATE TRIGGER material_requests_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- A10. Tickets parity -- FKs ---------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_contact_id_fkey') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT material_requests_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_user_id_fkey') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT material_requests_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- A11. Tickets parity -- RLS + policies ---------------------------------------

ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous intake inserts" ON public.tickets;
CREATE POLICY "Allow anonymous intake inserts" ON public.tickets
  FOR INSERT
  WITH CHECK ((source = 'intake'::text));

DROP POLICY IF EXISTS "Allow anonymous intake item inserts" ON public.ticket_items;
CREATE POLICY "Allow anonymous intake item inserts" ON public.ticket_items
  FOR INSERT
  WITH CHECK ((request_id IN (
    SELECT tickets.id
    FROM public.tickets
    WHERE (tickets.source = 'intake'::text)
  )));

DROP POLICY IF EXISTS "Users manage own tickets" ON public.tickets;
CREATE POLICY "Users manage own tickets" ON public.tickets
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage own ticket items" ON public.ticket_items;
CREATE POLICY "Users manage own ticket items" ON public.ticket_items
  USING ((request_id IN (
    SELECT tickets.id
    FROM public.tickets
    WHERE (tickets.user_id = auth.uid())
  )))
  WITH CHECK ((request_id IN (
    SELECT tickets.id
    FROM public.tickets
    WHERE (tickets.user_id = auth.uid())
  )));

-- A12. ai_usage_log indexes ---------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_occurred_at
  ON public.ai_usage_log USING btree (feature, occurred_at DESC)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_occurred_at
  ON public.ai_usage_log USING btree (occurred_at DESC)
  WHERE (deleted_at IS NULL);

-- A13. set_projects_updated_at function whitespace match ----------------------
-- Prod's pg_dump emits this with an indented body. CREATE OR REPLACE with the
-- exact same indentation so the dumps match byte-for-byte modulo the standard
-- pg_dump headers we strip during diff normalization.

CREATE OR REPLACE FUNCTION public.set_projects_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;

-- A14. seed_data function ------------------------------------------------------
-- Prod has a seed_data(uuid) function for populating a fresh user's account
-- with sample contacts, tags, interactions, notes, tasks, and follow-ups.
-- Previously declared in supabase/seed.sql (local-replay only), now mirrored
-- into the migration so the function is part of versioned schema history and
-- the post-reset local schema dump matches prod. Body verbatim from seed.sql.

CREATE OR REPLACE FUNCTION public.seed_data(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  -- Contact IDs
  c_maria uuid := gen_random_uuid();
  c_jake uuid := gen_random_uuid();
  c_patricia uuid := gen_random_uuid();
  c_derek uuid := gen_random_uuid();
  c_ana uuid := gen_random_uuid();
  c_tom uuid := gen_random_uuid();
  c_rachel uuid := gen_random_uuid();
  c_marcus uuid := gen_random_uuid();
  c_linda uuid := gen_random_uuid();
  c_chris uuid := gen_random_uuid();
  -- Tag IDs
  t_res uuid := gen_random_uuid();
  t_comm uuid := gen_random_uuid();
  t_lux uuid := gen_random_uuid();
  t_inv uuid := gen_random_uuid();
  t_ref uuid := gen_random_uuid();
  t_top uuid := gen_random_uuid();
begin
insert into tags (id, user_id, name, color) values
  (t_res, p_user_id, 'Residential', '#3b82f6'),
  (t_comm, p_user_id, 'Commercial', '#8b5cf6'),
  (t_lux, p_user_id, 'Luxury', '#f59e0b'),
  (t_inv, p_user_id, 'Investor', '#10b981'),
  (t_ref, p_user_id, 'Referral Source', '#ec4899'),
  (t_top, p_user_id, 'Top Producer', '#ef4444');
insert into contacts (id, user_id, first_name, last_name, company, title, email, phone, relationship, source, lead_status, notes) values
  (c_maria, p_user_id, 'Maria', 'Sandoval', 'Long Realty', 'Senior Agent', 'maria.sandoval@longrealty.com', '602-555-0142', 'active_partner', 'referral', 'none', 'Handles most of the Arcadia listings. Strong closer, always responsive. Met at SEVRAR mixer 2024.'),
  (c_jake, p_user_id, 'Jake', 'Whitfield', 'Russ Lyon Sothebys', 'Luxury Specialist', 'jake.whitfield@russlyon.com', '480-555-0198', 'advocate', 'manual', 'none', 'Top luxury agent in Paradise Valley. Sends 3-4 title orders per month. Plays golf at Phoenician.'),
  (c_patricia, p_user_id, 'Patricia', 'Nguyen', 'West USA Realty', 'Broker Associate', 'pnguyen@westusa.com', '602-555-0267', 'warm', 'broker_open', 'none', 'Newer relationship. Met at broker open on Camelback. Focus on Biltmore area condos.'),
  (c_derek, p_user_id, 'Derek', 'Hoffman', 'HomeSmart', 'Team Lead', 'dhoffman@homesmart.com', '480-555-0334', 'active_partner', 'manual', 'none', 'Runs a 6-person team in East Valley. High volume  --  mostly Gilbert and Chandler resale.'),
  (c_ana, p_user_id, 'Ana', 'Reyes', 'eXp Realty', 'Agent', 'ana.reyes@exprealty.com', '623-555-0411', 'new', 'open_house', 'prospect', 'Just got licensed 8 months ago. Eager, asks good questions. Potential long-term relationship.'),
  (c_tom, p_user_id, 'Tom', 'Brennan', 'Realty One Group', 'Associate Broker', 'tbrennan@realtyonegroup.com', '602-555-0523', 'dormant', 'manual', 'none', 'Used to send steady business. Havent heard from him since Q2. Need to re-engage.'),
  (c_rachel, p_user_id, 'Rachel', 'Goldstein', 'Berkshire Hathaway', 'Agent', 'rgoldstein@bhhsaz.com', '480-555-0645', 'warm', 'referral', 'none', 'Referred by Jake Whitfield. Works Scottsdale north of the 101. Has a strong sphere.'),
  (c_marcus, p_user_id, 'Marcus', 'Chen', 'Keller Williams Integrity First', 'Agent', 'mchen@kw.com', '602-555-0718', 'active_partner', 'manual', 'none', 'Consistent closer. Does 30+ transactions a year in Tempe and South Scottsdale. Prefers text.'),
  (c_linda, p_user_id, 'Linda', 'Vasquez', 'Coldwell Banker', 'Senior VP', 'lvasquez@cbrizona.com', '480-555-0899', 'advocate', 'manual', 'none', 'Senior leadership at CB Arizona. Refers her entire office. Always invites me to their quarterly events.'),
  (c_chris, p_user_id, 'Chris', 'Donahue', 'My Home Group', 'Agent', 'cdonahue@myhomegroup.com', '623-555-0956', 'new', 'sign_call', 'contacted', 'Called off a for-sale sign. Works mostly in Surprise and Goodyear. First-time meeting went well.');
insert into contact_tags (contact_id, tag_id) values
  (c_maria, t_res), (c_maria, t_ref),
  (c_jake, t_lux), (c_jake, t_ref), (c_jake, t_top),
  (c_patricia, t_res),
  (c_derek, t_res), (c_derek, t_top),
  (c_ana, t_res),
  (c_tom, t_res), (c_tom, t_comm),
  (c_rachel, t_lux), (c_rachel, t_res),
  (c_marcus, t_res), (c_marcus, t_top),
  (c_linda, t_ref), (c_linda, t_top),
  (c_chris, t_res);
insert into interactions (user_id, contact_id, type, summary, occurred_at) values
  (p_user_id, c_maria, 'meeting', 'Lunch at Postinos. Discussed upcoming Arcadia listings she has in escrow. She wants faster turnaround on prelims.', now() - interval '2 days'),
  (p_user_id, c_maria, 'email', 'Sent her updated rate sheet for commercial transactions.', now() - interval '8 days'),
  (p_user_id, c_jake, 'call', 'Checked in about the Paradise Valley spec home closing. On track for end of month.', now() - interval '1 day'),
  (p_user_id, c_jake, 'lunch', 'Took Jake and his wife to Steak 44. Great relationship builder  --  he mentioned wanting to bring two new agents my way.', now() - interval '14 days'),
  (p_user_id, c_patricia, 'broker_open', 'Met at 2240 E Camelback broker open. Exchanged cards, talked about Biltmore condo market.', now() - interval '21 days'),
  (p_user_id, c_patricia, 'text', 'Followed up after broker open. She said she has a condo listing coming next week.', now() - interval '18 days'),
  (p_user_id, c_derek, 'call', 'Quarterly check-in. His team is on pace for 120 transactions this year. Wants to set up a lunch-and-learn for his agents.', now() - interval '5 days'),
  (p_user_id, c_derek, 'meeting', 'Lunch-and-learn at his Gilbert office. Presented on common title issues in resale transactions. Good engagement from his team.', now() - interval '30 days'),
  (p_user_id, c_ana, 'meeting', 'Coffee at Press Coffee in Scottsdale. Walked her through the title process for new agents. She was very receptive.', now() - interval '3 days'),
  (p_user_id, c_tom, 'email', 'Sent re-engagement email. Mentioned new streamlined ordering portal.', now() - interval '45 days'),
  (p_user_id, c_tom, 'call', 'Left voicemail. No callback yet.', now() - interval '30 days'),
  (p_user_id, c_rachel, 'call', 'Intro call after Jake referred her. She has 3 listings in North Scottsdale right now.', now() - interval '10 days'),
  (p_user_id, c_rachel, 'text', 'Confirmed meeting for next Tuesday to discuss her pipeline.', now() - interval '7 days'),
  (p_user_id, c_marcus, 'text', 'He texted about a rush prelim for a Tempe condo. Got it turned around same day  --  he was appreciative.', now() - interval '4 days'),
  (p_user_id, c_marcus, 'call', 'Quick call about a title issue on a South Scottsdale property. Resolved it with underwriting same day.', now() - interval '12 days'),
  (p_user_id, c_linda, 'meeting', 'Attended CB quarterly event. Spoke with 4 of her agents. Linda introduced me personally to each one.', now() - interval '20 days'),
  (p_user_id, c_linda, 'email', 'Sent thank-you note after the quarterly event with my contact info for her new agents.', now() - interval '19 days'),
  (p_user_id, c_chris, 'call', 'Initial intro call after he called off our sign in Surprise. Explained our services and turnaround times.', now() - interval '6 days');
insert into notes (user_id, contact_id, content, created_at) values
  (p_user_id, c_maria, 'Maria prefers to communicate by email for business, phone for urgent matters. Her assistant is Diane  --  copy her on all orders.', now() - interval '15 days'),
  (p_user_id, c_jake, 'Jake plays golf every Wednesday. His wife Sarah is a designer. Remember to ask about their Scottsdale house renovation.', now() - interval '30 days'),
  (p_user_id, c_jake, 'He wants to be invited to any title industry events we sponsor. Likes visibility.', now() - interval '10 days'),
  (p_user_id, c_derek, 'Derek runs team meetings every Monday at 9am. Best time to reach him is after 2pm. His ops manager is Stephanie  --  she handles most of the title order submissions.', now() - interval '25 days'),
  (p_user_id, c_patricia, 'Patricia mentioned shes studying for her broker license. Offer to share study resources if I have any.', now() - interval '18 days'),
  (p_user_id, c_ana, 'Ana is originally from Tucson. Just moved to the Valley. She asked about mentorship opportunities  --  could connect her with Maria or Derek.', now() - interval '3 days'),
  (p_user_id, c_linda, 'Linda controls who the recommended title company is for the entire CB Arizona office. Critical relationship to maintain. Her birthday is June 14.', now() - interval '20 days'),
  (p_user_id, c_marcus, 'Marcus prefers text over email. Very no-nonsense  --  keep communications brief and direct. Fastest way to lose him is slow turnaround.', now() - interval '12 days');
insert into tasks (user_id, contact_id, title, description, due_date, priority, status) values
  (p_user_id, c_derek, 'Schedule lunch-and-learn Q2', 'Follow up with Derek about doing another lunch-and-learn for his team in April.', current_date + interval '5 days', 'high', 'pending'),
  (p_user_id, c_ana, 'Send new agent welcome packet', 'Put together title process overview and FAQ for Ana.', current_date + interval '2 days', 'medium', 'pending'),
  (p_user_id, c_jake, 'Send golf tournament invite', 'Jake wants to be included in the annual charity golf tournament. Send registration link.', current_date + interval '10 days', 'low', 'pending'),
  (p_user_id, c_linda, 'Prepare CB quarterly presentation', 'Linda invited me to present at next CB quarterly. Prep slides on market trends and title tips.', current_date + interval '15 days', 'high', 'pending'),
  (p_user_id, c_maria, 'Update rate sheet', 'Maria asked for updated commercial rate sheet. Check with underwriting for latest pricing.', current_date - interval '1 day', 'medium', 'pending'),
  (p_user_id, c_marcus, 'Resolve Tempe condo lien', 'Follow up with underwriting on the HOA lien for the Tempe property Marcus flagged.', current_date, 'high', 'in_progress'),
  (p_user_id, null, 'Update CRM with SEVRAR event contacts', 'Add new contacts from last weeks SEVRAR networking mixer.', current_date + interval '1 day', 'medium', 'pending'),
  (p_user_id, c_chris, 'Send intro email with services overview', 'Chris seemed interested during our call. Send a proper intro with case studies.', current_date - interval '2 days', 'medium', 'pending');
insert into follow_ups (user_id, contact_id, reason, due_date, status) values
  (p_user_id, c_tom, 'Re-engage after silence. Try calling again or stopping by his office.', current_date - interval '3 days', 'pending'),
  (p_user_id, c_patricia, 'Check on her new Biltmore condo listing  --  offer to handle title.', current_date, 'pending'),
  (p_user_id, c_rachel, 'Follow up after Tuesday meeting. Send recap and next steps.', current_date + interval '2 days', 'pending'),
  (p_user_id, c_ana, 'Check in after sending welcome packet. See if she has questions.', current_date + interval '5 days', 'pending'),
  (p_user_id, c_jake, 'Ask about the two new agents he mentioned introducing.', current_date + interval '1 day', 'pending'),
  (p_user_id, c_chris, 'Second touchpoint. Invite to a broker open or lunch.', current_date + interval '7 days', 'pending'),
  (p_user_id, c_maria, 'Confirm she received the updated rate sheet. Ask about Arcadia listings.', current_date - interval '1 day', 'pending'),
  (p_user_id, c_derek, 'Confirm Q2 lunch-and-learn date with his ops manager Stephanie.', current_date + interval '3 days', 'pending');
end;
$$;

GRANT ALL ON FUNCTION public.seed_data(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.seed_data(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.seed_data(p_user_id uuid) TO service_role;

-- =============================================================================
-- HALF B: DROPS
-- =============================================================================

-- B1. (already executed at top of migration -- legacy tables dropped before
-- Half A's FK creation so the constraint names are free).

-- B2. Drop events_set_updated_at trigger --------------------------------------

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;

-- B3. Drop excess set_updated_at triggers (re-do post add_missing_timestamps) -

DROP TRIGGER IF EXISTS set_updated_at ON public.activity_events;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_cache;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_usage_log;
DROP TRIGGER IF EXISTS set_updated_at ON public.api_usage_log;
DROP TRIGGER IF EXISTS set_updated_at ON public.emails;
DROP TRIGGER IF EXISTS set_updated_at ON public.error_logs;
DROP TRIGGER IF EXISTS set_updated_at ON public.inbox_items;
DROP TRIGGER IF EXISTS set_updated_at ON public.message_events;
DROP TRIGGER IF EXISTS set_updated_at ON public.messages_log;
DROP TRIGGER IF EXISTS set_updated_at ON public.morning_briefs;
DROP TRIGGER IF EXISTS set_updated_at ON public.oauth_tokens;
DROP TRIGGER IF EXISTS set_updated_at ON public.project_touchpoints;
DROP TRIGGER IF EXISTS set_updated_at ON public.relationship_health_scores;
DROP TRIGGER IF EXISTS set_updated_at ON public.ticket_items;

-- B4. Drop excess updated_at columns ------------------------------------------

ALTER TABLE public.activity_events                       DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.ai_cache                              DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.ai_usage_log                          DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.api_usage_log                         DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.emails                                DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.error_logs                            DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.inbox_items                           DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.message_events                        DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.messages_log                          DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.morning_briefs                        DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.oauth_tokens                          DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.project_touchpoints                   DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.relationship_health_scores            DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.ticket_items                          DROP COLUMN IF EXISTS updated_at;

-- B5. Drop excess deleted_at columns ------------------------------------------

ALTER TABLE public.agent_metrics                          DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.captures                               DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.email_drafts                           DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.emails                                 DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.email_log                              DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.error_logs                             DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.inbox_items                            DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.oauth_tokens                           DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.relationship_health_config             DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.relationship_health_touchpoint_weights DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.ticket_items                           DROP COLUMN IF EXISTS deleted_at;
-- NOTE: relationship_health_scores keeps its deleted_at column. Prod has it,
-- and idx_rhs_computed_at + idx_rhs_score_desc reference it in their WHERE
-- clause. Dropping it would cascade-drop those indexes.

-- B6. Drop created_at columns added by add_missing_timestamps that prod doesn't have -

ALTER TABLE public.relationship_health_config             DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.relationship_health_scores             DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.relationship_health_touchpoint_weights DROP COLUMN IF EXISTS created_at;

-- B7. Drop comments local has but prod lacks -----------------------------------

COMMENT ON TABLE public.email_drafts IS NULL;
COMMENT ON TABLE public.emails       IS NULL;
COMMENT ON TABLE public.error_logs   IS NULL;
COMMENT ON TABLE public.oauth_tokens IS NULL;

-- B8. Drop local-only activity_events_context_contact_id_idx ------------------

DROP INDEX IF EXISTS public.activity_events_context_contact_id_idx;

COMMIT;
