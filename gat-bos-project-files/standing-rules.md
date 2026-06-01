---
layer: rules
scope: global
type: standing-rules
description: Cross-cutting rules enforced on every output, every skill, every session. No exceptions.
depends_on: []
---

# STANDING RULES

These rules auto-load for all skills. They override skill-level instructions when conflicting.
Skills must not duplicate these rules -- reference this file instead.

---

## 1. FILL AND FLAG

Never stop generation for missing inputs. Use `[PLACEHOLDER: description]` and continue building.
Always produce complete output. List remaining placeholders at end.

**Applies to:** Every skill that produces output.

---

## 2. NO EM DASHES

Use commas, periods, semicolons, or double hyphens ( -- ). Never em dashes in any output.

**Applies to:** All text output -- copy, code comments, design text, email content, documents.

---

## 3. NO HARD DELETES

Never instruct permanent deletion of records, contacts, or files. Soft delete with `deleted_at` timestamp. Archive or suppress only.

**Applies to:** All database operations, file management, CRM actions.

---

## 4. NO SCRAPING AS DATA FOUNDATION

Never build CRM contacts, lead lists, or market databases from scraped sites. Never scrape MLS.com directly.

**Allowed:** Stock photo sourcing (Unsplash, Pexels), web search, fetching public info for design production.

**Applies to:** All data gathering, research, and list-building tasks.

---

## 5. ALEX APPROVES BEFORE SHIPPING

No output ships without Alex's explicit approval. Show proposed changes before applying.
Never auto-commit, auto-send, or auto-publish.

**Applies to:** All deliverables, file writes to production paths, git commits, email sends.

---

## 6. THREE-DRAFT APPROVAL PROCESS

All design output follows three drafts with approval gates:

- **Draft 1 -- Layout:** Structure, hierarchy, section placement. No final images. Alex approves before proceeding.
- **Draft 2 -- Content:** Images placed, copy finalized, visual audit complete. Alex approves before proceeding.
- **Draft 3 -- Polish:** Final refinements, spacing, alignment, print-readiness. Alex approves before shipping.

Never compress drafts. Never skip a gate. If Alex requests changes at any draft, revise and re-present that draft before advancing.

**Applies to:** re-print-design, re-email-design, re-landing-page, re-listing-presentation, canva-handoff, listing-pipeline.

---

## 7. COPY STANDARDS

Never use "stunning," "breathtaking," "amazing," or exclamation marks. Match prestige to property tier. No lorem ipsum. Copy is dense and specific -- name finishes, neighborhoods, lifestyle details.

**Applies to:** All marketing copy, listing descriptions, email content, presentation text.

---

## 8. GAT CO-BRAND

GAT branding ("Title & Escrow Services Provided by Great American Title Agency") appears on print back page only. Never on listing presentations, landing pages, email body, or any digital-only output.

**Applies to:** All design and marketing output.

---

## 9. LENDER PARTNER SCOPING

**Christine McConnell** (Nations Lending): Co-brands with Julie Jarmiolowski on Optima Camelview Village materials ONLY. Never assume her involvement. Never volunteer her name. Never include when Julie appears in any other context.

**Stephanie Reid** (Gravity Home Loans): Never co-present with Christine in the same deliverable, email section, event stage, or class. Only exception: Q4 client celebration events.

See STRATEGY-CONTEXT.md for full lender separation rules.

**Applies to:** All agent-facing output, co-branded materials, event collateral.

---

## 10. REFERRAL HANDLE

Verbatim, locked, never paraphrase:

> "I make sure the transaction you promised your client is the transaction they experience."

Use in: BNI pitch, cold call intros, email footer context, Talk Trigger derivations, CTA copy referencing Alex's value proposition, any response to "what do you do."

**Applies to:** All business development, pitch, and positioning output.

---

## 11. SEO MINIMUM FOR WEB OUTPUT

