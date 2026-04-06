# CRM Phase 5: Operations Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four operational features -- Action Queue, Ticket Workbench, Analytics Dashboard, and Resend Webhook integration -- to transform GAT-BOS from a contact database into a daily operations tool.

**Architecture:** All features are new pages or API routes in the existing Next.js 14 app. Data fetching uses client-side Supabase queries (matching existing pattern). No new database tables -- all features query existing Phase 1-4 schema. Analytics uses recharts for visualization. Resend webhook is a single API route that updates contact temperature and logs interactions.

**Tech Stack:** Next.js 14 App Router, Supabase (client-side), TypeScript, Tailwind CSS, shadcn/ui, recharts (new dependency), date-fns, lucide-react

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/(app)/actions/page.tsx` | Action Queue -- unified prioritized feed of follow-ups, tasks, stale contacts |
| `src/lib/action-scoring.ts` | Priority scoring logic for action items |
| `src/app/(app)/analytics/page.tsx` | Analytics dashboard with funnel, velocity, throughput charts |
| `src/app/api/webhooks/resend/route.ts` | Resend webhook receiver -- updates temperature, logs interactions |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(app)/tickets/page.tsx` | Rebuild as kanban workbench with columns, context panel, metrics |
| `src/lib/types.ts` | Add ActionItem, AnalyticsData, ResendWebhookPayload types |
| `src/app/(app)/layout.tsx` | Add "Actions" nav item to sidebar |

---

## Phase 1: Action Queue

### Task 1: Add types and scoring logic

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/action-scoring.ts`

- [ ] **Step 1: Add ActionItem type to types.ts**

Append to `src/lib/types.ts`:

```typescript
// ---------------------
// Action Queue
// ---------------------

export type ActionItemType = "overdue_followup" | "due_followup" | "overdue_task" | "stale_contact" | "due_task";

export interface ActionItem {
  id: string;
  type: ActionItemType;
  priority: number; // 0-100, higher = do first
  contactId: string;
  contactName: string;
  contactTier: ContactTier | null;
  contactTemperature: number;
  contactCompany: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  title: string;
  subtitle: string;
  dueDate: string | null;
  daysOverdue: number;
  sourceId: string; // follow_up.id, task.id, or contact.id
  sourceTable: "follow_ups" | "tasks" | "contacts";
}
```

- [ ] **Step 2: Create action-scoring.ts**

```typescript
// src/lib/action-scoring.ts
import { ActionItem, ActionItemType, ContactTier, FollowUp, Task, Contact } from "./types";
import { differenceInDays, parseISO, startOfToday } from "date-fns";

const TIER_WEIGHT: Record<string, number> = { A: 40, B: 25, C: 10, P: 5 };
const TYPE_WEIGHT: Record<ActionItemType, number> = {
  overdue_followup: 50,
  due_followup: 35,
  overdue_task: 30,
  stale_contact: 20,
  due_task: 15,
};
const STALE_THRESHOLDS: Record<string, number> = { A: 7, B: 14, C: 30, P: 60 };

function tierScore(tier: ContactTier | null): number {
  return TIER_WEIGHT[tier || "P"] || 5;
}

export function scoreAction(item: Omit<ActionItem, "priority">): number {
  const base = TYPE_WEIGHT[item.type] || 10;
  const tier = tierScore(item.contactTier);
  const overdue = Math.min(item.daysOverdue * 2, 20); // cap at +20
  const temp = Math.round(item.contactTemperature / 10); // 0-10 bonus
  return Math.min(base + tier + overdue + temp, 100);
}

export function buildFollowUpActions(
  followUps: (FollowUp & { contacts: Pick<Contact, "id" | "first_name" | "last_name" | "tier" | "temperature" | "company" | "phone" | "email"> })[],
): ActionItem[] {
  const today = startOfToday();
  return followUps.map((fu) => {
    const due = parseISO(fu.due_date);
    const daysOverdue = differenceInDays(today, due);
    const isOverdue = daysOverdue > 0;
    const item: Omit<ActionItem, "priority"> = {
      id: `fu-${fu.id}`,
      type: isOverdue ? "overdue_followup" : "due_followup",
      contactId: fu.contact_id,
      contactName: `${fu.contacts.first_name} ${fu.contacts.last_name}`,
      contactTier: fu.contacts.tier as ContactTier | null,
      contactTemperature: fu.contacts.temperature || 0,
      contactCompany: fu.contacts.company,
      contactPhone: fu.contacts.phone,
      contactEmail: fu.contacts.email,
      title: fu.reason,
      subtitle: isOverdue ? `${daysOverdue}d overdue` : "Due today",
      dueDate: fu.due_date,
      daysOverdue: Math.max(daysOverdue, 0),
      sourceId: fu.id,
      sourceTable: "follow_ups",
    };
    return { ...item, priority: scoreAction(item) };
  });
}

