# Phase 023: CRM Surface Audit - Research

**Researched:** 2026-05-21
**Domain:** Visual audit pipeline (Playwright capture + design-critique Mode A + pattern synthesis)
**Confidence:** HIGH

## Summary

Phase 023 is a capture-and-critique pipeline, not a build. Five tools chain: (1) `pnpm dev` boots the CRM, (2) `playwright-cli` captures full-page screenshots at two viewports, (3) the planner writes a locked Direction B spec to disk, (4) `design-critique` Mode A runs against each PNG, (5) findings synthesize into `PATTERNS.md`. GATE 1 halts the phase before any fix. Every tool and skill the phase needs is already installed and verified.

The audit will surface a structural truth the planner must price in: the CRM's current `globals.css` token system is **completely incompatible with Direction B Concierge**. Ground is `#FCFBFB` (light), Structure is `#192A56` (navy), Signal is `#F7D794` (yellow champagne). Direction B calls for warm charcoal background `#1A1714`, accent champagne `#C9A961` (different yellow), and Instrument Serif numerals (font not loaded). The audit's job is to document this gap with evidence, not to fix it. Expect every CRM route to fail every Direction B criterion in some form -- that is the finding.

**Primary recommendation:** Treat captures as the load-bearing artifact. Auth-protected routes (`/dashboard`, `/contacts`, `/contacts/[id]`) require a logged-in browser session before `playwright-cli screenshot` will return anything other than `/login`. The planner must include a Wave 0 task that establishes Supabase session cookies (manual login + storage state export) before parallel capture fan-out begins.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Direction B Concierge spec is locked** for the duration of this audit:
  - Background: warm charcoal `#1A1714`
  - Accents: champagne gold (working value `#C9A961`, flag if `design-tokens` disagrees)
  - Display numerals: Instrument Serif 700, tight letter spacing
  - UI text: Inter 400, generous line height
  - Metrics: Inter 600
  - Crimson (`#b31a35`) only for urgency states, never decoration
  - Calendar widget: top-right, integrated into layout, never floating
  - Today's Focus prioritized over analytics widgets
  - Runway interaction model: 6-10 visible tasks, system-ordered, collapse on complete
- **Capture viewports:** `1440x900` desktop AND `390x844` mobile, fullPage screenshots
- **Routes to capture:** `/dashboard`, `/contacts`, `/contacts/[id]` (first agent), `/events` (if exists), `alexhollienco.com` (production URL, not local)
- **Output path:** `AUDIT_DIR=/tmp/design-audit-$(date +%Y-%m-%d)`
- **GATE 1 halts the phase before any fix.** No remediation in Phase 023.
- **6-criterion rubric** for design-critique Mode A runs: token compliance, typography hierarchy, spatial rhythm, crimson usage ratio, calendar widget integration, Today's Focus hierarchy.
- **PATTERNS.md must distinguish system-level (3+ routes) from component-level (single route) violations.**

### Claude's Discretion

- Whether to run captures via shell `parallel` / `&` background jobs vs. multiple `playwright-cli run-code` invocations.
- Filename slugging convention inside the `{route-name}-{viewport}.png` template (e.g., `dashboard-desktop.png` vs `dashboard-1440.png` -- planner picks one and uses it consistently).
- Whether the locked Direction B spec is reconstructed from CONTEXT.md or pulled from a prior reference image, when both are available.
- Pre-work environment-gap logging: write `00-environment-gaps.md` only if something is missing (fill-and-flag), or skip the file when everything checks.

### Deferred Ideas (OUT OF SCOPE)

