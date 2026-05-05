// Playwright login flow for gat.cypher-crm.com.
// Returns an authenticated Page. Throws on login failure.
// Phase 2 implementation -- stub for Phase 1 scaffold.

import { type Browser, type Page } from 'playwright';

export interface CypherSession {
  browser: Browser;
  page: Page;
}

export async function cypherLogin(
  username: string,
  password: string
): Promise<CypherSession> {
  throw new Error('cypherLogin: Phase 2 not yet implemented');
}
