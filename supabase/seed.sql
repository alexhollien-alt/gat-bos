-- Seed data for Relationship CRM
-- Run AFTER schema.sql. Replace USER_ID with your actual auth.users id after signing up.
-- Or run via Supabase SQL editor after creating your account.

-- To use: sign up in the app, then get your user ID from Supabase Auth dashboard,
-- replace all instances of 'YOUR_USER_ID' below, and run in the SQL editor.

-- Alternatively, run this function after signing up:
create or replace function seed_data(p_user_id uuid) returns void as $$
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

-- TAGS
insert into tags (id, user_id, name, color) values
  (t_res, p_user_id, 'Residential', '#3b82f6'),
  (t_comm, p_user_id, 'Commercial', '#8b5cf6'),
  (t_lux, p_user_id, 'Luxury', '#f59e0b'),
  (t_inv, p_user_id, 'Investor', '#10b981'),
  (t_ref, p_user_id, 'Referral Source', '#ec4899'),
  (t_top, p_user_id, 'Top Producer', '#ef4444');

-- CONTACTS
insert into contacts (id, user_id, first_name, last_name, company, title, email, phone, relationship, source, lead_status, notes) values
  (c_maria, p_user_id, 'Maria', 'Sandoval', 'Long Realty', 'Senior Agent', 'maria.sandoval@longrealty.com', '602-555-0142', 'active_partner', 'referral', 'none', 'Handles most of the Arcadia listings. Strong closer, always responsive. Met at SEVRAR mixer 2024.'),
  (c_jake, p_user_id, 'Jake', 'Whitfield', 'Russ Lyon Sothebys', 'Luxury Specialist', 'jake.whitfield@russlyon.com', '480-555-0198', 'advocate', 'manual', 'none', 'Top luxury agent in Paradise Valley. Sends 3-4 title orders per month. Plays golf at Phoenician.'),
  (c_patricia, p_user_id, 'Patricia', 'Nguyen', 'West USA Realty', 'Broker Associate', 'pnguyen@westusa.com', '602-555-0267', 'warm', 'broker_open', 'none', 'Newer relationship. Met at broker open on Camelback. Focus on Biltmore area condos.'),
  (c_derek, p_user_id, 'Derek', 'Hoffman', 'HomeSmart', 'Team Lead', 'dhoffman@homesmart.com', '480-555-0334', 'active_partner', 'manual', 'none', 'Runs a 6-person team in East Valley. High volume — mostly Gilbert and Chandler resale.'),
  (c_ana, p_user_id, 'Ana', 'Reyes', 'eXp Realty', 'Agent', 'ana.reyes@exprealty.com', '623-555-0411', 'new', 'open_house', 'prospect', 'Just got licensed 8 months ago. Eager, asks good questions. Potential long-term relationship.'),
  (c_tom, p_user_id, 'Tom', 'Brennan', 'Realty One Group', 'Associate Broker', 'tbrennan@realtyonegroup.com', '602-555-0523', 'dormant', 'manual', 'none', 'Used to send steady business. Havent heard from him since Q2. Need to re-engage.'),
  (c_rachel, p_user_id, 'Rachel', 'Goldstein', 'Berkshire Hathaway', 'Agent', 'rgoldstein@bhhsaz.com', '480-555-0645', 'warm', 'referral', 'none', 'Referred by Jake Whitfield. Works Scottsdale north of the 101. Has a strong sphere.'),
  (c_marcus, p_user_id, 'Marcus', 'Chen', 'Keller Williams Integrity First', 'Agent', 'mchen@kw.com', '602-555-0718', 'active_partner', 'manual', 'none', 'Consistent closer. Does 30+ transactions a year in Tempe and South Scottsdale. Prefers text.'),
  (c_linda, p_user_id, 'Linda', 'Vasquez', 'Coldwell Banker', 'Senior VP', 'lvasquez@cbrizona.com', '480-555-0899', 'advocate', 'manual', 'none', 'Senior leadership at CB Arizona. Refers her entire office. Always invites me to their quarterly events.'),
  (c_chris, p_user_id, 'Chris', 'Donahue', 'My Home Group', 'Agent', 'cdonahue@myhomegroup.com', '623-555-0956', 'new', 'sign_call', 'contacted', 'Called off a for-sale sign. Works mostly in Surprise and Goodyear. First-time meeting went well.');