- Any fix to the token system, globals.css, layout, fonts, or component code.
- Wiring Direction B tokens into Tailwind config / CSS variables.
- Loading Instrument Serif via `next/font`.
- Replacing shadcn defaults that bleed through.
- Email surface audit (Phase 024).
- Flyer audit (Phase 025).
- Cross-surface synthesis (Phase 026).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-CRM-01 | Playwright fullPage screenshots of /dashboard, /contacts, /contacts/[id], /events at 1440x900 + 390x844 | `playwright-cli` skill verified at `/usr/local/bin/playwright-cli`; `run-code` supports `fullPage: true`; viewport `resize` documented. Routes verified in `~/crm/src/app/(app)/` -- BUT `/events` does NOT exist under `(app)`; only `/api/events` and `/portal/[slug]/(authed)/events` exist. Plan must fill-and-flag `/events` as missing. |
| AUDIT-CRM-02 | alexhollienco.com captured at both viewports against production URL | Public production URL, no auth required. Standard `playwright-cli goto + screenshot` flow. |
| AUDIT-CRM-03 | Locked Direction B spec written to `$AUDIT_DIR/crm/direction-B-locked-spec.md` | CONTEXT.md provides verbatim spec content. Planner emits as Write-tool task. |
| AUDIT-CRM-04 | design-critique Mode A run against every captured screenshot with 6-criterion rubric | `~/.claude/skills/design-critique/SKILL.md` + `references/mode-a-incoming.md` + `references/rubric.md` confirm Mode A workflow accepts PNG inputs and produces severity-tagged punchlist output. Mode A and Mode B documented separately. |
| AUDIT-CRM-05 | PATTERNS.md distinguishes system-level (3+ routes) vs component-level violations | Output is a written synthesis pass; no tooling needed beyond reading the critique markdown files and counting violation recurrence. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser navigation + screenshot capture | CLI tool (playwright-cli) | -- | playwright-cli is the locked default browser tool per Rule 23-ish tool-routing; replaces retired `mcp__playwright__*` |
| Dev server hosting captured pages | Frontend Server (Next.js dev mode) | -- | `pnpm dev` boots Next.js 14 App Router from `~/crm/src/app/`; auth middleware gates `(app)/*` routes |
| Auth session for protected routes | API / Backend (Supabase auth + middleware.ts) | Browser (cookies) | Middleware at `~/crm/src/middleware.ts` redirects unauthenticated requests to `/login`; capture must carry Supabase session cookies |
| Design spec storage | Local filesystem (`$AUDIT_DIR/crm/`) | -- | Phase outputs are markdown + PNG files, not committed; ephemeral `/tmp` location |
| Critique authoring | Skill (design-critique Mode A) | -- | Skill is the canonical reader of rendered PNGs against a spec; produces severity-tagged punchlist markdown |
| Pattern synthesis | Manual / agent reasoning | -- | No automated synthesis tool; planner reads all `critique-*.md` and writes PATTERNS.md by hand |

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| playwright-cli | installed at `/usr/local/bin/playwright-cli` | Browser capture (goto, resize, screenshot) | Locked default browser tool per `tool-routing.md`; `mcp__playwright__*` retired |
| Playwright (npx) | 1.59.1 | Underlying engine for `playwright-cli`; also drives `npx playwright install chromium` | Required by environment check; verified installed |
| pnpm | 10.32.1 | Boots dev server (`pnpm dev`) | CRM is pnpm-only per `~/crm/CLAUDE.md`; never npm/yarn |
| Pillow (PIL) | 11.3.0 | Image dimension audit per Standing Rule 14 | Verified installed via `python3 -c "from PIL import Image"` |
| design-critique skill | live | Mode A audit against locked spec | Path verified, Mode A + Mode B documented separately in `references/` |
| design-tokens skill | live | Source of truth for system palette / type kit | Used to validate `#C9A961` vs system `#F7D794` discrepancy |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Bash (background jobs `&`, `wait`) | Parallelize capture jobs across routes/viewports | Phase explicitly says "fan out, parallel" -- don't serialize |
| `mkdir -p` | Create `$AUDIT_DIR/crm/` | First task before any capture |
| design-tokens skill SKILL.md | Confirm `#C9A961` vs `#F7D794` | When writing the locked spec, flag the working-value discrepancy |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `playwright-cli screenshot` (single viewport command) | `playwright-cli run-code` with `page.setViewportSize` + `page.screenshot({fullPage:true})` inline | run-code is required for fullPage; the bare `screenshot` command only captures the visible viewport. Use run-code. |
| Local screenshot of `alexhollienco.com` | `WebFetch` | WebFetch returns markdown text, not pixels. Required output is PNG. Playwright is mandatory. |
| Manual login per capture | Stored Supabase session cookies via `playwright-cli` storage state | Storage state is the only sane path for fan-out parallelism. See Common Pitfalls. |

**Verification:**

```bash
playwright-cli --help  # confirms binary present
npx playwright --version  # 1.59.1 verified
pnpm --version  # 10.32.1 verified
python3 -c "from PIL import Image; print(Image.__version__)"  # 11.3.0 verified
```

## Architecture Patterns

### System Architecture Diagram

```
Pre-work (sequential)
    |
    v
Environment check ----> 00-environment-gaps.md (only if gaps)
    |
    v
mkdir $AUDIT_DIR/crm/
    |
    v
Write direction-B-locked-spec.md  <-- AUDIT-CRM-03 closes here
    |
    v
Boot pnpm dev (probe :3000 then :3001)
    |
    v
Establish auth session
    |  (manual login OR storage state import)
    v
Capture fan-out (parallel) -----+------> /dashboard-desktop.png
    |                            +------> /dashboard-mobile.png
    |                            +------> /contacts-desktop.png
    |                            +------> /contacts-mobile.png
    |                            +------> /contacts-[id]-desktop.png
    |                            +------> /contacts-[id]-mobile.png
    |                            +------> /events-* (flag missing route)
    |                            +------> alexhollienco-desktop.png
    |                            +------> alexhollienco-mobile.png
    |                                          AUDIT-CRM-01 + 02 close here
    v
Critique fan-out (parallel) ---> design-critique Mode A per PNG
    |                            -> critique-{route}-{viewport}.md
    |                                          AUDIT-CRM-04 closes here
    v
Synthesize (sequential) -------> read all critique-*.md
                                 -> PATTERNS.md (system vs component)
                                          AUDIT-CRM-05 closes here
    |
    v
GATE 1: HALT
```

