// Diffs scraped Cypher tickets against the tickets table and writes changes.
//
// Sync logic:
//   Path 1: cypher_id match -> compare status + assigned_to -> update if different
//   Path 2: No cypher_id match -> exact title-match among tickets WHERE cypher_id IS NULL
//           -> if exactly one match -> populate cypher_id + fields
//   Path 3: No match at all -> log as unmatched, skip (never INSERT a new tickets row)
//
// On every field change: writes ticket.synced to activity_events.
// On cypher_id backfill: also writes ticket.cypher_id_assigned.
// On unchanged rows: updates synced_at silently (no activity event).
//
// Uses the service-role supabase client -- bypasses RLS.
// Resolves account + owner_user_id at startup (single SELECT on accounts).

import { type SupabaseClient } from '@supabase/supabase-js';
import { type CypherTicketSummary } from './scrape-list.js';
import { mapCypherStatus } from './map-status.js';

export interface SyncResult {
  updated: number;
  backfilled: number;
  unchanged: number;
  unmatched: number;
}

interface DbTicket {
  id: string;
  ticket_title: string;
  status: string;
  assigned_to: string | null;
  cypher_id: string | null;
}

type ChangeMap = Record<string, { from: unknown; to: unknown }>;

const CYPHER_TICKET_URL_PREFIX = 'https://gat.cypher-crm.com/cypher-support/tickets/view/';

async function writeActivityEvent(
  supabase: SupabaseClient,
  verb: 'ticket.synced' | 'ticket.cypher_id_assigned',
  ticketId: string,
  userId: string,
  context: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    user_id: userId,
    actor_id: userId,
    verb,
    object_table: 'tickets',
    object_id: ticketId,
    context,
  });
  if (error) {
    console.error(`[sync] Failed to write ${verb} for ticket ${ticketId}: ${error.message}`);
  }
}

export async function syncTickets(
  supabase: SupabaseClient,
  scrapedTickets: CypherTicketSummary[]
): Promise<SyncResult> {
  // Resolve the single-tenant account so we have owner_user_id for activity events.
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, owner_user_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (accountError || !account) {
    throw new Error(`[sync] Could not resolve account: ${accountError?.message ?? 'no rows returned'}`);
  }

  const ownerUserId: string = account.owner_user_id;
  const accountId: string = account.id;

  // Fetch all non-deleted tickets once -- avoids N+1 queries during the diff loop.
  const { data: rows, error: fetchError } = await supabase
    .from('tickets')
    .select('id, ticket_title, status, assigned_to, cypher_id')
    .eq('account_id', accountId)
    .is('deleted_at', null);

  if (fetchError) {
    throw new Error(`[sync] Could not fetch tickets: ${fetchError.message}`);
  }

  const dbTickets = (rows ?? []) as DbTicket[];

  // Build two lookup maps for the diff:
  //   byCypherId  -- fast O(1) lookup for Path 1 (already synced tickets)
  //   byTitle     -- for Path 2 title-match backfill (tickets not yet linked)
  const byCypherId = new Map<string, DbTicket>();
  const byTitle = new Map<string, DbTicket[]>();

  for (const t of dbTickets) {
    if (t.cypher_id) {
      byCypherId.set(t.cypher_id, t);
    }
    const key = t.ticket_title.toLowerCase().trim();
    const bucket = byTitle.get(key) ?? [];
    bucket.push(t);
    byTitle.set(key, bucket);
  }

  const result: SyncResult = { updated: 0, backfilled: 0, unchanged: 0, unmatched: 0 };
  const now = new Date().toISOString();

  for (const scraped of scrapedTickets) {
    const cypherIdStr = String(scraped.cypherInternalId);
    const mappedStatus = mapCypherStatus(scraped.rawStatus);
    const newAssignedTo = scraped.assignedTo ?? null;

    // ── Path 1: cypher_id already linked ─────────────────────────────────────
    const linked = byCypherId.get(cypherIdStr);
    if (linked) {
      const changes: ChangeMap = {};

      if (linked.status !== mappedStatus) {
        changes.status = { from: linked.status, to: mappedStatus };
      }
      if ((linked.assigned_to ?? null) !== newAssignedTo) {
        changes.assigned_to = { from: linked.assigned_to, to: newAssignedTo };
      }

      if (Object.keys(changes).length > 0) {
        const patch: Record<string, unknown> = { synced_at: now };
        if (changes.status) patch.status = mappedStatus;
        if (changes.assigned_to) patch.assigned_to = newAssignedTo;

        const { error } = await supabase.from('tickets').update(patch).eq('id', linked.id);
        if (error) {
          console.error(`[sync] Update failed for ticket ${linked.id}: ${error.message}`);
          continue;
        }
        await writeActivityEvent(supabase, 'ticket.synced', linked.id, ownerUserId, { changes });
        result.updated++;
        console.log(`[sync] Updated ${linked.id} (cypher #${cypherIdStr}): ${JSON.stringify(changes)}`);
      } else {
        // No field changes -- silently refresh synced_at only.
        await supabase.from('tickets').update({ synced_at: now }).eq('id', linked.id);
        result.unchanged++;
      }
      continue;
    }

    // ── Path 2: title-match backfill (tickets not yet linked to Cypher) ──────
    const titleKey = scraped.title.toLowerCase().trim();
    const unlinked = (byTitle.get(titleKey) ?? []).filter((t) => !t.cypher_id);

    if (unlinked.length === 1) {
      const match = unlinked[0];
      const changes: ChangeMap = {
        cypher_id: { from: null, to: cypherIdStr },
      };
      if (match.status !== mappedStatus) {
        changes.status = { from: match.status, to: mappedStatus };
      }
      if ((match.assigned_to ?? null) !== newAssignedTo) {
        changes.assigned_to = { from: match.assigned_to, to: newAssignedTo };
      }

      const patch: Record<string, unknown> = {
        cypher_id: cypherIdStr,
        cypher_url: `${CYPHER_TICKET_URL_PREFIX}${cypherIdStr}`,
        synced_at: now,
      };
      if (changes.status) patch.status = mappedStatus;
      if (changes.assigned_to) patch.assigned_to = newAssignedTo;

      const { error } = await supabase.from('tickets').update(patch).eq('id', match.id);
      if (error) {
        console.error(`[sync] Backfill failed for ticket ${match.id}: ${error.message}`);
        continue;
      }

      await writeActivityEvent(supabase, 'ticket.cypher_id_assigned', match.id, ownerUserId, {
        cypher_id: cypherIdStr,
        title: scraped.title,
      });
      await writeActivityEvent(supabase, 'ticket.synced', match.id, ownerUserId, { changes });

      // Keep in-memory maps consistent so subsequent iterations in this run
      // don't attempt to re-match the same ticket via title.
      const linked: DbTicket = { ...match, cypher_id: cypherIdStr };
      byCypherId.set(cypherIdStr, linked);
      byTitle.set(titleKey, (byTitle.get(titleKey) ?? []).map((t) => (t.id === match.id ? linked : t)));

      result.backfilled++;
      console.log(`[sync] Backfilled cypher_id=${cypherIdStr} onto ticket ${match.id} ("${scraped.title}")`);
      continue;
    }

    if (unlinked.length > 1) {
      console.warn(
        `[sync] Skipped cypher #${cypherIdStr} ("${scraped.title}"): ` +
          `${unlinked.length} title matches with no cypher_id -- ambiguous, skipping`
      );
    } else {
      console.log(`[sync] Unmatched: cypher #${cypherIdStr} ("${scraped.title}") -- no DB ticket found`);
    }
    result.unmatched++;
  }

  return result;
}
