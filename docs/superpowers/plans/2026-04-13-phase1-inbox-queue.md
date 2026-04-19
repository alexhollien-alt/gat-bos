# Phase 1: Inbox Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Gmail threads that need a reply from Alex into a `/inbox` queue, scored by Claude Haiku against four rules, with no auto-drafting and no folder automation.

**Architecture:** Gmail API (OAuth2 refresh token) is polled every 30 minutes by a Vercel cron hitting `GET /api/inbox/scan`. Claude Haiku scores each unread thread against 4 stacking rules (0-100, threshold >= 35 = needs reply). Qualifying threads are upserted into a new `inbox_items` table (idempotent on `gmail_thread_id`). The `/inbox` route renders the queue. Today View's "Inbox Highlights" placeholder becomes a live count card linking to `/inbox`.

**Tech Stack:** `googleapis` (new), `@anthropic-ai/sdk` (already installed), Supabase (`inbox_items` table), Next.js 14 App Router, TanStack Query v5, `vercel.json` cron, `CRON_SECRET` env var.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260413000100_inbox_items.sql` | Create | inbox_items table + RLS |
| `src/lib/inbox/types.ts` | Create | Zod schemas + TS types for InboxItem |
| `src/lib/inbox/scorer.ts` | Create | Claude Haiku scoring function (prompt-cached system prompt) |
| `src/lib/gmail/client.ts` | Create | Gmail OAuth2 client factory + fetchUnreadThreads |
| `src/app/api/inbox/scan/route.ts` | Create | Cron-triggered fetch + score + upsert |
| `src/app/api/inbox/items/route.ts` | Create | GET pending queue, PATCH dismiss/replied |
| `src/components/today/inbox-summary-card.tsx` | Create | Count card for Today View |
| `src/components/inbox/inbox-row.tsx` | Create | Single queue row |
| `src/app/(app)/inbox/page.tsx` | Create | Server component with SSR prefetch |
| `src/app/(app)/inbox/inbox-client.tsx` | Create | Client component, TanStack Query |
| `vercel.json` | Create | Cron schedule (every 30 min) |
| `src/components/sidebar.tsx` | Modify | Add Inbox nav item after Today |
| `src/app/(app)/today/today-client.tsx` | Modify | Replace mail PlaceholderSection with InboxSummaryCard |

---

## Task 1: Install googleapis and configure env

**Files:**
- Modify: `package.json` (via pnpm)
- Modify: `.env.local`

- [ ] **Step 1: Install googleapis**

```bash
cd ~/crm && pnpm add googleapis
```

Expected: `"googleapis": "^..."` in package.json dependencies. No lockfile errors.

- [ ] **Step 2: One-time OAuth setup (do this once, then store the tokens)**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) -- create or select a project
2. Enable the Gmail API (APIs & Services > Library > Gmail API)
3. Create OAuth 2.0 credentials: Application type = "Web application"
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
4. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
   - Click gear icon -- check "Use your own OAuth credentials" -- enter client ID and secret
5. In Step 1, find "Gmail API v1" -- select scope `https://mail.google.com/` -- click "Authorize APIs"
6. Sign in as Alex's Gmail account -- grant access
7. In Step 2, click "Exchange authorization code for tokens"
8. Copy the `refresh_token` value -- this is `GOOGLE_REFRESH_TOKEN`

- [ ] **Step 3: Add env vars to .env.local**

Append to `~/crm/.env.local`:

```
GOOGLE_CLIENT_ID=<from Google Cloud Console OAuth credentials>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console OAuth credentials>
GOOGLE_REFRESH_TOKEN=<from OAuth Playground Step 2>
GOOGLE_USER_EMAIL=<Alex's Gmail address>
CRON_SECRET=<run: openssl rand -hex 16>
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 2: inbox_items migration

**Files:**
- Create: `supabase/migrations/20260413000100_inbox_items.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- inbox_items: Gmail threads Claude has scored as needing a reply.
-- One row per (user, thread). Idempotent on the unique constraint.

