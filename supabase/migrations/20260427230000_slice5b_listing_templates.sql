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
