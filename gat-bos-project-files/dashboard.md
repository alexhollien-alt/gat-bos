# DASHBOARD ARCHITECTURE RULE

This rule applies when working on **any** of the following inside the GAT-BOS CRM at `~/crm/`:

- The dashboard route at `(app)/dashboard/`
- Today View, morning briefing, prioritized action list
- Any widget (task list, relationship health grid, calendar, quick-action panel, activity feed, KPI card, pipeline funnel, timeline)
- Any UI component intended for the bento grid
- Any new chart, table, or interactive surface in the portal
- Any contact detail page, opportunity detail page, or "record show" page
- Any Supabase realtime subscription wired into a dashboard widget

---

## Required Reading Before Writing Code

Before touching any of the above, read this file:

```
~/Documents/Alex Hub(Obs)/digital-aesthetic-upgrade/docs:architecture:dashboard-widgets.md.md
```

(The colon-style filename is an Obsidian export artifact. Open it directly with Read, do not try to navigate `docs/architecture/` as a folder.)

The doc has eight numbered sections. Reference them by number when proposing work:

1. Widget taxonomy (Tier 1/2/3 priority)
2. Layout systems (bento wins over drag-and-drop)
3. Component libraries (the recommended stack)
4. CRM patterns from Attio, Folk, Twenty
5. The Today View (Linear Focus model + AI morning briefing)
6. Realtime architecture (Supabase Realtime + TanStack Query hybrid)
7. Accessibility and mobile patterns
8. Integration mapping across the full stack

---

## Locked Decisions (do not relitigate)

These are settled. If a request implies otherwise, surface the conflict and wait for OK before proceeding.

### Stack
- **Charts:** shadcn/ui Charts (Recharts v3 under the hood). No Tremor, no Nivo, no Victory.
- **Tables:** TanStack Table v8 via the shadcn/ui Data Table component.
- **Drag and drop:** dnd-kit (core + sortable). Used for kanban and reordering, NOT for dashboard layout.
- **Data fetching:** TanStack Query v5 as the primary cache layer.
- **Command palette:** cmdk via shadcn/ui Command for `Cmd+K` navigation and quick actions.
- **Realtime:** Supabase Realtime invalidates TanStack Query caches. Never update component state directly from a Realtime event.

### Layout
- **Bento grid via CSS Grid with `grid-template-areas`.** Static. Four card sizes: hero (2x2), medium (2x1), compact (1x1), tall (1x2). Cap at 8-10 visible cards.
- **No drag-and-drop dashboard layouts.** No React-Grid-Layout. No Gridstack. The engineering cost is better spent on Claude-powered prioritization.
- **Responsive collapse by priority, not by column.** Desktop 3-4 columns, tablet 2, mobile 1 reordered.

### Data model adaptation
The architecture doc was written in greenfield vocabulary (`agents`, `deals`). The CRM uses different table names. Translate as follows when reading the doc:

| Doc says | CRM uses |
|---|---|
| `agents` | `contacts` (with `tier`, `temperature`, `relationship`, `farm_area`, etc.) |
| `deals` | `opportunities` (with `stage`, `escrow_number`, `sale_price`) |
| `interactions` | `interactions` (already named correctly) |
| `tasks` | `tasks` (already named correctly) |

Never create a new table called `agents` or `deals`. Extend `contacts` and `opportunities` instead.

### Relationship health scoring
The doc's algorithm in Section 1: recency 40%, deal volume trend 30%, frequency 20%, responsiveness 10%. This is implemented as the materialized view `agent_relationship_health` (see `~/crm/supabase/dashboard-architecture.sql`). Refresh on `interactions` insert/update via trigger. Never compute health scores client-side.

### Today View
Follows Linear's Focus model from Section 5 of the doc. Six prioritized buckets, in this exact order:

1. Overdue follow-ups (red)
2. Closings today/tomorrow (orange)
3. Agents going cold (yellow, AI-detected)
4. Scheduled meetings/calls (blue)
5. Proactive touchpoints (green)
6. Pipeline items needing attention (gray)

Do not sort tasks by creation date on the Today View. Ever.

### AI morning briefing
Runs as a Vercel Edge Function calling Claude API. Cached in Supabase with 1-hour TTL. Never call Claude API directly from the client. The response shape and prompt structure are defined in Section 5 of the doc.

---

## Component Boundaries (Next.js 14 App Router)

Per Section 6 of the doc:

- **Server Components:** layout shells, page structures, initial data prefetch via `prefetchQuery`, `HydrationBoundary`. Zero client JavaScript.
- **Client Components (`'use client'`):** TanStack Query hooks, Supabase Realtime subscriptions, optimistic mutations, presence indicators, `Cmd+K` command palette, any interactive widget.

`QueryClientProvider` wraps the app inside a client component. Create the QueryClient inside `useState` to give SSR its own instance while the client reuses a singleton.

---

## Accessibility Floor

Per Section 7 of the doc:

- Touch targets minimum 44x44 px on mobile (Apple HIG), 24x24 minimum (WCAG 2.2 AA).
- Every chart needs a "View as table" toggle adjacent to it.
- Every chart container needs an `aria-label`.
- Every KPI that updates in real time needs `aria-live="polite"`.
- Roving tabindex within widget groups, with `role="region"` and `aria-label` on each widget shell.
- Skip links: "Skip to main content," "Skip to dashboard widgets."
- Focus indicator: `outline: 3px solid` at `outline-offset: 3px`.
- Honor `prefers-reduced-motion` (already in globals.css per digital-aesthetic.md).

Accessibility is not a Phase 3 polish item. It is a Phase 1 build requirement.

---

## Stale Time Defaults

Per Section 6 of the doc, configure TanStack Query `staleTime` per data type:

| Data type | staleTime | Notes |
|---|---|---|
| KPI cards | 60 seconds | Recalculated on the minute |
| Task lists | 30 seconds | Plus Realtime invalidation |
| Agent profiles | 5 minutes | Rarely change |
| User preferences | Infinity | Manual invalidation only |

---

## What This Rule Does NOT Cover

- Visual aesthetic (colors, spacing, motion budgets, typography roles): see `digital-aesthetic.md`
- Brand tokens (GAT Red, GAT Blue, font kits): see `brand.md`
- Marketing copy and voice: see `standing-rules.md` Rule 7 and `re-marketing/SKILL.md`
- Build conventions (pnpm, Tailwind v3, shadcn v4): see `CLAUDE.md` Build and Dev section

This rule is the architecture and stack contract. The aesthetic rule is the visual contract. They stack, they do not conflict.

---

## When This Rule Auto-Loads

This file is referenced from `CLAUDE.md`'s Rules table and loads automatically at session start. If you are about to write dashboard, widget, or GAT-BOS UI code and have NOT seen this file's contents in your context, **stop and re-read it before continuing**.
