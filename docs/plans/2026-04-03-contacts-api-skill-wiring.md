# Contacts API + Skill Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace agents-index.json file reads/writes in 5 Claude Code skills with REST API calls to the CRM's Supabase-backed contacts table.

**Architecture:** Create Next.js App Router API routes at `/api/contacts` that use a Supabase service-role client (bypasses RLS, no cookie auth needed). Skills switch from `Read ~/Documents/Alex Hub/05_AGENTS/agents-index.json` to `WebFetch http://localhost:3000/api/contacts`. CONTACT.md narrative files remain file-based -- unchanged.

**Tech Stack:** Next.js 14 App Router, @supabase/supabase-js (service role client), existing CRM Supabase instance

---

## Prerequisites (Alex action -- before any task starts)

1. Get the **Service Role Key** from Supabase dashboard: Project Settings > API > service_role (secret)
2. Add to `~/crm/.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
3. CRM dev server must be running during skill use: `cd ~/crm && pnpm dev`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/supabase/admin.ts` | Service-role Supabase client for API routes (no cookies, bypasses RLS) |
| Modify | `src/lib/types.ts` | Add missing live DB fields to Contact interface: `last_touch_date`, `next_action`, `website_url`, `brokerage`, `stage`, `deleted_at` |
| Create | `src/app/api/contacts/route.ts` | GET (list/search/filter) + POST (create) |
| Create | `src/app/api/contacts/[id]/route.ts` | GET (single) + PATCH (update) |
| Modify | `~/.claude/skills/morning-briefing/SKILL.md` | Swap agents-index.json reads to API calls |
| Modify | `~/.claude/skills/agent-bd/SKILL.md` | Swap agents-index.json reads to API calls |
| Modify | `~/.claude/skills/agent-strategy-session/SKILL.md` | Swap agents-index.json reads + writes to API calls |
| Modify | `~/.claude/skills/agent-creative-brief/SKILL.md` | Swap agents-index.json reads + writes to API calls |
| Modify | `~/.claude/skills/end-of-day-briefing/SKILL.md` | Swap agents-index.json reads + writes to API calls |

---

## Field Name Mapping (agents-index.json -> Supabase)

Skills currently reference agents-index.json field names. The API returns Supabase column names. Key differences:

| agents-index.json | Supabase column | Notes |
|---|---|---|
| `last_contact` | `last_touch_date` | Date of most recent interaction |
| `next_action` | `next_action` | Same name |
| `website` | `website_url` | Renamed |
| `headshot` | `headshot_url` | Renamed |
| `brokerage_logo` | `brokerage_logo_url` | Renamed |
| `agent_logo` | `agent_logo_url` | Renamed |
| `flags` | `tags` | JSONB array |
| `lead_source` | `source` | Renamed |
| `contact_md` | `contact_md_path` | Renamed |
| `name` | `first_name` + `last_name` | Split fields -- API returns both |

All other fields (`tier`, `temperature`, `rep_pulse`, `stage`, `farm_area`, `farm_zips`, `brand_colors`, `palette`, `font_kit`, `escrow_officer`, `preferred_channel`, `referred_by`, `brokerage`, `email`, `phone`) have identical names in both systems.

---

## Task 1: Create Admin Supabase Client

**Files:**
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Create the admin client file**

```typescript
// src/lib/supabase/admin.ts
// Service-role client for API routes. Bypasses RLS. Never use in browser code.
import { createClient } from "@supabase/supabase-js";

export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

- [ ] **Step 2: Verify env var is loaded**

Run: `cd ~/crm && grep SUPABASE_SERVICE_ROLE_KEY .env.local`
Expected: Line with the key value (not empty)

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/lib/supabase/admin.ts
git commit -m "feat: add Supabase service-role admin client for API routes"
```

---

## Task 2: Update Contact Type to Match Live DB

**Files:**
- Modify: `src/lib/types.ts:61-101`

The live DB has columns that the TypeScript type is missing. Add them.

- [ ] **Step 1: Add missing fields to Contact interface**

In `src/lib/types.ts`, add these fields to the `Contact` interface after the existing fields:

