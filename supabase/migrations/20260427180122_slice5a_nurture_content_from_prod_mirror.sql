-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260427180122
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260427180122. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- Slice 5A Task 6 -- Agent Nurture campaign + templates + steps.
--
-- 2 templates + 1 campaign ('Agent Nurture') + 2 campaign_steps.
-- Step 1: Day 0  -- monthly "what I've shipped" recap (rotating proof; copy
--                   carries [PLACEHOLDER] tokens for the rotating items per
--                   Standing Rule 1 fill-and-flag).
-- Step 2: Day 30 -- soft re-engagement / coffee prompt.
--
-- Enrollment is NOT auto-triggered in this slice. Auto-enrollment for nurture
-- belongs to a future slice (post-onboarding-complete hook). This migration
-- creates the data so the runner has something to fire when an enrollment
-- arrives manually.
--
-- send_mode='gmail' to match onboarding (deliverability + relationship surface).
-- kind='campaign' per Slice 4 enum.
--
-- All inserts idempotent.

INSERT INTO public.templates (name, slug, version, kind, send_mode, subject, body_html, body_text)
VALUES
  (
    'Agent Nurture -- Step 1 -- Monthly recap',
    'agent-nurture-step-1',
    1,
    'campaign',
    'gmail',
    'A few things I''ve put together lately',
    '<p>Hey {{first_name}},</p>

<p>Wanted to share a quick rundown of what I''ve been putting together for agents this month. Some of it might spark an idea for something coming up on your end.</p>

<p>Recent pieces:</p>

<ul>
<li>[PLACEHOLDER: rotating recap item 1, e.g. "A just-listed brochure for an Optima Camelview unit"]</li>
<li>[PLACEHOLDER: rotating recap item 2, e.g. "A neighborhood farming postcard for a Paradise Valley listing"]</li>
<li>[PLACEHOLDER: rotating recap item 3, e.g. "A landing page for a $4M Silverleaf property"]</li>
</ul>

<p>If anything hits, just send me the listing and I''ll come back with a plan. No pressure either way.</p>

<p>-- Alex</p>',
    'Hey {{first_name}},

Wanted to share a quick rundown of what I''ve been putting together for agents this month. Some of it might spark an idea for something coming up on your end.

Recent pieces:

- [PLACEHOLDER: rotating recap item 1, e.g. "A just-listed brochure for an Optima Camelview unit"]
- [PLACEHOLDER: rotating recap item 2, e.g. "A neighborhood farming postcard for a Paradise Valley listing"]
- [PLACEHOLDER: rotating recap item 3, e.g. "A landing page for a $4M Silverleaf property"]

If anything hits, just send me the listing and I''ll come back with a plan. No pressure either way.

-- Alex'
  ),
  (
    'Agent Nurture -- Step 2 -- 30-day soft re-engage',
    'agent-nurture-step-2',
    1,
    'campaign',
    'gmail',
    'Coffee soon?',
    '<p>Hey {{first_name}},</p>

<p>Wanted to check in. It''s been a minute, and I''d like to hear what''s on your plate over the next few months. Any listings on deck, anything you''re working through, anything I could help map out.</p>

<p>I keep my schedule pretty open for short coffee stops in [PLACEHOLDER: city or area, e.g. "Old Town Scottsdale"]. If you''re up for one, send me a couple windows and I''ll work around you.</p>

<p>-- Alex</p>',
    'Hey {{first_name}},

Wanted to check in. It''s been a minute, and I''d like to hear what''s on your plate over the next few months. Any listings on deck, anything you''re working through, anything I could help map out.

I keep my schedule pretty open for short coffee stops in [PLACEHOLDER: city or area, e.g. "Old Town Scottsdale"]. If you''re up for one, send me a couple windows and I''ll work around you.

-- Alex'
  )
ON CONFLICT (slug, version) DO NOTHING;

-- Campaign row.
INSERT INTO public.campaigns (name, description, type, status, user_id)
SELECT 'Agent Nurture',
       'Monthly recap touch + 30-day soft re-engagement. Manual enrollment until a post-onboarding hook is wired in a later slice.',
       'drip',
       'active',
       'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE name = 'Agent Nurture' AND user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
    AND deleted_at IS NULL
);

-- Steps. Resolve campaign_id by lookup; idempotent via NOT EXISTS guard on
-- (campaign_id, step_number).
WITH c AS (
  SELECT id FROM public.campaigns
  WHERE name = 'Agent Nurture' AND user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
    AND deleted_at IS NULL
  LIMIT 1
)
INSERT INTO public.campaign_steps (
  campaign_id, step_number, step_type, title, delay_days,
  email_subject, email_body_html, template_slug, user_id
)
SELECT c.id, 1, 'email', 'Day 0 -- Monthly recap', 0,
       'A few things I''ve put together lately',
       '(see template agent-nurture-step-1)',
       'agent-nurture-step-1',
       'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
FROM c
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_steps
  WHERE campaign_id = c.id AND step_number = 1
);

WITH c AS (
  SELECT id FROM public.campaigns
  WHERE name = 'Agent Nurture' AND user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
    AND deleted_at IS NULL
  LIMIT 1
)
INSERT INTO public.campaign_steps (
  campaign_id, step_number, step_type, title, delay_days,
  email_subject, email_body_html, template_slug, user_id
)
SELECT c.id, 2, 'email', 'Day 30 -- Soft re-engage', 30,
       'Coffee soon?',
       '(see template agent-nurture-step-2)',
       'agent-nurture-step-2',
       'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
FROM c
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_steps
  WHERE campaign_id = c.id AND step_number = 2
);
