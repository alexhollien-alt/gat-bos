// Scrapes the Cypher ticket list and returns summaries.
// Two modes (from Phase 0 discovery):
//   sync    -- JSON API endpoint, returns 50 most recent
//   backfill -- HTML list with button-click pagination (all 1,454+ tickets)
// Phase 2 implementation -- stub for Phase 1 scaffold.

import { type Page } from 'playwright';

export interface CypherTicketSummary {
  // Internal Cypher DB primary key (used in URL). NOT the ticket_number.
  cypherInternalId: number;
  // Display ticket number shown in UI and notifications (e.g. 20405).
  ticketNumber: number;
  title: string;
  // Raw status text from Cypher before mapping.
  rawStatus: string;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
}

export async function scrapeViaJsonApi(page: Page): Promise<CypherTicketSummary[]> {
  throw new Error('scrapeViaJsonApi: Phase 2 not yet implemented');
}

export async function scrapeViaHtmlList(page: Page): Promise<CypherTicketSummary[]> {
  throw new Error('scrapeViaHtmlList: Phase 2 not yet implemented');
}
