---
phase: 023
slug: design-overhaul-crm-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 023, Validation Strategy

> Per-phase validation contract for the CRM Surface Audit. This phase produces inspection artifacts (PNG screenshots, locked spec markdown, critique markdown, PATTERNS.md), not application code. Validation is grep-and-file-presence based rather than test-framework based.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + grep + file-existence checks (no JS/TS test runner; this phase produces docs and PNGs) |
| **Config file** | none; Wave 0 establishes `$AUDIT_DIR` |
| **Quick run command** | `ls $AUDIT_DIR/crm/*.png \| wc -l` (count captures) |
| **Full suite command** | `bash .planning/phases/023-design-overhaul-crm-audit/scripts/verify-audit.sh` (Wave 0 authors this) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `ls -la $AUDIT_DIR/` (confirm artifacts exist and are non-empty)
- **After every plan wave:** Run `verify-audit.sh` to check coverage matrix
- **Before `/gsd-verify-work`:** All required PNGs + .md files present, no zero-byte files
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 023-01-01 | 01 | 0 | AUDIT-CRM-01 | n/a | env check passes or 00-environment-gaps.md exists | file | `test -d $AUDIT_DIR && (test -f $AUDIT_DIR/00-environment-gaps.md \|\| true)` | W0 | pending |
| 023-01-02 | 01 | 0 | AUDIT-CRM-01 | T-023-01 | Playwright auth storageState captured before route fan-out | file | `test -s $AUDIT_DIR/auth-state.json` | W0 | pending |
| 023-02-01 | 02 | 1 | AUDIT-CRM-03 | n/a | locked Direction B spec written | file+grep | `grep -q "warm charcoal" $AUDIT_DIR/crm/direction-B-locked-spec.md` | W0 | pending |
| 023-03-01 | 03 | 1 | AUDIT-CRM-01 | n/a | desktop+mobile PNGs exist for /dashboard | file | `test -s $AUDIT_DIR/crm/dashboard-1440x900.png && test -s $AUDIT_DIR/crm/dashboard-390x844.png` | W0 | pending |
| 023-03-02 | 03 | 1 | AUDIT-CRM-01 | n/a | PNGs exist for /contacts list | file | `test -s $AUDIT_DIR/crm/contacts-1440x900.png && test -s $AUDIT_DIR/crm/contacts-390x844.png` | W0 | pending |
| 023-03-03 | 03 | 1 | AUDIT-CRM-01 | n/a | PNGs exist for /contacts/[id] (seed Stephanie Reid 350ef57b-4c09-4952-bf70-87dad5a94d2e) | file | `test -s $AUDIT_DIR/crm/contact-detail-1440x900.png && test -s $AUDIT_DIR/crm/contact-detail-390x844.png` | W0 | pending |
| 023-03-04 | 03 | 1 | AUDIT-CRM-01 | n/a | /events fill-and-flag, route absent per research | file | `test -f $AUDIT_DIR/crm/events-missing.md` | W0 | pending |
| 023-03-05 | 03 | 1 | AUDIT-CRM-02 | n/a | alexhollienco.com prod PNGs exist at both viewports | file | `test -s $AUDIT_DIR/crm/alexhollienco-1440x900.png && test -s $AUDIT_DIR/crm/alexhollienco-390x844.png` | W0 | pending |
| 023-04-01 | 04 | 2 | AUDIT-CRM-04 | n/a | one critique .md per captured PNG | grep | `[ $(ls $AUDIT_DIR/crm/critique-*.md \| wc -l) -ge $(ls $AUDIT_DIR/crm/*.png \| wc -l) ]` | W0 | pending |
| 023-04-02 | 04 | 2 | AUDIT-CRM-04 | n/a | every critique addresses 6-criterion rubric | grep | `for f in $AUDIT_DIR/crm/critique-*.md; do grep -q "Token compliance" $f && grep -q "Typography hierarchy" $f && grep -q "Crimson usage" $f; done` | W0 | pending |
| 023-05-01 | 05 | 3 | AUDIT-CRM-05 | n/a | PATTERNS.md exists and separates system vs component | grep | `grep -q "## System-level violations" $AUDIT_DIR/crm/PATTERNS.md && grep -q "## Component-level violations" $AUDIT_DIR/crm/PATTERNS.md` | W0 | pending |

Status legend: pending, green, red, flaky.

---

## Wave 0 Requirements

- [ ] `scripts/verify-audit.sh`, bash script asserting all PNG + .md outputs present and non-empty
- [ ] `$AUDIT_DIR=/tmp/design-audit-$(date +%Y-%m-%d)`, exported and reused across tasks
- [ ] Playwright auth storageState file at `$AUDIT_DIR/auth-state.json`. Research finding: middleware redirects every `(app)/*` route to `/login` without session, so captures would otherwise record the login form, not the dashboard. One-time manual login, then reused by every capture task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Playwright login + storageState save | AUDIT-CRM-01 | Supabase session cookie acquisition requires real credentials and cannot automate without leaking secrets into the repo. | Alex runs `playwright-cli` login flow once, saves to `$AUDIT_DIR/auth-state.json`. All subsequent capture tasks reuse via `--storage-state` flag. |
| Visual judgment in Mode A critique | AUDIT-CRM-04 | design-critique is an opinionated heuristic skill. It produces a markdown report but the "is the calendar widget integrated" verdict is qualitative. | Alex skims each critique-*.md as a sanity check before GATE 1. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (grep/file checks) or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (auth-state.json, AUDIT_DIR, verify-audit.sh)
- [ ] No watch-mode flags (this phase is one-shot capture + critique)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 ships

**Approval:** pending

---

## Notes

- This is an inspection phase, not a build phase. Artifacts produced are evidence (PNGs, critique markdown), not application code. Validation guards file presence and content shape rather than runtime behavior.
- T-023-01 (auth storageState capture) is the single load-bearing pre-work item per research findings. If skipped, every capture PNG records the login form instead of the dashboard.
- Threat model surface area is minimal: capturing screenshots of the local dev server. Storage state contains a real Supabase session token, so keep `$AUDIT_DIR` out of git (it lives in `/tmp/`).