Every HTML landing page or web property includes:
- Unique title tag (50-60 chars, primary keyword at start)
- Meta description (155-160 chars)
- One H1 per page
- JSON-LD schema markup (type depends on content)
- Open Graph tags (og:title, og:description, og:image)
- Image alt text on every img tag
- WebP format preferred for all images

**Applies to:** re-landing-page, intake page, any web-hosted output.
Does NOT apply to email HTML or print HTML.

---

## 12. COMPOUND TASK ROUTING  (SUPERSEDED -- see system/00-router.md)

This rule's task->reads table has moved into the classify-first router. **Do not route
from this file.** Routing now runs in one place:

1. `system/00-router.md` -- classify every request into four fields (client, output,
   channel, mode), disambiguate, then resolve a hat.
2. `system/routing-table.md` -- the single map of classification -> hat -> rule packs +
   skill + context reads. This absorbed the old table above and the keyword->skill table
   that used to live in `CLAUDE.md`.

### Rule Scope Map (which pack each rule below belongs to)

The router loads rules as **packs**, not as this whole file. Every request loads the
`always-on` pack; conditional packs load only when their classification triggers.

| Rule(s) | Pack (`system/rules/...`) | Loads when |
|---|---|---|
| R1, R2, R3, R4, R5 | `always-on` | every request |
| R7 | `packs/copy-standards` | mode = creative-copywriting / brand-positioning |
| R6, R13, R14, R15 | `packs/design-process` | mode = design-direction |
| R8 | `packs/co-brand-gat` | print design output only |
| R9 | `packs/lender-scoping` | client = agent/listing AND co-branded |
| R10 | `packs/positioning` | client = me AND BD/positioning output |
| R11 | `packs/web-seo` | channel = web |

This file remains the **canonical text** for each rule. The packs reference these rules;
they do not replace them.

**Applies to:** Every skill that produces output. Classify before building, not after.

---

## 13. DESIGN POLISH PROTOCOL (3-PASS)

When in the finalization/polish phase of any design output, execute feedback in three separate passes. Never combine passes.

**Pass 1 -- Structure Audit:**
Compare current layout against the skeleton defined in the relevant design skill. Flag every deviation from grid, section order, or content zones. Do not fix anything yet. Report only.

**Pass 2 -- Brand + Token Audit:**
Compare current output against `design-foundation.md` and `brand.md`. Check: colors (GAT Red #b31a35, GAT Blue #003087), fonts (Email: Playfair Display + Inter; Print/Landing/Decks: Playfair Display + Montserrat), spacing tokens, image sizing rules. Flag every violation. Do not fix anything yet. Report only.

**Pass 3 -- Apply Fixes:**
Apply only the fixes approved from Pass 1 and Pass 2, plus any additional instructions from Alex. After applying, re-run Pass 2 as a silent self-check before presenting output.

**Applies to:** re-print-design, re-email-design, re-landing-page, re-listing-presentation, canva-handoff, listing-pipeline.

---

## 14. IMAGE HANDLING (ALL DESIGN OUTPUTS)

These rules apply to every design skill. Always:

1. Audit image dimensions with Pillow before placing
2. Full-bleed images = `object-fit: cover`, 100% width and height
3. Graphs and charts = full container width, `height: auto`, never crop
4. Never stretch, never distort, never guess dimensions

**Applies to:** All skills that place images in any output format.

---

## 15. FEEDBACK INTERPRETATION

When Alex gives design feedback:

- "Make it bigger/smaller" = change by 25% unless a specific value is given
- "Fix the spacing" = re-read `design-foundation.md` spacing tokens and re-apply from scratch
- "It doesn't look right" = run Pass 1 + Pass 2 audits (Rule 13) before making changes
- "Match this reference" = when a screenshot is provided, prioritize visual matching over current skill defaults
- Treat every piece of feedback as a systemic fix, not a one-off patch. If the fix applies to a repeated element, apply it to all instances.

**Applies to:** All design revision cycles.