### Recommended File Structure

```
/tmp/design-audit-2026-05-21/
    crm/
        00-environment-gaps.md         # only if pre-work surfaces gaps
        direction-B-locked-spec.md      # written before captures
        dashboard-desktop.png
        dashboard-mobile.png
        contacts-desktop.png
        contacts-mobile.png
        contacts-{uuid}-desktop.png
        contacts-{uuid}-mobile.png
        events-{flag}.md                # if /events missing
        alexhollienco-desktop.png
        alexhollienco-mobile.png
        critique-dashboard-desktop.md
        critique-dashboard-mobile.md
        critique-contacts-desktop.md
        ...
        PATTERNS.md                     # synthesis output, GATE 1 artifact
```

### Pattern 1: Authenticated capture via storage state

**What:** Playwright stores cookies/localStorage after a manual login, replays them on every subsequent capture. The CRM middleware checks Supabase session cookies; if absent, returns 307 to `/login`.

**When to use:** Every CRM route except `/intake`, `/agents/`, `/agent/`, `/api/`, and `/portal/*/login`. All `(app)/*` routes require this.

**Example:**

```bash
# One-time: log in once, save state
playwright-cli open http://localhost:3000/login
# (Alex fills credentials manually)
playwright-cli run-code "async (page, context) => {
  await context.storageState({ path: '/tmp/design-audit-2026-05-21/auth.json' });
  return 'saved';
}"

# Per capture: import state and screenshot
playwright-cli run-code "async (page, context) => {
  // context already created with storageState if launched with state file
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/design-audit-2026-05-21/crm/dashboard-desktop.png', fullPage: true });
  return 'captured';
}"
```

(Source: `~/.claude/skills/playwright-cli/screenshots-and-media.md` + `session-management.md` + `storage-and-auth.md`.)

### Pattern 2: Parallel capture fan-out

**What:** Two viewports x five routes = 10 capture jobs. Run as background `&` shell jobs, `wait`, then proceed to critique fan-out.

**When to use:** When the phase says "fan out, parallel" (it does).

**Anti-pattern:** Serial `for route in routes; do capture; done` -- violates the source plan's explicit parallelism directive.

### Pattern 3: Mode A invocation per screenshot

**What:** design-critique Mode A accepts PNG input + a reference spec. The skill's Step 1 "Intake" asks one question -- the planner answers it inline ("CRM screenshot of {route} at {viewport}; reference is `direction-B-locked-spec.md`").

**Example workflow (from `references/mode-a-incoming.md`):**

```
Step 2 -- Normalize: PNG input is already normalized; copy/reference path.
Step 3 -- Run Section A (Structural Read): A1 spacing, A2 color, etc.
Step 4 -- Run Section B (Composition)
Step 5 -- Run Section C (Incoming-only) -- C2 EXTRACT block irrelevant here
        (the output isn't going to theme-factory; it's going to PATTERNS.md)
Step 6 -- Assign disposition -- map to "system-level vs component-level"
         language instead of PRESERVE/REBUILD/EXTRACT
```

Note: the standard Mode A disposition vocabulary (PRESERVE/REBUILD/EXTRACT) does not match Phase 023's required vocabulary (system-level vs component-level). The planner should add a translation note inside `direction-B-locked-spec.md` or in each critique file's preamble so the disposition section maps cleanly into PATTERNS.md synthesis. [VERIFIED: `~/.claude/skills/design-critique/references/mode-a-incoming.md` lines 74-82]

### Anti-Patterns to Avoid

- **Capturing `/dashboard` without auth.** Returns 307 redirect to `/login`; PNG will show a login form. Wastes the capture, contaminates the critique. Establish auth session first.
- **Writing screenshots to `/tmp/` and assuming relative paths work in markdown.** `PATTERNS.md` will live in `$AUDIT_DIR/crm/`, so PNG references should be relative-from-PATTERNS (`./dashboard-desktop.png`) or absolute.
- **Probing `:3000` only.** Standing Rule 17: `pnpm dev` auto-increments to `:3001` if 3000 is taken. Probe both with `curl -sI localhost:3000` AND `localhost:3001` before deciding.
- **Calling Mode A "audit" verbally.** The skill's trigger map (`SKILL.md` line 23) explicitly says "Never fire on the bare word 'audit'". Internal phase invocations bypass triggers, but if the planner spawns a subagent it must use phrases like "audit incoming" or "review their design".
- **Hardcoding `#C9A961` into globals.css.** This is GATE 1; no fixes happen. Spec stays on disk, code stays untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Take a fullPage screenshot | A custom Puppeteer script | `playwright-cli run-code` with `page.screenshot({fullPage: true})` | playwright-cli is the locked default browser tool; building a parallel script violates tool-routing |
| Read PNG dimensions before placement | Custom imaging code | Pillow `Image.open(path).size` | Standing Rule 14: Pillow audit is the standard |
| Audit incoming design vs a spec | Free-form prose review | design-critique Mode A with its 3-section rubric | The rubric (A spacing grid, B composition, C incoming-only) is the standard; reinventing it produces lower-quality findings |
| Detect dev server port | Hardcode `:3000` | Probe both `:3000` and `:3001` with curl | Standing Rule 17; Next.js auto-increments |
| Establish auth for headless capture | Mock the Supabase client | `playwright-cli` storage state (manual login once, replay cookies) | Mocking auth changes runtime behavior the audit is meant to measure |

