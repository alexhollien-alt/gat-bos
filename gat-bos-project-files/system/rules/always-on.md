---
layer: system
scope: global
type: rule-pack
pack: always-on
description: The universal rule pack. Loads on every request regardless of classification. No exceptions.
source: standing-rules.md (R1-R5)
depends_on: []
---

# RULE PACK: always-on

These five rules load for **every** classification. They are never excluded. They are
the floor under every hat. Full canonical text lives in `standing-rules.md`; this pack
is the selectable bundle the router always loads first.

---

## A1 -- Fill and Flag  (standing-rules R1)
Never stop generation for missing inputs. Use `[PLACEHOLDER: description]` and keep
building. Always produce complete output. List remaining placeholders at the end.

## A2 -- No Em Dashes  (standing-rules R2)
Use commas, periods, semicolons, or double hyphens ( -- ). Never em dashes, in any
output: copy, code comments, design text, email, documents.

## A3 -- No Hard Deletes  (standing-rules R3)
Never permanently delete records, contacts, or files. Soft delete with `deleted_at`,
or archive/suppress. Applies to all DB, file, and CRM actions.

## A4 -- No Scraping as Data Foundation  (standing-rules R4)
Never build contacts, lead lists, or market databases from scraped sites. Never scrape
MLS. Allowed: stock photo sourcing, web search, fetching public info for design.

## A5 -- Alex Approves Before Shipping  (standing-rules R5)
No output ships without Alex's explicit approval. Show proposed changes first. Never
auto-commit, auto-send, or auto-publish.

---

**Loaded by:** every hat in `routing-table.md`.
**Excluded by:** nothing, ever.
