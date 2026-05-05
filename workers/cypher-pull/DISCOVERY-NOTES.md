# Cypher Pull Worker -- Phase 0 Discovery Notes

**Session date:** 2026-05-05
**Discovered by:** Phase 0 playwright-cli exploration session
**Cypher instance:** `https://gat.cypher-crm.com`

---

## 1. Authentication

- **Login URL:** `https://gat.cypher-crm.com/users/login?redirect=%2F`
- **Method:** Standard HTML form, POST on "Sign In" click
- **Fields:** `Email`, `Password`
- **MFA:** None observed. Standard form submit redirects to Dashboard on success.
- **Session type:** Cookie-based (no API token available; session persists via browser cookies)
- **No API tokens available:** Profile page (`/users/profile`) offers only Personal Information, Email Integration, Calendar Integrations tabs. No API key or token tab exists. Admin settings (`/admin/settings`) returns 404 for Alex's Sales Rep role.

### Credential rotation note

The password used for Phase 0 discovery appeared in the chat transcript. Rotate before production use. Preferred: create a dedicated read-only service account in Cypher (if supported by the admin team) so the sync agent never holds the master login.

---

## 2. Navigation Path to Ticket List

Sidebar: **Marketing** (dropdown) > **Requests**

- Sidebar link text: "Requests"
- Sidebar link href: `/cypher-support/tickets`
- "Requests" is what Cypher calls tickets. The plan uses "Tickets" -- internally the path/slug uses `tickets` but the UI label is "Requests."

---

## 3. List View

### URL

```
https://gat.cypher-crm.com/cypher-support/tickets
```

This is the canonical list URL. It auto-filters to show only tickets where **Created By = logged-in user** (Alex Hollien). No filter parameters required in the URL.

### Columns (HTML table, left to right)

| Column | Sortable | Sort param |
|--------|----------|------------|
| Actions | No | -- |
| Ticket Title | Yes | `Tickets.name` |
| Contact | Yes | `Tickets.contact_id` |
| Status | Yes | `TicketStatuses.name` |
| Ticket Number | Yes | `Tickets.ticket_number` |
| Due Date | Yes | `due_date` |
| Assigned To | Yes | `assigned_user_id` |
| Created By | Yes | `Tickets.created_by` |
| Priority | Yes | `priority` |
| Created at | Yes | `Tickets.created` |
| Close Date | Yes | `Tickets.close_date` |

Sort URL pattern: `/cypher-support?sort=<param>&direction=asc`

### Pagination

- **Records per page:** 20 (HTML table, server-side rendered)
- **Total records:** 1,454 (all tickets Alex has ever created)
- **Total pages:** 73
- **Pagination URL pattern from HTML links:** `/cypher-support?page=N`

**Critical finding:** navigating directly to `/cypher-support?page=N` or `/cypher-support/tickets?page=N` does NOT paginate the list. Both render the Kanban view instead. The pagination links in the HTML list appear to be JavaScript-driven, not simple anchor navigation. The scraper must click the "Next >" button from within the live page session rather than constructing page URLs.

### View switchers

- **Kanban View:** `/cypher-support?view=kanban`
- **List View:** `/cypher-support?view=list`
- **New Request:** `/cypher-support/tickets/add`

---

## 4. The Two IDs -- Critical Distinction

There are **two separate numeric identifiers** for every ticket. Many scraper bugs will come from confusing them.

| Identifier | Description | Example | Where seen |
|---|---|---|---|
| `id` (internal) | Auto-increment primary key in Cypher's database | 19477 | URL: `/cypher-support/tickets/view/19477` |
| `ticket_number` | Display number shown to users | 20405 | "Ticket #20405" in UI and notifications |

**Our `cypher_id` field stores the `id` (internal URL ID), NOT the `ticket_number`.** The `cypher_url` is built as `https://gat.cypher-crm.com/cypher-support/tickets/view/{id}`.

The internal `id` values are sequential and growing (range observed: 18,800 -- 19,500 over ~1 month). The `ticket_number` values are unpredictable 5-6 digit integers (e.g., 20405, 61373, 58517, 97473).

---

## 5. JSON API Endpoint

The list page triggers an AJAX call to a JSON endpoint on load:

```
GET /cypher-support/tickets/get-dashboard-data?from_index=1
```

**Returns:** Up to 50 most-recent tickets for the logged-in user.

**Response shape:**
```json
{
  "success": true,
  "ticketStats": {
    "total_assigned": 0,
    "open_tickets": 0,
    "closed_tickets": 0
  },
  "assignedTickets": [
    {
      "id": 19477,
      "ticket_number": 20405,
      "version": 2,
      "categories": ["Product Request"],
      "assigned_to": "",
      "created_by": "Alex Hollien",
      "contact": "Joey (Jose) Gutierrez Rodriguez",
      "name": "Design Creation - Joey - Open House Sign Design - Attached Branding",
      "status": {
        "name": "New",
        "background": "#ff9000"
      },
      "due_date": "2026-05-07",
      "priority": {
        "name": "High",
        "class": "#ffb100"
      },
      "created": "2026-05-05 11:35:21",
      "close_date": null
    }
  ]
}
```

**Pagination behavior:** The `from_index` parameter does NOT function as an offset. `from_index=1` and `from_index=51` return identical results (verified by comparing all 50 returned IDs). The endpoint always returns the 50 most-recent tickets regardless of `from_index`. A `limit` param was also tested -- no effect.

**Scraper implication:** This endpoint is ideal for **ongoing sync** (any ticket modified in the past few days will appear in the top 50). It is NOT suitable for a complete historical backfill. For the initial backfill (title-match for all 1,454 tickets), the scraper must paginate the HTML list view.