**Key insight:** Every component of this phase has a locked tool. The phase is composing them, not writing new ones.

## Runtime State Inventory

Not applicable. Phase 023 is a read-only audit; no renames, refactors, migrations, or state changes occur. Output is markdown + PNG to `/tmp/`. The CRM database, code, secrets, and OS state are untouched. The only "stored data" the phase produces is the audit artifacts themselves, which live in ephemeral `/tmp` and are not committed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `playwright-cli` (binary) | All capture tasks | yes | installed at `/usr/local/bin/playwright-cli` | -- |
| `npx playwright` (engine) | Pre-work check; underlying playwright runtime | yes | 1.59.1 | -- |
| Chromium browser | playwright-cli rendering | unknown -- run `npx playwright install chromium` as pre-work | -- | -- |
| `pnpm` | CRM dev server boot | yes | 10.32.1 | -- |
| `~/crm/.env.local` Supabase vars | Dev server auth | assumed present (verify with `[ -f ~/crm/.env.local ]`) | -- | flag and stop if missing |
| Pillow (PIL) | Image dimension audit (Rule 14) | yes | 11.3.0 | -- |
| `~/.claude/skills/design-generator/SKILL.md` | Pre-work check | yes | live | -- |
| `~/.claude/skills/design-critique/SKILL.md` | Mode A audit | yes | live, Mode A + B documented | -- |
| `~/.claude/skills/brand-audit/SKILL.md` | Pre-work check | yes | live | -- |
| `~/.claude/skills/design-tokens/SKILL.md` | Spec validation | yes | live, declares Champagne = `#F7D794` | -- |
| `~/.claude/rules/digital-aesthetic.md` | Spec authority | NO -- actual path is `~/.claude/context/digital-aesthetic.md` | -- | adjust path in spec; log to `00-environment-gaps.md` |
| `~/.claude/rules/design-foundation.md` | Spec authority | NO -- actual path is `~/.claude/context/design-foundation.md` | -- | adjust path in spec; log to `00-environment-gaps.md` |
| `~/.claude/rules/brand.md` | GAT-locked palette | yes | live (locks GAT Red `#b31a35`, but GAT Blue is via system palette per `colors.md`) | -- |
| Live Supabase agent ID for `/contacts/[id]` | AUDIT-CRM-01 (contact detail capture) | yes | `350ef57b-4c09-4952-bf70-87dad5a94d2e` (Stephanie Reid, lender) is the first row in `~/crm/supabase/seeds/gatbos-seed-2026-04-10.sql` | use a real-agent (type='realtor') id if Alex prefers; planner can grep seed for `'realtor'` to pick one |
| Production URL `alexhollienco.com` | AUDIT-CRM-02 | assumed live (no banned domain per Rule 4) | -- | if WebFetch returns Cloudflare 202/403/429, fall back to `playwright-cli goto` directly |
| Authenticated Supabase session for `(app)/*` routes | All CRM captures except `alexhollienco.com` | unknown -- depends on whether Alex is willing to log in manually once | -- | block on this; storage state from prior session may exist at `~/crm/playwright-storage.json` or similar -- planner should grep |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Two `~/.claude/rules/*.md` files referenced in CONTEXT.md actually live in `~/.claude/context/`. Path adjustment, not a blocker.

**Verified state at research time:**
- Routes that exist under `~/crm/src/app/(app)/`: `dashboard`, `contacts` (+ `contacts/[id]`), plus extras like `today`, `today-v2`, `morning`, `tickets`, `weekly-edge`, `tasks`, `materials`, `inbox`, `opportunities`, `drafts`, `projects`, `actions`, `material-requests`, `campaigns`, `analytics`, `captures`.
- Routes that DO NOT exist: `/events` is referenced in CONTEXT.md and ROADMAP.md but no such route exists under `(app)`. Only `/api/events` (server) and `/portal/[slug]/(authed)/events` (agent portal) exist. **Plan must fill-and-flag this** by writing a one-line `events-missing.md` to `$AUDIT_DIR/crm/` and continuing -- never stop the phase.

## Common Pitfalls

### Pitfall 1: Auth-gated routes return login HTML, not the actual page

**What goes wrong:** `playwright-cli goto http://localhost:3000/dashboard` without a session redirects to `/login`. The captured PNG shows a login form. Mode A then critiques the login form against Direction B Concierge, producing nonsense findings.

