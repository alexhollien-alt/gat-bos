---
layer: system
scope: global
type: mode
hat: crm-operations
kind: intent-hat
status: stub
---

# HAT: crm-operations  (STUB)

## Purpose
**GAT-BOS / CRM** work -- workflows, contact records, tickets, automations, briefings.
Operational and technical, not marketing.

## Typical classification
- client: `internal-crm`  ·  mode: `technical-implementation` / `operational-workflow`

## Rule packs
- Loads: `always-on` only (note A3 No-Hard-Deletes is load-bearing here).
- **Out of scope (must NOT apply):** `copy-standards`, `co-brand-gat`, `web-seo`, `positioning`, `lender-scoping`.

## Inputs (to fill)
- [ ] Records/contacts involved, the workflow or automation goal.

## Outputs (to fill)
- [ ] Cypher tickets, CRM record changes, follow-up sequences, briefings.

## Examples (to fill)
- [ ] "Ticket this up from my meeting notes" -> crm-operations + cypher-ticket-builder.
