# Voice Memo Capture Pipeline — Loop 1 (Agent Check-Ins)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

**Goal:** Stand up the keystone capture layer from the GAT-BOS Operating Leverage Map: Alex hangs up a phone call, holds one button on his iPhone, talks for 60 seconds, and a structured row appears in `interactions` linked to the right contact within ~10 seconds. If the contact is ambiguous, the row sits in a review queue Alex clears at end of day.

**Architecture:** iOS Shortcut posts a multipart form (audio + secret header) to a Next.js API route at `/api/voice-memo/intake`. The route runs synchronously: upload audio to Supabase Storage > OpenAI Whisper for transcription > Claude Haiku 4.5 with forced `tool_use` for structured extraction > resolve contact name against the user's contacts > insert into `voice_memos` (audit trail) and either `interactions` (high confidence) or `voice_memos.processing_status='needs_review'` (low confidence). A new `(app)/dashboard/voice-memo-review` page surfaces the needs_review queue.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres + Storage + RLS, `@supabase/supabase-js` (admin client), `openai` SDK v4 (Whisper), `@anthropic-ai/sdk` v0.30+ (Claude Haiku 4.5 with `tool_use`), TypeScript, pnpm. **No test framework exists in this repo** — verification is via `pnpm exec tsc --noEmit`, `pnpm lint`, SQL assertion queries, `curl`, and a real iPhone test. This matches the codebase's established pattern; do not add a test framework as part of this plan.

**Reference:** This plan implements **Loop 1 only** from `~/Downloads/GAT-BOS-Data-First-Operating-Leverage-Map.md`. Loops 2-6 (prospects, production_jobs, escrow extensions, events, market_data) are explicitly out of scope. Build the capture layer first, then features.

---

## Out of scope (do not build in this plan)

These will land in later phases. If you find yourself adding any of them, stop and ask Alex.

- `prospects` table or 14-day onboarding sequencer (Loop 2)
- `production_jobs` table or `deliverable-retro` hook integration (Loop 3)
- `deals` table extensions for post-close touchpoint flags (Loop 4)
- `events` table or BNI pre-event prep prompt (Loop 5)
- `market_data` table or Altos ingestion (Loop 6)
- Morning briefing changes (existing skill reads `interactions` already; it picks up the new data automatically)
- Temperature score recalculation logic (the `agent_relationship_health` materialized view picks up new interactions on its own — but the view is `MATERIALIZED`, so it needs to be refreshed; see Task 14)
- Trigger.dev integration or background queue (synchronous pipeline is fine at 3-5 memos/day)
- Android shortcut, web recorder fallback, voice memo bulk import

---

## Background and pre-existing facts

You are working in `/Users/alex/crm`. Internalize these facts before touching anything.

1. **Existing schema you will extend, not replace:**
   - `contacts` table at `supabase/migrations/20260407012800_baseline.sql:264` — has `user_id`, `first_name`, `last_name`, `type`, `tier`, `health_score`, `last_touch_date`, `deleted_at`. RLS already gates this by `user_id` per piece5/piece6 from Phase 2.1.
   - `interactions` table at `supabase/migrations/20260407012800_baseline.sql:352` — currently has `id, user_id, contact_id, type (enum), summary, occurred_at, direction, duration_minutes`. Enum `interaction_type` defined at line 74: `call | text | email | meeting | broker_open | lunch | note`.
   - `tasks` table at `supabase/migrations/20260407012800_baseline.sql:811` — has `contact_id, title, description, due_date, priority, status, user_id`. We will INSERT into this when a voice memo includes a follow-up commitment.
   - `agent_relationship_health` materialized view at line 370 — computes recency / deal trend / frequency / responsiveness scores. **Materialized** — must be `REFRESH MATERIALIZED VIEW` after backfills. The trigger that auto-refreshes on `interactions` insert may or may not exist; verify in Task 1.

2. **Established CRM patterns to follow:**
   - **Owner stamping:** API routes read `process.env.OWNER_USER_ID` (currently set to `b735d691-4d86-4e31-9fd3-c2257822dca3` in `.env.local`) and stamp it as `user_id` on inserts. Do not look up users via `auth.admin.listUsers`. See `src/app/api/intake/route.ts` for the canonical pattern.
   - **Bearer auth:** Internal API routes use `requireApiToken(request)` from `src/lib/api-auth.ts`. It reads `INTERNAL_API_TOKEN`, does timing-safe comparison, returns a `NextResponse` on failure or `null` on success. We are adding a sibling helper `requireVoiceMemoSecret` that reads a separate env var so the iOS Shortcut's secret has narrow blast radius if leaked.
   - **Service-role writes:** API routes import `adminClient` from `src/lib/supabase/admin.ts`. This bypasses RLS. The bearer gate is the only authorization layer.
   - **Migrations:** CLI-tracked at `supabase/migrations/`. Filename pattern `YYYYMMDDHHMMSS_<name>.sql`. After writing, apply locally with `supabase db push` OR via the supabase MCP `apply_migration` tool. Either is fine; use whichever the executing session has access to.

3. **Known gotcha: there is NO test framework in this repo.** Do not add jest/vitest/playwright. The verification loop is: `pnpm exec tsc --noEmit` for type checking, `pnpm lint` for new errors only (baseline has 10 pre-existing), SQL assertion queries for schema, and `curl` + real iPhone for end-to-end.

4. **Lint baseline:** `pnpm lint` exits 1 with 10 pre-existing errors on main. Gate is "no NEW errors", count must not exceed 10.

5. **Branching:** Branch off `main` (NOT off the current `feat/spine-phase1` branch). New branch name: `feat/voice-memo-capture`. **Coordination note:** Phase 2.1 RLS lockdown is in flight on `feat/spine-phase1` and not yet merged to main (per auto-memory `project_phase21_rls_lockdown.md` -- blocked on browser smoke test). This plan does not depend on Phase 2.1's contacts table changes (we only INSERT into contacts indirectly via the matcher's READ, and READ already works against the current schema). When Phase 2.1 merges, this branch should rebase onto main; conflicts are unlikely because Phase 2.1 touches `contacts` and this plan touches `interactions` + `voice_memos` + storage.

6. **Supabase MCP is read-only.** `mcp__supabase__execute_sql` and `mcp__supabase__apply_migration` both refuse writes on this project (auto-memory `reference_supabase_mcp_readonly.md`). All DDL and DML must go through `supabase db push` (CLI) or the Supabase Studio SQL editor. This affects Task 1 (apply migration) and Task 9 (verification queries — use `psql` directly or the SQL editor).

7. **Dev server port ghosts.** Orphaned `pnpm dev` processes can leave a ghost on 3000 while the new server binds to 3001 (auto-memory `feedback_dev_server_port_check.md`). Always probe both ports before curling.

8. **Anthropic model:** Use `claude-haiku-4-5-20251001`. This is the fast, cheap, structured-output model. Do not use Sonnet for this — Haiku with `tool_use` is sufficient and 4x cheaper.

9. **OpenAI model:** Use `whisper-1`. There is only one Whisper model in the API.

---

## Pre-work checklist (do these before Task 1)

- [ ] Confirm you are in `/Users/alex/crm` and the working tree is clean: `git status`. If dirty, stash or commit existing work first.
- [ ] Confirm `OWNER_USER_ID=b735d691-4d86-4e31-9fd3-c2257822dca3` exists in `.env.local`.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in `.env.local`.
- [ ] Ask Alex to create an OpenAI API key at https://platform.openai.com/api-keys and an Anthropic API key at https://console.anthropic.com/settings/keys. Both starting with `sk-` and `sk-ant-` respectively.
- [ ] Generate the voice memo shared secret: `openssl rand -hex 32` (run this and capture the output for Alex to paste into `.env.local` and into the iOS Shortcut later).

---

## Task 0: Branch, env vars, dependency install

**Files:**
- Modify: `.env.local` (Alex pastes secrets)
- Modify: `.env.local.example`
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Branch off main.**

```bash
cd ~/crm
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/voice-memo-capture
```

- [ ] **Step 2: Install OpenAI and Anthropic SDKs.**

```bash
pnpm add openai @anthropic-ai/sdk
```

Verify:
```bash
pnpm list openai @anthropic-ai/sdk
```
Expected: both packages listed at versions >= 4.0.0 (openai) and >= 0.30.0 (anthropic).

- [ ] **Step 3: Add new env vars to `.env.local.example`.** Append these four lines (do not commit real values):

```
# Voice memo capture pipeline (Loop 1)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
VOICE_MEMO_SHARED_SECRET=<openssl rand -hex 32>
```

