# Digital Aesthetic v2 -- Polish Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a three-layer polish (surfaces, motion, typography) across the CRM and Weekly Edge template, using the intake page as the design reference standard, then codify the decisions in digital-aesthetic.md.

**Architecture:** Two surface tiers -- "showcase" (intake, login, signup) gets full depth treatment (glass cards, noise textures, gradient meshes, layered elevation). "Workspace" (all (app) routes) gets the dark color system and card borders but stays clean. Motion follows the same split: showcase gets the full animation system, workspace gets hover/transition only. Typography follows strict roles system-wide: Syne for page titles only, Inter 600 for card titles, Space Mono for every number. Headshots never use hard circle/rectangle crops -- always gradient-mask fade into the surrounding background.

**Tech Stack:** Next.js 14, Tailwind v3, shadcn/ui, Google Fonts (Syne, Inter, Space Mono)

**Reference:** `/Users/alex/crm/src/app/intake/page.tsx` + `/Users/alex/crm/src/app/intake/layout.tsx` -- these are the source of truth for what "right" looks like.

---

## File Map

### Create
- None

### Modify
| File | Responsibility |
|------|---------------|
| `src/app/globals.css` | Add showcase/workspace utility classes, motion keyframes, reduced-motion |
| `src/app/(auth)/login/page.tsx` | Showcase tier surface + motion |
| `src/app/(auth)/signup/page.tsx` | Full dark showcase rework (currently light) |
| `src/app/(app)/layout.tsx` | Dark workspace background |
| `src/app/(app)/dashboard/page.tsx` | Syne page title, date in Space Mono |
| `src/components/dashboard/temperature-summary.tsx` | Space Mono on temperature counts + avg |
| `src/components/dashboard/temperature-leaders.tsx` | Space Mono on temperature values |
| `src/components/dashboard/pipeline-snapshot.tsx` | Space Mono on counts + dollar values |
| `src/components/dashboard/relationship-stats.tsx` | Space Mono on counts |
| `src/components/dashboard/follow-ups-due.tsx` | Space Mono on badge count |
| `src/components/dashboard/tasks-due.tsx` | Space Mono on badge count |
| `src/components/dashboard/stale-contacts.tsx` | Space Mono on severity counts + days-ago |
| `src/components/dashboard/recent-interactions.tsx` | Space Mono on dates |
| `src/app/(app)/contacts/page.tsx` | Syne page title, dark text colors |
| `src/components/contacts/contact-card.tsx` | Dark workspace card styling |
| `src/app/(app)/actions/page.tsx` | Fix hardcoded light colors |
| `src/app/(app)/analytics/page.tsx` | Fix hardcoded light colors + Space Mono on chart numbers |
| `src/app/intake/layout.tsx` | Add prefers-reduced-motion |
| `src/app/intake/page.tsx` | Space Mono on stats bar numbers, gradient-mask on signature headshot |
| `src/app/intake/layout.tsx` | Gradient-mask on hero headshot |
| `src/app/(app)/contacts/[id]/page.tsx` | Gradient-mask on agent headshot, dark theme fixes |
| `~/Desktop/the-weekly-edge-MASTER-v2.html` | Space Mono on prices, bed/bath/sqft, listing count |
| `~/.claude/rules/digital-aesthetic.md` | Document tier system, motion budget, typography roles, image treatment |

---

### Task 1: CSS Foundation -- globals.css

Add showcase and workspace utility classes, motion keyframes, and prefers-reduced-motion to the global stylesheet.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add showcase surface utilities and motion keyframes**

Append after the existing `@layer base` block:

```css
/* ── Showcase Surface Utilities ── */
@layer components {
  .showcase-mesh {
    background:
      radial-gradient(ellipse at 20% 50%, rgba(230, 53, 80, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(37, 99, 235, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, rgba(192, 38, 211, 0.04) 0%, transparent 50%),
      hsl(var(--background));
  }

  .showcase-noise::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  .showcase-card {
    background: hsl(var(--card) / 0.8);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.2);
  }

  /* Headshot gradient-mask: fades edges into surrounding background.
     Never use hard circle or rectangle crops on headshots. */
  .headshot-mask {
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 45%, black 50%, transparent 100%);
    mask-image: radial-gradient(ellipse 80% 80% at 50% 45%, black 50%, transparent 100%);
  }

  /* Variant for hero/showcase contexts: wider ellipse, softer fade */
  .headshot-mask-hero {
    -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 55%, transparent 100%);
    mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 55%, transparent 100%);
  }

  /* Variant for small/avatar contexts: tighter ellipse */
  .headshot-mask-sm {
    -webkit-mask-image: radial-gradient(ellipse 85% 85% at 50% 45%, black 60%, transparent 100%);
    mask-image: radial-gradient(ellipse 85% 85% at 50% 45%, black 60%, transparent 100%);
  }
}

/* ── Motion: Showcase Page Load ── */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  opacity: 0;
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.10s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.20s; }
.stagger-5 { animation-delay: 0.25s; }

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds (or only pre-existing warnings)

- [ ] **Step 3: Commit**

```bash
cd /Users/alex/crm
git add src/app/globals.css
git commit -m "style: add showcase/workspace CSS utilities, motion keyframes, reduced-motion"
```

---

### Task 2: Login Page -- Showcase Treatment

Transform the login page from a basic dark card to full showcase tier with gradient mesh background, noise texture, glass-effect card, and staggered fade-in animation.

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the login page with showcase-tier styling**

Replace the entire return JSX. The current login uses `bg-background` with a basic Card. The new version adds:
- `showcase-mesh` background with `showcase-noise` overlay
- `showcase-card` glass-effect on the card
- Staggered `animate-fade-in-up` on the card
- Syne on the "GAT-BOS" title
- Space Mono on any meta text
- All form inputs styled to match intake page inputs (dark bg, white/[0.06] border, focus:border-[#e63550])

Replace the return statement (lines 45-106):

```tsx
  return (
    <div className="min-h-screen flex items-center justify-center showcase-mesh relative overflow-hidden">
      <div className="showcase-noise absolute inset-0" />
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="showcase-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GAT-BOS
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your account
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="bg-[#1a1a1f] border-white/[0.06] text-foreground placeholder:text-[#3f3f46] focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="bg-[#1a1a1f] border-white/[0.06] text-foreground placeholder:text-[#3f3f46] focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[#e63550] hover:bg-[#f04060] text-white transition-all hover:-translate-y-px"
              style={{ boxShadow: "0 4px 14px rgba(230,53,80,0.25)" }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            No account?{" "}
            <Link
              href="/signup"
              className="text-foreground underline hover:text-[#e63550] transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
```

Remove the unused Card/CardContent/CardHeader/CardTitle imports since we're no longer using them.

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
cd /Users/alex/crm
git add src/app/\(auth\)/login/page.tsx
git commit -m "style: apply showcase-tier treatment to login page (glass card, mesh bg, motion)"
```

---

### Task 3: Signup Page -- Showcase Treatment

The signup page is currently in light mode (`bg-slate-50`, `text-slate-800`). Needs complete rework to match login page showcase tier.

**Files:**
- Modify: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Replace the signup page with showcase-tier styling**

Replace the return statement (lines 45-116). Same showcase pattern as login -- mesh bg, noise overlay, glass card, fade-in animation. Match the login page structure exactly:

```tsx
  return (
    <div className="min-h-screen flex items-center justify-center showcase-mesh relative overflow-hidden">
      <div className="showcase-noise absolute inset-0" />
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="showcase-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Create Account
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Get started with GAT-BOS
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="bg-[#1a1a1f] border-white/[0.06] text-foreground placeholder:text-[#3f3f46] focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="bg-[#1a1a1f] border-white/[0.06] text-foreground placeholder:text-[#3f3f46] focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                className="bg-[#1a1a1f] border-white/[0.06] text-foreground placeholder:text-[#3f3f46] focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[#e63550] hover:bg-[#f04060] text-white transition-all hover:-translate-y-px"
              style={{ boxShadow: "0 4px 14px rgba(230,53,80,0.25)" }}
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground underline hover:text-[#e63550] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
```

Remove the unused Card/CardContent/CardHeader/CardTitle imports.

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
cd /Users/alex/crm
git add src/app/\(auth\)/signup/page.tsx
git commit -m "style: apply showcase-tier treatment to signup page (dark theme, glass card, motion)"
```

---

### Task 4: App Layout -- Dark Workspace Background

The workspace shell currently uses `bg-slate-50` (light mode). Change to dark background using the CSS variable system already defined in globals.css.

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace bg-slate-50 with bg-background**

On line 7, change `bg-slate-50` to `bg-background`:

```tsx
// Before:
<div className="min-h-screen bg-slate-50">

// After:
<div className="min-h-screen bg-background">
```

This uses the CSS variable `--background: 240 10% 4%` which resolves to the near-black `#0f0f11` -- the dark workspace base.

- [ ] **Step 2: Verify the build compiles and sidebar still renders**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
cd /Users/alex/crm
git add src/app/\(app\)/layout.tsx
git commit -m "style: switch workspace layout to dark background (bg-background)"
```

---

### Task 5: Dashboard Page -- Typography Hierarchy

Apply Syne to the page title, Space Mono to the date, and ensure proper font-weight roles.

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add font-display to page title and font-mono to date**

Replace lines 170-177 (the header section):

```tsx
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-display">Today</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono tracking-wide">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>
```

The `font-display` class maps to `var(--font-display)` which is Syne. The `font-mono` class maps to `var(--font-mono)` which is Space Mono. Both are already configured in `tailwind.config.ts` via the root layout's font variables.

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
cd /Users/alex/crm
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "style: apply typography hierarchy to dashboard (Syne title, Space Mono date)"
```

---

### Task 6: Dashboard Widgets -- Space Mono on All Numbers

Apply `font-mono` (Space Mono) to every number displayed in dashboard widgets: temperature values, badge counts, dollar values, severity counts, days-ago labels, dates, and stats.

**Files:**
- Modify: `src/components/dashboard/temperature-summary.tsx`
- Modify: `src/components/dashboard/temperature-leaders.tsx`
- Modify: `src/components/dashboard/pipeline-snapshot.tsx`
- Modify: `src/components/dashboard/relationship-stats.tsx`
- Modify: `src/components/dashboard/follow-ups-due.tsx`
- Modify: `src/components/dashboard/tasks-due.tsx`
- Modify: `src/components/dashboard/stale-contacts.tsx`
- Modify: `src/components/dashboard/recent-interactions.tsx`

- [ ] **Step 1: temperature-summary.tsx -- Space Mono on count and avg numbers**

In `temperature-summary.tsx`, line 74 -- the bucket count `<p>` tag:
```tsx
// Before:
<p className={`text-lg font-semibold leading-none ${b.color}`}>

// After:
<p className={`text-lg font-semibold leading-none font-mono ${b.color}`}>
```

Line 86 -- the avg temp value:
```tsx
// Before:
<p className="text-lg font-semibold leading-none text-foreground">

// After:
<p className="text-lg font-semibold leading-none text-foreground font-mono">
```

- [ ] **Step 2: temperature-leaders.tsx -- Space Mono on temperature number**

In `temperature-leaders.tsx`, line 80 -- the temperature span:
```tsx
// Before:
<span
  className="text-xs font-semibold w-7 text-right"
  style={{ color: tempColor(c.temperature) }}
>

// After:
<span
  className="text-xs font-semibold w-7 text-right font-mono"
  style={{ color: tempColor(c.temperature) }}
>
```

- [ ] **Step 3: pipeline-snapshot.tsx -- Space Mono on counts and dollar values**

In `pipeline-snapshot.tsx`, line 87 -- stage count:
```tsx
// Before:
<span className="text-xs text-muted-foreground">{count}</span>

// After:
<span className="text-xs text-muted-foreground font-mono">{count}</span>
```

Line 90 -- dollar value badge:
```tsx
// Before:
<span
  className={cn(
    "text-xs font-medium px-1.5 py-0.5 rounded",
    config.bgColor,
    config.textColor
  )}
>

// After:
<span
  className={cn(
    "text-xs font-medium px-1.5 py-0.5 rounded font-mono",
    config.bgColor,
    config.textColor
  )}
>
```

Line 112 -- closed this month count:
```tsx
// Before:
<span className="text-xs text-muted-foreground">
  {closedThisMonth.length}
</span>

// After:
<span className="text-xs text-muted-foreground font-mono">
  {closedThisMonth.length}
</span>
```

Line 115 -- closed dollar value:
```tsx
// Before:
<span className="text-xs font-semibold text-green-400">

// After:
<span className="text-xs font-semibold text-green-400 font-mono">
```

- [ ] **Step 4: relationship-stats.tsx -- Space Mono on counts**

In `relationship-stats.tsx`, line 20 -- total contacts count:
```tsx
// Before:
<span className="text-xs text-muted-foreground font-normal">
  {total} contacts
</span>

// After:
<span className="text-xs text-muted-foreground font-normal">
  <span className="font-mono">{total}</span> contacts
</span>
```

Line 50 -- per-relationship count:
```tsx
// Before:
<span className="text-xs text-muted-foreground w-6 text-right">
  {count}
</span>

// After:
<span className="text-xs text-muted-foreground w-6 text-right font-mono">
  {count}
</span>
```

- [ ] **Step 5: follow-ups-due.tsx -- Space Mono on badge count**

In `follow-ups-due.tsx`, line 22 -- the count badge:
```tsx
// Before:
<span className="bg-red-500/15 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
  {followUps.length}
</span>

// After:
<span className="bg-red-500/15 text-red-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
  {followUps.length}
</span>
```

- [ ] **Step 6: tasks-due.tsx -- Space Mono on badge count**

In `tasks-due.tsx`, line 22 -- the count badge:
```tsx
// Before:
<span className="bg-yellow-500/15 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">
  {tasks.length}
</span>

// After:
<span className="bg-yellow-500/15 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
  {tasks.length}
</span>
```

- [ ] **Step 7: stale-contacts.tsx -- Space Mono on counts and days-ago**

In `stale-contacts.tsx`, line 111 -- severity group count badge:
```tsx
// Before:
<span
  className={cn(
    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
    config.badge
  )}
>
  {items.length}
</span>

// After:
<span
  className={cn(
    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full font-mono",
    config.badge
  )}
>
  {items.length}
</span>
```

Line 157 -- the days-ago label (e.g. "14d ago"):
```tsx
// Before:
<span
  className={cn(
    "text-xs font-medium shrink-0",

// After:
<span
  className={cn(
    "text-xs font-medium shrink-0 font-mono",
```

Line 187 -- total count badge:
```tsx
// Before:
<span className="bg-orange-500/15 text-orange-400 text-xs px-1.5 py-0.5 rounded-full">
  {totalCount}
</span>

// After:
<span className="bg-orange-500/15 text-orange-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
  {totalCount}
</span>
```

Line 219 -- "Show all X" count:
```tsx
// Before:
Show all {totalCount}

// After (wrap the number in a span):
Show all <span className="font-mono">{totalCount}</span>
```

- [ ] **Step 8: recent-interactions.tsx -- Space Mono on dates**

In `recent-interactions.tsx`, line 45 -- the date display:
```tsx
// Before:
<p className="text-xs text-muted-foreground mt-0.5">
  {format(new Date(i.occurred_at), "MMM d")}
</p>

// After:
<p className="text-xs text-muted-foreground mt-0.5 font-mono">
  {format(new Date(i.occurred_at), "MMM d")}
</p>
```

- [ ] **Step 9: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
cd /Users/alex/crm
git add src/components/dashboard/
git commit -m "style: apply Space Mono to all numbers across dashboard widgets"
```

---

### Task 7: Contacts Page + Card -- Dark Theme + Typography

The contacts page and contact-card component use hardcoded light-mode colors (`text-slate-800`, `bg-white`, `border-slate-200`). Convert to dark workspace tier using CSS variable classes.

**Files:**
- Modify: `src/app/(app)/contacts/page.tsx`
- Modify: `src/components/contacts/contact-card.tsx`

- [ ] **Step 1: Fix contacts page title to use Syne and CSS var colors**

In `contacts/page.tsx`, line 55 -- change the page title:
```tsx
// Before:
<h1 className="text-xl font-semibold text-slate-800">Contacts</h1>

// After:
<h1 className="text-xl font-semibold text-foreground font-display">Contacts</h1>
```

- [ ] **Step 2: Fix contact-card.tsx to use dark workspace styling**

Replace the card's outer div (line 16):
```tsx
// Before:
<div className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 hover:shadow-sm transition-all">

// After:
<div className="border border-border rounded-lg p-4 bg-card hover:border-white/[0.12] transition-all">
```

Line 19 -- contact name:
```tsx
// Before:
<h3 className="font-medium text-slate-800">

// After:
<h3 className="font-medium text-foreground">
```

Line 23 -- company icon:
```tsx
// Before:
<Building className="h-3 w-3 text-slate-400" />

// After:
<Building className="h-3 w-3 text-muted-foreground" />
```

Line 25 -- company text:
```tsx
// Before:
<span className="text-sm text-slate-500">

// After:
<span className="text-sm text-muted-foreground">
```

Line 34 -- contact info row:
```tsx
// Before:
<div className="flex items-center gap-4 mt-3 text-xs text-slate-400">

// After:
<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd /Users/alex/crm
git add src/app/\(app\)/contacts/page.tsx src/components/contacts/contact-card.tsx
git commit -m "style: convert contacts page and cards to dark workspace theme"
```

---

### Task 8: Remaining Workspace Pages -- Light-to-Dark Audit

Multiple workspace pages still use hardcoded light-mode colors. This task does a systematic find-and-replace across all affected files.

**Files to audit and fix (all files with `text-slate-` or `bg-white` or `bg-slate-` in `src/`):**
- `src/app/(app)/actions/page.tsx` -- line 18: `text-slate-600` in TIER_COLORS for P tier
- `src/app/(app)/analytics/page.tsx` -- lines 194-195, 204-205: `text-slate-800`, `text-slate-400`; lines 212, 245, 290, 328: `bg-white rounded-xl border border-[#e8e8e8]`
- `src/components/campaigns/step-builder.tsx` -- lines 40, 97, 108, 121, 124, 129, 133: various `text-slate-*`, `bg-white`, `border-slate-200`
- Any other files from the grep results

- [ ] **Step 1: Fix actions/page.tsx P-tier color**

In `actions/page.tsx`, line 18:
```tsx
// Before:
P: "bg-[#e8e8e8] text-slate-600",

// After:
P: "bg-[#222228] text-[#a1a1aa]",
```

- [ ] **Step 2: Fix analytics/page.tsx light-mode colors**

Apply these replacements throughout the file:
- `text-slate-800` -> `text-foreground`
- `text-slate-400` -> `text-muted-foreground`
- `bg-white rounded-xl border border-[#e8e8e8]` -> `bg-card rounded-xl border border-border`

Also add `font-display` to the page title `<h1>` and `font-mono` to any number displays in charts.

- [ ] **Step 3: Fix campaigns/step-builder.tsx light-mode colors**

Apply these replacements:
- `bg-slate-100 text-slate-600` -> `bg-secondary text-muted-foreground`
- `text-slate-400` -> `text-muted-foreground`
- `border-slate-200 bg-white` -> `border-border bg-card`
- `text-slate-800` -> `text-foreground`

- [ ] **Step 4: Run a final grep to catch any remaining light-mode colors**

Run: `cd /Users/alex/crm && grep -rn "text-slate-\|bg-slate-\|bg-white" src/app/ src/components/ --include="*.tsx" | grep -v node_modules | grep -v intake`

Expected: No matches (or only intentional uses in special contexts).

- [ ] **Step 5: Add font-display to page titles on remaining workspace pages**

Each `(app)` page that has an `<h1>` needs `font-display` added:
- `src/app/(app)/actions/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/analytics/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/tasks/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/campaigns/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/follow-ups/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/materials/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/tickets/page.tsx` -- find the `<h1>` and add `font-display`
- `src/app/(app)/opportunities/page.tsx` -- find the `<h1>` and add `font-display`

Search each file for `<h1` and add `font-display` to the className.

- [ ] **Step 6: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
cd /Users/alex/crm
git add -A
git commit -m "style: convert remaining workspace pages from light to dark theme, add font-display to all page titles"
```

---

### Task 9: Intake Page -- Reduced Motion + Stats Typography

Add `prefers-reduced-motion` to the intake page's existing animations, and change stats bar numbers from Syne to Space Mono per the typography hierarchy.

**Files:**
- Modify: `src/app/intake/layout.tsx`
- Modify: `src/app/intake/page.tsx`

- [ ] **Step 1: Add reduced-motion to intake layout**

In `intake/layout.tsx`, inside the `<style>` block at lines 211-219, add the reduced-motion query after the existing keyframe:

```css
@keyframes intake-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.intake-animate-in {
  animation: intake-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .intake-animate-in {
    animation: none;
    opacity: 1;
  }
}
```

- [ ] **Step 2: Change stats bar numbers to Space Mono in intake layout**

In `intake/layout.tsx`, lines 166-169 -- the stats values currently use Syne. Change to Space Mono:

```tsx
// Before:
<span
  className="text-[20px] sm:text-[24px] text-white/80 leading-none tracking-[-0.02em]"
  style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
>
  {item.stat}
</span>

// After:
<span
  className="text-[20px] sm:text-[24px] text-white/80 leading-none tracking-[-0.02em]"
  style={{ fontFamily: "'Space Mono', 'Courier New', monospace" }}
>
  {item.stat}
</span>
```

- [ ] **Step 3: Add reduced-motion to carousel in intake page**

In `intake/page.tsx`, the carousel animation at lines 660-665 -- add a reduced-motion override inside the same `<style>` block:

```css
@keyframes carousel-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .flex[style*="carousel-scroll"] {
    animation: none !important;
  }
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
cd /Users/alex/crm
git add src/app/intake/
git commit -m "style: add prefers-reduced-motion to intake, Space Mono on stats bar numbers"
```

---

### Task 10: Weekly Edge Template -- Space Mono on Numbers

Apply Space Mono to all numeric values in the email template: listing prices, bed/bath/sqft stats, listing count, issue numbers. Vol/Issue/date metadata already uses Space Mono -- skip those.

**Files:**
- Modify: `~/Desktop/the-weekly-edge-MASTER-v2.html`

- [ ] **Step 1: Change listing card prices to Space Mono**

In the listing cards (lines ~191 and ~210), the price currently uses Inter:
```html
<!-- Before: -->
<p style="margin:0 0 4px;font-family:'Inter',Arial,sans-serif;font-size:17px;font-weight:700;color:#09090b;">[REPLACE: $X,XXX,XXX]</p>

<!-- After: -->
<p style="margin:0 0 4px;font-family:'Space Mono','Courier New',monospace;font-size:17px;font-weight:400;color:#09090b;">[REPLACE: $X,XXX,XXX]</p>
```

Apply this to BOTH listing card price lines (card 1 and card 2).

- [ ] **Step 2: Change bed/bath/sqft stats to Space Mono**

In the listing cards (lines ~193 and ~213), the stats line currently uses Inter:
```html
<!-- Before: -->
<p style="margin:0 0 10px;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:400;color:#a1a1aa;letter-spacing:0.04em;">[REPLACE: X] bd &nbsp;&middot;&nbsp; [REPLACE: X] ba &nbsp;&middot;&nbsp; [REPLACE: X,XXX] sqft</p>

<!-- After: -->
<p style="margin:0 0 10px;font-family:'Space Mono','Courier New',monospace;font-size:10px;font-weight:400;color:#a1a1aa;letter-spacing:0.04em;">[REPLACE: X] bd &nbsp;&middot;&nbsp; [REPLACE: X] ba &nbsp;&middot;&nbsp; [REPLACE: X,XXX] sqft</p>
```

Apply to BOTH listing card stat lines.

- [ ] **Step 3: Change listing count to Space Mono**

In section 6 header (line ~148), the listings count:
```html
<!-- Before: -->
<p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;color:#e63550;">[REPLACE: X] listings</p>

<!-- After: -->
<p style="margin:0;font-family:'Space Mono','Courier New',monospace;font-size:11px;font-weight:400;color:#e63550;letter-spacing:0.04em;">[REPLACE: X] listings</p>
```

- [ ] **Step 4: Update the design system comment block**

At the bottom of the file (lines 376-387), add a note about the typography update:

Add after line 379:
```
  Numbers: Space Mono (prices, stats, counts, dates, issue #, vol #)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/alex
git init Desktop/weekly-edge-temp 2>/dev/null || true
# Note: Weekly Edge is a standalone file, not in the CRM repo.
# No git commit needed -- it's a template file on Desktop.
```

No commit for this file -- it lives outside the CRM repo. Just save the changes.

---

### Task 11: Update digital-aesthetic.md -- Codify Decisions

Add the tier system, motion budget rules, and typography role assignments to the rules file so all future outputs follow these patterns.

**Files:**
- Modify: `~/.claude/rules/digital-aesthetic.md`

- [ ] **Step 1: Add Surface Tier System section after Design Philosophy**

Insert after the "Color is surgical" principle (after line 42), before the Typography section:

```markdown
---

## Surface Tier System

All screen outputs belong to one of two surface tiers. The tier determines
which depth effects are allowed.

### Showcase Tier
**Pages:** Login, signup, intake, landing pages, presentations, any public-facing page.

Full depth treatment:
- Glass-effect cards: `backdrop-filter: blur(16px) saturate(120%)` + `border: 1px solid rgba(255,255,255,0.06)`
- Noise texture overlay: SVG feTurbulence at 3% opacity
- Gradient mesh backgrounds: multi-point radial gradients (crimson, blue, purple at 4-8% opacity)
- Layered elevation: multi-layer box-shadows with glow on hover
- Use `showcase-mesh`, `showcase-noise`, `showcase-card` utility classes from globals.css

### Workspace Tier
**Pages:** Dashboard, contacts, tasks, campaigns, follow-ups, materials, tickets,
analytics, actions, opportunities -- all `(app)` routes.

Clean depth treatment:
- Dark color system via CSS variables (`bg-background`, `bg-card`, `text-foreground`)
- Card borders: `border-border` (1px solid, ~16% lightness)
- Hover states: `hover:border-white/[0.12]` (border brightens on hover)
- **No** noise texture, **no** gradient mesh, **no** glass blur, **no** glow shadows
- Dense layouts signal utility. Generous spacing signals premium -- workspace is utility.

### Tier Assignment Rules
- If the page is behind authentication AND is a working tool: **workspace**
- If the page is public-facing OR is an entry point (login, signup): **showcase**
- Landing pages generated by `re-landing-page` skill: **showcase**
- Presentations generated by `re-listing-presentation`: **showcase**
- Email templates: neither tier (email has its own constraints in the Email-Specific Overrides section)
```

- [ ] **Step 2: Add Motion Budget section after the Motion and Animation section**

Insert after the existing `prefers-reduced-motion` media query (after line 346):

```markdown
### Motion Budget by Tier

**Showcase pages** get the full motion system:
- Page-load stagger: `fadeInUp` with 50ms incremental delays per section
- Scroll-triggered reveals: IntersectionObserver at 15% threshold, one-shot (unobserve after trigger)
- Hover micro-interactions: `translateY(-1px)` on buttons/links, `scale(1.03)` on images, border glow on cards
- Duration budget: 200-400ms for micro-interactions, 500-800ms for reveals
- Carousel/marquee: `linear infinite` for auto-scrolling, `paused` on hover

**Workspace pages** get hover/transition effects ONLY:
- Hover transitions: border-color, background-color, opacity changes
- Duration: under 200ms, ease-out only
- **No** page-load animations, **no** scroll-triggered reveals, **no** staggered fade-ins
- **No** keyframe animations on workspace content
- Sidebar active state transitions are allowed (they are navigation, not content)

**Both tiers require:**
- `prefers-reduced-motion: reduce` media query that kills all animation/transition
- This is already in globals.css -- do not duplicate in component-level styles
```

- [ ] **Step 3: Replace the Typography System section with strict role assignments**

Replace the "Typographic Rules" bullet list (lines 96-101) with:

```markdown
### Typography Role Assignments (Strict)

Every text element maps to exactly one role. No exceptions.

| Role | Font | Weight | Where It Appears |
|------|------|--------|-----------------|
| Page titles | **Syne** | 700 | `<h1>` on every page, hero headlines on showcase pages |
| Section headers | **Syne** | 600-700 | `<h2>`, `<h3>` section dividers. Never inside cards or list items |
| Card titles | **Inter** | 600 | Card header text, nav item labels, button text |
| Body text | **Inter** | 400 | Paragraphs, descriptions, form labels, list item text |
| Labels / Metadata | **Inter** | 500-600 | Uppercase labels, badge text, category tags |
| Every number | **Space Mono** | 400 | Temperatures, badge counts, dates, prices, stats, pipeline dollar values, issue numbers, bed/bath/sqft, days-ago indicators, percentages, any numeric value displayed to the user |
| Accent / Taglines | **Space Mono** | 400 | Version numbers, codes, editorial asides, step indicators ("Step 01") |

**Syne must never appear:**
- Inside card bodies or list items
- On numeric values
- On button labels or navigation items
- On body text or descriptions

**Space Mono must always appear on:**
- Any rendered number, even if it's a single digit
- Date strings (e.g., "Apr 6", "2026-04-06", "14d ago")
- Dollar values at any size
- Stat displays (beds, baths, sqft, lot size)

**Tailwind class mapping:**
- `font-display` = Syne (via `--font-display` CSS variable)
- `font-sans` = Inter (via `--font-sans` CSS variable, also the body default)
- `font-mono` = Space Mono (via `--font-mono` CSS variable)
```

- [ ] **Step 4: Add Image Treatment section after the Image Handling (Screen) section**

Insert after the existing `.image-reveal.visible` rule (after the Image Handling section, before Email-Specific Overrides):

```markdown
---

## Image Treatment: Headshots

**Standing rule:** Never use a hard circle or rectangle crop on any headshot.
Default to a gradient mask that fades the headshot edges into the surrounding
background. The person should appear to float on the layout, not be contained
in a shape.

### Implementation

Use CSS `mask-image` with radial or linear gradients. Three size variants:

```css
/* Standard: agent cards, sidebar, contact detail */
.headshot-mask {
  -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 45%, black 50%, transparent 100%);
  mask-image: radial-gradient(ellipse 80% 80% at 50% 45%, black 50%, transparent 100%);
}

/* Hero: showcase pages, landing page headers, presentations */
.headshot-mask-hero {
  -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 55%, transparent 100%);
  mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 55%, transparent 100%);
}

/* Small: avatar-sized contexts (< 64px) */
.headshot-mask-sm {
  -webkit-mask-image: radial-gradient(ellipse 85% 85% at 50% 45%, black 60%, transparent 100%);
  mask-image: radial-gradient(ellipse 85% 85% at 50% 45%, black 60%, transparent 100%);
}
` ``

### Rules
- If the headshot has a plain studio background, match the canvas color underneath
  and let the figure bleed naturally into the layout.
- Never add `border-radius: 50%` or `rounded-full` to a headshot `<img>` element.
  The gradient mask handles the shape.
- Remove any `ring-*`, `border-*`, or `overflow-hidden` that was previously
  creating a hard crop on headshots.
- The mask center is offset slightly upward (`at 50% 45%` or `at 50% 40%`) to
  keep the face centered even when the fade eats into the bottom.
- For email templates: gradient masks are not supported. Use a `border-radius: 50%`
  circle as fallback -- email is the one exception to this rule.

### Where This Applies
- CRM contact detail page headshots
- Intake page hero headshot and signature headshot
- Login/signup pages (if headshots are added)
- Any agent headshot in dashboard widgets, cards, or lists
- Landing pages generated by `re-landing-page`
- Listing presentations generated by `re-listing-presentation`
- Print flyers/brochures: CSS mask is not available in print HTML rendered to PDF,
  so use Pillow to pre-process the image with a feathered alpha mask before placing.
```

NOTE: Fix the triple-backtick inside the markdown code fence -- the CSS block's closing backticks need to be three backticks (the example above has a space in `` ` `` `` to avoid nesting issues; use proper backticks in the actual file).

- [ ] **Step 5: Verify the file is syntactically valid markdown**

Read back the modified file to confirm no formatting issues.

- [ ] **Step 6: Commit (rules file is outside the CRM repo)**

The rules file at `~/.claude/rules/digital-aesthetic.md` is not in a git repo. Save the changes -- no commit needed.

---

### Task 12: Headshot Showcase Component -- Gradient Mask

Replace hard circle/rectangle crops on all headshots with CSS gradient masks that fade into the surrounding background. The person should float on the layout, not be contained in a shape.

**Files:**
- Modify: `src/app/intake/layout.tsx` (hero headshot)
- Modify: `src/app/intake/page.tsx` (signature headshot)
- Modify: `src/app/(app)/contacts/[id]/page.tsx` (agent headshot)

- [ ] **Step 1: Apply gradient mask to intake hero headshot**

In `intake/layout.tsx`, lines 85-93 -- the hero headshot wrapper currently uses `rounded-2xl overflow-hidden ring-1 ring-white/[0.06]`. Remove the hard crop and apply the hero mask:

```tsx
// Before:
<div className="flex-shrink-0 w-full sm:w-[200px] relative">
  <div className="h-[240px] sm:h-full rounded-2xl overflow-hidden ring-1 ring-white/[0.06]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/alex-hero.jpg"
      alt="Alex Hollien"
      className="h-full w-full object-cover object-top"
    />
  </div>
</div>

// After:
<div className="flex-shrink-0 w-full sm:w-[200px] relative">
  <div className="h-[240px] sm:h-full">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/alex-hero.jpg"
      alt="Alex Hollien"
      className="h-full w-full object-cover object-top headshot-mask-hero"
    />
  </div>
</div>
```

This removes `rounded-2xl`, `overflow-hidden`, and `ring-1 ring-white/[0.06]`. The `headshot-mask-hero` class from globals.css applies a radial gradient mask that fades the edges into the dark background behind it.

- [ ] **Step 2: Apply gradient mask to intake signature headshot**

In `intake/page.tsx`, lines 734-737 -- the bottom signature headshot uses `rounded-full overflow-hidden ring-1 ring-white/[0.06]`:

```tsx
// Before:
<div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full overflow-hidden ring-1 ring-white/[0.06]">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src="/alex-bottom.jpg" alt="Alex Hollien" className="h-full w-full object-cover object-top" />
</div>

// After:
<div className="h-12 w-12 sm:h-16 sm:w-16">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src="/alex-bottom.jpg" alt="Alex Hollien" className="h-full w-full object-cover object-top headshot-mask-sm" />
</div>
```

Removes `rounded-full`, `overflow-hidden`, `ring-1 ring-white/[0.06]`. Applies `headshot-mask-sm` for the small avatar context.

- [ ] **Step 3: Apply gradient mask to contact detail headshot**

In `contacts/[id]/page.tsx`, lines 210-221 -- the agent headshot currently uses `rounded-full object-cover border border-slate-200`. Also fix the fallback initials circle and dark-theme colors:

```tsx
// Before:
{contact.headshot_url ? (
  <img
    src={contact.headshot_url}
    alt={`${contact.first_name} ${contact.last_name}`}
    className="w-14 h-14 rounded-full object-cover border border-slate-200"
  />
) : (
  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-semibold">
    {contact.first_name.charAt(0)}
    {contact.last_name.charAt(0)}
  </div>
)}

// After:
{contact.headshot_url ? (
  <img
    src={contact.headshot_url}
    alt={`${contact.first_name} ${contact.last_name}`}
    className="w-14 h-14 object-cover headshot-mask"
  />
) : (
  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-lg font-semibold">
    {contact.first_name.charAt(0)}
    {contact.last_name.charAt(0)}
  </div>
)}
```

Note: The initials fallback keeps `rounded-full` -- it's a solid color circle, not a headshot photo. The rule applies to photos only. Also fixes light-mode colors (`bg-slate-100` -> `bg-secondary`, `text-slate-400` -> `text-muted-foreground`).

- [ ] **Step 4: Also fix light-mode colors on the contact detail page header**

In `contacts/[id]/page.tsx`, line 207:
```tsx
// Before:
<div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">

// After:
<div className="bg-card border border-border rounded-lg p-6 mb-4">
```

Line 200:
```tsx
// Before:
className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"

// After:
className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
```

Line 224:
```tsx
// Before:
<h1 className="text-xl font-semibold text-slate-800">

// After:
<h1 className="text-xl font-semibold text-foreground font-display">
```

- [ ] **Step 5: Verify the build compiles**

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
cd /Users/alex/crm
git add src/app/intake/ src/app/\(app\)/contacts/
git commit -m "style: replace hard headshot crops with gradient-mask fade treatment"
```

---

## Verification Checklist

After all tasks are complete, verify these across the CRM:

- [ ] Login page: dark background, gradient mesh, noise overlay, glass card, fade-in animation
- [ ] Signup page: matches login page treatment exactly
- [ ] Dashboard: dark background, Syne on "Today" title, Space Mono on date and all widget numbers
- [ ] Contacts: dark cards, Syne on "Contacts" title, no slate-* colors
- [ ] All (app) pages: dark background (no `bg-slate-50` or `bg-white` on containers)
- [ ] All page titles: use `font-display` (Syne)
- [ ] All numbers in widgets: use `font-mono` (Space Mono)
- [ ] Intake stats bar: numbers use Space Mono (not Syne)
- [ ] Weekly Edge: prices, bed/bath/sqft, listing count use Space Mono
- [ ] Intake hero headshot: gradient-mask fade, no hard crop or ring
- [ ] Intake signature headshot: gradient-mask fade, no rounded-full
- [ ] Contact detail headshot: gradient-mask fade, initials fallback still rounded
- [ ] Contact detail page: dark theme (no bg-white, no slate-* colors)
- [ ] `prefers-reduced-motion` works: all animations disabled when user prefers reduced motion
- [ ] digital-aesthetic.md: has Surface Tier System, Motion Budget, Typography Roles, and Image Treatment sections
- [ ] Build passes: `pnpm build` completes without errors

Run: `cd /Users/alex/crm && pnpm build 2>&1 | tail -10`
Expected: Build succeeds