export function buildTaskActions(
  tasks: (Task & { contacts: Pick<Contact, "id" | "first_name" | "last_name" | "tier" | "temperature" | "company" | "phone" | "email"> | null })[],
): ActionItem[] {
  const today = startOfToday();
  return tasks
    .filter((t) => t.contacts) // only tasks with contacts
    .map((t) => {
      const due = t.due_date ? parseISO(t.due_date) : today;
      const daysOverdue = differenceInDays(today, due);
      const isOverdue = daysOverdue > 0;
      const c = t.contacts!;
      const item: Omit<ActionItem, "priority"> = {
        id: `task-${t.id}`,
        type: isOverdue ? "overdue_task" : "due_task",
        contactId: c.id,
        contactName: `${c.first_name} ${c.last_name}`,
        contactTier: c.tier as ContactTier | null,
        contactTemperature: c.temperature || 0,
        contactCompany: c.company,
        contactPhone: c.phone,
        contactEmail: c.email,
        title: t.title,
        subtitle: isOverdue ? `${daysOverdue}d overdue` : "Due today",
        dueDate: t.due_date,
        daysOverdue: Math.max(daysOverdue, 0),
        sourceId: t.id,
        sourceTable: "tasks",
      };
      return { ...item, priority: scoreAction(item) };
    });
}

