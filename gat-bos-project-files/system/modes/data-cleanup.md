---
layer: system
scope: global
type: mode
hat: data-cleanup
kind: intent-hat
status: stub
---

# HAT: data-cleanup  (STUB)

## Purpose
**Spreadsheet/CSV/list** processing -- cleaning, deduping, normalizing, transforming.
Pure data work, no copy or design.

## Typical classification
- client: `data`  ·  mode: `data-processing`

## Rule packs
- Loads: `always-on` only (A3 No-Hard-Deletes and A4 No-Scraping are load-bearing here).
- **Out of scope (must NOT apply):** all copy/design/positioning packs.

## Inputs (to fill)
- [ ] The file, the target schema, dedupe keys, what "clean" means here.

## Outputs (to fill)
- [ ] Cleaned file + change log; never overwrite source without approval (A5).

## Examples (to fill)
- [ ] "Dedupe this contact export" -> data-cleanup; flag merges, never hard-delete.
