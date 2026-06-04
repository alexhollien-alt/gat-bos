---
layer: system
scope: global
type: rule-pack
pack: design-process
description: The design lifecycle rules -- draft gates, polish passes, image handling, feedback interpretation. Loads for any design execution.
source: standing-rules.md (R6, R13, R14, R15)
status: stub
---

# RULE PACK: design-process  (STUB)

**Loads when:** `mode = design-direction` (any print or screen design build).
**Excluded when:** copy-only, data, strategy, or operational tasks.

## Source
Canonical text: `standing-rules.md` Rules 6, 13, 14, 15.

## To fill in
- [ ] R6 -- Three-draft approval (Layout -> Content -> Polish), gates not compressed.
- [ ] R13 -- Design polish 3-pass (Structure audit -> Brand/token audit -> Apply fixes).
- [ ] R14 -- Image handling (audit dims with Pillow, object-fit cover, never stretch).
- [ ] R15 -- Feedback interpretation ("bigger" = 25%, "fix spacing" = re-read tokens, etc.).
