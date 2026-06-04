// src/lib/open-house/queries.ts
// Per-blast send statistics aggregated from the blast_sends ledger.

import { adminClient } from "@/lib/supabase/admin";

export interface BlastStats {
  total: number; // every blast_sends row
  queued: number;
  failed: number;
  dispatched: number; // actually handed to Resend (sent..complained)
  delivered: number; // reached an inbox (delivered+opened+clicked+complained)
  opened: number; // opened+clicked
  clicked: number;
  bounced: number;
  complained: number;
  deliveredRate: number; // delivered / dispatched
  openRate: number; // opened / delivered
  clickRate: number; // clicked / delivered
  bounceRate: number; // bounced / dispatched
  complaintRate: number; // complained / dispatched
}

const DISPATCHED = ["sent", "delivered", "opened", "clicked", "bounced", "complained"];

export async function getBlastStats(blastId: string): Promise<BlastStats> {
  const { data } = await adminClient
    .from("blast_sends")
    .select("status")
    .eq("blast_id", blastId)
    .is("deleted_at", null);
  const rows = (data ?? []) as Array<{ status: string }>;

  const c = (s: string) => rows.filter((r) => r.status === s).length;
  const queued = c("queued");
  const failed = c("failed");
  const sent = c("sent");
  const deliveredOnly = c("delivered");
  const openedOnly = c("opened");
  const clicked = c("clicked");
  const bounced = c("bounced");
  const complained = c("complained");

  const dispatched = rows.filter((r) => DISPATCHED.includes(r.status)).length;
  // A complaint implies the message was received; a click implies an open.
  const delivered = deliveredOnly + openedOnly + clicked + complained;
  const opened = openedOnly + clicked;

  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    total: rows.length,
    queued,
    failed,
    dispatched,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    deliveredRate: rate(delivered, dispatched),
    openRate: rate(opened, delivered),
    clickRate: rate(clicked, delivered),
    bounceRate: rate(bounced, dispatched),
    complaintRate: rate(complained, dispatched),
  };
}
