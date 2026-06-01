---
layer: system
scope: global
type: router
description: The single entry point. Classify every request into four fields, resolve a hat, load only matching rule packs, then build. Supersedes CLAUDE.md "Skill Routing" and standing-rules.md Rule 12.
depends_on: [classification.md, routing-table.md, rules/always-on.md]
priority: highest
---

# THE ROUTER -- read this first, every time

No output is produced until this procedure runs. It exists so the system **thinks
before it creates**: it decides *who the work is for*, *what is being made*, *what
channel*, and *what thinking mode* -- and then loads **only** the rules that match.

This file replaces both old routers. `CLAUDE.md` and `standing-rules.md` Rule 12 now
defer here.

---

## Procedure

### Step 1 -- Classify (4 fields)
Resolve all four fields from `classification.md`:
`client` · `output` · `channel` · `mode`.

### Step 2 -- Disambiguate before guessing
Run the request against the **Disambiguation Table** in `classification.md`. If a
trigger word (`marketing`, `design`, `flyer`, `page`, `post`, `list`, `send`,
`update`) leaves a field unresolved, **stop and ask one consolidated question.** Never
guess `client` -- it is the field most likely to load the wrong rules.

### Step 3 -- Resolve the hat (routing-table.md)
- **Intent hat** from `client` + `mode` -> the rule packs.
- **Output hat** from `output` + `channel` -> the skill + output-specific packs.

### Step 4 -- Load rules, name exclusions
Final pack set = `always-on` + intent-hat packs + output-hat packs (deduped),
**minus** the exclusions listed for that hat. Load nothing outside this set.

### Step 5 -- Declare the hat (the gate)
Before building, state the resolution back to Alex in this exact shape, then proceed:

```
HAT: <intent-hat> + <output-hat>
Classification: client=<..> output=<..> channel=<..> mode=<..>
Packs loaded: always-on, <..>
Packs excluded: <..>
Skill: <..>
```

If anything in the declaration looks wrong to Alex, he corrects one field and the route
re-resolves. This is the moment that catches a misclassification before it becomes a
wrong deliverable.

---

## Worked example

Request: *"Make a flyer for Julie's new Optima listing."*

1. Classify: client=`agent` (Julie), output=`flyer`, channel=`print`, mode=`design-direction`.
2. Disambiguate: `flyer` present but client IS known (Julie) -> no question needed.
3. Hat: intent = **agent-marketing**; output = **print-collateral**.
4. Packs: `always-on` + `copy-standards`, `lender-scoping` (Optima = Christine/Julie),
   `co-brand-gat` (print), `design-process`. Excluded: `positioning`, `web-seo`.
5. Declare, then build with `re-print-design`.

Contrast: *"Make a flyer for my farm area."* -> client=`me` -> intent =
**personal-brand**, packs swap to `positioning` (+`co-brand-gat` for print), and
`lender-scoping` is **excluded**. Same output word, different rules. That swap is the
entire reason this router exists.

---

## Hard invariants
- `client = me` never loads `lender-scoping` or `co-brand-gat`.
- `client = agent | listing` never loads `positioning`.
- `always-on` always loads; it is never excluded.
- A route never loads a pack listed in its own EXCLUDED column.

These are tested by `test-matrix.md`.
