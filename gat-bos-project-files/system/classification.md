---
layer: system
scope: global
type: classification
description: The four controlled vocabularies every request is classified into before any rule loads or skill runs. Foundation of the classify-first router.
depends_on: []
consumed_by: [00-router.md, routing-table.md, test-matrix.md]
---

# CLASSIFICATION

Before any output is produced, a request is resolved into **four fields**. These are
the machine layer. Nothing routes, no rule loads, and no skill runs until all four are
known (or a disambiguation question has been asked). See `00-router.md` for the
procedure that uses this file.

The values below are **closed vocabularies**. If a request seems to need a value not
listed here, that is a signal to ask Alex, not to invent one.

---

## Field 1 -- CLIENT (who the work is for)

| Value | Meaning | Tier (client-universe.md) |
|---|---|---|
| `me` | Alex's own brand, business development, positioning, pitch | n/a (Alex) |
| `agent` | A specific real estate agent Alex markets for | Tier 1 |
| `listing` | A specific property / address being promoted | Tier 1 (via agent) |
| `event` | A class, broker open, client celebration, BNI slot | Tier 1/2/3 audience |
| `internal-crm` | GAT-BOS, CRM workflows, contact records, automations | n/a (system) |
| `data` | A spreadsheet/CSV/list to clean, dedupe, or transform | n/a (system) |
| `creative-asset` | A reusable design asset not tied to one client (template, icon set, brand element) | n/a |

> **`me` vs `agent` vs `listing` is the highest-value distinction in the system.**
> Marketing for Alex pulls in positioning + referral handle. Marketing for an agent
> pulls in lender scoping + co-brand. Marketing a listing centers the property. These
> must never be conflated. When client is unstated, **ask** (see Disambiguation).

---

## Field 2 -- OUTPUT (what is being created)

`flyer` · `email` · `social-caption` · `postcard` · `brochure` · `sms` ·
`crm-workflow` · `data-cleanup` · `strategy-plan` · `web-copy` ·
`listing-presentation` · `brief`

Notes:
- `flyer`, `postcard`, `brochure` are **print design** outputs (trigger co-brand pack).
- `web-copy` covers landing pages and property pages (trigger web-seo pack).
- `brief` = an agent creative brief or handoff brief, not a finished piece.

---

## Field 3 -- CHANNEL (where it goes)

`print` · `email` · `instagram` · `sms` · `youtube-podcast` ·
`internal-system` · `spreadsheet` · `web`

Channel is **not** implied by output. A market update can be `email`, `print`, or
`web`. A caption can be `instagram` or `youtube-podcast`. Resolve channel separately.

---

## Field 4 -- MODE / HAT (how to think)

| Value | The thinking the request demands |
|---|---|
| `creative-copywriting` | Headlines, body copy, captions, taglines, MLS remarks |
| `strategic-planning` | Campaign strategy, business planning, sequencing |
| `technical-implementation` | CRM/code/automation wiring, migrations, SQL |
| `data-processing` | Cleaning, deduping, transforming lists and spreadsheets |
| `design-direction` | Layout, visual hierarchy, print/screen design execution |
| `brand-positioning` | Alex's value prop, pitch, "what do you do" answers |
| `operational-workflow` | Tickets, scheduling, follow-up sequences, ops routines |

---

## Disambiguation Table (never auto-route on these alone)

These words appear in many requests and **do not identify a route by themselves**.
When one is present and the listed field is still unknown, **stop and ask the single
question in the last column** before classifying.

| Trigger word | Field it leaves unresolved | Why it is ambiguous | The one question to ask |
|---|---|---|---|
| `marketing` | client + output + channel | Could be agent/personal/listing, any of 6+ outputs, any channel | "Who is this for (you, an agent, or a listing), and what piece -- flyer, email, social, postcard?" |
| `design` | output + channel | Print vs screen pull different rule packs | "Print or screen, and which piece?" |
| `flyer` | client | Same output, totally different rules for me vs agent vs listing | "Is this for you, an agent, or a specific listing?" |
| `page` | output + channel | Landing page (web) vs presentation slide (deck) vs print one-sheet | "A web page, a slide, or a printed sheet?" |
| `post` | channel | Instagram vs podcast/YouTube caption vs blog | "Which platform -- Instagram, podcast/YouTube, or somewhere else?" |
| `list` | output + mode | A data file to clean vs a content list to write vs a mailing list | "Do you mean a spreadsheet to clean up, or written content?" |
| `send` | client + channel | Email blast vs SMS vs internal CRM action | "Send via email, text, or trigger something in the CRM?" |
| `update` | client + output | Market update (intel) vs CRM record update vs design revision | "A market update piece, a CRM record change, or a revision to an existing design?" |

**Rule:** If two or more fields are unresolved, ask **one** consolidated question that
recovers the most fields at once. Never guess `client` -- it is the field most likely
to load the wrong rules.
