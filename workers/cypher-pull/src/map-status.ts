// Maps raw Cypher status strings to our ticket_status enum.
// Status vocabulary confirmed via Phase 0 discovery (2026-05-05).
// Unmapped statuses are logged rather than thrown so a new Cypher
// status never crashes the sync job.

type TicketStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_reply'
  | 'in_progress'
  | 'done'
  | 'blocked'
  | 'cancelled';

const STATUS_MAP: Record<string, TicketStatus> = {
  'new':              'submitted',
  'pending approval': 'awaiting_reply',
  'awaiting reply':   'awaiting_reply',
  'in progress':      'in_progress',
  // "Print Files" = design printed, awaiting pickup. Closer to in_progress
  // than done since Alex still needs to collect the order. OQ7 resolved 2026-05-05.
  'print files':      'in_progress',
  'closed':           'done',
  'declined':         'cancelled',
  'canceled':         'cancelled',
};

export function mapCypherStatus(raw: string): TicketStatus {
  const normalized = raw.toLowerCase().trim();
  const mapped = STATUS_MAP[normalized];
  if (!mapped) {
    console.warn(`[map-status] Unmapped Cypher status: "${raw}" -- defaulting to awaiting_reply`);
    return 'awaiting_reply';
  }
  return mapped;
}