(`OWNER_USER_ID` is already in the example file from Phase 2.1.)

- [ ] **Step 4: Alex pastes real values into `.env.local`.** This is a manual step. Confirm with Alex that:
  - `OPENAI_API_KEY` is set and starts with `sk-`
  - `ANTHROPIC_API_KEY` is set and starts with `sk-ant-`
  - `VOICE_MEMO_SHARED_SECRET` is set to a 64-char hex string (record this — you will paste it into the iOS Shortcut in Task 12)

Verify (without printing the values):
```bash
grep -c "^OPENAI_API_KEY=" .env.local
grep -c "^ANTHROPIC_API_KEY=" .env.local
grep -c "^VOICE_MEMO_SHARED_SECRET=" .env.local
```
Each should print `1`.

- [ ] **Step 5: TypeScript clean check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0 (no errors).

- [ ] **Step 6: Commit.**

```bash
git add package.json pnpm-lock.yaml .env.local.example
git commit -m "chore(deps): add openai and @anthropic-ai/sdk for voice memo capture"
```

---

## Task 1: Migration — voice_memos table, interactions extensions, storage bucket

**Files:**
- Create: `supabase/migrations/20260407190000_voice_memo_capture.sql`

- [ ] **Step 1: Write the migration.** Create the file with this exact content:

```sql
-- Voice memo capture pipeline (Loop 1 from Operating Leverage Map)
-- Adds voice_memos audit table, extends interactions with extracted fields,
-- creates the voice-memos storage bucket.

BEGIN;

-- ============================================================================
-- 1. voice_memos audit table
-- ============================================================================

DROP TABLE IF EXISTS public.voice_memos CASCADE;

CREATE TABLE public.voice_memos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    audio_url text NOT NULL,
    audio_duration_sec integer,
    transcript text,
    raw_extraction jsonb,
    interaction_id uuid REFERENCES public.interactions(id) ON DELETE SET NULL,
    processing_status text NOT NULL DEFAULT 'pending',
    processing_error text,
    confidence_score numeric(3,2),
    candidate_name text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT voice_memos_status_check CHECK (
        processing_status = ANY (ARRAY['pending', 'processed', 'needs_review', 'error', 'rejected'])
    ),
    CONSTRAINT voice_memos_confidence_check CHECK (
        confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
    )
);

CREATE INDEX voice_memos_user_status_idx
    ON public.voice_memos(user_id, processing_status)
    WHERE deleted_at IS NULL;

CREATE INDEX voice_memos_created_at_idx
    ON public.voice_memos(created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own voice memos"
    ON public.voice_memos
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Trigger to keep updated state coherent
CREATE OR REPLACE FUNCTION public.voice_memos_set_processed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.processing_status IN ('processed', 'rejected') AND OLD.processing_status NOT IN ('processed', 'rejected') THEN
        NEW.processed_at := now();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voice_memos_processed_at_trigger
    BEFORE UPDATE ON public.voice_memos
    FOR EACH ROW
    EXECUTE FUNCTION public.voice_memos_set_processed_at();

-- ============================================================================
-- 2. interactions table extensions
-- ============================================================================

ALTER TABLE public.interactions
    ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS sentiment text,
    ADD COLUMN IF NOT EXISTS intel jsonb,
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' NOT NULL,
    ADD COLUMN IF NOT EXISTS voice_memo_id uuid REFERENCES public.voice_memos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'interactions_sentiment_check'
    ) THEN
        ALTER TABLE public.interactions
            ADD CONSTRAINT interactions_sentiment_check
            CHECK (sentiment IS NULL OR sentiment = ANY (ARRAY['positive', 'neutral', 'frustrated']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'interactions_source_check'
    ) THEN
        ALTER TABLE public.interactions
            ADD CONSTRAINT interactions_source_check
            CHECK (source = ANY (ARRAY['manual', 'voice_memo', 'email_import', 'sms_import']));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS interactions_voice_memo_id_idx
    ON public.interactions(voice_memo_id)
    WHERE voice_memo_id IS NOT NULL;

-- ============================================================================
-- 3. Storage bucket for raw audio files
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-memos',
    'voice-memos',
    false,
    10485760,  -- 10 MB cap per file (60 sec audio is ~1 MB at typical iPhone bitrates)
    ARRAY['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Service role bypasses RLS by default. We add an explicit policy for completeness
-- so future migrations don't accidentally expose the bucket to authenticated users.
DROP POLICY IF EXISTS "Service role manages voice memos" ON storage.objects;
CREATE POLICY "Service role manages voice memos"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'voice-memos')
    WITH CHECK (bucket_id = 'voice-memos');

COMMIT;
```

- [ ] **Step 2: Apply the migration.**

**The Supabase MCP is read-only on this project** — `mcp__supabase__apply_migration` and `mcp__supabase__execute_sql` will refuse writes (see auto-memory `reference_supabase_mcp_readonly.md`). DDL/DML must go through one of these two paths:

**Option A — Supabase CLI (preferred):**
```bash
cd ~/crm
supabase db push
```

**Option B — Supabase Studio SQL editor:** open the project dashboard, go to SQL editor, paste the migration body, run it. Note that this bypasses CLI tracking — if you take this path, **also commit the migration file** so the local migrations directory matches what's deployed.

Expected: migration applies cleanly. If you see "duplicate column" or "constraint already exists" errors, the `IF NOT EXISTS` guards should have caught them; if they didn't, stop and inspect.

- [ ] **Step 3: Verify schema with assertion queries.** Run these via `psql` or `mcp__supabase__execute_sql`:

```sql
-- voice_memos table exists
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'voice_memos';
-- Expected: 1

-- interactions has new columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'interactions'
  AND column_name IN ('topics', 'sentiment', 'intel', 'source', 'voice_memo_id', 'confidence_score')
ORDER BY column_name;
-- Expected: 6 rows

-- Storage bucket exists
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'voice-memos';
-- Expected: 1 row, public=false, file_size_limit=10485760

-- RLS is enabled on voice_memos
SELECT relrowsecurity FROM pg_class WHERE relname = 'voice_memos';
-- Expected: true
```

- [ ] **Step 4: Verify the materialized view auto-refresh trigger.** The Operating Leverage Map relies on `agent_relationship_health` reflecting new interactions. Check whether a refresh trigger exists:

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.interactions'::regclass
  AND tgname LIKE '%refresh%';
```

If the result is empty, the materialized view is not auto-refreshing. **Do not fix this in Phase 1** — note it in the wrap-up (Task 14) as a follow-up task. The view can be manually refreshed as needed; auto-refresh on every interaction insert is a separate decision (cost vs freshness).

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260407190000_voice_memo_capture.sql
git commit -m "feat(db): voice_memos table + interactions extensions + storage bucket"
```

---

## Task 2: Add `requireVoiceMemoSecret` helper to api-auth.ts

**Files:**
- Modify: `src/lib/api-auth.ts`

- [ ] **Step 1: Read the existing file** to confirm the established pattern:

```bash
cat src/lib/api-auth.ts
```

You should see `requireApiToken(request)` exported, reading `INTERNAL_API_TOKEN`. We are mirroring this pattern with a separate function reading `VOICE_MEMO_SHARED_SECRET`. Two helpers, two env vars, narrow blast radius if either leaks.

- [ ] **Step 2: Append the new helper.** Add this to the bottom of `src/lib/api-auth.ts`:

```typescript

const VOICE_MEMO_SECRET = process.env.VOICE_MEMO_SHARED_SECRET;

/**
 * Returns a 401 NextResponse if the request lacks a valid voice memo secret.
 * Returns null if the request is authorized.
 *
 * The voice memo secret is intentionally separate from INTERNAL_API_TOKEN so
 * that the iOS Shortcut on Alex's phone has a narrow-scope credential. If the
 * shortcut is exported or shared by accident, only the voice memo intake route
 * is exposed, not all internal APIs.
 *
 * Header: X-Voice-Memo-Secret: <secret>
 */
export function requireVoiceMemoSecret(request: Request): NextResponse | null {
  if (!VOICE_MEMO_SECRET) {
    return NextResponse.json(
      { error: "Server misconfigured: VOICE_MEMO_SHARED_SECRET not set" },
      { status: 500 }
    );
  }

  const provided = request.headers.get("x-voice-memo-secret") ?? "";
  if (provided.length === 0 || provided.length !== VOICE_MEMO_SECRET.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(VOICE_MEMO_SECRET));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
```