create table if not exists public.inbox_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid()
                                  references auth.users(id),
  gmail_thread_id   text        not null,
  sender_email      text        not null,
  sender_name       text        not null default '',
  subject           text        not null default '(no subject)',
  snippet           text        not null default '',
  received_at       timestamptz not null,
  score             integer     not null default 0
                                  check (score >= 0 and score <= 100),
  matched_rules     jsonb       not null default '[]'::jsonb,
  contact_id        uuid        references public.contacts(id) on delete set null,
  contact_name      text,
  contact_tier      text,
  status            text        not null default 'pending'
                                  check (status in ('pending','replied','dismissed')),
  dismissed_at      timestamptz,
  created_at        timestamptz not null default now(),

  constraint inbox_items_user_thread_unique unique (user_id, gmail_thread_id)
);

create index if not exists inbox_items_user_status_received_idx
  on public.inbox_items (user_id, status, received_at desc)
  where dismissed_at is null;

alter table public.inbox_items enable row level security;

drop policy if exists inbox_items_owner on public.inbox_items;
create policy inbox_items_owner on public.inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Run in Supabase SQL editor**

Paste into Supabase dashboard > SQL Editor > Run.
Expected: "Success. No rows returned."

---

## Task 3: Types

**Files:**
- Create: `src/lib/inbox/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/lib/inbox/types.ts
import { z } from "zod";

export const InboxItemStatus = z.enum(["pending", "replied", "dismissed"]);

export const InboxItemRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  gmail_thread_id: z.string(),
  sender_email: z.string(),
  sender_name: z.string(),
  subject: z.string(),
  snippet: z.string(),
  received_at: z.string(),
  score: z.number().int().min(0).max(100),
  matched_rules: z.array(z.string()),
  contact_id: z.string().uuid().nullable(),
  contact_name: z.string().nullable(),
  contact_tier: z.string().nullable(),
  status: InboxItemStatus,
  dismissed_at: z.string().nullable(),
  created_at: z.string(),
});
export type InboxItem = z.infer<typeof InboxItemRow>;

export const InboxItemUpdate = z.object({
  status: InboxItemStatus,
});

export const ScanResult = z.object({
  scanned: z.number(),
  surfaced: z.number(),
  skipped: z.number(),
});
export type ScanResultT = z.infer<typeof ScanResult>;

export interface ThreadScore {
  score: number;
  matched_rules: string[];
  needs_reply: boolean;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 4: Gmail client factory

**Files:**
- Create: `src/lib/gmail/client.ts`

- [ ] **Step 1: Write the Gmail client factory**

```ts
// src/lib/gmail/client.ts
import { google } from "googleapis";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Gmail OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export interface GmailThread {
  threadId: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  snippet: string;
  receivedAt: Date;
}

export async function fetchUnreadThreads(maxResults = 50): Promise<GmailThread[]> {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });

  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: "in:inbox is:unread newer_than:2d",
    maxResults,
  });

  const threads = listRes.data.threads ?? [];
  if (threads.length === 0) return [];

  const results: GmailThread[] = [];

  for (const thread of threads) {
    if (!thread.id) continue;

    const detail = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const firstMessage = detail.data.messages?.[0];
    if (!firstMessage) continue;

    const headers = firstMessage.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const fromRaw = getHeader("From");
    const subject = getHeader("Subject") || "(no subject)";
    const dateRaw = getHeader("Date");

    // Parse "Name <email@domain>" or bare "email@domain"
    const emailMatch = fromRaw.match(/<([^>]+)>/);
    const senderEmail = emailMatch ? emailMatch[1].trim() : fromRaw.trim();
    const senderName = emailMatch
      ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "")
      : senderEmail;

    const snippet = detail.data.snippet ?? "";
    const receivedAt = dateRaw ? new Date(dateRaw) : new Date();

    results.push({ threadId: thread.id, subject, senderEmail, senderName, snippet, receivedAt });
  }

  return results;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors. (`googleapis` ships its own types -- no `@types/googleapis` needed.)

---

## Task 5: Scorer

**Files:**
- Create: `src/lib/inbox/scorer.ts`

- [ ] **Step 1: Write the scoring function**

```ts
// src/lib/inbox/scorer.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ThreadScore } from "./types";

const anthropic = new Anthropic();

// System prompt is prompt-cached (ephemeral) -- one cache write per cold start,
// then cache hits for every subsequent thread scored in the same scan run.
const SYSTEM_PROMPT = `You are an email triage assistant for Alex Hollien, a title sales executive. Your only job is to decide whether an email thread needs a reply from Alex.

Score the thread against these four rules. Rules can stack -- add points for each rule that fires:

- "direct_question" (+40): Alex is directly asked a question ("?", "can you", "do you", "would you", "what do you think", "let me know if", "please advise")
- "deliverable_request" (+35): A request for a deliverable, scheduling, or decision ("can you send", "need a flyer", "need you to decide", "schedule a time", "can we meet", "when works for you", "need your approval")
- "escalation_language" (+30 base, +10 if Tier A contact, +5 if Tier B contact): Urgent or time-sensitive language from a known contact ("urgent", "ASAP", "time sensitive", "need this today", "closing tomorrow", "deal falling through", "end of day")
- "cold_contact" (+25): Sender is not a known contact and this appears to be a genuine first outreach (not spam, not a newsletter, not an automated notification)

Threshold: score >= 35 means needs_reply = true.

DO NOT surface: newsletters, marketing emails, automated notifications, order/shipping confirmations, receipts, LinkedIn/Zillow/Realtor.com alerts, calendar invite acceptances without a message body.

Respond ONLY with a JSON object. No explanation. No markdown. Just the object:
{"score": <integer 0-100>, "matched_rules": [<names of rules that fired>], "needs_reply": <true|false>}`;

export async function scoreThread(params: {
  subject: string;
  senderEmail: string;
  senderName: string;
  snippet: string;
  isKnownContact: boolean;
  contactTier?: string | null;
}): Promise<ThreadScore> {
  const { subject, senderEmail, senderName, snippet, isKnownContact, contactTier } = params;

  const userContent = [
    `From: ${senderName} <${senderEmail}>`,
    `Subject: ${subject}`,
    `Known contact: ${isKnownContact ? `Yes, Tier ${contactTier ?? "unknown"}` : "No"}`,
    `Snippet: ${snippet.slice(0, 400)}`,
  ].join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    const parsed = JSON.parse(text);
    return {
      score: typeof parsed.score === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.score)))
        : 0,
      matched_rules: Array.isArray(parsed.matched_rules) ? parsed.matched_rules : [],
      needs_reply: typeof parsed.needs_reply === "boolean" ? parsed.needs_reply : false,
    };
  } catch {
    // Scoring failure = silent skip, not a crash. Thread will be re-evaluated next scan.
    return { score: 0, matched_rules: [], needs_reply: false };
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 6: Scan API route

**Files:**
- Create: `src/app/api/inbox/scan/route.ts`

Note: `middleware.ts` line 37 already bypasses all `/api/` routes from session auth. The scan route handles its own auth via `CRON_SECRET` header verification, matching the pattern used by `api/webhooks/resend/route.ts`.

- [ ] **Step 1: Write the scan route**

```ts
// src/app/api/inbox/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchUnreadThreads } from "@/lib/gmail/client";
import { scoreThread } from "@/lib/inbox/scorer";