```typescript
export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  relationship: RelationshipStrength;
  source: ContactSource;
  lead_status: LeadStatus;
  source_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];

  // Live DB native fields (not in schema.sql)
  brokerage: string | null;
  website_url: string | null;
  stage: string | null;
  last_touch_date: string | null;
  next_action: string | null;
  deleted_at: string | null;

  // Marketing fields (phase 4)
  headshot_url: string | null;
  brokerage_logo_url: string | null;
  agent_logo_url: string | null;
  brand_colors: Record<string, string> | null;
  palette: string | null;
  font_kit: string | null;

  // Geography
  farm_area: string | null;
  farm_zips: string[] | null;

  // Relationship scoring
  temperature: number;
  rep_pulse: number | null;
  tier: ContactTier | null;

  // Context
  preferred_channel: string | null;
  referred_by: string | null;
  escrow_officer: string | null;
  contact_md_path: string | null;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd ~/crm && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors may remain from other causes)

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/lib/types.ts
git commit -m "feat: add missing live DB fields to Contact type (brokerage, stage, last_touch_date, etc.)"
```

---

## Task 3: Create GET /api/contacts Route

**Files:**
- Create: `src/app/api/contacts/route.ts`

This route handles listing, searching, and filtering contacts. No auth required (localhost-only, service-role client).

- [ ] **Step 1: Create the route file with GET handler**

```typescript
// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  let query = adminClient
    .from("contacts")
    .select("*")
    .is("deleted_at", null)
    .order("last_name", { ascending: true });

  // Search by name (fuzzy match on first or last name)
  const name = params.get("name");
  if (name) {
    query = query.or(
      `first_name.ilike.%${name}%,last_name.ilike.%${name}%`
    );
  }

  // Filter by tier
  const tier = params.get("tier");
  if (tier) {
    query = query.eq("tier", tier);
  }

  // Filter by stage
  const stage = params.get("stage");
  if (stage) {
    query = query.eq("stage", stage);
  }

  // Filter by temperature below threshold
  const tempBelow = params.get("temperature_below");
  if (tempBelow) {
    query = query.lt("temperature", parseInt(tempBelow, 10));
  }

  // Filter by stale contacts (last_touch_date older than N days)
  const staleDays = params.get("stale_days");
  if (staleDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(staleDays, 10));
    query = query.lt("last_touch_date", cutoff.toISOString());
  }

  // Exclude contacts with specific tags (e.g., lender-partner, gat-internal)
  const excludeTag = params.get("exclude_tag");
  if (excludeTag) {
    query = query.not("tags", "cs", `["${excludeTag}"]`);
  }

  // Limit
  const limit = params.get("limit");
  query = query.limit(limit ? parseInt(limit, 10) : 200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Start dev server and test list all**

Run: `curl -s http://localhost:3000/api/contacts | jq '. | length'`
Expected: A number (104 or similar -- total contact count)

- [ ] **Step 3: Test search by name**

Run: `curl -s 'http://localhost:3000/api/contacts?name=Julie' | jq '.[0] | {first_name, last_name, tier, temperature}'`
Expected: Julie's contact record with her fields

- [ ] **Step 4: Test filter by tier**

Run: `curl -s 'http://localhost:3000/api/contacts?tier=A' | jq '. | length'`
Expected: Count of Tier A contacts

- [ ] **Step 5: Test stale contacts filter**

Run: `curl -s 'http://localhost:3000/api/contacts?stale_days=14' | jq '.[0:3] | .[].last_name'`
Expected: Names of contacts not touched in 14+ days

- [ ] **Step 6: Commit**

```bash
cd ~/crm
git add src/app/api/contacts/route.ts
git commit -m "feat: add GET /api/contacts with name search, tier/stage/temperature/stale filters"
```

---

## Task 4: Add POST Handler to /api/contacts

**Files:**
- Modify: `src/app/api/contacts/route.ts`

- [ ] **Step 1: Add POST handler below the GET handler**

Append to `src/app/api/contacts/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Require at minimum a first_name
  if (!body.first_name) {
    return NextResponse.json(
      { error: "first_name is required" },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient
    .from("contacts")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Test create (dry run -- just verify the shape)**

Run:
```bash
curl -s -X POST http://localhost:3000/api/contacts \
  -H 'Content-Type: application/json' \
  -d '{"first_name": "Test", "last_name": "APIRoute", "email": "test@example.com"}' \
  | jq '{id, first_name, last_name}'