- [ ] **Step 3: TypeScript clean check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/api-auth.ts
git commit -m "feat(auth): add requireVoiceMemoSecret helper for iOS shortcut"
```

---

## Task 3: Voice memo types module

**Files:**
- Create: `src/lib/voice-memo/types.ts`

- [ ] **Step 1: Create the types file.** This module is the contract between transcribe / extract / match / insert.

```typescript
// src/lib/voice-memo/types.ts
// Shared types for the voice memo capture pipeline (Loop 1).

import { z } from "zod";

/**
 * The candidate set passed into the Claude extraction call. Each candidate is
 * a contact the user could plausibly be referring to in the memo. The matcher
 * builds this list from the user's contacts table.
 */
export interface ContactCandidate {
  id: string;
  display_name: string;          // "Julie Jarmiolowski"
  first_name: string;
  last_name: string;
  brokerage: string | null;
  type: string;                  // realtor | lender | etc.
  tier: string | null;
  nicknames: string[];           // ['Julie', 'Julia']
}

/**
 * The structured extraction result. This is what Claude returns via tool_use.
 * If you change this shape, update the tool input_schema in extract.ts.
 */
export const VoiceMemoExtractionSchema = z.object({
  contact_match: z.object({
    candidate_id: z.string().nullable(),
    candidate_name: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  summary: z.string().min(1).max(500),
  topics: z.array(z.string()).max(10),
  sentiment: z.enum(["positive", "neutral", "frustrated"]),
  intel: z.record(z.string(), z.unknown()).optional().default({}),
  follow_up: z
    .object({
      title: z.string(),
      due_date_iso: z.string().nullable(),
    })
    .nullable()
    .optional(),
  interaction_type: z.enum(["call", "text", "email", "meeting", "broker_open", "lunch", "note"]),
  direction: z.enum(["inbound", "outbound"]).nullable().optional(),
  duration_minutes: z.number().int().min(0).max(240).nullable().optional(),
});

export type VoiceMemoExtraction = z.infer<typeof VoiceMemoExtractionSchema>;

/**
 * Threshold above which an extracted contact match is considered confident
 * enough to auto-insert into interactions. Below this, the row is queued for
 * manual review in the dashboard.
 *
 * Tunable. Start high. Lower only after measuring false negatives.
 */
export const CONFIDENCE_THRESHOLD = 0.85;

export type ProcessingStatus = "pending" | "processed" | "needs_review" | "error" | "rejected";
```

- [ ] **Step 2: TypeScript check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/voice-memo/types.ts
git commit -m "feat(voice-memo): types module + extraction schema"
```

---

## Task 4: Contact matcher with nickname expansion

**Files:**
- Create: `src/lib/voice-memo/match-contact.ts`

- [ ] **Step 1: Create the matcher.** This loads the candidate set from the database and exposes a post-validation helper.

```typescript
// src/lib/voice-memo/match-contact.ts
// Loads contact candidates for the voice memo extraction call and validates
// the contact_id Claude returns is actually in the candidate set (defense
// against hallucinated UUIDs).

import { adminClient } from "@/lib/supabase/admin";
import type { ContactCandidate } from "./types";

/**
 * Common nickname expansions. Add to this map as Alex's contact list grows.
 * Format: canonical first_name -> array of spoken-form variants (lowercase).
 * Spoken forms are matched case-insensitively in the prompt context.
 */
const NICKNAME_MAP: Record<string, string[]> = {
  julie: ["jules", "julia"],
  joseph: ["joe", "joey"],
  joe: ["joey", "joseph"],
  joey: ["joe", "joseph"],
  michael: ["mike", "mikey"],
  michelle: ["shelly", "missy"],
  william: ["will", "bill", "billy"],
  robert: ["rob", "bob", "bobby"],
  richard: ["rick", "dick", "rich"],
  thomas: ["tom", "tommy"],
  christopher: ["chris", "topher"],
  christine: ["chris", "tina"],
  stephanie: ["steph", "stephie"],
  elizabeth: ["liz", "beth", "betty", "eliza"],
  catherine: ["cat", "cathy", "kate", "katie"],
  katherine: ["kate", "katie", "kathy"],
  jonathan: ["jon", "johnny"],
  jennifer: ["jen", "jenny"],
  patricia: ["pat", "patty", "trish"],
  susan: ["sue", "susie"],
  margaret: ["maggie", "meg", "peggy"],
  alexander: ["alex"],
  alexandra: ["alex", "lexi"],
  fiona: ["fi"],
  rebecca: ["becca", "becky"],
};

function expandNicknames(firstName: string): string[] {
  const lower = firstName.trim().toLowerCase();
  const direct = NICKNAME_MAP[lower] ?? [];
  // Also include reverse-lookups: if Alex calls someone "Joey" and the DB has "Joseph",
  // we still need to surface "Joey" as a match candidate.
  const reverse: string[] = [];
  for (const [canonical, variants] of Object.entries(NICKNAME_MAP)) {
    if (variants.includes(lower) && canonical !== lower) {
      reverse.push(canonical);
    }
  }
  return Array.from(new Set([...direct, ...reverse]));
}

/**
 * Loads the candidate set for a given user. Filters to active contacts of
 * types that produce interactions (realtors, lenders, referral partners,
 * past clients, sphere). Excludes vendors/builders/buyers/sellers — those
 * are unlikely subjects for a "called Julie about her DC Ranch listing"
 * voice memo.
 */
export async function loadContactCandidates(userId: string): Promise<ContactCandidate[]> {
  const { data, error } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, brokerage, type, tier")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("type", ["realtor", "lender", "referral_partner", "past_client", "sphere"]);

  if (error) {
    throw new Error(`loadContactCandidates failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    display_name: `${row.first_name} ${row.last_name}`.trim(),
    brokerage: (row.brokerage as string | null) ?? null,
    type: row.type as string,
    tier: (row.tier as string | null) ?? null,
    nicknames: expandNicknames(row.first_name as string),
  }));
}

/**
 * Validates that a contact_id returned by the extraction is actually in the
 * candidate set. Returns the matched candidate or null if the id is unknown.
 * This prevents the model from hallucinating a plausible-looking UUID.
 */
export function validateMatchedContact(
  candidates: ContactCandidate[],
  candidateId: string | null
): ContactCandidate | null {
  if (!candidateId) return null;
  return candidates.find((c) => c.id === candidateId) ?? null;
}
```

- [ ] **Step 2: TypeScript check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/voice-memo/match-contact.ts
git commit -m "feat(voice-memo): contact candidate loader + nickname expansion"
```

---

## Task 5: Whisper transcription wrapper

**Files:**
- Create: `src/lib/voice-memo/transcribe.ts`

- [ ] **Step 1: Create the transcription wrapper.**

```typescript
// src/lib/voice-memo/transcribe.ts
// OpenAI Whisper API wrapper. Takes a Blob (the raw audio from the multipart
// upload), returns the transcript string and a duration estimate.

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionResult {
  transcript: string;
  duration_sec: number | null;
}

/**
 * Transcribe an audio blob using Whisper. The blob must be one of the
 * accepted formats listed in the storage bucket's allowed_mime_types.
 *
 * @param audio - audio blob from multipart upload
 * @param filename - the original filename, used for the OpenAI File object
 * @returns transcript text + duration in seconds (when available)
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string
): Promise<TranscriptionResult> {
  // OpenAI SDK accepts a File-like object. In Node 18+ Blob is fine but the
  // SDK wants a name and type — we wrap it in a File.
  const file = new File([audio], filename, { type: audio.type || "audio/m4a" });

  // verbose_json gives us the duration field
  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    language: "en",
  });

  // verbose_json returns { text, duration, ... }
  // The SDK types it as an interface with `text` always present and `duration`
  // sometimes present depending on response_format.
  const text = (response as { text: string }).text ?? "";
  const duration = (response as { duration?: number }).duration ?? null;

  if (!text || text.trim().length === 0) {
    throw new Error("Whisper returned empty transcript");
  }

  return {
    transcript: text.trim(),
    duration_sec: duration !== null ? Math.round(duration) : null,
  };
}
```

- [ ] **Step 2: TypeScript check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0. If the OpenAI SDK types complain about `verbose_json`, the response cast above handles it; if not, drop to `response_format: "json"` and lose the duration field (acceptable degradation).

- [ ] **Step 3: Commit.**

```bash
git add src/lib/voice-memo/transcribe.ts
git commit -m "feat(voice-memo): whisper transcription wrapper"
```

---

## Task 6: Claude Haiku extraction with forced tool_use

**Files:**
- Create: `src/lib/voice-memo/extract.ts`

