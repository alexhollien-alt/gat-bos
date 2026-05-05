// Scrapes the Cypher ticket list in one of two modes:
//
//   sync     -- JSON API at /cypher-support/tickets/get-dashboard-data
//               Returns 50 most recent tickets. Fast, no HTML parsing.
//               Use for the hourly cron.
//
//   backfill -- Server-rendered HTML list, button-click pagination.
//               Returns all 1,454+ tickets. One-time historical run.
//               URL pagination (?page=N) renders Kanban -- must click "Next >".
//
// Both modes return the same CypherTicketSummary shape.

import { type Page } from 'playwright';

export interface CypherTicketSummary {
  // Internal Cypher DB primary key -- used in the detail URL (/view/{id}).
  // This is what we store as cypher_id. NOT the same as ticket_number.
  cypherInternalId: number;
  // Display ticket number shown in Cypher UI and email notifications (e.g. 20405).
  ticketNumber: number;
  title: string;
  // Raw status text from Cypher before mapping (e.g. "In Progress", "Closed").
  rawStatus: string;
  assignedTo: string | null;
  dueDate: string | null;
  // ISO-ish string from Cypher (e.g. "2026-05-05 11:35:21")
  createdAt: string;
}

// ─── JSON API mode (sync / hourly cron) ──────────────────────────────────────

const JSON_API_URL =
  'https://gat.cypher-crm.com/cypher-support/tickets/get-dashboard-data?from_index=1';

interface CypherApiTicket {
  id: number;
  ticket_number: number;
  name: string;
  status: { name: string; background: string };
  assigned_to: string;
  due_date: string | null;
  created: string;
}

interface CypherApiResponse {
  success: boolean;
  assignedTickets: CypherApiTicket[];
}