```
Expected: JSON with id, first_name "Test", last_name "APIRoute"

- [ ] **Step 3: Clean up test record**

Note the id from step 2, then delete via Supabase SQL Editor or soft-delete via API (Task 5).

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add src/app/api/contacts/route.ts
git commit -m "feat: add POST /api/contacts for creating new contacts"
```

---

## Task 5: Create GET/PATCH /api/contacts/[id] Route

**Files:**
- Create: `src/app/api/contacts/[id]/route.ts`

- [ ] **Step 1: Create the [id] route file**

```typescript
// src/app/api/contacts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await adminClient
    .from("contacts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Auto-set updated_at
  body.updated_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from("contacts")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Test GET single contact**

Run (use a real id from the list endpoint):
```bash
ID=$(curl -s 'http://localhost:3000/api/contacts?name=Julie&limit=1' | jq -r '.[0].id')
curl -s "http://localhost:3000/api/contacts/$ID" | jq '{first_name, last_name, tier, temperature, last_touch_date}'
```
Expected: Julie's full contact record

- [ ] **Step 3: Test PATCH update**

Run:
```bash
curl -s -X PATCH "http://localhost:3000/api/contacts/$ID" \
  -H 'Content-Type: application/json' \
  -d '{"last_touch_date": "2026-04-03", "temperature": 85}' \
  | jq '{first_name, last_touch_date, temperature, updated_at}'
```
Expected: Updated values reflected in response

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add src/app/api/contacts/\[id\]/route.ts
git commit -m "feat: add GET/PATCH /api/contacts/[id] for single contact read and update"
```

---

## Task 6: Update morning-briefing Skill (read-only)

**Files:**
- Modify: `~/.claude/skills/morning-briefing/SKILL.md:57-136`

This skill only reads contact data. Replace agents-index.json references with API calls.

- [ ] **Step 1: Replace the "Agent Memory Source" section (lines 57-60)**

Replace:
```
## Agent Memory Source
Before generating the briefing, read ~/Documents/Alex Hub/05_AGENTS/agents-index.json. This is the structured data layer for all 95+ contacts. Use tier, stage, temperature, last_contact, and farm_area to populate the FOLLOW-UP QUEUE and AGENT ACTIVITY sections.

For priority agents (Tier A), also read their CONTACT.md via the contact_md path for deeper narrative context (relationship history, active projects, preferences).
```

With:
```
## Agent Memory Source
Before generating the briefing, pull structured contact data from the CRM API (requires `pnpm dev` running in ~/crm/):

1. **Tier A agents:** `WebFetch GET http://localhost:3000/api/contacts?tier=A`
2. **Stale contacts (14+ days):** `WebFetch GET http://localhost:3000/api/contacts?stale_days=14`
3. **Cooling contacts (temp < 60):** `WebFetch GET http://localhost:3000/api/contacts?temperature_below=60`

Use tier, stage, temperature, last_touch_date, and farm_area from the API response to populate FOLLOW-UP QUEUE and AGENT ACTIVITY.

For priority agents, also read their CONTACT.md via the contact_md_path field for deeper narrative context (relationship history, active projects, preferences).

If the API is unreachable (connection refused), fall back to reading ~/Documents/Alex Hub/05_AGENTS/agents-index.json.
```

- [ ] **Step 2: Replace the "FULL CONTACT LIST" reference (lines 133-136)**

Replace:
```
FULL CONTACT LIST -- 95 agents indexed as of 2026-04-03. Structured data lives at:
~/Documents/Alex Hub/05_AGENTS/agents-index.json

When Alex asks for a briefing on a specific agent not in the priority list above, look them up in agents-index.json by name. Use their tier, stage, temperature, and last_contact to determine context.
```

With:
```
FULL CONTACT LIST -- 100+ agents in Supabase. Query via:
WebFetch GET http://localhost:3000/api/contacts

When Alex asks for a briefing on a specific agent not in the priority list above, look them up by name:
WebFetch GET http://localhost:3000/api/contacts?name=[agent name]
Use their tier, stage, temperature, and last_touch_date from the response.
```

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/skills/morning-briefing
git add SKILL.md
git commit -m "feat: wire morning-briefing to CRM contacts API instead of agents-index.json"
```

---

## Task 7: Update agent-bd Skill (read-only)

**Files:**
- Modify: `~/.claude/skills/agent-bd/SKILL.md:101-110`

