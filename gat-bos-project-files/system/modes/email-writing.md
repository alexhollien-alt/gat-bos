---
layer: system
scope: global
type: mode
hat: email-writing
kind: output-hat
status: stub
---

# HAT: email-writing  (STUB, output hat)

## Purpose
**Email and SMS** production. Composes with an intent hat (agent / personal / listing /
event) which supplies the voice and the client-specific packs.

## Typical classification
- output: `email` / `sms`  ·  channel: `email` / `sms`

## Skill + packs
- Skill: `re-email-design` (email) / `re-marketing` (sms).
- Output packs: `design-process` (email HTML). Inherits intent-hat packs.
- **Out of scope:** `web-seo` (email HTML is not a web property), `co-brand-gat` on email body.

## Examples (to fill)
- [ ] "Weekly Edge email for Julie" -> agent-marketing + email-writing.
- [ ] "Email blast for my open house" -> personal-brand or listing-marketing + email-writing.