- [ ] **Step 1: Create the extraction module.** This is the heart of the pipeline. Forced `tool_use` means Claude must return a structured object matching the schema; no free-form prose to parse.

```typescript
// src/lib/voice-memo/extract.ts
// Claude Haiku 4.5 with forced tool_use for structured extraction of voice
// memos. The model receives the transcript + a candidate contact list, and
// returns a fully-typed extraction matching VoiceMemoExtractionSchema.

import Anthropic from "@anthropic-ai/sdk";
import type { ContactCandidate, VoiceMemoExtraction } from "./types";
import { VoiceMemoExtractionSchema } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const TOOL_NAME = "record_voice_memo";

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    contact_match: {
      type: "object" as const,
      description: "Which contact this memo is about",
      properties: {
        candidate_id: {
          type: ["string", "null"] as const,
          description:
            "UUID of the best-match contact from the provided candidate list. Set to null if no candidate matches with reasonable confidence.",
        },
        candidate_name: {
          type: "string" as const,
          description: "The name as Alex spoke it in the memo (e.g., 'Julie', 'Joey from Russ Lyon')",
        },
        confidence: {
          type: "number" as const,
          description:
            "0.0 to 1.0. Use 1.0 only when first name + brokerage or last name uniquely matches one candidate. Use 0.5-0.7 when the first name matches multiple candidates and you had to guess. Use < 0.5 when no candidate is a clear match.",
        },
      },
      required: ["candidate_id", "candidate_name", "confidence"],
    },
    summary: {
      type: "string" as const,
      description:
        "1-2 sentence neutral summary of what happened in the call. No marketing language. No exclamation marks.",
    },
    topics: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "Up to 6 short topic tags. Use kebab-case. Examples: listing-coming, personal, market-opinion, frustrated-with-lender, post-close-thanks, deal-stuck, referral-given.",
    },
    sentiment: {
      type: "string" as const,
      enum: ["positive", "neutral", "frustrated"],
      description: "Overall emotional tone of the agent during the call.",
    },
    intel: {
      type: "object" as const,
      description:
        "Free-form key-value pairs of facts mentioned. Common keys: pipeline (upcoming listings/deals), personal (kids/vacations/etc), market_opinion, lender_status. Omit any key with no info.",
    },
    follow_up: {
      type: ["object", "null"] as const,
      description: "Set to null if no follow-up was committed",
      properties: {
        title: {
          type: "string" as const,
          description: "Imperative phrase: 'Send DC Ranch comp data', 'Call back about lender intro'",
        },
        due_date_iso: {
          type: ["string", "null"] as const,
          description: "ISO date YYYY-MM-DD if Alex named one, otherwise null",
        },
      },
      required: ["title", "due_date_iso"],
    },
    interaction_type: {
      type: "string" as const,
      enum: ["call", "text", "email", "meeting", "broker_open", "lunch", "note"],
      description: "Default to 'call' unless the memo clearly says otherwise.",
    },
    direction: {
      type: ["string", "null"] as const,
      enum: ["inbound", "outbound", null],
      description: "Who initiated. inbound = agent called Alex; outbound = Alex called agent. Null if unclear.",
    },
    duration_minutes: {
      type: ["number", "null"] as const,
      description: "Approximate call length in minutes if mentioned, else null.",
    },
  },
  required: ["contact_match", "summary", "topics", "sentiment", "interaction_type"],
} as const;

const SYSTEM_PROMPT = `You are a structured extraction assistant for Alex Hollien, a Title Sales Executive at Great American Title Agency in Phoenix. Alex records 30-60 second voice memos after phone calls with real estate agents (his clients). Your job is to convert each transcript into a structured record of the interaction.

Key rules:
- Always call the record_voice_memo tool. Never reply with prose.
- Match the agent name against the provided candidate list. Return null candidate_id if you cannot match with confidence.
- Be conservative with confidence scores. Confidence > 0.85 means an auto-insert; below that means manual review.
- Topics use kebab-case. No marketing language ('stunning', 'amazing'). No exclamation marks anywhere.
- Summary is neutral and factual. Two sentences max.
- Direction: 'outbound' = Alex called the agent. 'inbound' = the agent called Alex. Default to outbound if unclear (Alex is the one with the voice memo habit).`;

function buildUserMessage(transcript: string, candidates: ContactCandidate[]): string {
  const candidateLines = candidates.map((c) => {
    const nicks = c.nicknames.length > 0 ? ` (also: ${c.nicknames.join(", ")})` : "";
    const brokerage = c.brokerage ? ` -- ${c.brokerage}` : "";
    return `- ${c.id} | ${c.display_name}${nicks}${brokerage} | ${c.type}`;
  });

  return `Voice memo transcript:
"""
${transcript}
"""

Candidate contacts (id | name | brokerage | type):
${candidateLines.join("\n")}

Extract a structured record by calling the record_voice_memo tool.`;
}

export async function extractVoiceMemo(
  transcript: string,
  candidates: ContactCandidate[]
): Promise<VoiceMemoExtraction> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the structured fields extracted from a voice memo.",
        input_schema: TOOL_INPUT_SCHEMA as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildUserMessage(transcript, candidates),
      },
    ],
  });

  // Find the tool_use block in the response
  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUseBlock) {
    throw new Error(`Claude did not return a tool_use block. Stop reason: ${response.stop_reason}`);
  }

  // Validate against the Zod schema. This catches both type errors and any
  // schema drift between the tool definition and the runtime contract.
  const parsed = VoiceMemoExtractionSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    throw new Error(
      `Extraction failed schema validation: ${JSON.stringify(parsed.error.issues)}`
    );
  }

  return parsed.data;
}
```

- [ ] **Step 2: TypeScript check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0. If the Anthropic SDK type imports fail, check `pnpm list @anthropic-ai/sdk` to confirm version >= 0.30.0; older versions had different export shapes.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/voice-memo/extract.ts
git commit -m "feat(voice-memo): claude haiku extraction with forced tool_use"
```

---

## Task 7: Insert module — DB writes for voice_memos, interactions, tasks

**Files:**
- Create: `src/lib/voice-memo/insert.ts`

- [ ] **Step 1: Create the insert module.** This handles all database writes and the high-confidence vs needs-review branching.

```typescript
// src/lib/voice-memo/insert.ts
// Database writes for the voice memo pipeline. Decides whether to insert into
// interactions (high confidence) or queue for review (low confidence).

import { adminClient } from "@/lib/supabase/admin";
import { CONFIDENCE_THRESHOLD } from "./types";
import type { VoiceMemoExtraction } from "./types";

interface InsertParams {
  userId: string;
  audioUrl: string;
  audioDurationSec: number | null;
  transcript: string;
  extraction: VoiceMemoExtraction;
  /** True if the contact_id from extraction was validated against the candidate set. */
  contactIdValid: boolean;
}

interface InsertResult {
  voiceMemoId: string;
  interactionId: string | null;
  taskId: string | null;
  status: "processed" | "needs_review";
}

/**
 * Single entry point for writing the pipeline output to the database.
 *
 * Decision tree:
 * - confidence >= 0.85 AND contact_id is valid -> insert interactions row,
 *   maybe insert task row, mark voice_memo as 'processed'
 * - else -> mark voice_memo as 'needs_review' for manual reconciliation
 *
 * Always inserts a voice_memos row regardless of outcome (audit trail).
 */
