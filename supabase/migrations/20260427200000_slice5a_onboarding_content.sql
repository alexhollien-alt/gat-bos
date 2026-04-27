-- Slice 5A Task 5 -- New Agent Onboarding campaign content
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
