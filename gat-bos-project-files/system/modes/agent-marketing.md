---
layer: system
scope: global
type: mode
hat: agent-marketing
kind: intent-hat
status: stub
---

# HAT: agent-marketing  (STUB)

## Purpose
Marketing produced **for a specific real estate agent** (Tier 1 client), in that
agent's voice and brand -- not Alex's.

## Typical classification
- client: `agent`  ·  mode: `creative-copywriting` / `design-direction`

## Rule packs
- Loads: `always-on`, `copy-standards`, `lender-scoping` (if co-branded), `co-brand-gat` (if print)
- **Out of scope (must NOT apply):** `positioning` -- this is the agent's voice, never Alex's referral handle.

## Inputs (to fill)
- [ ] Agent identity + brand palette, target audience, the specific ask.

## Outputs (to fill)
- [ ] Routes to output hats: print-collateral, email-writing, social-content, brief.

## Examples (to fill)
- [ ] "Flyer for Julie's new Optima listing" -> agent-marketing + print-collateral + co-brand-gat + lender-scoping.
