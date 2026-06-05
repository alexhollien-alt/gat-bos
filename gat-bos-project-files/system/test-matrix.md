---
layer: system
scope: global
type: test-matrix
description: Labeled example prompts with their expected classification and route. The harness for verifying the router behaves -- including adversarial cases that must trigger a clarifying question instead of a guess.
depends_on: [routing.md]
---

# ROUTING TEST MATRIX

How to run: for each row, open a fresh session with the system loaded, paste the
**Prompt**, and confirm the router's resolution matches the expected columns. The
declaration (the HAT block in `routing.md`) is recited on request. Adversarial rows must
produce **a question**, not a build.

Legend: packs are beyond `always-on` (which always loads).

| # | Prompt | client | output | channel | mode | HAT (intent + output) | Packs loaded | Packs EXCLUDED |
|---|---|---|---|---|---|---|---|---|
| 1 | "Make a flyer for Julie's new Optima listing" | agent | flyer | print | design-direction | agent-marketing + print-collateral | copy-standards, lender-scoping, co-brand-gat, design-process | positioning, web-seo |
| 2 | "Make a flyer for my farm area" | me | flyer | print | design-direction | personal-brand + print-collateral | positioning, copy-standards, co-brand-gat, design-process | lender-scoping, web-seo |
| 3 | "Landing page for 123 Camelview" | listing | web-copy | web | design-direction | listing-marketing + web | copy-standards, web-seo, design-process | positioning, co-brand-gat |
| 4 | "Write my BNI 60-second pitch" | me | brief/copy | n/a | brand-positioning | personal-brand | positioning, copy-standards | lender-scoping, co-brand-gat |
| 5 | "Weekly Edge email for Julie" | agent | email | email | creative-copywriting | agent-marketing + email-writing | copy-standards, design-process | positioning, web-seo, co-brand-gat |
| 6 | "Dedupe this contact export" | data | data-cleanup | spreadsheet | data-processing | data-cleanup | (none) | all copy/design/positioning packs |
| 7 | "Ticket this up from my meeting notes" | internal-crm | crm-workflow | internal-system | operational-workflow | crm-operations | (none) | copy-standards, co-brand-gat, web-seo, positioning, lender-scoping |
| 8 | "Plan my Q3 Partner Spotlight campaign" | me | strategy-plan | n/a | strategic-planning | strategy-planning | positioning | design-process, co-brand-gat, web-seo |
| 9 | "Broker open invite, Julie + lender co-hosting" | event | flyer | print | creative-copywriting | event-promotion + print-collateral | copy-standards, lender-scoping, co-brand-gat, design-process | positioning, web-seo |
| 10 | "Caption for Julie's listing reel" | agent | social-caption | instagram | creative-copywriting | agent-marketing + social-content | copy-standards, design-process | positioning, web-seo, co-brand-gat |

## Adversarial rows -- expected: ASK, do not build

| # | Prompt | Why it must stop | Field(s) missing | Expected question (from routing.md) |
|---|---|---|---|---|
| A1 | "Do some marketing for me" | "marketing" + no piece | output, channel | "Who is this for, and what piece -- flyer, email, social, postcard?" |
| A2 | "Make me a flyer" | client genuinely ambiguous (me/agent/listing) | client | "Is this for you, an agent, or a specific listing?" |
| A3 | "Send this out" | channel + client unknown | client, channel | "Send via email, text, or trigger something in the CRM?" |
| A4 | "Clean up this list" | data-file vs content-list | output, mode | "Do you mean a spreadsheet to clean up, or written content?" |
| A5 | "Update the page" | which page, which medium | output, channel | "A web page, a slide, or a printed sheet?" |
| A6 | "Design something for the open house" | print vs screen, and client | output, channel | "Print or screen, and which piece?" |
| A7 | "Make a post about the new listing" | platform unknown | channel | "Which platform -- Instagram, podcast/YouTube, or somewhere else?" |

## Conflict probe (run back-to-back)
Rows **1 vs 2** and **5 vs (same email for me)**: identical output word, different
`client`. They MUST resolve to different intent hats and different pack sets --
`agent-marketing` (lender-scoping/co-brand) vs `personal-brand`
(positioning, no lender-scoping). If both resolve the same, the router is broken.

## Self-consistency checks (static, greppable)
- [ ] Every HAT in this file has a **row in `routing.md`'s Master route table**.
- [ ] Every pack named here exists in `rules/packs/` or is `always-on`.
- [ ] Every disambiguation word in `routing.md` appears in an A-row above.
- [ ] No row loads a pack that its EXCLUDED column also lists.
