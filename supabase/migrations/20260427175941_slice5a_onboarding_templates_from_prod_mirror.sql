-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260427175941
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260427175941. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- Slice 5A Task 5 -- New Agent Onboarding templates + step backfill.
--
-- Imports the existing inline copy on the 4 campaign_steps rows under
-- campaign 'New Agent Onboarding' (id e13653af-405e-4118-bade-d45d31830b86)
-- into the templates table, then sets template_slug on each step so the
-- campaign-runner cron route resolves through templates.
--
-- send_mode='gmail' -- Alex sends through his own Gmail for deliverability
-- and the relationship surface (per Slice 5A starter Task 5).
--
-- kind='campaign' per Slice 4 enum.
--
-- Idempotent via ON CONFLICT (slug, version) DO NOTHING on the unique
-- index idx_templates_slug_version.

INSERT INTO public.templates (name, slug, version, kind, send_mode, subject, body_html, body_text)
VALUES
  (
    'New Agent Onboarding -- Step 1 -- Day 0 Welcome',
    'new-agent-onboarding-step-1',
    1,
    'campaign',
    'gmail',
    'Staying Connected',
    '<p>Hey {{first_name}},</p>

<p>Good meeting you. I wanted to send a quick follow-up so you have everything in one place.</p>

<p>Here''s where I''m most useful for my agents:</p>

<ul>
<li>Marketing and print -- clean, well-done pieces that actually get used</li>
<li>Targeted data -- farming lists, equity pulls, and smart prospecting</li>
<li>Open house support -- setup, flow, and follow-up strategy</li>
<li>Content -- simple, consistent pieces to stay in front of your audience</li>
<li>On-demand help -- if something comes up, I move quick</li>
</ul>

<p>You don''t need to overthink any of it. When you have something coming up, just loop me in and I''ll help you put it together the right way.</p>

<p>Talk soon,<br>Alex</p>',
    'Hey {{first_name}},

Good meeting you. I wanted to send a quick follow-up so you have everything in one place.

Here''s where I''m most useful for my agents:

- Marketing and print -- clean, well-done pieces that actually get used
- Targeted data -- farming lists, equity pulls, and smart prospecting
- Open house support -- setup, flow, and follow-up strategy
- Content -- simple, consistent pieces to stay in front of your audience
- On-demand help -- if something comes up, I move quick

You don''t need to overthink any of it. When you have something coming up, just loop me in and I''ll help you put it together the right way.

Talk soon,
Alex'
  ),
  (
    'New Agent Onboarding -- Step 2 -- Day 3 How it works',
    'new-agent-onboarding-step-2',
    1,
    'campaign',
    'gmail',
    'How agents are leveraging resources',
    '<p>Hey {{first_name}},</p>

<p>Quick follow-up. Here''s how most of my agents actually use me day-to-day:</p>

<ul>
<li><strong>Before a listing:</strong> we get in front of the neighborhood early with the right list and a clean piece</li>
<li><strong>While it''s live:</strong> brochures, open house setup, and making sure the presentation feels dialed in</li>
<li><strong>After it sells:</strong> just sold campaigns that keep the conversation going and bring in the next deal</li>
</ul>

<p>It''s not complicated. It''s just being consistent and doing things a little better than most.</p>

<p>If you have something coming up, even if it''s last minute, I''m happy to jump in.</p>

<p>-- Alex</p>',
    'Hey {{first_name}},

Quick follow-up. Here''s how most of my agents actually use me day-to-day:

- Before a listing: we get in front of the neighborhood early with the right list and a clean piece
- While it''s live: brochures, open house setup, and making sure the presentation feels dialed in
- After it sells: just sold campaigns that keep the conversation going and bring in the next deal

It''s not complicated. It''s just being consistent and doing things a little better than most.

If you have something coming up, even if it''s last minute, I''m happy to jump in.

-- Alex'
  ),
  (
    'New Agent Onboarding -- Step 3 -- Day 7 Escrow team',
    'new-agent-onboarding-step-3',
    1,
    'campaign',
    'gmail',
    'How We Handle Escrow From Start to Finish',
    '<p>Hey {{first_name}},</p>

<p>Quick note on the escrow side, since that''s really where everything matters most.</p>

<p>Our team is tight, experienced, and very hands-on. Communication is consistent, timelines are managed closely, and we stay ahead of issues before they become problems.</p>

<p>You won''t have to chase updates or wonder where things stand. That''s a big focus for us.</p>

<p>If you ever want to loop us in early on a file or just have a quick question before something goes live, we''re always available.</p>

<p>-- Alex</p>',
    'Hey {{first_name}},

Quick note on the escrow side, since that''s really where everything matters most.

Our team is tight, experienced, and very hands-on. Communication is consistent, timelines are managed closely, and we stay ahead of issues before they become problems.

You won''t have to chase updates or wonder where things stand. That''s a big focus for us.

If you ever want to loop us in early on a file or just have a quick question before something goes live, we''re always available.

-- Alex'
  ),
  (
    'New Agent Onboarding -- Step 4 -- Day 14 Value example',
    'new-agent-onboarding-step-4',
    1,
    'campaign',
    'gmail',
    'What''s been working lately',
    '<p>Hey {{first_name}},</p>

<p>One thing that''s been working really well lately: agents taking one listing and getting multiple uses out of it.</p>

<p>Instead of a single post or flyer, we turn it into:</p>

<ul>
<li>A strong brochure</li>
<li>A targeted mailer to the area</li>
<li>A few clean social pieces</li>
</ul>

<p>Nothing overbuilt. Just making sure the property actually gets seen and remembered.</p>

<p>If you have something coming up, I''m happy to help you map something out around it.</p>

<p>-- Alex</p>',
    'Hey {{first_name}},

One thing that''s been working really well lately: agents taking one listing and getting multiple uses out of it.

Instead of a single post or flyer, we turn it into:

- A strong brochure
- A targeted mailer to the area
- A few clean social pieces

Nothing overbuilt. Just making sure the property actually gets seen and remembered.

If you have something coming up, I''m happy to help you map something out around it.

-- Alex'
  )
ON CONFLICT (slug, version) DO NOTHING;

-- Backfill template_slug on the 4 existing onboarding step rows.
-- Idempotent: running again is a no-op since the values already match.
UPDATE public.campaign_steps
SET template_slug = 'new-agent-onboarding-step-1', updated_at = now()
WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86' AND step_number = 1
  AND template_slug IS DISTINCT FROM 'new-agent-onboarding-step-1';

UPDATE public.campaign_steps
SET template_slug = 'new-agent-onboarding-step-2', updated_at = now()
WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86' AND step_number = 2
  AND template_slug IS DISTINCT FROM 'new-agent-onboarding-step-2';

UPDATE public.campaign_steps
SET template_slug = 'new-agent-onboarding-step-3', updated_at = now()
WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86' AND step_number = 3
  AND template_slug IS DISTINCT FROM 'new-agent-onboarding-step-3';

UPDATE public.campaign_steps
SET template_slug = 'new-agent-onboarding-step-4', updated_at = now()
WHERE campaign_id = 'e13653af-405e-4118-bade-d45d31830b86' AND step_number = 4
  AND template_slug IS DISTINCT FROM 'new-agent-onboarding-step-4';