export function buildStaleActions(
  contacts: Contact[],
  lastInteractions: Record<string, string>, // contactId -> last occurred_at ISO
): ActionItem[] {
  const today = startOfToday();
  return contacts
    .filter((c) => {
      const threshold = STALE_THRESHOLDS[c.tier || "P"] || 60;
      const lastTouch = lastInteractions[c.id];
      if (!lastTouch) return true; // never contacted = stale
      return differenceInDays(today, parseISO(lastTouch)) >= threshold;
    })
    .map((c) => {
      const lastTouch = lastInteractions[c.id];
      const daysSince = lastTouch ? differenceInDays(today, parseISO(lastTouch)) : 999;
      const threshold = STALE_THRESHOLDS[c.tier || "P"] || 60;
      const item: Omit<ActionItem, "priority"> = {
        id: `stale-${c.id}`,
        type: "stale_contact",
        contactId: c.id,
        contactName: `${c.first_name} ${c.last_name}`,
        contactTier: c.tier as ContactTier | null,
        contactTemperature: c.temperature || 0,
        contactCompany: c.company,
        contactPhone: c.phone,
        contactEmail: c.email,
        title: `No contact in ${daysSince} days`,
        subtitle: `${c.tier || "P"}-tier threshold: ${threshold}d`,
        dueDate: null,
        daysOverdue: daysSince - threshold,
        sourceId: c.id,
        sourceTable: "contacts",
      };
      return { ...item, priority: scoreAction(item) };
    });
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd ~/crm && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to action-scoring.ts or types.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/action-scoring.ts
git commit -m "feat: add action item types and priority scoring logic"
```

---

### Task 2: Build the Action Queue page

**Files:**
- Create: `src/app/(app)/actions/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (add nav link)

- [ ] **Step 1: Create the actions page**

Create `src/app/(app)/actions/page.tsx` with:
- Fetch pending follow-ups (with contact join including tier, temperature, company, phone, email)
- Fetch pending tasks with due_date <= today+7 (with contact join)
- Fetch contacts with tier A/B/C that are stale (using latest interaction per contact)
- Merge all into ActionItem[], sort by priority desc
- Render as a vertical feed with action buttons

The page should:
- Use `createClient()` from `@/lib/supabase/client`
- Fetch in a single `useCallback` with parallel queries
- Show a count badge at top: "12 actions today"
- Each card shows: tier badge, contact name, company, action reason, days info
- Three action buttons per card: Phone (log call), Email (log email), Skip (snooze 1 day)
- Completing an action: update follow_up/task status, insert interaction, remove from list
- Use lucide icons: Phone, Mail, Clock, AlertTriangle, User, ChevronRight

Key queries:
```typescript
// Follow-ups: pending, due <= today+7, with contact details
const { data: followUps } = await supabase
  .from("follow_ups")
  .select("*, contacts(id, first_name, last_name, tier, temperature, company, phone, email)")
  .eq("status", "pending")
  .lte("due_date", addDays(new Date(), 7).toISOString().split("T")[0])
  .order("due_date");

// Tasks: pending/in_progress with due dates, contact-linked only
const { data: tasks } = await supabase
  .from("tasks")
  .select("*, contacts(id, first_name, last_name, tier, temperature, company, phone, email)")
  .in("status", ["pending", "in_progress"])
  .not("contact_id", "is", null)
  .not("due_date", "is", null)
  .lte("due_date", addDays(new Date(), 7).toISOString().split("T")[0])
  .order("due_date");

// Stale contacts: get all tiered contacts + their latest interaction
const { data: contacts } = await supabase
  .from("contacts")
  .select("*")
  .not("tier", "is", null)
  .is("deleted_at", null)
  .in("relationship", ["warm", "active_partner", "advocate"]);

const { data: interactions } = await supabase
  .from("interactions")
  .select("contact_id, occurred_at")
  .order("occurred_at", { ascending: false });
// Dedupe to latest per contact in JS
```

Action handlers:
```typescript
// "Called" action
async function handleCalled(item: ActionItem) {
  // 1. Log interaction
  await supabase.from("interactions").insert({
    user_id: userId,
    contact_id: item.contactId,
    type: "call",
    summary: `Follow-up call: ${item.title}`,
    direction: "outbound",
  });
  // 2. Complete the source record
  if (item.sourceTable === "follow_ups") {
    await supabase.from("follow_ups").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", item.sourceId);
  } else if (item.sourceTable === "tasks") {
    await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", item.sourceId);
  }
  // 3. Bump temperature +5
  await supabase.from("contacts").update({ temperature: Math.min(item.contactTemperature + 5, 100) }).eq("id", item.contactId);
  // 4. Refresh
  fetchActions();
}

// "Skipped" action -- push follow-up to tomorrow
async function handleSkip(item: ActionItem) {
  const tomorrow = addDays(new Date(), 1).toISOString().split("T")[0];
  if (item.sourceTable === "follow_ups") {
    await supabase.from("follow_ups").update({ due_date: tomorrow }).eq("id", item.sourceId);
  } else if (item.sourceTable === "tasks") {
    await supabase.from("tasks").update({ due_date: tomorrow }).eq("id", item.sourceId);
  }
  // For stale contacts, create a follow-up for tomorrow
  if (item.sourceTable === "contacts") {
    await supabase.from("follow_ups").insert({
      user_id: userId,
      contact_id: item.contactId,
      reason: "Reconnect -- stale contact",
      due_date: tomorrow,
    });
  }
  fetchActions();
}
```

UI layout: single column, max-w-2xl, each action is a card with left tier badge + content + right action buttons.

Tier badge colors:
- A: `bg-[#b31a35] text-white`
- B: `bg-[#003087] text-white`
- C: `bg-[#666] text-white`
- P: `bg-[#e8e8e8] text-[#666]`

- [ ] **Step 2: Add "Actions" to sidebar navigation**

In `src/app/(app)/layout.tsx`, find the nav items array and add:
```typescript
{ href: "/actions", icon: Zap, label: "Actions" }
```
Import `Zap` from lucide-react. Place it as the second nav item (after Dashboard).

- [ ] **Step 3: Verify build**

Run: `cd ~/crm && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds, `/actions` appears in route list

- [ ] **Step 4: Visual verification**

Open `http://localhost:3000/actions` and verify:
- Page loads without errors
- Actions appear sorted by priority (if data exists)
- Tier badges render with correct colors
- Action buttons are visible and clickable

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/actions/page.tsx src/app/(app)/layout.tsx
git commit -m "feat: add Action Queue page with prioritized contact feed"
```

---

## Phase 2: Ticket Workbench

### Task 3: Rebuild tickets page as kanban workbench

**Files:**
- Modify: `src/app/(app)/tickets/page.tsx`

- [ ] **Step 1: Read current tickets page**

Read `src/app/(app)/tickets/page.tsx` to understand existing structure before modifying.

- [ ] **Step 2: Rebuild as kanban columns**

Replace the current list view with a 4-column kanban layout:

Columns: `submitted` | `in_production` | `complete` | `draft`

Layout structure:
```
┌──────────────────────────────────────────────────────┐
│  Metrics Bar: [Pending: 5] [This Week: 3] [Avg: 2d] │
├─────────┬─────────────┬──────────┬───────────────────┤
│ NEW (5) │ IN PROD (2) │ DONE (8) │ DRAFTS (1)        │
│ ┌─────┐ │ ┌─────────┐ │ ┌──────┐ │ ┌───────────────┐ │
│ │card │ │ │  card   │ │ │ card │ │ │     card      │ │
│ └─────┘ │ └─────────┘ │ └──────┘ │ └───────────────┘ │
│ ┌─────┐ │             │ ┌──────┐ │                   │
│ │card │ │             │ │ card │ │                   │
│ └─────┘ │             │ └──────┘ │                   │
└─────────┴─────────────┴──────────┴───────────────────┘
```

Each ticket card shows:
- Rush badge (if priority === "rush")
- Title
- Agent name (from contacts join) + tier badge
- Product types (from items join) as small pills
- Submitted date
- Status change dropdown (Select component)
- Click to expand: show listing_data, agent contact info, brand colors

Metrics bar at top:
- Pending count (submitted status)
- Completed this week
- Average turnaround (days from submitted_at to completed_at, last 30 days)

Data query:
```typescript
const { data } = await supabase
  .from("material_requests")
  .select("*, contacts(id, first_name, last_name, company, tier, phone, email, brand_colors, palette), items:material_request_items(*)")
  .is("deleted_at", null)
  .order("created_at", { ascending: false });
```

Group into columns by status in JS. Status change updates optimistically then syncs.

- [ ] **Step 3: Add expandable agent context**

When a ticket card is clicked, expand it to show:
- Agent headshot (if headshot_url exists)
- Full contact info (phone, email, brokerage)
- Brand colors as swatches (from brand_colors JSONB)
- Palette name
- Past deliverables count (query material_requests completed for same contact)
- Link to contact detail page

- [ ] **Step 4: Verify build and visual check**

Run: `cd ~/crm && npx next build --no-lint 2>&1 | tail -5`
Open `http://localhost:3000/tickets` and verify kanban layout renders.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/tickets/page.tsx
git commit -m "feat: rebuild tickets as kanban workbench with metrics and agent context"
```

---

## Phase 3: Analytics Dashboard

### Task 4: Install recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

Run: `cd ~/crm && pnpm add recharts`

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add recharts for analytics charts"
```

---

### Task 5: Build analytics page

**Files:**
- Create: `src/app/(app)/analytics/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (add nav link)

- [ ] **Step 1: Create analytics page with four widget sections**

Create `src/app/(app)/analytics/page.tsx` with four sections:

**Section 1: Agent Acquisition Funnel** (horizontal bar or funnel chart)
- Query contacts grouped by lead_status
- Show: prospect → contacted → qualified → nurturing → converted
- Calculate conversion rate between each stage

```typescript
const { data: contacts } = await supabase
  .from("contacts")
  .select("lead_status")
  .is("deleted_at", null);
// Group by lead_status, count each
```

**Section 2: Pipeline Health** (stacked bar chart)
- Query opportunities grouped by stage
- Show total value per stage (sum of sale_price)
- Show count per stage

```typescript
const { data: opps } = await supabase
  .from("opportunities")
  .select("stage, sale_price");
// Group by stage, sum sale_price
```

**Section 3: Relationship Velocity** (line chart over time)
- Query contacts with temperature, grouped by created month
- Show average temperature trend over last 6 months
- Show stale contact count trend (requires last interaction date)

```typescript
const { data: contacts } = await supabase
  .from("contacts")
  .select("tier, temperature, relationship")
  .is("deleted_at", null);
// Aggregate: count per tier, avg temperature per relationship
```

**Section 4: Production Throughput** (bar chart)
- Query material_requests completed in last 90 days
- Group by week
- Show count per week + average turnaround

```typescript
const { data: completed } = await supabase
  .from("material_requests")
  .select("submitted_at, completed_at, status")
  .eq("status", "complete")
  .gte("completed_at", subDays(new Date(), 90).toISOString());
// Group by ISO week, calculate avg days between submitted_at and completed_at
```

Layout: 2x2 grid on desktop, stacked on mobile. Each widget is a card with title + chart.

Use recharts components:
```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
```

Chart colors: use brand tokens -- `#b31a35` (primary), `#003087` (secondary), `#666` (tertiary).

- [ ] **Step 2: Add "Analytics" to sidebar**

In `src/app/(app)/layout.tsx`, add:
```typescript
{ href: "/analytics", icon: BarChart3, label: "Analytics" }
```
Import `BarChart3` from lucide-react.

- [ ] **Step 3: Verify build and visual check**

Run: `cd ~/crm && npx next build --no-lint 2>&1 | tail -5`
Open `http://localhost:3000/analytics` and verify charts render with data.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/analytics/page.tsx src/app/(app)/layout.tsx
git commit -m "feat: add Analytics dashboard with funnel, pipeline, velocity, and throughput charts"
```

---

## Phase 4: Resend Webhook Integration

### Task 6: Build webhook receiver

**Files:**
- Create: `src/app/api/webhooks/resend/route.ts`
- Modify: `src/lib/types.ts` (add webhook types)

- [ ] **Step 1: Add Resend webhook types**

Append to `src/lib/types.ts`:

```typescript
// ---------------------
// Resend Webhooks
// ---------------------

export interface ResendWebhookPayload {
  type: "email.sent" | "email.delivered" | "email.opened" | "email.clicked" | "email.bounced" | "email.complained";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: { link: string };
  };
}
```

- [ ] **Step 2: Create webhook route**

Create `src/app/api/webhooks/resend/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use admin client for webhook (no user auth context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TEMP_BUMPS: Record<string, number> = {
  "email.delivered": 1,
  "email.opened": 3,
  "email.clicked": 5,
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, data } = payload;

    // Only process engagement events
    if (!["email.delivered", "email.opened", "email.clicked"].includes(type)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const recipientEmail = data.to?.[0];
    if (!recipientEmail) return NextResponse.json({ ok: true, skipped: true });

    // Find contact by email
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, temperature, first_name, last_name")
      .eq("email", recipientEmail)
      .is("deleted_at", null)
      .single();

    if (!contact) return NextResponse.json({ ok: true, skipped: true, reason: "no matching contact" });

    // Bump temperature
    const bump = TEMP_BUMPS[type] || 0;
    if (bump > 0) {
      await supabase
        .from("contacts")
        .update({ temperature: Math.min((contact.temperature || 0) + bump, 100) })
        .eq("id", contact.id);
    }

    // Log interaction (for opens and clicks only -- delivered is too noisy)
    if (type === "email.opened" || type === "email.clicked") {
      // Get the first user (single-user system)
      const { data: firstUser } = await supabase
        .from("contacts")
        .select("user_id")
        .eq("id", contact.id)
        .single();

      if (firstUser) {
        const summary = type === "email.opened"
          ? `Opened: ${data.subject}`
          : `Clicked link in: ${data.subject}`;

        await supabase.from("interactions").insert({
          user_id: firstUser.user_id,
          contact_id: contact.id,
          type: "email",
          summary,
          direction: "inbound",
        });
      }
    }

    return NextResponse.json({ ok: true, contact_id: contact.id, bump });
  } catch {
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd ~/crm && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds, `/api/webhooks/resend` appears in routes

- [ ] **Step 4: Test with curl**

```bash
curl -X POST http://localhost:3000/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{"type":"email.opened","created_at":"2026-04-05T12:00:00Z","data":{"email_id":"test","from":"alex@gat.com","to":["test@example.com"],"subject":"Weekly Edge","created_at":"2026-04-05T12:00:00Z"}}'
```
Expected: `{"ok":true,"skipped":true,"reason":"no matching contact"}` (since test email won't match)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/resend/route.ts src/lib/types.ts
git commit -m "feat: add Resend webhook receiver for email engagement tracking"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx next build --no-lint` passes
- [ ] `/actions` page loads, shows prioritized items, action buttons work
- [ ] `/tickets` page shows kanban columns, status changes work, metrics display
- [ ] `/analytics` page shows 4 chart widgets with real data
- [ ] `/api/webhooks/resend` accepts POST, processes events, returns JSON
- [ ] Sidebar shows both new nav items (Actions, Analytics)
- [ ] No console errors on any page