**Why it happens:** `~/crm/src/middleware.ts` enforces Supabase session presence for every route except `/login`, `/api/*`, `/intake`, `/agents/`, `/agent/`, and portal-public paths. The `(app)/*` group is gated.

**How to avoid:**
1. Pre-work task: ask Alex to log into the local dev server once. Capture storage state to `$AUDIT_DIR/crm/auth.json`.
2. All subsequent captures launch with `--storage-state=$AUDIT_DIR/crm/auth.json` (or via `playwright-cli run-code` setting cookies before `page.goto`).
3. Verify the first capture: check that `dashboard-desktop.png` does NOT contain visible "/login" UI before proceeding to fan-out.

**Warning signs:** PNG file size is suspiciously small (< 50 KB for a full dashboard); critique mentions "login form" or "Supabase".

### Pitfall 2: Probing only port 3000

**What goes wrong:** Assume dev server is on 3000, capture URL `http://localhost:3000/dashboard`, get connection refused because Next picked 3001.

**Why it happens:** Standing Rule 17 -- Next.js auto-increments when 3000 is occupied (an existing `pnpm dev` from another terminal is common in Alex's setup).

**How to avoid:** Probe both before capture:
```bash
curl -sI http://localhost:3000 2>/dev/null | head -1
curl -sI http://localhost:3001 2>/dev/null | head -1
```
Pick whichever responds. If both respond, ask Alex which is the active session. If neither responds, start `pnpm dev` directly in `~/crm/` -- never hand back a shell snippet.

### Pitfall 3: `#C9A961` vs `#F7D794` ambiguity

**What goes wrong:** The locked Direction B spec uses champagne gold `#C9A961`. The system palette in `~/.claude/skills/design-tokens/SKILL.md` and `~/.claude/context/colors.md` defines Champagne (Signal role) as `#F7D794`. These are different yellows.

**Why it happens:** Direction B is a new visual direction being introduced by this milestone; the system palette predates it.

**How to avoid:** The spec file (`direction-B-locked-spec.md`) must declare `#C9A961` as the WORKING VALUE and flag the discrepancy explicitly:
> "Champagne accent: `#C9A961` (working value). System `design-tokens` declares Champagne Signal as `#F7D794`. The audit treats `#C9A961` as the locked target; any later phase that adopts Direction B will need to update `design-tokens` and `globals.css` together. Both hexes will appear in CRM critique files: `#F7D794` as 'system palette bleed', `#C9A961` as 'Direction B target'."

This keeps the audit honest without forcing a token-system fix into Phase 023.

### Pitfall 4: Mode A's vocabulary (PRESERVE / REBUILD / EXTRACT) doesn't match Phase 023's vocabulary (system-level / component-level)

**What goes wrong:** Each `critique-{route}-{viewport}.md` ends with a Mode A disposition (PRESERVE / REBUILD / EXTRACT). PATTERNS.md needs system-level vs component-level. Synthesis becomes a re-translation step.

**How to avoid:** In `direction-B-locked-spec.md`, add a disposition translation note:
> "Mode A's disposition section maps to PATTERNS.md as: REBUILD -> usually system-level (whole token system, whole layout) or component-level (one widget) depending on what failed; PRESERVE -> no finding; EXTRACT -> not applicable here (audit isn't feeding theme-factory)."

### Pitfall 5: Skill path drift -- `rules/` vs `context/`

**What goes wrong:** Pre-work check fails on `~/.claude/rules/digital-aesthetic.md` because it lives at `~/.claude/context/digital-aesthetic.md`. Same for `design-foundation.md`. Phase halts instead of fill-and-flag.

**How to avoid:** Pre-work environment check must accept BOTH paths and log the path that resolves. If neither resolves, write to `00-environment-gaps.md` and continue per fill-and-flag.

### Pitfall 6: Sequential capture instead of parallel

**What goes wrong:** Capturing 10 PNGs sequentially adds ~30 seconds of latency vs. parallel. The source plan explicitly says "fan out, parallel". Sequential is a Rule 25 / GSD anti-pattern (adding a checkpoint where the artifact is not the real thing).

**How to avoid:** Use background `&` shell jobs or a single `playwright-cli run-code` block that does all 10 captures in `Promise.all`. The pattern is documented in `~/.claude/skills/playwright-cli/advanced-workflows.md`.

## Code Examples

### Example 1: Probe dev server port

```bash
DEV_PORT=
for p in 3000 3001; do
  if curl -sI "http://localhost:$p" >/dev/null 2>&1; then
    DEV_PORT=$p
    break
  fi
done
if [ -z "$DEV_PORT" ]; then
  echo "no dev server; starting pnpm dev in ~/crm/"
  cd ~/crm && pnpm dev &
  # wait for boot, then re-probe
fi
```

### Example 2: Fullpage screenshot at custom viewport

```bash
playwright-cli run-code "async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/design-audit-2026-05-21/crm/dashboard-desktop.png', fullPage: true });
  return 'ok';
}"
```

(Source: `~/.claude/skills/playwright-cli/screenshots-and-media.md`)

### Example 3: Parallel capture fan-out (10 jobs)

```bash
export AUDIT_DIR=/tmp/design-audit-$(date +%Y-%m-%d)
mkdir -p "$AUDIT_DIR/crm"

# Pseudocode pattern; planner picks per-task structure
capture () {
  local route="$1" viewport="$2" w="$3" h="$4"
  playwright-cli run-code "async (page) => {
    await page.setViewportSize({ width: $w, height: $h });
    await page.goto('http://localhost:$DEV_PORT$route', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '$AUDIT_DIR/crm/${route//\//-}-$viewport.png', fullPage: true });
  }"
}

capture /dashboard desktop 1440 900 &
capture /dashboard mobile 390 844 &
capture /contacts desktop 1440 900 &
capture /contacts mobile 390 844 &
# ...
wait
```

### Example 4: Mode A invocation against a captured PNG

```
# Inside planner's task action:
# "Run design-critique Mode A on $AUDIT_DIR/crm/dashboard-desktop.png.
#  Inputs: PNG file + locked spec at $AUDIT_DIR/crm/direction-B-locked-spec.md.
#  Reference: ~/.claude/skills/design-critique/references/mode-a-incoming.md.
#  Scoring rubric: token compliance, typography hierarchy, spatial rhythm,
#  crimson usage ratio, calendar widget integration, Today's Focus hierarchy.
#  Output: $AUDIT_DIR/crm/critique-dashboard-desktop.md."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mcp__playwright__*` MCP tools | `playwright-cli` binary | 2026-04-30 (retired in `playwright-cli/SKILL.md`) | Plan must not invoke any MCP playwright tool; use shell binary |
| GAT Red `#b31a35` / GAT Blue `#003087` as primaries | 4-role system palette (Ground / Structure / Signal / Atmosphere) per `~/.claude/context/colors.md` | 2026-05-08 (Color Palette Rebuild per STATUS) | The CRM's globals.css reflects the new palette (Ground `#FCFBFB`, Structure `#192A56`, Signal `#F7D794`, Atmosphere `#EDA6A3`). Direction B is a SEPARATE rebrand on top of this; the audit will surface both deltas. |
| `~/.claude/rules/digital-aesthetic.md` (assumed path) | `~/.claude/context/digital-aesthetic.md` (actual path) | unknown | Pre-work check must accept both paths |
| Tremor / Nivo / Victory chart libs | shadcn/ui Charts (Recharts under the hood) | locked in `dashboard-architecture.md` | Audit will likely surface shadcn default styling bleeding through Direction B aesthetic |

**Deprecated/outdated:**
- Direct `mcp__playwright__*` calls -- do not use.
- Champagne `#C9A961` as a "system" value -- it's a Direction B working value, not in `design-tokens`. Flag in spec.

## Project Constraints (from CLAUDE.md)

From `~/crm/CLAUDE.md`:
- **pnpm only.** Never npm or yarn.
- Verify-before-done baseline: `cd ~/crm && pnpm typecheck && pnpm build` (Phase 023 doesn't write code, so this is not part of the gate -- but the dev server must boot cleanly).
- **GSD Protocol owns execution inside `~/crm/`**; `/lock` does not apply.
- Auth middleware lives at `src/middleware.ts` -- new public routes need bypass list updates (not applicable here, but informs capture strategy).
- `activity_events` is the canonical write target post-Slice 1; do NOT add new writes (not relevant to read-only audit).
- Build vs plumbing: this phase is **plumbing-adjacent** in that no UI ships. It is the read-only audit feeding the actual remediation phases.

From `~/CLAUDE.md`:
- **Standing Rule 17** (port probe 3000/3001) is non-negotiable.
- **Standing Rule 14** (Pillow audit) applies to all image placements.
- **Standing Rule 23** (Supabase CLI exclusive) -- not exercised in this phase since no SQL is run.
- **Standing Rule 1** (fill and flag) -- applies to missing `/events` route, missing skill paths, missing reference images.
- **No em dashes** in any output, including critique and PATTERNS.md files.
- **playwright-cli** is the only browser tool; `mcp__playwright__*` retired.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The first contact in `gatbos-seed-2026-04-10.sql` (Stephanie Reid, `350ef57b-...`) is acceptable as the `/contacts/[id]` target | Environment Availability | If Alex wants a `type='realtor'` agent specifically (not a lender), planner picks a different seed row. Low risk -- both rendering paths exercise the same contact detail component. |
| A2 | A storage-state-based auth approach is acceptable for Alex (one-time manual login feeds parallel headless captures) | Common Pitfalls Pitfall 1 | If Alex insists on captures running with no session, the contact detail page won't render. The audit must either skip auth-gated routes (incomplete) or use storage state (recommended). |
| A3 | `alexhollienco.com` is reachable from this machine without Cloudflare bot-block | Phase Requirements AUDIT-CRM-02 | If Cloudflare returns 202/403/429, fall back to a longer `page.waitForTimeout()` after `goto`; the WebFetch fallback rule already says playwright-cli should be reached for. Low risk. |
| A4 | The pre-work environment-check failures (rules path drift) should fill-and-flag, not stop the phase | Pitfall 5 | If Alex wants a hard halt on path drift, planner adds an explicit confirm task. Low risk -- fill-and-flag is the standing rule. |
| A5 | Mode A's PRESERVE/REBUILD/EXTRACT disposition can be translated to system-level/component-level in PATTERNS.md synthesis | Pattern 3 + Pitfall 4 | If Alex wants pure Mode A vocabulary in PATTERNS.md, synthesis instruction changes. Low risk -- the translation is mechanical. |
| A6 | Chromium is installed via Playwright; if not, `npx playwright install chromium` is non-destructive and can run in pre-work | Standard Stack | If Chromium install fails (network, disk), pre-work must surface the failure and stop. Medium risk if first run on this machine. |

## Open Questions (RESOLVED)

1. **Is there a stored Playwright auth state file from prior sessions?**
   - What we know: middleware.ts requires auth; no storage state file path is canonical in the repo.
   - What's unclear: whether `~/.claude/skills/playwright-cli/storage-and-auth.md` documents a project-wide convention, or whether each session re-logs in.
   - RESOLVED: pre-work task in 01-PLAN greps for `storageState` or `auth.json` under `~/crm/` and `~/.claude/`; if found, reuse; else manual login + save once to `$AUDIT_DIR/auth-state.json`.

2. **Does Direction B's `#C9A961` get adopted into `design-tokens` later, or stay a CRM-local override?**
   - What we know: the spec calls for `#C9A961`; the system palette has `#F7D794`.
   - What's unclear: out of scope for Phase 023 (deferred to remediation phases).
   - RESOLVED: deferred to Phase 027 (Fix execution). Phase 023 captures the gap, no token edits.

3. **Is the production `alexhollienco.com` actually live and current?**
   - What we know: it's the marketing page Alex maintains.
   - What's unclear: whether it's been redesigned recently; the audit captures whatever is live at run-time.
   - RESOLVED: capture as-is at run-time. No pre-verify. The critique speaks to what is live.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None applicable -- Phase 023 produces no executable code |
| Config file | none |
| Quick run command | manual artifact inspection (`ls $AUDIT_DIR/crm/*.png`, `wc -l $AUDIT_DIR/crm/critique-*.md`) |
| Full suite command | none |

### Phase Requirements -> Validation Map

| Req ID | Behavior | Validation Type | Automated Command | File Exists? |
|--------|----------|-----------------|-------------------|-------------|
| AUDIT-CRM-01 | All 8 CRM screenshots present (4 routes x 2 viewports) | artifact-existence | `ls -1 $AUDIT_DIR/crm/{dashboard,contacts,contacts-*,events}-{desktop,mobile}.png \| wc -l` should be 8 (or 6 + a flagged events-missing.md) | n/a -- runtime check |
| AUDIT-CRM-02 | alexhollienco.com captured at both viewports | artifact-existence | `ls $AUDIT_DIR/crm/alexhollienco-{desktop,mobile}.png` exits 0 | n/a |
| AUDIT-CRM-03 | direction-B-locked-spec.md exists with required sections | content-grep | `grep -E '(charcoal\|champagne\|Instrument Serif\|crimson\|calendar\|Today.s Focus\|Runway)' $AUDIT_DIR/crm/direction-B-locked-spec.md \| wc -l` should be >= 7 | n/a |
| AUDIT-CRM-04 | One critique file per screenshot, each containing the 6-criterion rubric | content-grep | `grep -l 'token compliance' $AUDIT_DIR/crm/critique-*.md \| wc -l` should equal screenshot count | n/a |
| AUDIT-CRM-05 | PATTERNS.md distinguishes system-level vs component-level | content-grep | `grep -E '(system-level\|component-level)' $AUDIT_DIR/crm/PATTERNS.md \| wc -l` should be >= 2 | n/a |

### Sampling Rate

- **Per task:** artifact existence check (does the file exist? has expected size?)
- **Per wave (capture / critique / synthesize):** sanity-check one output before fan-out completes (open one PNG, eyeball it; open one critique, confirm rubric coverage)
- **Phase gate:** all 5 grep checks pass; PATTERNS.md is human-readable; GATE 1 halt declared explicitly

### Wave 0 Gaps

- [ ] Verify Chromium installed: `npx playwright install chromium` (idempotent; safe to run unconditionally as pre-work)
- [ ] Verify dev server boots: `cd ~/crm && pnpm dev` in background; confirm `/login` returns 200 on the chosen port
- [ ] Verify auth session captured to `$AUDIT_DIR/crm/auth.json` (one-time manual login + storage state save)
- [ ] Confirm the chosen `/contacts/[id]` UUID is reachable (`curl -sI http://localhost:$DEV_PORT/contacts/350ef57b-4c09-4952-bf70-87dad5a94d2e` with session cookie -> 200)
- [ ] Confirm `~/.claude/skills/design-critique/SKILL.md` is loadable (`test -f`) -- skill is the load-bearing critique tool

*(No traditional test framework needed; the phase produces inspection artifacts, not code.)*

## Security Domain

Phase 023 is read-only artifact production to `/tmp/`. No new attack surface introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Supabase session reuse for captures) | Reuse existing Supabase session via storage state; do NOT hardcode credentials in scripts |
| V3 Session Management | partial | `auth.json` storage state contains live session cookies; treat as a secret; delete after audit completes |
| V4 Access Control | no | Audit runs as Alex's authenticated user; no escalation |
| V5 Input Validation | no | No user input handled |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Storage state file containing live cookies left in `/tmp/` | Information Disclosure | Audit pre-work creates the file; phase exit (or a Wave 0 cleanup task) deletes it. Optionally write to `$HOME/.cache/` instead of `/tmp/` if multi-user concerns matter (not applicable on Alex's single-user Mac). |
| Captured PNGs containing live CRM data (contact PII, transaction details) | Information Disclosure | `$AUDIT_DIR` is ephemeral `/tmp/`; not committed to git. PATTERNS.md must not quote PII verbatim -- describe layout / typography violations, not names / emails. |
| Production URL capture (`alexhollienco.com`) accidentally hitting a live tracker | n/a | Disable network tracing; do not interact (no clicks); just `goto + screenshot`. |

## Sources

### Primary (HIGH confidence)

- `~/crm/.planning/phases/023-design-overhaul-crm-audit/CONTEXT.md` -- locked spec, locked routes, locked viewports
- `~/crm/.planning/REQUIREMENTS.md` -- AUDIT-CRM-01..05 verbatim
- `~/crm/.planning/STATE.md` -- current position, branch context, accumulated context
- `~/crm/.planning/ROADMAP.md` Phase 023 entry -- success criteria
- `~/crm/.planning/config.json` -- GSD mode interactive, auto_advance false, branching phase
- `~/crm/src/middleware.ts` -- auth gating logic (verified line-by-line)
- `~/crm/src/app/(app)/` directory listing -- confirms `/dashboard`, `/contacts`, `/contacts/[id]` exist; `/events` does NOT
- `~/crm/src/app/globals.css` lines 16-19 -- confirms current 4-role palette tokens (Ground/Structure/Signal/Atmosphere with `#FCFBFB`/`#192A56`/`#F7D794`/`#EDA6A3`)
- `~/crm/src/app/layout.tsx` lines 2-7 -- confirms Inter + Syne + Space Mono fonts; Instrument Serif NOT loaded
- `~/crm/supabase/seeds/gatbos-seed-2026-04-10.sql` -- confirms first contact ID `350ef57b-4c09-4952-bf70-87dad5a94d2e`
- `~/.claude/skills/playwright-cli/SKILL.md` -- default browser tool, MCP retired 2026-04-30
- `~/.claude/skills/playwright-cli/screenshots-and-media.md` -- fullPage screenshot pattern + viewport resize
- `~/.claude/skills/design-critique/SKILL.md` -- Mode A + Mode B both documented
- `~/.claude/skills/design-critique/references/mode-a-incoming.md` -- Mode A workflow steps 1-6
- `~/.claude/skills/design-critique/references/rubric.md` -- 3-section rubric
- `~/.claude/skills/design-tokens/SKILL.md` -- system palette Champagne = `#F7D794` (NOT `#C9A961`)
- `~/.claude/context/colors.md` -- 4-role system palette canonical source
- `~/.claude/rules/standing-rules.md` Rule 14 (Pillow), Rule 17 (port probe), Rule 1 (fill and flag), Rule 25 (no workflow stages in rules)
- `~/.claude/rules/tool-routing.md` -- playwright-cli is default browser tool; `mcp__playwright__*` retired
- Live shell verification: `playwright-cli` at `/usr/local/bin/playwright-cli`, `pnpm` 10.32.1, `npx playwright` 1.59.1, Pillow 11.3.0

### Secondary (MEDIUM confidence)

- `~/Desktop/01_ACTIVE/DESIGN-OVERHAUL-PLAN.md` -- not read in research session; CONTEXT.md is downstream of it and considered authoritative

### Tertiary (LOW confidence)

- Whether prior auth storage state exists in repo -- not verified; recommend pre-work grep

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every tool verified at canonical path with `--version` output
- Architecture: HIGH -- middleware.ts auth gating read line-by-line; routes confirmed by directory listing; globals.css token values read directly
- Pitfalls: HIGH -- auth, port, palette discrepancy, vocabulary, and path drift all confirmed against source files
- Spec content: HIGH -- copied verbatim from CONTEXT.md

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (30 days; stable -- no fast-moving dependencies)
