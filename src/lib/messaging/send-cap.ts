// Global hard daily send cap -- a backstop ABOVE the per-blast warmup cap so a
// runaway cron or a fat-fingered blast cannot exhaust the sending subdomain's
// reputation in a single day. Pure decision function; the count of today's sends
// is supplied by the caller (I/O stays at the call site).

export const GLOBAL_DAILY_SEND_CAP = Number(process.env.BLAST_DAILY_HARD_CAP ?? 5000);

export interface SendCapInput {
  sentToday: number;
  requested: number;
  cap: number;
}

export interface SendCapDecision {
  allowed: boolean;
  remaining: number;
  wouldExceedBy: number;
}

export function evaluateSendCap({ sentToday, requested, cap }: SendCapInput): SendCapDecision {
  const remaining = Math.max(0, cap - sentToday);
  const projected = sentToday + requested;
  const allowed = projected <= cap;
  return { allowed, remaining, wouldExceedBy: allowed ? 0 : projected - cap };
}