// Fetches the JSON API endpoint using the authenticated browser session.
// The page's cookies are included automatically via page.evaluate fetch.
export async function scrapeViaJsonApi(page: Page): Promise<CypherTicketSummary[]> {
  console.log('[scrape-list] JSON API mode -- fetching 50 most recent tickets...');

  const data = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`JSON API returned HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  }, JSON_API_URL) as CypherApiResponse;

  if (!data.success || !Array.isArray(data.assignedTickets)) {
    throw new Error('[scrape-list] JSON API response missing success=true or assignedTickets array');
  }

  const tickets = data.assignedTickets.map((t): CypherTicketSummary => ({
    cypherInternalId: t.id,
    ticketNumber: t.ticket_number,
    title: t.name.trim(),
    rawStatus: t.status?.name ?? 'Unknown',
    assignedTo: t.assigned_to?.trim() || null,
    dueDate: t.due_date ?? null,
    createdAt: t.created,
  }));

  console.log(`[scrape-list] JSON API returned ${tickets.length} tickets`);
  return tickets;
}

// ─── HTML list mode (backfill) ────────────────────────────────────────────────

const LIST_URL = 'https://gat.cypher-crm.com/cypher-support/tickets?view=list';
// Safety cap -- 73 pages as of Phase 0 discovery. 150 gives headroom for growth.
const MAX_PAGES = 150;

// Extracted from the HTML table body for one page
interface RawRow {
  internalId: number | null;
  ticketNumber: number | null;
  title: string;
  rawStatus: string;
  dueDate: string | null;
  assignedTo: string | null;
  createdAt: string;
}

// Scrapes the HTML list view, clicking through all pages via the "Next >" button.
// Pagination via URL params (?page=N) renders Kanban instead of the list --
// must use button clicks from an active browser session.
export async function scrapeViaHtmlList(page: Page): Promise<CypherTicketSummary[]> {
  console.log('[scrape-list] HTML list mode -- navigating to ticket list...');

  await page.goto(LIST_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Confirm the table loaded. If Kanban appeared, try switching to list view.
  const tableVisible = await page.locator('table').first().isVisible().catch(() => false);
  if (!tableVisible) {
    console.log('[scrape-list] Table not visible -- attempting to click List view toggle...');
    const listToggle = page.locator('a:has-text("List"), button:has-text("List")').first();
    const toggleVisible = await listToggle.isVisible().catch(() => false);
    if (!toggleVisible) {
      throw new Error('[scrape-list] Could not find the list view table or a List view toggle button');
    }
    await listToggle.click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  }

  const all: CypherTicketSummary[] = [];

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    console.log(`[scrape-list] Scraping page ${pageNum}...`);

    const rows = await scrapeCurrentPage(page);
    const valid = rows.filter(
      (r): r is CypherTicketSummary =>
        r.cypherInternalId > 0 && r.ticketNumber > 0 && r.title.length > 0
    );

    if (valid.length === 0 && pageNum === 1) {
      throw new Error('[scrape-list] Page 1 returned no valid rows -- check table selectors');
    }

    all.push(...valid);

    if (valid.length < rows.length) {
      const skipped = rows.length - valid.length;
      console.warn(`[scrape-list] Skipped ${skipped} row(s) on page ${pageNum} (missing id or title)`);
    }

    // Check for Next button -- look for the anchor in a standard Bootstrap
    // pagination list (<li class="next"><a ...>Next</a></li>)
    const nextLink = page.locator('li.next:not(.disabled) a, a[rel="next"]').first();
    const hasNext = await nextLink.isVisible().catch(() => false);

    if (!hasNext) {
      console.log(`[scrape-list] No more pages after page ${pageNum}`);
      break;
    }

    await nextLink.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }

  console.log(`[scrape-list] HTML backfill complete -- ${all.length} total tickets`);
  return all;
}

// Extracts CypherTicketSummary rows from the current table page.
// Columns (left to right per Phase 0 discovery):
//   0: Actions (has view link with internal ID)
//   1: Ticket Title
//   2: Contact
//   3: Status
//   4: Ticket Number
//   5: Due Date
//   6: Assigned To
//   7: Created By
//   8: Priority
//   9: Created at
//  10: Close Date
async function scrapeCurrentPage(page: Page): Promise<CypherTicketSummary[]> {
  const rawRows = await page.evaluate((): RawRow[] => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));

    return rows.map((row): RawRow | null => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 10) return null;

      // Column 0 (Actions): extract internal ID from the view-detail link href
      // href pattern: /cypher-support/tickets/view/{internalId}
      const viewLink = cells[0].querySelector('a[href*="/view/"]');
      const href = viewLink?.getAttribute('href') ?? '';
      const idMatch = href.match(/\/view\/(\d+)/);
      const internalId = idMatch ? parseInt(idMatch[1], 10) : null;

      // Column 4 (Ticket Number): display number, may be prefixed with "#"
      const ticketNumberText = cells[4].textContent?.trim().replace(/^#/, '') ?? '';
      const ticketNumber = ticketNumberText ? parseInt(ticketNumberText, 10) : null;

      // Due date and assigned to may be empty cells
      const dueDateRaw = cells[5].textContent?.trim() || null;
      const assignedToRaw = cells[6].textContent?.trim() || null;

      return {
        internalId,
        ticketNumber,
        title: cells[1].textContent?.trim() ?? '',
        rawStatus: cells[3].textContent?.trim() ?? '',
        dueDate: dueDateRaw,
        assignedTo: assignedToRaw,
        createdAt: cells[9].textContent?.trim() ?? '',
      };
    }).filter((r): r is RawRow => r !== null);
  }) as RawRow[];

  return rawRows
    .filter((r) => r.internalId !== null && r.ticketNumber !== null)
    .map((r): CypherTicketSummary => ({
      cypherInternalId: r.internalId as number,
      ticketNumber: r.ticketNumber as number,
      title: r.title,
      rawStatus: r.rawStatus,
      assignedTo: r.assignedTo,
      dueDate: r.dueDate,
      createdAt: r.createdAt,
    }));
}
