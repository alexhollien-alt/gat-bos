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
