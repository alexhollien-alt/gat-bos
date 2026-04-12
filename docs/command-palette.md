# Command Palette (Cmd+K)

## What it does

Global Cmd+K command palette using `cmdk` (via shadcn's Command component).
Provides fuzzy search over contacts, quick action launchers, and
navigation shortcuts. Rendered inside `AppLayout` so every authenticated
page has access to it.

## Where it lives

`/Users/alex/crm/src/components/command-palette.tsx` (140 lines).

Rendered in `/Users/alex/crm/src/app/(app)/layout.tsx` at line 12, next
to the `Sidebar` and `Toaster`.

## Key entry points

- `CommandPalette()` at line 26
- Cmd+K key listener at lines 32 to 41
- `fetchContacts()` at line 44
- Contact fetch effect at lines 54 to 56
- `navigate(path)` at line 58

## Flow

1. **Toggle with Cmd+K** (lines 32 to 41). A global `keydown` listener on
   `document` listens for `e.key === "k"` with `metaKey || ctrlKey`.
   Calls `setOpen(prev => !prev)` and `e.preventDefault()` to stop the
   browser's default bookmark popup.
2. **Lazy contact load** (lines 54 to 56). Contacts only fetch when the
   palette opens, so closed state costs zero network.
3. **Query** (lines 44 to 52). Direct Supabase browser client call,
   selecting `id, first_name, last_name, brokerage, email, phone,
   health_score, tier`, ordered by `first_name`, limit 200.
4. **Navigate** (line 58). Closes the palette and calls
   `router.push(path)`.

## Render sections

Four groups inside the `CommandList`:

1. **Quick Actions** (lines 69 to 86)
   - New Contact -> `/contacts?action=new`
   - View Tasks -> `/tasks`
   - View Follow-ups -> `/follow-ups`
   - View Pipeline -> `/opportunities`
2. **Contacts** (lines 90 to 115). One `CommandItem` per contact. The
   `value` prop at line 94 combines name + brokerage + email so the
   cmdk fuzzy match treats any of those as searchable. Shows the
   `health_score` as a trailing number when it is greater than zero.
3. **Navigate** (lines 119 to 136)
   - Dashboard -> `/dashboard`
   - All Contacts -> `/contacts`
   - Campaigns -> `/campaigns`
   - Materials -> `/materials`

`CommandSeparator` dividers between groups at lines 88 and 117.

## Fuzzy matching

cmdk handles ranking automatically based on the `value` prop on each
`CommandItem`. The value string for contacts includes brokerage and email
so typing "KW" finds everyone at Keller Williams, typing part of an email
finds that agent, and typing part of a name does the normal thing.

## Accessibility

The shadcn `CommandDialog` wraps cmdk, which provides:

- `role="dialog"` on the overlay
- Auto-focus on the input when opened
- Arrow key navigation through items
- Enter to select, Escape to close
- `CommandEmpty` renders when no items match

## Dependencies

- `cmdk` v1.1.1 via the shadcn `Command` family
- `@/lib/supabase/client` for the browser client
- `@/lib/types` for the `Contact` type
- `lucide-react` icons: `Users`, `Phone`, `CheckSquare`, `Clock`,
  `UserPlus`, `Search`, `TrendingUp`
- `next/navigation` for `useRouter`

## Known constraints

Per `.claude/rules/dashboard.md`: "Command palette: cmdk via shadcn/ui
Command for `Cmd+K` navigation and quick actions." This is the locked
decision.

- The listener is global and uses `metaKey || ctrlKey` so Cmd+K works
  on macOS and Ctrl+K on other platforms.
- The sidebar also has a "Search" button at lines 76 to 89 of
  `/Users/alex/crm/src/components/sidebar.tsx` that dispatches a
  synthetic Cmd+K keydown event via `document.dispatchEvent(new
  KeyboardEvent(...))`. This is a hack; a proper context-based
  `openPalette()` function would be cleaner, but it works.
- No contact count cap beyond `limit(200)`. For CRMs with more than
  200 contacts, convert to a server-driven search endpoint.

## Example: adding a new quick action

Add to the Quick Actions `CommandGroup` (after line 85):

```tsx
<CommandItem onSelect={() => navigate("/weekly-edge")}>
  <Megaphone className="mr-2 h-4 w-4" />
  Build Weekly Edge
</CommandItem>
```

Import `Megaphone` from `lucide-react` at the top of the file.