- [ ] **Step 1: Replace the "Step 1 -- Pull agent context" section**

Replace:
```
### Step 1 -- Pull agent context
Read ~/Documents/Alex Hub/05_AGENTS/agents-index.json. Use structured fields (tier, stage, temperature, last_contact, farm_area, escrow_officer, flags) to build the call list. Flag anyone who is:
- Temperature below 60 (Cool or Cold -- at-risk relationship)
- last_contact older than 14 days (YELLOW) or 30+ days (RED)
- Has a new listing or recent close in the last 72 hours
- Is in a zip code with notable market movement from the last market snapshot
- Is within their 7-day onboarding window (new agent, stage = "engaged")
- Flagged as lender-partner or gat-internal -- skip these for agent outreach calls

For deeper context on any specific agent, read their CONTACT.md via the contact_md path in the index.
```

With:
```
### Step 1 -- Pull agent context
Pull contact data from the CRM API (requires `pnpm dev` running in ~/crm/):

1. **At-risk (cooling):** `WebFetch GET http://localhost:3000/api/contacts?temperature_below=60`
2. **Stale 14+ days:** `WebFetch GET http://localhost:3000/api/contacts?stale_days=14`
3. **Stale 30+ days:** `WebFetch GET http://localhost:3000/api/contacts?stale_days=30`
4. **All contacts (for zip/stage filtering):** `WebFetch GET http://localhost:3000/api/contacts`

Build the call list from the API responses. Use tier, stage, temperature, last_touch_date, farm_area, escrow_officer, and tags. Flag anyone who is:
- Temperature below 60 (Cool or Cold -- at-risk relationship)
- last_touch_date older than 14 days (YELLOW) or 30+ days (RED)
- Has a new listing or recent close in the last 72 hours
- Is in a zip code with notable market movement from the last market snapshot
- Is within their 7-day onboarding window (new agent, stage = "engaged")
- Has tags containing "lender-partner" or "gat-internal" -- skip these for agent outreach calls

For deeper context on any specific agent, read their CONTACT.md via the contact_md_path field in the API response.

If the API is unreachable, fall back to reading ~/Documents/Alex Hub/05_AGENTS/agents-index.json.
```

- [ ] **Step 2: Commit**

```bash
cd ~/.claude/skills/agent-bd
git add SKILL.md
git commit -m "feat: wire agent-bd to CRM contacts API instead of agents-index.json"
```

---

## Task 8: Update agent-strategy-session Skill (read + write)

**Files:**
- Modify: `~/.claude/skills/agent-strategy-session/SKILL.md:24-36`

- [ ] **Step 1: Replace the "MANDATORY FIRST STEP" section**

Replace:
```
## MANDATORY FIRST STEP

Before any output, read:
- MASTER-TOKENS.md (brand context)
- CLAUDE.md (agent relationships, standing rules)
- ~/Documents/Alex Hub/05_AGENTS/agents-index.json -- look up the agent by name. Pull tier, stage, temperature, last_contact, escrow_officer, farm_area, and flags. This is the structured data layer.
- Check ~/Documents/Alex Hub/05_AGENTS/[agent-name]/ for existing CONTACT.md and session notes. This is the narrative layer (relationship context, active projects, key history).

If the agent exists in agents-index.json, use structured fields for prep/scoring and CONTACT.md for narrative context.
If the agent is NOT in agents-index.json, flag this as a new contact -- add them to the index at the end of this session.
If a CONTACT.md exists, load it. If no CONTACT.md exists, create one at the end of this session.

When this session ends, update agents-index.json with any changed fields (last_contact, next_action, stage, rep_pulse, temperature).
```

With:
```
## MANDATORY FIRST STEP

Before any output, read:
- MASTER-TOKENS.md (brand context)
- CLAUDE.md (agent relationships, standing rules)
- CRM contacts API (requires `pnpm dev` running in ~/crm/):
  `WebFetch GET http://localhost:3000/api/contacts?name=[agent name]`
  Pull tier, stage, temperature, last_touch_date, escrow_officer, farm_area, and tags from the response. This is the structured data layer.
- Check ~/Documents/Alex Hub/05_AGENTS/[agent-name]/ for existing CONTACT.md and session notes. This is the narrative layer.