// Service-role client -- bypasses RLS so the cron can write for any user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = process.env.GOOGLE_USER_EMAIL;
  if (!userEmail) {
    return NextResponse.json({ error: "GOOGLE_USER_EMAIL not configured" }, { status: 500 });
  }

  // Resolve Alex's Supabase user ID from his email
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const user = authUsers?.users?.find((u) => u.email === userEmail);
  if (!user) {
    return NextResponse.json(
      { error: `No Supabase user found for ${userEmail}` },
      { status: 500 }
    );
  }

  let threads;
  try {
    threads = await fetchUnreadThreads(50);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (threads.length === 0) {
    return NextResponse.json({ scanned: 0, surfaced: 0, skipped: 0 });
  }

  // Batch-check which sender emails match known contacts
  const senderEmails = [...new Set(threads.map((t) => t.senderEmail.toLowerCase()))];
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, tier")
    .in("email", senderEmails)
    .is("deleted_at", null);

  const contactByEmail = new Map(
    (contacts ?? []).map((c) => [c.email?.toLowerCase() ?? "", c])
  );

  // Skip threads already scored -- idempotent, never re-score
  const threadIds = threads.map((t) => t.threadId);
  const { data: existing } = await supabase
    .from("inbox_items")
    .select("gmail_thread_id")
    .eq("user_id", user.id)
    .in("gmail_thread_id", threadIds);

  const existingIds = new Set((existing ?? []).map((r) => r.gmail_thread_id));

  let surfaced = 0;
  let skipped = 0;

  for (const thread of threads) {
    if (existingIds.has(thread.threadId)) {
      skipped++;
      continue;
    }

    const contact = contactByEmail.get(thread.senderEmail.toLowerCase());

    const result = await scoreThread({
      subject: thread.subject,
      senderEmail: thread.senderEmail,
      senderName: thread.senderName,
      snippet: thread.snippet,
      isKnownContact: !!contact,
      contactTier: contact?.tier ?? null,
    });

    if (!result.needs_reply) continue;

    await supabase.from("inbox_items").insert({
      user_id: user.id,
      gmail_thread_id: thread.threadId,
      sender_email: thread.senderEmail,
      sender_name: thread.senderName,
      subject: thread.subject,
      snippet: thread.snippet,
      received_at: thread.receivedAt.toISOString(),
      score: result.score,
      matched_rules: result.matched_rules,
      contact_id: contact?.id ?? null,
      contact_name: contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : null,
      contact_tier: contact?.tier ?? null,
      status: "pending",
    });

    surfaced++;
  }

  return NextResponse.json({ scanned: threads.length, surfaced, skipped });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 7: Items API route

**Files:**
- Create: `src/app/api/inbox/items/route.ts`

- [ ] **Step 1: Write the items route**

```ts
// src/app/api/inbox/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InboxItemUpdate } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", status)
    .order("score", { ascending: false })
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = InboxItemUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "dismissed") {
    updates.dismissed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("inbox_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 8: Vercel cron config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/inbox/scan",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Fires every 30 minutes. Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` using the `CRON_SECRET` env var you set in Step 1.

- [ ] **Step 2: Add all Gmail + cron env vars to Vercel**

In Vercel dashboard > Project Settings > Environment Variables, add:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_USER_EMAIL`
- `CRON_SECRET` (same value as in `.env.local`)

---

## Task 9: Inbox UI

**Files:**
- Create: `src/components/inbox/inbox-row.tsx`
- Create: `src/app/(app)/inbox/inbox-client.tsx`
- Create: `src/app/(app)/inbox/page.tsx`

- [ ] **Step 1: Create inbox-row component**

```tsx
// src/components/inbox/inbox-row.tsx
"use client";

import type { InboxItem } from "@/lib/inbox/types";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const RULE_LABELS: Record<string, string> = {
  direct_question: "Question",
  deliverable_request: "Request",
  escalation_language: "Urgent",
  cold_contact: "New contact",
};

const TIER_COLORS: Record<string, string> = {
  A: "text-red-500",
  B: "text-orange-500",
  C: "text-muted-foreground",
  P: "text-muted-foreground",
};

interface InboxRowProps {
  item: InboxItem;
  onDismiss: (id: string) => void;
  onMarkReplied: (id: string) => void;
  isMutating: boolean;
}

export function InboxRow({ item, onDismiss, onMarkReplied, isMutating }: InboxRowProps) {
  return (
    <div
      role="listitem"
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border border-border bg-card",
        "hover:border-foreground/20 transition-colors",
        isMutating && "opacity-50 pointer-events-none"
      )}
    >
      {/* Score badge */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
        <span className="text-xs font-mono font-medium text-foreground">{item.score}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {item.sender_name || item.sender_email}
          </span>
          {item.contact_tier && (
            <span className={cn("text-xs font-mono", TIER_COLORS[item.contact_tier] ?? "text-muted-foreground")}>
              {item.contact_tier}
            </span>
          )}
          {!item.contact_id && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Unknown
            </span>
          )}
        </div>
        <p className="text-sm text-foreground truncate mb-1">{item.subject}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.snippet}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {item.matched_rules.map((rule) => (
            <span
              key={rule}
              className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium"
            >
              {RULE_LABELS[rule] ?? rule}
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground ml-auto font-mono">
            {formatDistanceToNow(new Date(item.received_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1">
        <button
          onClick={() => onMarkReplied(item.id)}
          title="Mark replied"
          aria-label="Mark as replied"
          className="p-1.5 rounded text-muted-foreground hover:text-green-500 hover:bg-secondary transition-colors"
        >
          <CheckCircle className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDismiss(item.id)}
          title="Dismiss"
          aria-label="Dismiss thread"
          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-secondary transition-colors"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create inbox-client component**

```tsx
// src/app/(app)/inbox/inbox-client.tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InboxItem } from "@/lib/inbox/types";
import { InboxRow } from "@/components/inbox/inbox-row";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

async function fetchPendingItems(): Promise<InboxItem[]> {
  const res = await fetch("/api/inbox/items?status=pending&limit=50");
  if (!res.ok) throw new Error("Failed to fetch inbox items");
  const json = await res.json();
  return json.items ?? [];
}

async function patchItem(id: string, status: "replied" | "dismissed") {
  const res = await fetch(`/api/inbox/items?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update item");
}

export function InboxClient() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, dataUpdatedAt } = useQuery<InboxItem[]>({
    queryKey: ["inbox", "items", "pending"],
    queryFn: fetchPendingItems,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "replied" | "dismissed" }) =>
      patchItem(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
    },
  });

  const count = items.length;
  const updatedLabel = dataUpdatedAt
    ? `updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : "";

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count === 0
              ? "No threads need a reply"
              : `${count} thread${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} a reply`}
            {updatedLabel && ` · ${updatedLabel}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["inbox", "items"] })}
          className="gap-2"
          aria-label="Refresh inbox"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3" aria-label="Loading inbox">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && count === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Queue is clear</p>
          <p className="text-xs text-muted-foreground mt-1">
            Next scan runs automatically every 30 minutes
          </p>
        </div>
      )}

      {!isLoading && count > 0 && (
        <div className="space-y-2" role="list" aria-label="Threads needing a reply">
          {items.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onDismiss={(id) => mutation.mutate({ id, status: "dismissed" })}
              onMarkReplied={(id) => mutation.mutate({ id, status: "replied" })}
              isMutating={mutation.isPending && mutation.variables?.id === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create inbox page (server component)**

```tsx
// src/app/(app)/inbox/page.tsx
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "./inbox-client";

export const metadata = { title: "Inbox | GAT-BOS" };

export default async function InboxPage() {
  const queryClient = new QueryClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await queryClient.prefetchQuery({
      queryKey: ["inbox", "items", "pending"],
      queryFn: async () => {
        const { data } = await supabase
          .from("inbox_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("score", { ascending: false })
          .order("received_at", { ascending: false })
          .limit(50);
        return data ?? [];
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InboxClient />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 4: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 10: Nav + Today View wiring

**Files:**
- Modify: `src/components/sidebar.tsx`
- Create: `src/components/today/inbox-summary-card.tsx`
- Modify: `src/app/(app)/today/today-client.tsx`

- [ ] **Step 1: Add Inbox to sidebar**

In `src/components/sidebar.tsx`, make two edits:

Add `Inbox` to the lucide-react import (line 20):
```ts
// Before:
import {
  LayoutDashboard, Sun, Users, CheckSquare, Megaphone,
  Clock, Printer, TrendingUp, LogOut, Search, Ticket, Zap, BarChart3,
} from "lucide-react";

// After:
import {
  LayoutDashboard, Sun, Users, CheckSquare, Megaphone,
  Clock, Printer, TrendingUp, LogOut, Search, Ticket, Zap, BarChart3, Inbox,
} from "lucide-react";
```

Add Inbox nav item after Today (line 26):
```ts
// Before:
const navItems = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

// After:
const navItems = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
```

- [ ] **Step 2: Create InboxSummaryCard component**

```tsx
// src/components/today/inbox-summary-card.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import type { InboxItem } from "@/lib/inbox/types";
import Link from "next/link";

async function fetchPendingCount(): Promise<InboxItem[]> {
  const res = await fetch("/api/inbox/items?status=pending&limit=50");
  if (!res.ok) return [];
  const json = await res.json();
  return json.items ?? [];
}

export function InboxSummaryCard() {
  const { data: items = [] } = useQuery<InboxItem[]>({
    queryKey: ["inbox", "items", "pending"],
    queryFn: fetchPendingCount,
    staleTime: 60_000,
  });

  const count = items.length;
  const label = count === 0
    ? "Inbox clear"
    : `${count}${count === 50 ? "+" : ""} thread${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} a reply`;

  return (
    <Link
      href="/inbox"
      className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
      aria-label={`Inbox: ${label}`}
    >
      <p className={count > 0 ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
        {label}
      </p>
    </Link>
  );
}
```

- [ ] **Step 3: Replace mail PlaceholderSection in today-client.tsx**

In `src/app/(app)/today/today-client.tsx`:

Add import at the top:
```ts
import { InboxSummaryCard } from "@/components/today/inbox-summary-card";
import { Inbox } from "lucide-react";
```

Replace lines 98-103 (the "Inbox Highlights" PlaceholderSection):
```tsx
// Before:
{/* Section D: Inbox Highlights -- placeholder until Gmail sync */}
<PlaceholderSection
  title="Inbox Highlights"
  description="Email triage will appear here once Gmail sync is connected."
  icon="mail"
/>

// After:
{/* Section D: Inbox Highlights -- live once Gmail sync is connected */}
<section role="region" aria-label="Inbox">
  <div className="flex items-center gap-3 mb-3">
    <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
      Inbox
    </h2>
  </div>
  <InboxSummaryCard />
</section>
```

- [ ] **Step 4: Verify typecheck**

```bash
cd ~/crm && pnpm typecheck
```

Expected: 0 errors.

---

## Task 11: Smoke test + commit

- [ ] **Step 1: Start dev server**

```bash
cd ~/crm && pnpm dev
```

Expected: compiled on port 3000 or 3001, 0 errors.

- [ ] **Step 2: Verify /inbox loads**

Open `http://localhost:3000/inbox` (or 3001).
Expected: Page loads. "Inbox" active in sidebar. Queue shows empty state: "Queue is clear / Next scan runs automatically every 30 minutes."

- [ ] **Step 3: Verify Today View shows Inbox section**

Open `http://localhost:3000/today`.
Expected: "Inbox" section visible where the placeholder was. Shows "Inbox clear" with a link to /inbox.

- [ ] **Step 4: Smoke-test the scan route auth (no Gmail creds needed)**

```bash
# Should return 401
curl -s http://localhost:3000/api/inbox/scan | jq .

# Should return 500 with Gmail error (auth passed, Gmail env vars not set yet) or full scan result
curl -s http://localhost:3000/api/inbox/scan \
  -H "Authorization: Bearer $(grep '^CRON_SECRET' ~/crm/.env.local | cut -d= -f2)" | jq .
```

Expected first curl: `{"error":"Unauthorized"}`
Expected second curl: `{"error":"Missing Gmail OAuth env vars: ..."}` until OAuth is configured, then `{"scanned": N, "surfaced": M, "skipped": 0}` once it is.

- [ ] **Step 5: Final typecheck + build**

```bash
cd ~/crm && pnpm typecheck && pnpm build
```

Expected: 0 type errors, successful production build.

- [ ] **Step 6: Commit**

```bash
cd ~/crm && git add \
  supabase/migrations/20260413000100_inbox_items.sql \
  src/lib/inbox/types.ts \
  src/lib/inbox/scorer.ts \
  src/lib/gmail/client.ts \
  "src/app/api/inbox/scan/route.ts" \
  "src/app/api/inbox/items/route.ts" \
  "src/app/(app)/inbox/page.tsx" \
  "src/app/(app)/inbox/inbox-client.tsx" \
  src/components/inbox/inbox-row.tsx \
  src/components/today/inbox-summary-card.tsx \
  vercel.json \
  src/components/sidebar.tsx \
  "src/app/(app)/today/today-client.tsx" \
  package.json pnpm-lock.yaml

git commit -m "feat: Phase 1 inbox queue -- Gmail scan, Claude Haiku scoring, /inbox UI"
```

---

## Self-Review Against v2 Spec (Decision 2)

| Requirement | Task |
|---|---|
| Claude reads incoming Gmail threads | Task 4 (`fetchUnreadThreads`) + Task 5 (`scoreThread`) |
| Surfaces only threads needing a reply | Task 6 (scan route, threshold >= 35) |
| No auto-drafting | No draft creation anywhere |
| No categorization beyond needs-reply / does-not | Binary: surfaced to `inbox_items` or silently skipped |
| No folder automation | No Gmail label/archive calls |
| Direct question rule | Task 5 system prompt |
| Deliverable/scheduling/decision rule | Task 5 system prompt |
| Escalation from represented agent | Task 5 system prompt + tier modifier logic |
| New cold contact rule | Task 5 system prompt |
| Idempotent -- no double-scoring | Task 6 `existingIds` check before scoring |
| No hard deletes | Dismiss via `status + dismissed_at`, no DELETE statements |

All spec requirements covered. No gaps.
