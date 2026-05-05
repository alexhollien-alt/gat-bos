// Diffs scraped Cypher tickets against the tickets table and writes changes.
// Sync logic:
//   1. cypher_id match -> compare status + assigned_to -> update if different
//   2. No cypher_id match -> title-match among tickets WHERE cypher_id IS NULL
//      -> if exactly one match -> populate cypher_id + fields
//   3. No match -> log as unmatched, skip (never create a tickets row here)
// Writes a ticket.synced ActivityEvent on every field change.
// Phase 3 implementation -- stub for Phase 1 scaffold.

import { type SupabaseClient } from '@supabase/supabase-js';
import { type CypherTicketSummary } from './scrape-list.js';

export interface SyncResult {
  updated: number;
  backfilled: number;
  unchanged: number;
  unmatched: number;
}

export async function syncTickets(
  supabase: SupabaseClient,
  tickets: CypherTicketSummary[]
): Promise<SyncResult> {
  throw new Error('syncTickets: Phase 3 not yet implemented');
}