export async function insertVoiceMemoResult(params: InsertParams): Promise<InsertResult> {
  const {
    userId,
    audioUrl,
    audioDurationSec,
    transcript,
    extraction,
    contactIdValid,
  } = params;

  const isHighConfidence =
    extraction.contact_match.confidence >= CONFIDENCE_THRESHOLD &&
    extraction.contact_match.candidate_id !== null &&
    contactIdValid;

  // Step 1: Always insert the voice_memos audit row first. We need its id for
  // FK linkage if we proceed to insert the interactions row.
  const { data: voiceMemo, error: vmErr } = await adminClient
    .from("voice_memos")
    .insert({
      user_id: userId,
      audio_url: audioUrl,
      audio_duration_sec: audioDurationSec,
      transcript,
      raw_extraction: extraction,
      processing_status: isHighConfidence ? "pending" : "needs_review",
      confidence_score: extraction.contact_match.confidence,
      candidate_name: extraction.contact_match.candidate_name,
    })
    .select("id")
    .single();

  if (vmErr || !voiceMemo) {
    throw new Error(`voice_memos insert failed: ${vmErr?.message ?? "no row returned"}`);
  }

  if (!isHighConfidence) {
    // Stop here. Reconciliation page will let Alex pick the right contact later.
    return {
      voiceMemoId: voiceMemo.id as string,
      interactionId: null,
      taskId: null,
      status: "needs_review",
    };
  }

  // Step 2: High-confidence path. Insert into interactions.
  const { data: interaction, error: interErr } = await adminClient
    .from("interactions")
    .insert({
      user_id: userId,
      contact_id: extraction.contact_match.candidate_id!,
      type: extraction.interaction_type,
      summary: extraction.summary,
      direction: extraction.direction ?? "outbound",
      duration_minutes: extraction.duration_minutes ?? null,
      topics: extraction.topics,
      sentiment: extraction.sentiment,
      intel: extraction.intel ?? {},
      source: "voice_memo",
      voice_memo_id: voiceMemo.id,
      confidence_score: extraction.contact_match.confidence,
    })
    .select("id")
    .single();

  if (interErr || !interaction) {
    // Rollback the voice_memos row to error state so we don't lose the audit
    // trail or leave a half-processed memo invisible to reconciliation.
    await adminClient
      .from("voice_memos")
      .update({
        processing_status: "error",
        processing_error: `interactions insert failed: ${interErr?.message ?? "unknown"}`,
      })
      .eq("id", voiceMemo.id);

    throw new Error(`interactions insert failed: ${interErr?.message ?? "no row returned"}`);
  }

  // Step 3: Optional follow-up task.
  let taskId: string | null = null;
  if (extraction.follow_up && extraction.follow_up.title.length > 0) {
    const { data: task, error: taskErr } = await adminClient
      .from("tasks")
      .insert({
        user_id: userId,
        contact_id: extraction.contact_match.candidate_id!,
        title: extraction.follow_up.title,
        description: `From voice memo: "${extraction.summary}"`,
        due_date: extraction.follow_up.due_date_iso ?? null,
        priority: "medium",
        status: "open",
      })
      .select("id")
      .single();

    if (!taskErr && task) {
      taskId = task.id as string;
    }
    // Don't fail the whole pipeline if task insert fails — log it on the voice memo.
    if (taskErr) {
      console.error("[voice-memo] task insert failed:", taskErr.message);
    }
  }

  // Step 4: Update the voice_memos row to processed + link the interaction.
  await adminClient
    .from("voice_memos")
    .update({
      processing_status: "processed",
      interaction_id: interaction.id,
    })
    .eq("id", voiceMemo.id);

  return {
    voiceMemoId: voiceMemo.id as string,
    interactionId: interaction.id as string,
    taskId,
    status: "processed",
  };
}
```

- [ ] **Step 2: TypeScript check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/voice-memo/insert.ts
git commit -m "feat(voice-memo): db insert module with confidence branching"
```

---

## Task 8: API route — `/api/voice-memo/intake`

**Files:**
- Create: `src/app/api/voice-memo/intake/route.ts`

- [ ] **Step 1: Create the route.** This wires the whole pipeline together.