If the agent exists in the API response, use structured fields for prep/scoring and CONTACT.md for narrative context.
If the API returns an empty array (agent not found), flag this as a new contact -- create them via the API at the end of this session:
  `WebFetch POST http://localhost:3000/api/contacts` with `{"first_name": "...", "last_name": "...", ...}`
If a CONTACT.md exists, load it. If no CONTACT.md exists, create one at the end of this session.

When this session ends, update the contact via the API:
  `WebFetch PATCH http://localhost:3000/api/contacts/[id]` with changed fields (last_touch_date, next_action, stage, rep_pulse, temperature).

If the API is unreachable, fall back to reading/writing ~/Documents/Alex Hub/05_AGENTS/agents-index.json.
```

- [ ] **Step 2: Commit**

```bash
cd ~/.claude/skills/agent-strategy-session
git add SKILL.md
git commit -m "feat: wire agent-strategy-session to CRM contacts API (read + write)"
```

---

## Task 9: Update agent-creative-brief Skill (read + write)

**Files:**
- Modify: `~/.claude/skills/agent-creative-brief/SKILL.md:27-35`

- [ ] **Step 1: Replace the "MANDATORY FIRST STEP" section**

Replace:
```
## MANDATORY FIRST STEP
Before making any design decisions -- read these files first:
1. /Users/alex/.claude/skills/MASTER-TOKENS.md -- brand tokens
2. ~/Documents/Alex Hub/05_AGENTS/agents-index.json -- look up the agent by name. If they exist, pull brokerage, brand_colors, palette, font_kit, tier, farm_area, and any flags. Pre-populate these into the brief instead of re-asking.
3. If the agent has a contact_md path in the index, read their CONTACT.md for relationship context and existing preferences.

Every value in MASTER-TOKENS.md overrides any default, prior session memory, or assumption. Do not proceed until you have confirmed those tokens are active. Palette selection must align with MASTER-TOKENS.md brand values.

When this brief is complete, update agents-index.json with any new fields captured (brokerage, brand_colors, palette, font_kit, farm_area) and update or create the agent's CONTACT.md.
```

With:
```
## MANDATORY FIRST STEP
Before making any design decisions -- read these files first:
1. /Users/alex/.claude/skills/MASTER-TOKENS.md -- brand tokens
2. CRM contacts API (requires `pnpm dev` running in ~/crm/):
   `WebFetch GET http://localhost:3000/api/contacts?name=[agent name]`
   If the agent exists, pull brokerage, brand_colors, palette, font_kit, tier, farm_area, and tags. Pre-populate these into the brief instead of re-asking.
3. If the agent has a contact_md_path in the API response, read their CONTACT.md for relationship context and existing preferences.

Every value in MASTER-TOKENS.md overrides any default, prior session memory, or assumption. Do not proceed until you have confirmed those tokens are active. Palette selection must align with MASTER-TOKENS.md brand values.

When this brief is complete, update the contact via the API:
  `WebFetch PATCH http://localhost:3000/api/contacts/[id]` with any new fields captured (brokerage, brand_colors, palette, font_kit, farm_area).
If the agent is new (not in the API), create them:
  `WebFetch POST http://localhost:3000/api/contacts` with the captured fields.
Update or create the agent's CONTACT.md file as before.

If the API is unreachable, fall back to reading/writing ~/Documents/Alex Hub/05_AGENTS/agents-index.json.
```

- [ ] **Step 2: Commit**

```bash
cd ~/.claude/skills/agent-creative-brief
git add SKILL.md
git commit -m "feat: wire agent-creative-brief to CRM contacts API (read + write)"
```

---

## Task 10: Update end-of-day-briefing Skill (read + write)

**Files:**
- Modify: `~/.claude/skills/end-of-day-briefing/SKILL.md:58-64` (Agent Memory Source section)
- Modify: `~/.claude/skills/end-of-day-briefing/SKILL.md:128-132` (Step 5 agent tracker)

- [ ] **Step 1: Replace the "Agent Memory Source" section (lines 58-64)**

Replace:
```
## Agent Memory Source
After processing the brain dump, update both data layers for any agents mentioned in today's activity:

1. **Structured layer** -- ~/Documents/Alex Hub/05_AGENTS/agents-index.json: Update last_contact (today's date), rep_pulse (if Alex gave a sentiment signal), next_action, and stage (if a transition happened, e.g., pipeline to active on first escrow). Recalculate temperature if inputs changed.
2. **Narrative layer** -- CONTACT.md files in ~/Documents/Alex Hub/05_AGENTS/[agent-name]/: Add a dated note with what happened (meeting, call, email, design delivered, etc.).

If the agent folder does not exist, create it with a new CONTACT.md and add the agent to agents-index.json.
```

With:
```
## Agent Memory Source
After processing the brain dump, update both data layers for any agents mentioned in today's activity:

1. **Structured layer** -- CRM contacts API (requires `pnpm dev` running in ~/crm/):
   - Look up each agent: `WebFetch GET http://localhost:3000/api/contacts?name=[agent name]`
   - Update their record: `WebFetch PATCH http://localhost:3000/api/contacts/[id]` with changed fields: last_touch_date (today's date), rep_pulse (if Alex gave a sentiment signal), next_action, and stage (if a transition happened). Recalculate temperature if inputs changed.
   - If agent not found: `WebFetch POST http://localhost:3000/api/contacts` with their details.
2. **Narrative layer** -- CONTACT.md files in ~/Documents/Alex Hub/05_AGENTS/[agent-name]/: Add a dated note with what happened (meeting, call, email, design delivered, etc.).

If the agent folder does not exist, create it with a new CONTACT.md and create the agent via POST to the API.

If the API is unreachable, fall back to reading/writing ~/Documents/Alex Hub/05_AGENTS/agents-index.json.
```

- [ ] **Step 2: Replace the "Step 5 -- Agent Tracker Update" section (lines 128-132)**

Replace:
```
## Step 5 -- Agent Tracker Update
For every agent mentioned in today's brain dump:
1. Update agents-index.json: set last_contact to today, update rep_pulse if Alex gave sentiment, update stage if transition occurred, recalculate temperature
2. Update their CONTACT.md: log the interaction type (met, called, texted, built for, discussed) with date
3. Flag if they should move to a different Resend audience
4. If temperature dropped below 60, flag as "cooling -- schedule face-to-face within two weeks"
```

With:
```
## Step 5 -- Agent Tracker Update
For every agent mentioned in today's brain dump:
1. Update via CRM API: `WebFetch PATCH http://localhost:3000/api/contacts/[id]` -- set last_touch_date to today, update rep_pulse if Alex gave sentiment, update stage if transition occurred, recalculate temperature
2. Update their CONTACT.md: log the interaction type (met, called, texted, built for, discussed) with date
3. Flag if they should move to a different Resend audience
4. If temperature dropped below 60, flag as "cooling -- schedule face-to-face within two weeks"
```

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/skills/end-of-day-briefing
git add SKILL.md
git commit -m "feat: wire end-of-day-briefing to CRM contacts API (read + write)"
```

---

## Task 11: Smoke Test End-to-End

Verify one read-only and one read-write skill work against the live API.

- [ ] **Step 1: Ensure CRM dev server is running**

Run: `curl -s http://localhost:3000/api/contacts?limit=1 | jq '.[0].first_name'`
Expected: A first name string (confirms API is live)

- [ ] **Step 2: Test morning-briefing read path**

Run the morning-briefing skill and verify it pulls from the API instead of agents-index.json. Check the output includes agent data with correct field names (last_touch_date, not last_contact).

- [ ] **Step 3: Test agent-strategy-session write path**

Run agent-strategy-session for a known agent. Verify:
1. It looks up the agent via `GET /api/contacts?name=...`
2. At session end, it updates via `PATCH /api/contacts/[id]`
3. The updated fields persist (re-query to confirm)

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
cd ~/crm
git add -A
git commit -m "fix: adjustments from smoke testing contacts API + skill wiring"
```

---

## Post-Completion Notes

**agents-index.json is NOT deleted.** It remains as a fallback and historical record. All 5 skills include a fallback instruction: "If the API is unreachable, fall back to reading agents-index.json." Over time, as the CRM becomes the sole source, the fallback can be removed and agents-index.json archived.

**CONTACT.md files are unchanged.** The narrative layer stays file-based. Only the structured data layer (fields like tier, temperature, last_touch_date) moves to the API.

**New agents created via skills** now go into Supabase (via POST) instead of being appended to agents-index.json. The CONTACT.md file is still created on disk as before.

**Field name changes in skills:** Skills now use Supabase column names. Key change: `last_contact` is now `last_touch_date` in all API responses.
