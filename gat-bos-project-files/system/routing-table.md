---
layer: system
scope: global
type: routing-table
description: The single source of truth mapping a classification to a hat, rule packs, and skill. Supersedes CLAUDE.md "Skill Routing" and standing-rules.md Rule 12.
depends_on: [classification.md]
consumed_by: [00-router.md, test-matrix.md]
---

# ROUTING TABLE

One classification in, one route out. This file replaces the two old routers (the
keyword->skill table in `CLAUDE.md` and the task->reads table in `standing-rules.md`
Rule 12). A route resolves in two composable steps:

1. **Intent hat** (from `client` + `mode`) -> which **rule packs** load.
2. **Output hat** (from `output` + `channel`) -> which **skill** runs + any
   output-specific packs.

Final pack set = `always-on` + intent-hat packs + output-hat packs (deduped),
**minus** the named exclusions. The skill is the production tool; the packs are the
rules. The same skill (e.g. `re-email-design`) serves different clients under
different packs -- that is the whole point.

---

## Step 1 -- Intent hat (client + mode -> rule packs)

| client | typical mode | HAT | Packs loaded (beyond always-on) | Packs explicitly EXCLUDED |
|---|---|---|---|---|
| `me` | brand-positioning | **personal-brand** | `positioning`, `copy-standards` | `lender-scoping`, `co-brand-gat` |
| `agent` | creative-copywriting / design-direction | **agent-marketing** | `copy-standards`, `lender-scoping` (if co-branded), `co-brand-gat` (if print) | `positioning` |
| `listing` | creative-copywriting / design-direction | **listing-marketing** | `copy-standards`, `co-brand-gat` (if print), `web-seo` (if web), `lender-scoping` (if co-branded) | `positioning` |
| `event` | strategic-planning / creative-copywriting | **event-promotion** | `copy-standards`, `lender-scoping` (if lender on stage) | `positioning` |
| `internal-crm` | technical-implementation / operational-workflow | **crm-operations** | (none beyond always-on) | `copy-standards`, `co-brand-gat`, `web-seo`, `positioning`, `lender-scoping` |
| `data` | data-processing | **data-cleanup** | (none beyond always-on) | all copy/design/positioning packs |
| `me`/`agent` | strategic-planning | **strategy-planning** | (none beyond always-on; `positioning` if `client = me`) | `design-process`, `co-brand-gat`, `web-seo` |

---

## Step 2 -- Output hat (output + channel -> skill + output packs)

Absorbs the keyword->skill rows from `CLAUDE.md` and the required-reads from Rule 12.
"Reads" = the design/brand context files to load before building.

| output | channel | OUTPUT HAT | Skill | Output-specific packs | Context reads (in order) |
|---|---|---|---|---|---|
| `flyer` `postcard` `brochure` | `print` | **print-collateral** | `re-print-design` | `design-process`, `co-brand-gat` | design-foundation > brand > re-print-design |
| `email` | `email` | **email-writing** | `re-email-design` | `design-process` | design-foundation > brand > re-email-design |
| `social-caption` | `instagram` | **social-content** | `re-print-design` (graphic) + `re-marketing` (caption) | `design-process` (if graphic) | design-foundation > brand > re-print-design > re-marketing |
| `web-copy` | `web` | **listing-marketing**/web | `re-landing-page` | `design-process`, `web-seo` | design-foundation > brand > re-landing-page > re-marketing |
| `listing-presentation` | `print`/`web` | **listing-marketing**/deck | `re-listing-presentation` | `design-process` | design-foundation > brand > re-listing-presentation > re-marketing |
| `sms` | `sms` | **email-writing**/sms | `re-marketing` | (none) | re-marketing |
| `crm-workflow` | `internal-system` | **crm-operations** | `cypher-ticket-builder` / CRM skill | (none) | client-universe > cypher-ticket-builder |
| `data-cleanup` | `spreadsheet` | **data-cleanup** | data/list skill | (none) | (none) |
| `strategy-plan` | any | **strategy-planning** | `agent-strategy-session` / research-assistant | (none) | STRATEGY-CONTEXT |
| `brief` | any | **agent-marketing**/brief | `agent-creative-brief` | (none) | brand > agent-creative-brief |

---

## Keyword fast-paths (only after classification, never instead of it)

These confirm a route once the four fields are known. They are **not** entry points --
the disambiguation table in `classification.md` runs first.

| Confirmed signal | Resolves to |
|---|---|
| copy, headline, tagline, MLS remarks | `re-marketing` under the client's intent hat |
| send to designer, Canva, brief | `canva-handoff` after the relevant design skill |
| listing pipeline, full package | `listing-pipeline` (orchestrates multiple output hats) |
| cold call, BNI pitch, outreach | `agent-bd` under `personal-brand` (client = me) |
| morning briefing / EOD | `morning-briefing` / `end-of-day-briefing` under `crm-operations` |

---

## Invariants (checked by test-matrix.md)
- Every HAT named here has a file in `modes/`.
- Every pack named here exists in `rules/packs/` (or is `always-on`).
- No route loads a pack listed in its own EXCLUDED column.
- `client = me` never loads `lender-scoping` or `co-brand-gat`.
- `client = agent | listing` never loads `positioning`.