---

## 6. Status Vocabulary (Complete)

Discovered by inspecting the Kanban view column headers:

| Cypher status text | Color (from API) | Ticket count observed |
|---|---|---|
| `New` | `#ff9000` (orange) | 1 |
| `Pending Approval` | -- | 0 |
| `Awaiting Reply` | `#e94cf7` (purple) | 30 |
| `In Progress` | -- | several |
| `Print Files` | -- | several |
| `Closed` | `#12cc00` (green) | majority |
| `Declined` | -- | 0 |
| `Canceled` | -- | 2 |

**Mapping to our `ticket_status` enum** (update `map-status.ts`):

```typescript
const map: Record<string, ticket_status> = {
  'new':              'submitted',
  'pending approval': 'awaiting_reply',
  'awaiting reply':   'awaiting_reply',
  'in progress':      'in_progress',
  'print files':      'in_progress',   // Cypher-specific: design printed, awaiting pickup
  'closed':           'done',
  'declined':         'cancelled',
  'canceled':         'cancelled',
};
```

**Note on "Print Files":** This is a Cypher-specific workflow status meaning the print shop has produced the files and the order is ready. It's closer to `in_progress` than `done` from Alex's perspective (he still needs to pick up the order). Consider a future `print_ready` status in our enum if this distinction becomes important.

**Statuses NOT found:** `blocked`, `submitted` (as a Cypher status name). The old plan listed these -- they do not exist in the live system.

---

## 7. Priority Values

Observed in list and detail views:

| Priority | Color class |
|---|---|
| `Urgent` | `red` |
| `High` | `#ffb100` (amber) |
| `Medium` | `#0098ac` (teal) |

`Low` likely exists but was not observed on page 1. Treat as safe fallback.

---

## 8. Ticket Detail View

**URL:** `https://gat.cypher-crm.com/cypher-support/tickets/view/{id}`

### Fields available in list view (HTML table)

All 10 list columns are present in the JSON API response too.

### Additional fields in detail view only

| Field | Notes |
|---|---|
| Contact full name | Full first + last (list shows initials + truncated) |
| Contact company | e.g., "Keller Williams Realty Sonoran Living" |
| Contact email | Full email address |
| Contact phone | Direct phone |
| Contact mobile | Mobile phone |
| Branch Association | e.g., "Gainey Branch" |
| Ship To Location | e.g., "Leave at Corporate - Front Desk" |
| Ticket Info (items) | Line items: category, product name, paper type, quantity, cost per project |
| Total cost | Sum of all line items (e.g., "$110.00") |
| Description | Full free-text body of the request |
| Comments | Tab with all agent/team comments |
| Attachments | Tab with file attachments |
| Audit Trail | Tab with full change history |

**Fields the scraper needs from detail view (not in list/API):**

The sync worker's goal is `cypher_id`, `status`, `assigned_to`, `synced_at`. All four are available from the JSON API without loading the detail page. The detail page is needed only if we later want `branch_association` or `ship_to_location`.

---

## 9. Scraper Architecture Recommendation

Given the discovery above, the recommended scraper approach is:

### For ongoing sync (hourly cron)

1. `GET /cypher-support/tickets/get-dashboard-data?from_index=1` -- returns 50 most recent as JSON
2. For each ticket: compare `status.name` and `assigned_to` against `tickets` table
3. Update changed rows + write `ticket.synced` activity event
4. Set `synced_at = now()` on every synced row

This covers any ticket created or updated in the last few weeks with zero HTML parsing.

### For initial backfill (one-time, run during burn-in)

1. Load `/cypher-support/tickets` -- server-rendered HTML table, 20 rows
2. Scrape the 20 rows from the table body
3. Click "Next >" pagination button to advance to the next page
4. Repeat until no "Next >" button visible
5. Match each scraped ticket against `tickets` table by title (conservative: skip on ambiguous match)

**Pagination method:** The scraper MUST click the "Next >" button from an active browser session. URL-based pagination (`?page=N`) does not work -- those links render the Kanban view, not the list.

### Combined approach

- Ongoing: JSON API (fast, no HTML parsing, covers the past 50 changes)
- Backfill: HTML list + button-click pagination (one-time, slower)
- The two approaches share the same login + browser session

---

## 10. Open Questions Resolved

| OQ | Question | Answer |
|---|---|---|
| OQ1 | Cypher credentials | ahollien@azgat.com. **Password requires rotation.** |
| OQ2 | GitHub Actions vs Railway | GitHub Actions (confirmed by Alex) |
| OQ3 | Sync frequency | Hourly (confirmed by Alex) |
| OQ4 | List auto-filters to Alex's tickets? | Yes -- `created_by = "Alex Hollien"` on all visible rows; no manual filter needed |
| OQ5 | MFA on login? | No MFA. Standard form submit. |

---

## 11. New Open Questions (from Phase 0)

| OQ | Question | Blocks |
|---|---|---|
| OQ6 | Can the Cypher admin team create a service account with read-only scope? | Production credential security |
| OQ7 | "Print Files" status -- should it map to `in_progress` or a new `print_ready` status? | `map-status.ts` |
| OQ8 | For the backfill HTML scrape: is the "Next >" button always present, or does the list ever show all tickets without pagination? | Backfill loop termination |
| OQ9 | Are there tickets created by others on behalf of Alex that we should also sync? (All visible tickets have `created_by = Alex Hollien`) | Scrape filter logic |

---

## 12. Screenshots Captured

- `~/Desktop/cypher-ticket-list.png` -- list view page 1
- `~/Desktop/cypher-ticket-detail-1.png` -- ticket #19477 (New status)
- `~/Desktop/cypher-kanban.png` -- Kanban view showing all status columns