```typescript
// src/app/api/voice-memo/intake/route.ts
// POST endpoint for the iOS Shortcut. Accepts a multipart form with an
// "audio" field, runs the full Whisper > Claude > DB pipeline, returns 201.

import { NextResponse, type NextRequest } from "next/server";
import { requireVoiceMemoSecret } from "@/lib/api-auth";
import { adminClient } from "@/lib/supabase/admin";
import { transcribeAudio } from "@/lib/voice-memo/transcribe";
import { extractVoiceMemo } from "@/lib/voice-memo/extract";
import { loadContactCandidates, validateMatchedContact } from "@/lib/voice-memo/match-contact";
import { insertVoiceMemoResult } from "@/lib/voice-memo/insert";

export const runtime = "nodejs";  // we use Buffer + File globals
export const maxDuration = 60;     // Vercel Hobby is 10s, Pro is 60s. Whisper + Claude usually < 8s.

export async function POST(request: NextRequest) {
  // 1. Auth
  const unauth = requireVoiceMemoSecret(request);
  if (unauth) return unauth;

  // 2. Owner stamping (no real auth context from a phone shortcut)
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return NextResponse.json(
      { error: "Server misconfigured: OWNER_USER_ID not set" },
      { status: 500 }
    );
  }

  // 3. Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid multipart body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'audio' field in multipart body" },
      { status: 400 }
    );
  }

  if (audio.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: `Audio too large: ${audio.size} bytes (max 10485760)` },
      { status: 413 }
    );
  }

  const filename = (formData.get("filename") as string | null) ?? `memo-${Date.now()}.m4a`;

  try {
    // 4. Upload to Supabase Storage
    const storagePath = `${ownerId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadErr } = await adminClient.storage
      .from("voice-memos")
      .upload(storagePath, audio, {
        contentType: audio.type || "audio/m4a",
        cacheControl: "31536000",
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const audioUrl = `voice-memos/${storagePath}`;

    // 5. Transcribe with Whisper
    const { transcript, duration_sec } = await transcribeAudio(audio, filename);

    // 6. Load contact candidates and run extraction
    const candidates = await loadContactCandidates(ownerId);
    const extraction = await extractVoiceMemo(transcript, candidates);

    // 7. Post-validate the contact_id Claude returned
    const matched = validateMatchedContact(candidates, extraction.contact_match.candidate_id);
    const contactIdValid = matched !== null;

    // If Claude returned a candidate_id but it's not in our candidate set,
    // null it out so the confidence path treats this as needs_review.
    if (extraction.contact_match.candidate_id && !contactIdValid) {
      extraction.contact_match.candidate_id = null;
    }

    // 8. Insert
    const result = await insertVoiceMemoResult({
      userId: ownerId,
      audioUrl,
      audioDurationSec: duration_sec,
      transcript,
      extraction,
      contactIdValid,
    });

    return NextResponse.json(
      {
        ok: true,
        voice_memo_id: result.voiceMemoId,
        interaction_id: result.interactionId,
        task_id: result.taskId,
        status: result.status,
        confidence: extraction.contact_match.confidence,
        matched_contact:
          matched !== null
            ? { id: matched.id, name: matched.display_name }
            : null,
        summary: extraction.summary,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    console.error("[voice-memo/intake] pipeline failed:", message);
    return NextResponse.json(
      { error: "Pipeline failed", detail: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: TypeScript clean check.**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Lint check.**

```bash
pnpm lint 2>&1 | tail -20
```
Expected: error count <= 10 (the pre-existing baseline). If your changes introduce new errors, fix them.

- [ ] **Step 4: Commit.**

```bash
git add src/app/api/voice-memo/intake/route.ts
git commit -m "feat(api): voice memo intake route wiring whisper + claude + db"
```

---

## Task 9: End-to-end smoke test with curl

**Files:** none (verification only)

- [ ] **Step 1: Generate or locate a test audio file.** A real iPhone voice memo is best. Alternatives:
  - Record one from QuickTime Player on the Mac (~30 sec, talking like Alex would about a fictional agent)
  - Use any existing `.m4a` file you have

The test memo should mention an actual agent in Alex's `contacts` table to exercise the matching path. Pick an obvious one like "Julie".

- [ ] **Step 2: Start the dev server and confirm the port.**

```bash
cd ~/crm
pnpm dev
```

**Probe both 3000 and 3001** before continuing — orphaned pnpm dev processes can leave a ghost on 3000 while the new server binds to 3001 (see auto-memory `feedback_dev_server_port_check.md`):

```bash
for port in 3000 3001; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port 2>/dev/null || echo "down")
  echo "Port $port: $code"
done
```

Pick the port that returns `200` or `307`. If both respond, you have a ghost — kill it with `pkill -f "next dev"` and restart `pnpm dev`. Use the chosen port (likely 3000) in all subsequent curl commands. Set it as a shell var:

```bash
PORT=3000  # or 3001 if the ghost forced you up a port
```

- [ ] **Step 3: Test the auth gate first** (no audio, just confirm 401 on bad secret).

```bash
curl -s -X POST http://localhost:$PORT/api/voice-memo/intake \
  -H "X-Voice-Memo-Secret: wrong-secret" \
  -F "audio=@/dev/null" | head -50
```
Expected: `{"error":"Unauthorized"}`.

- [ ] **Step 4: Real test.** Replace `/path/to/memo.m4a` with the file from Step 1.

```bash
SECRET=$(grep '^VOICE_MEMO_SHARED_SECRET=' .env.local | cut -d= -f2)
curl -s -X POST http://localhost:$PORT/api/voice-memo/intake \
  -H "X-Voice-Memo-Secret: $SECRET" \
  -F "audio=@/path/to/memo.m4a;type=audio/m4a" \
  -F "filename=test-memo.m4a" | tee /tmp/voice-memo-response.json
```

Expected output shape:
```json
{
  "ok": true,
  "voice_memo_id": "...",
  "interaction_id": "...",
  "task_id": "..." or null,
  "status": "processed" or "needs_review",
  "confidence": 0.95,
  "matched_contact": { "id": "...", "name": "Julie ..." },
  "summary": "Spoke with Julie about ..."
}
```

If `status: needs_review`, the matching was uncertain — this is fine, the queue will catch it. If `status: processed`, check the DB:

```sql
SELECT id, contact_id, summary, topics, sentiment, source, voice_memo_id
FROM interactions
ORDER BY created_at DESC
LIMIT 1;
```

Expected: one row with `source='voice_memo'`, populated `topics`/`sentiment`/`voice_memo_id`.

- [ ] **Step 5: Inspect the audit table.**

```sql
SELECT id, processing_status, confidence_score, candidate_name, transcript
FROM voice_memos
ORDER BY created_at DESC
LIMIT 1;
```

Expected: row with the transcript Whisper produced and processing_status matching the response.

- [ ] **Step 6: Total wall time check.** Re-run the curl with `time`:

```bash
time curl -s -X POST http://localhost:$PORT/api/voice-memo/intake \
  -H "X-Voice-Memo-Secret: $SECRET" \
  -F "audio=@/path/to/memo.m4a;type=audio/m4a" -o /dev/null
```

Expected: real time < 12 seconds for a 30-60 second memo. If > 20 seconds, check whether Whisper or Claude is the bottleneck (add `console.time` calls in `route.ts`). If both are fine and the route is slow, suspect Storage upload latency.

- [ ] **Step 7: Commit nothing (verification only).** If you found issues that required code changes, commit those as fixes against the relevant prior task with `fix(voice-memo): <what>`.

---

## Task 10: Reconciliation page — `(app)/dashboard/voice-memo-review`

**Files:**
- Create: `src/app/(app)/dashboard/voice-memo-review/page.tsx`
- Create: `src/app/(app)/dashboard/voice-memo-review/review-list.tsx`

This is a server component that lists `voice_memos` rows in `needs_review` status, with the transcript, confidence, and a contact picker. Approve/reject buttons call the **server actions** built in Task 11. Per the established CRM pattern (`src/app/(app)/campaigns/actions.ts`), we use server actions, NOT API routes with bearer tokens — server actions keep all secrets server-side and don't ship `INTERNAL_API_TOKEN` to the browser.

- [ ] **Step 1: Create the page.**

```typescript
// src/app/(app)/dashboard/voice-memo-review/page.tsx
// Reconciliation queue for voice memos that didn't auto-match a contact.
// Server component shell + client list. Mutations go through server actions.

import { adminClient } from "@/lib/supabase/admin";
import { VoiceMemoReviewList } from "./review-list";

export const dynamic = "force-dynamic";

export default async function VoiceMemoReviewPage() {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return <div className="p-8 text-red-500">OWNER_USER_ID not set</div>;
  }

  const { data: pending, error: pendingErr } = await adminClient
    .from("voice_memos")
    .select("id, transcript, confidence_score, candidate_name, raw_extraction, created_at")
    .eq("user_id", ownerId)
    .eq("processing_status", "needs_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: contacts, error: contactsErr } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, brokerage, type")
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .in("type", ["realtor", "lender", "referral_partner", "past_client", "sphere"])
    .order("first_name");

  if (pendingErr || contactsErr) {
    return (
      <div className="p-8 text-red-500">
        Failed to load review queue: {pendingErr?.message ?? contactsErr?.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Memo Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending?.length ?? 0} memos waiting for contact assignment.
        </p>
      </header>

      <VoiceMemoReviewList
        memos={pending ?? []}
        contacts={contacts ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the client list component.** Same directory. It imports the server actions from Task 11 and calls them directly — Next.js serializes the call across the network boundary, and no secrets leave the server.

```typescript
// src/app/(app)/dashboard/voice-memo-review/review-list.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveVoiceMemo, rejectVoiceMemo } from "./actions";

interface PendingMemo {
  id: string;
  transcript: string | null;
  confidence_score: number | null;
  candidate_name: string | null;
  raw_extraction: unknown;
  created_at: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  brokerage: string | null;
  type: string;
}

interface Props {
  memos: PendingMemo[];
  contacts: Contact[];
}

export function VoiceMemoReviewList({ memos, contacts }: Props) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (memos.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Inbox zero. No memos waiting for review.
      </div>
    );
  }

  async function handleApprove(memoId: string) {
    const contactId = selections[memoId];
    if (!contactId) {
      setError("Pick a contact first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await approveVoiceMemo(memoId, contactId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  async function handleReject(memoId: string) {
    setError(null);
    startTransition(async () => {
      const result = await rejectVoiceMemo(memoId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {memos.map((memo) => {
        const confidence = memo.confidence_score ?? 0;
        const confidencePct = Math.round(confidence * 100);
        return (
          <div
            key={memo.id}
            className="rounded-lg border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                {new Date(memo.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="font-mono">
                {memo.candidate_name ? `Heard: "${memo.candidate_name}"` : "No name extracted"}
                {" -- "}
                confidence {confidencePct}%
              </span>
            </div>

            <p className="text-sm leading-relaxed">{memo.transcript ?? "(no transcript)"}</p>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm flex-1 min-w-[240px]"
                value={selections[memo.id] ?? ""}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [memo.id]: e.target.value }))
                }
                disabled={isPending}
              >
                <option value="">Pick a contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.brokerage ? ` -- ${c.brokerage}` : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleApprove(memo.id)}
                disabled={isPending || !selections[memo.id]}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                Approve
              </button>

              <button
                type="button"
                onClick={() => handleReject(memo.id)}
                disabled={isPending}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Note** — `actions.ts` (the file imported on line `import { approveVoiceMemo, rejectVoiceMemo } from "./actions";`) doesn't exist yet. Task 11 creates it. TypeScript will fail at this point — that's fine, finish Task 11 before running tsc.

- [ ] **Step 4: Commit (after Task 11 lands together).** Do NOT commit Task 10 in isolation — the import will be broken until Task 11 creates `actions.ts`. Stage the files but commit at the end of Task 11. To stage now without committing:

```bash
git add src/app/\(app\)/dashboard/voice-memo-review/page.tsx \
        src/app/\(app\)/dashboard/voice-memo-review/review-list.tsx
```

---

## Task 11: Server actions for approve / reject

**Files:**
- Create: `src/app/(app)/dashboard/voice-memo-review/actions.ts`

The CRM already uses Next.js server actions in `src/app/(app)/campaigns/actions.ts` and `campaigns/[id]/actions.ts`. We follow the same pattern. Server actions run server-side, have direct access to `adminClient` and `process.env`, and are called from client components as if they were local functions — no API route, no token in browser, no fetch boilerplate.

- [ ] **Step 1: Read the existing pattern** so you match the house style:

```bash
cat src/app/\(app\)/campaigns/actions.ts
```

Note how it: declares `"use server"` at the top, exports async functions, returns a discriminated `{ ok: true, ... } | { ok: false, error: string }` shape, calls `revalidatePath` after writes.

- [ ] **Step 2: Create the actions file.**

```typescript
// src/app/(app)/dashboard/voice-memo-review/actions.ts
// Server actions for the voice memo reconciliation queue.
// Called directly from review-list.tsx (client component) — no fetch, no API route.
"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { VoiceMemoExtractionSchema } from "@/lib/voice-memo/types";

type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const REVIEW_PATH = "/dashboard/voice-memo-review";

/**
 * Approve a needs_review voice memo by assigning it to a specific contact.
 * Inserts into interactions, optionally creates a follow-up task, marks the
 * memo processed.
 */
export async function approveVoiceMemo(
  memoId: string,
  contactId: string
): Promise<ActionResult<{ interactionId: string; taskId: string | null }>> {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return { ok: false, error: "Server misconfigured: OWNER_USER_ID not set" };
  }

  if (!memoId || !contactId) {
    return { ok: false, error: "Missing memoId or contactId" };
  }

  // Load the memo
  const { data: memo, error: memoErr } = await adminClient
    .from("voice_memos")
    .select("id, user_id, raw_extraction, processing_status")
    .eq("id", memoId)
    .single();

  if (memoErr || !memo) {
    return { ok: false, error: "Memo not found" };
  }

  if (memo.user_id !== ownerId) {
    return { ok: false, error: "Forbidden" };
  }

  if (memo.processing_status !== "needs_review") {
    return {
      ok: false,
      error: `Memo is in status '${memo.processing_status}', cannot approve`,
    };
  }

  // Validate the contact belongs to the user
  const { data: contact, error: contactErr } = await adminClient
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .single();

  if (contactErr || !contact) {
    return { ok: false, error: "Invalid contact selection" };
  }

  // Re-parse the extraction
  const parsed = VoiceMemoExtractionSchema.safeParse(memo.raw_extraction);
  if (!parsed.success) {
    return { ok: false, error: "Stored extraction is malformed" };
  }
  const extraction = parsed.data;

  // Insert the interaction
  const { data: interaction, error: interErr } = await adminClient
    .from("interactions")
    .insert({
      user_id: ownerId,
      contact_id: contactId,
      type: extraction.interaction_type,
      summary: extraction.summary,
      direction: extraction.direction ?? "outbound",
      duration_minutes: extraction.duration_minutes ?? null,
      topics: extraction.topics,
      sentiment: extraction.sentiment,
      intel: extraction.intel ?? {},
      source: "voice_memo",
      voice_memo_id: memoId,
      confidence_score: 1.0, // manually approved = full confidence
    })
    .select("id")
    .single();

  if (interErr || !interaction) {
    return {
      ok: false,
      error: `interactions insert failed: ${interErr?.message ?? "unknown"}`,
    };
  }

  // Optional follow-up task
  let taskId: string | null = null;
  if (extraction.follow_up && extraction.follow_up.title.length > 0) {
    const { data: task } = await adminClient
      .from("tasks")
      .insert({
        user_id: ownerId,
        contact_id: contactId,
        title: extraction.follow_up.title,
        description: `From voice memo: "${extraction.summary}"`,
        due_date: extraction.follow_up.due_date_iso ?? null,
        priority: "medium",
        status: "open",
      })
      .select("id")
      .single();
    taskId = (task?.id as string) ?? null;
  }

  // Mark the memo as processed
  await adminClient
    .from("voice_memos")
    .update({
      processing_status: "processed",
      interaction_id: interaction.id,
    })
    .eq("id", memoId);

  revalidatePath(REVIEW_PATH);

  return {
    ok: true,
    interactionId: interaction.id as string,
    taskId,
  };
}

/**
 * Reject a needs_review voice memo. Marks processing_status='rejected'.
 * Does not insert into interactions. Audio remains in storage for the
 * retention window.
 */
export async function rejectVoiceMemo(memoId: string): Promise<ActionResult> {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return { ok: false, error: "Server misconfigured: OWNER_USER_ID not set" };
  }

  if (!memoId) {
    return { ok: false, error: "Missing memoId" };
  }

  const { data: memo, error: memoErr } = await adminClient
    .from("voice_memos")
    .select("id, user_id, processing_status")
    .eq("id", memoId)
    .single();

  if (memoErr || !memo) {
    return { ok: false, error: "Memo not found" };
  }

  if (memo.user_id !== ownerId) {
    return { ok: false, error: "Forbidden" };
  }

  if (memo.processing_status !== "needs_review") {
    return {
      ok: false,
      error: `Memo is in status '${memo.processing_status}', cannot reject`,
    };
  }

  await adminClient
    .from("voice_memos")
    .update({ processing_status: "rejected" })
    .eq("id", memoId);

  revalidatePath(REVIEW_PATH);

  return { ok: true };
}
```

- [ ] **Step 3: TypeScript + lint check.** Now that `actions.ts` exists, the import in `review-list.tsx` from Task 10 resolves.

```bash
pnpm exec tsc --noEmit
pnpm lint 2>&1 | tail -10
```
Expected: tsc exit 0, lint error count <= 10.

- [ ] **Step 4: Commit Task 10 + Task 11 together.**

```bash
git add src/app/\(app\)/dashboard/voice-memo-review/
git commit -m "feat(dashboard): voice memo reconciliation page + server actions"
```

---

## Task 12: iOS Shortcut recipe documentation

**Files:**
- Create: `docs/voice-memo-shortcut-recipe.md`

- [ ] **Step 1: Create the recipe file.** This is the build instructions for the iOS Shortcut, not a `.shortcut` binary file (binaries don't survive git well and exporting one requires the iPhone in hand).

```markdown
# Voice Memo iOS Shortcut Recipe

This shortcut posts a 30-60 second audio recording to the CRM's voice memo intake endpoint. Build it once on the iPhone, then trigger it from the Action Button, Lock Screen, or "Hey Siri, log a call".

## Prerequisites

- The CRM is deployed and reachable (production URL or Tailscale tunnel for local dev)
- `VOICE_MEMO_SHARED_SECRET` is set in the deployed environment
- You have the secret value handy (it's in `~/crm/.env.local` next to `VOICE_MEMO_SHARED_SECRET=`)

## Build steps (Shortcuts app on iPhone)

1. Open the Shortcuts app, tap **+** to create a new shortcut.
2. Name it **"Log a Call"**.
3. Add action: **Record Audio**
   - Audio Quality: **Normal** (smaller file, Whisper handles it fine)
   - Start Recording: **On Tap** (hold-to-talk feels nicer; switch to "Immediately" if you prefer)
4. Add action: **Get Contents of URL**
   - URL: `https://<your-crm-domain>/api/voice-memo/intake`
   - Method: **POST**
   - Headers:
     - `X-Voice-Memo-Secret`: paste the secret value
   - Request Body: **Form**
     - Add field name `audio`, type **File**, value: **Recorded Audio** (the magic variable from step 3)
     - Add field name `filename`, type **Text**, value: `memo-{Current Date}.m4a` (use the Current Date magic variable)
5. (Optional) Add action: **Show Notification**
   - Title: **Logged**
   - Body: **Contents of URL** (the JSON response — useful while testing)
   - Once it's working, you can replace this with a quick haptic feedback.
6. (Optional) Add action: **Vibrate Device** for silent confirmation.

## Add to Action Button (iPhone 15 Pro and later)

1. Settings > Action Button > scroll to **Shortcut** > select **Log a Call**.
2. Now: hold the Action Button, talk for 60 seconds, release. Done.

## Add to Lock Screen widget

1. Long-press the lock screen > Customize > Lock Screen > Add Widgets.
2. Pick **Shortcuts** > **Run Shortcut** > select **Log a Call**.

## Voice trigger via Siri

"Hey Siri, log a call" runs the shortcut by name automatically.

## Testing the shortcut

The first time you run it, iOS will prompt to allow Shortcuts to access the network and to record audio. Allow both.

A successful run should return JSON like:
```json
{
  "ok": true,
  "voice_memo_id": "...",
  "interaction_id": "...",
  "status": "processed",
  "confidence": 0.95,
  "matched_contact": { "id": "...", "name": "Julie ..." },
  "summary": "Spoke with Julie about ..."
}
```

If you see `status: "needs_review"`, the matching wasn't confident — open the dashboard at `/dashboard/voice-memo-review` and pick the right contact.

## Troubleshooting

- **401 Unauthorized:** the `X-Voice-Memo-Secret` header is wrong. Re-check the value.
- **413 Payload Too Large:** recording > 10 MB. Lower audio quality or shorten the memo.
- **500 with "Pipeline failed":** Whisper or Claude error. Check the dev server logs.
- **Shortcut hangs forever:** the CRM URL is unreachable. If you're hitting localhost from your phone, you need a Tailscale tunnel or ngrok.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/voice-memo-shortcut-recipe.md
git commit -m "docs(voice-memo): iOS shortcut build recipe"
```

---

## Task 13: Real iPhone end-to-end test

**Files:** none (verification only — Alex's hands on the phone)

This is the only test that matters. The whole point of the build is "hold one button, talk, walk away."

- [ ] **Step 1: Make the dev server reachable from the iPhone.** Two options:
  - **Tailscale (preferred):** `tailscale up` on the Mac, then the URL is `http://<mac-tailscale-name>:3000`. Both devices on the same tailnet.
  - **ngrok:** `ngrok http 3000`, use the https URL.
  - If the CRM is already deployed to Vercel, skip this step and use the production URL — but make sure the prod environment has the env vars set first.

- [ ] **Step 2: Build the shortcut on the iPhone** following `docs/voice-memo-shortcut-recipe.md`. Use the URL from Step 1.

- [ ] **Step 3: Run it for real.** Press the Action Button, talk for 30-60 seconds about a real recent call (or fake one mentioning a real contact). Release. Wait for the notification.

- [ ] **Step 4: Verify in the dashboard.** Open `/dashboard/voice-memo-review` and `/contacts/<the-agent>` to confirm:
  - If processed: the new interaction appears on the contact's timeline
  - If needs_review: the queue page shows the memo with the contact picker

- [ ] **Step 5: Time it.** From "press button" to "interaction visible in dashboard" should be < 15 seconds. If it's slower, identify the bottleneck (Storage upload, Whisper, Claude, DB) by checking dev server logs.

- [ ] **Step 6: Iterate on the shortcut.** Add Vibrate Device, remove the notification, etc. — make it ambient. The notification is only useful while debugging.

If anything fails here, fix the underlying issue and re-test. **Do not commit fixes as part of this task** — go back to the relevant prior task and commit there with `fix(voice-memo): <what>`.

---

## Task 14: Wrap-up — verification, commit shape, project memory, follow-up notes

**Files:**
- Modify: `~/.claude/projects/-Users-alex/memory/MEMORY.md` (auto-memory index)
- Create: `~/.claude/projects/-Users-alex/memory/project_voice_memo_capture.md`

- [ ] **Step 1: Final TypeScript and lint check.**

```bash
cd ~/crm
pnpm exec tsc --noEmit
pnpm lint 2>&1 | tail -10
```
Expected: tsc exit 0; lint error count <= 10 (no NEW errors above the baseline).

- [ ] **Step 2: Build check.**

```bash
pnpm build 2>&1 | tail -30
```
Expected: build completes successfully. New routes `/api/voice-memo/intake`, `/api/voice-memo/[id]/approve`, `/api/voice-memo/[id]/reject` should appear in the route summary. New page `/dashboard/voice-memo-review` should also appear.

- [ ] **Step 3: Refresh the materialized view** so the new interactions show up in `agent_relationship_health` immediately:

```sql
REFRESH MATERIALIZED VIEW public.agent_relationship_health;
```

- [ ] **Step 4: Commit log review.** Run `git log --oneline main..feat/voice-memo-capture` and confirm you have approximately these commits (order matters less than coverage):

1. `chore(deps): add openai and @anthropic-ai/sdk for voice memo capture`
2. `feat(db): voice_memos table + interactions extensions + storage bucket`
3. `feat(auth): add requireVoiceMemoSecret helper for iOS shortcut`
4. `feat(voice-memo): types module + extraction schema`
5. `feat(voice-memo): contact candidate loader + nickname expansion`
6. `feat(voice-memo): whisper transcription wrapper`
7. `feat(voice-memo): claude haiku extraction with forced tool_use`
8. `feat(voice-memo): db insert module with confidence branching`
9. `feat(api): voice memo intake route wiring whisper + claude + db`
10. `feat(dashboard): voice memo reconciliation page + server actions`
11. `docs(voice-memo): iOS shortcut build recipe`

If you bundled some of these together, that's fine — the goal is one logical commit per task. (Task 10 + Task 11 are intentionally combined into commit 10 because the page imports the actions and would not type-check separately.)

- [ ] **Step 5: Push and open a PR.**

```bash
git push -u origin feat/voice-memo-capture
gh pr create --title "Voice memo capture pipeline (Loop 1)" --body "$(cat <<'EOF'
## Summary

Implements Loop 1 of the GAT-BOS Operating Leverage Map: voice-memo capture for agent check-ins. iOS Shortcut posts audio to a Next.js API route, the route runs Whisper > Claude Haiku > Supabase, and an interactions row appears within ~10 seconds.

- New `voice_memos` audit table
- Extended `interactions` with topics, sentiment, intel, source, voice_memo_id, confidence_score
- Storage bucket `voice-memos` with service-role-only policy
- `/api/voice-memo/intake` synchronous pipeline
- `/dashboard/voice-memo-review` reconciliation queue for low-confidence matches
- iOS Shortcut recipe in `docs/voice-memo-shortcut-recipe.md`

Cost per memo: ~$0.01. Estimated ~$1/month at 3-5 memos/day.

## Test plan

- [ ] Migration applies cleanly
- [ ] `curl` to `/api/voice-memo/intake` with a sample audio file returns 201 with structured response
- [ ] Real iPhone Shortcut posts a memo and creates an interactions row within 15 seconds
- [ ] Low-confidence memo lands in `/dashboard/voice-memo-review` and clears via Approve
- [ ] Reject flow marks the memo `rejected` without inserting into interactions

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Update auto-memory.** Create the project memory file:

```bash
cat > ~/.claude/projects/-Users-alex/memory/project_voice_memo_capture.md <<'EOF'
---
name: Voice Memo Capture Pipeline (Loop 1)
description: Phase 1 of the GAT-BOS Operating Leverage Map. Voice memo > Whisper > Claude Haiku > Supabase. iOS Shortcut > /api/voice-memo/intake.
type: project
---

Phase 1 of the data-first GAT-BOS rebuild, implementing Loop 1 (Agent Check-Ins) from `~/Downloads/GAT-BOS-Data-First-Operating-Leverage-Map.md`.

**Why:** Five of six interaction loops were leaking data because Alex's brain was the CRM. The keystone fix is voice memo capture: hang up phone, hold one button on iPhone, talk 60 seconds, walk away. Structured row appears in `interactions` automatically.

**How to apply:** When extending to Loops 2-6 (prospects, production_jobs, escrow, events, market_data), follow the same pattern: capture layer first, AI features second. Never build a feature that needs data the system isn't capturing yet.

**Architecture (locked decisions):**
- iOS Shortcut posts multipart to Next.js API route (NOT a Supabase edge function — CRM is already Next.js)
- Synchronous pipeline, no Trigger.dev (acceptable at 3-5 memos/day; revisit if volume grows)
- Whisper API + Claude Haiku 4.5 with forced tool_use (cheap, structured, ~$0.01/memo)
- Confidence threshold 0.85 for auto-insert; below = needs_review queue at /dashboard/voice-memo-review
- 30-day audio retention in Supabase Storage bucket `voice-memos`
- VOICE_MEMO_SHARED_SECRET separate from INTERNAL_API_TOKEN (narrow blast radius if shortcut leaks)

**Schema delta from Phase 1:**
- New: `voice_memos` table (audit + queue)
- Extended: `interactions` with `topics, sentiment, intel, source, voice_memo_id, confidence_score`
- Storage: bucket `voice-memos`, service-role-only policy

**Known follow-ups (not in Phase 1):**
- agent_relationship_health materialized view auto-refresh trigger may not exist; needs manual REFRESH
- INTERNAL_API_TOKEN reaches the browser via server-component prop on /dashboard/voice-memo-review (consistent with rest of repo, but worth hardening eventually)
- Loops 2-6 capture layers
EOF
```

Then add to the index — append this line to `~/.claude/projects/-Users-alex/memory/MEMORY.md` under the **Project** section, immediately after the GAT-BOS build status entry:

```
- [Voice Memo Capture (Loop 1)](project_voice_memo_capture.md) -- 2026-04-07: Phase 1 of GAT-BOS Operating Leverage Map. iOS Shortcut > Whisper > Claude Haiku > Supabase. Keystone capture layer.
```

- [ ] **Step 7: Notify Alex.** Final message to Alex:

> Phase 1 capture layer is on `feat/voice-memo-capture`, PR opened. Build the iOS shortcut on your phone using `docs/voice-memo-shortcut-recipe.md`, then test with a real call. Report back if anything feels slow or wrong. Loops 2-6 (prospects, production logging, escrow extensions, events, market data) come next, but only after this one has 7+ days of real usage so we know the foundation holds.

---

## Self-review checklist (run this before considering the plan done)

- [ ] Every Loop 1 capture requirement from the Operating Leverage Map is implemented (transcription, extraction, structured fields, follow-up tasks, sentiment, intel, source attribution)
- [ ] No tasks reference functions/types/files defined in tasks that haven't run yet (Tasks 3 > 4 > 5 > 6 > 7 > 8 dependency order is correct)
- [ ] Every code block is complete; no `// TODO`, `// implement later`, `// fill this in`
- [ ] Every step has either a code block or a runnable command
- [ ] Verification commands have expected outputs documented
- [ ] Every task ends with a commit
- [ ] Plan does not introduce any of the explicitly out-of-scope items
- [ ] Plan respects the no-test-framework rule
- [ ] Plan respects the OWNER_USER_ID + adminClient + bearer-token patterns from Phase 2.1
- [ ] Plan creates a feature branch off main, not off the current branch
