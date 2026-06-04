---
layer: system
scope: global
type: rule-pack
pack: lender-scoping
description: Lender partner separation rules. Loads for co-branded agent/listing output.
source: standing-rules.md (R9), STRATEGY-CONTEXT.md
status: stub
---

# RULE PACK: lender-scoping  (STUB)

**Loads when:** `client = agent | listing` AND the deliverable is co-branded with a lender.
**Excluded when:** `client = me`, internal-crm, data, or any non-co-branded piece.

## Source
Canonical text: `standing-rules.md` Rule 9; full separation rules in `STRATEGY-CONTEXT.md`
(not present in this snapshot -- wire on porting).

## To fill in
- [ ] Christine McConnell (Nations Lending): Julie Jarmiolowski + Optima Camelview only.
      Never volunteer; never include when Julie appears elsewhere.
- [ ] Stephanie Reid (Gravity): never co-present with Christine (except Q4 client events).