-- CONTACT TAGS
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

-- INTERACTIONS
insert into interactions (user_id, contact_id, type, summary, occurred_at) values
  (p_user_id, c_maria, 'meeting', 'Lunch at Postinos. Discussed upcoming Arcadia listings she has in escrow. She wants faster turnaround on prelims.', now() - interval '2 days'),
  (p_user_id, c_maria, 'email', 'Sent her updated rate sheet for commercial transactions.', now() - interval '8 days'),
  (p_user_id, c_jake, 'call', 'Checked in about the Paradise Valley spec home closing. On track for end of month.', now() - interval '1 day'),
  (p_user_id, c_jake, 'lunch', 'Took Jake and his wife to Steak 44. Great relationship builder — he mentioned wanting to bring two new agents my way.', now() - interval '14 days'),
  (p_user_id, c_patricia, 'broker_open', 'Met at 2240 E Camelback broker open. Exchanged cards, talked about Biltmore condo market.', now() - interval '21 days'),
  (p_user_id, c_patricia, 'text', 'Followed up after broker open. She said she has a condo listing coming next week.', now() - interval '18 days'),
  (p_user_id, c_derek, 'call', 'Quarterly check-in. His team is on pace for 120 transactions this year. Wants to set up a lunch-and-learn for his agents.', now() - interval '5 days'),
  (p_user_id, c_derek, 'meeting', 'Lunch-and-learn at his Gilbert office. Presented on common title issues in resale transactions. Good engagement from his team.', now() - interval '30 days'),
  (p_user_id, c_ana, 'meeting', 'Coffee at Press Coffee in Scottsdale. Walked her through the title process for new agents. She was very receptive.', now() - interval '3 days'),
  (p_user_id, c_tom, 'email', 'Sent re-engagement email. Mentioned new streamlined ordering portal.', now() - interval '45 days'),
  (p_user_id, c_tom, 'call', 'Left voicemail. No callback yet.', now() - interval '30 days'),
  (p_user_id, c_rachel, 'call', 'Intro call after Jake referred her. She has 3 listings in North Scottsdale right now.', now() - interval '10 days'),
  (p_user_id, c_rachel, 'text', 'Confirmed meeting for next Tuesday to discuss her pipeline.', now() - interval '7 days'),
  (p_user_id, c_marcus, 'text', 'He texted about a rush prelim for a Tempe condo. Got it turned around same day — he was appreciative.', now() - interval '4 days'),
  (p_user_id, c_marcus, 'call', 'Quick call about a title issue on a South Scottsdale property. Resolved it with underwriting same day.', now() - interval '12 days'),
  (p_user_id, c_linda, 'meeting', 'Attended CB quarterly event. Spoke with 4 of her agents. Linda introduced me personally to each one.', now() - interval '20 days'),
  (p_user_id, c_linda, 'email', 'Sent thank-you note after the quarterly event with my contact info for her new agents.', now() - interval '19 days'),
  (p_user_id, c_chris, 'call', 'Initial intro call after he called off our sign in Surprise. Explained our services and turnaround times.', now() - interval '6 days');

-- NOTES
insert into notes (user_id, contact_id, content, created_at) values
  (p_user_id, c_maria, 'Maria prefers to communicate by email for business, phone for urgent matters. Her assistant is Diane — copy her on all orders.', now() - interval '15 days'),
  (p_user_id, c_jake, 'Jake plays golf every Wednesday. His wife Sarah is a designer. Remember to ask about their Scottsdale house renovation.', now() - interval '30 days'),
  (p_user_id, c_jake, 'He wants to be invited to any title industry events we sponsor. Likes visibility.', now() - interval '10 days'),
  (p_user_id, c_derek, 'Derek runs team meetings every Monday at 9am. Best time to reach him is after 2pm. His ops manager is Stephanie — she handles most of the title order submissions.', now() - interval '25 days'),
  (p_user_id, c_patricia, 'Patricia mentioned shes studying for her broker license. Offer to share study resources if I have any.', now() - interval '18 days'),
  (p_user_id, c_ana, 'Ana is originally from Tucson. Just moved to the Valley. She asked about mentorship opportunities — could connect her with Maria or Derek.', now() - interval '3 days'),
  (p_user_id, c_linda, 'Linda controls who the recommended title company is for the entire CB Arizona office. Critical relationship to maintain. Her birthday is June 14.', now() - interval '20 days'),
  (p_user_id, c_marcus, 'Marcus prefers text over email. Very no-nonsense — keep communications brief and direct. Fastest way to lose him is slow turnaround.', now() - interval '12 days');

-- TASKS
insert into tasks (user_id, contact_id, title, description, due_date, priority, status) values
  (p_user_id, c_derek, 'Schedule lunch-and-learn Q2', 'Follow up with Derek about doing another lunch-and-learn for his team in April.', current_date + interval '5 days', 'high', 'pending'),
  (p_user_id, c_ana, 'Send new agent welcome packet', 'Put together title process overview and FAQ for Ana.', current_date + interval '2 days', 'medium', 'pending'),
  (p_user_id, c_jake, 'Send golf tournament invite', 'Jake wants to be included in the annual charity golf tournament. Send registration link.', current_date + interval '10 days', 'low', 'pending'),
  (p_user_id, c_linda, 'Prepare CB quarterly presentation', 'Linda invited me to present at next CB quarterly. Prep slides on market trends and title tips.', current_date + interval '15 days', 'high', 'pending'),
  (p_user_id, c_maria, 'Update rate sheet', 'Maria asked for updated commercial rate sheet. Check with underwriting for latest pricing.', current_date - interval '1 day', 'medium', 'pending'),
  (p_user_id, c_marcus, 'Resolve Tempe condo lien', 'Follow up with underwriting on the HOA lien for the Tempe property Marcus flagged.', current_date, 'high', 'in_progress'),
  (p_user_id, null, 'Update CRM with SEVRAR event contacts', 'Add new contacts from last weeks SEVRAR networking mixer.', current_date + interval '1 day', 'medium', 'pending'),
  (p_user_id, c_chris, 'Send intro email with services overview', 'Chris seemed interested during our call. Send a proper intro with case studies.', current_date - interval '2 days', 'medium', 'pending');

-- FOLLOW-UPS
insert into follow_ups (user_id, contact_id, reason, due_date, status) values
  (p_user_id, c_tom, 'Re-engage after silence. Try calling again or stopping by his office.', current_date - interval '3 days', 'pending'),
  (p_user_id, c_patricia, 'Check on her new Biltmore condo listing — offer to handle title.', current_date, 'pending'),
  (p_user_id, c_rachel, 'Follow up after Tuesday meeting. Send recap and next steps.', current_date + interval '2 days', 'pending'),
  (p_user_id, c_ana, 'Check in after sending welcome packet. See if she has questions.', current_date + interval '5 days', 'pending'),
  (p_user_id, c_jake, 'Ask about the two new agents he mentioned introducing.', current_date + interval '1 day', 'pending'),
  (p_user_id, c_chris, 'Second touchpoint. Invite to a broker open or lunch.', current_date + interval '7 days', 'pending'),
  (p_user_id, c_maria, 'Confirm she received the updated rate sheet. Ask about Arcadia listings.', current_date - interval '1 day', 'pending'),
  (p_user_id, c_derek, 'Confirm Q2 lunch-and-learn date with his ops manager Stephanie.', current_date + interval '3 days', 'pending');

end;
$$ language plpgsql;

-- After signing up, run:  select seed_data('your-user-id-here');
