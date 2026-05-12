// Phase 5 of ~/.claude/plans/idempotent-toasting-tome.md
// Read queries for the public /agent/<token> portal.
//
// Uses adminClient (service-role) -- the token IS the auth; RLS is bypassed
// by design and replaced with a token-to-contact lookup. Callers MUST gate
// every other query on a successful contact lookup or the route returns
// not-found. Never expose this lib to the browser.

import { adminClient } from "@/lib/supabase/admin";
import type { ActivityEvent } from "@/lib/activity/types";

export interface AgentPortalContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  brokerage: string | null;
}

export interface OpenTransaction {
  opportunity_id: string;
  stage: string;
  last_event_at: string;
  context: Record<string, unknown>;
}

export interface AgentPortalData {
  contact: AgentPortalContact;
  deliverables: ActivityEvent[];
  openTransactions: OpenTransaction[];
}

const TERMINAL_STAGES = new Set(["closed", "fell_through"]);

export async function getAgentPortalData(
  token: string,
): Promise<AgentPortalData | null> {
  if (!isUuid(token)) return null;

  const { data: contact, error: contactErr } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, brokerage")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (contactErr || !contact) return null;

  const [deliverablesRes, transactionEventsRes] = await Promise.all([
    adminClient
      .from("activity_events")
      .select("*")
      .eq("verb", "deliverable.shipped")
      .eq("context->>contact_id", contact.id)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(5),
    adminClient
      .from("activity_events")
      .select("*")
      .like("verb", "transaction.%")
      .eq("context->>contact_id", contact.id)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false }),
  ]);

  const deliverables = (deliverablesRes.data ?? []) as ActivityEvent[];
  const txEvents = (transactionEventsRes.data ?? []) as ActivityEvent[];

  // Group transaction events by object_id (opportunity id); latest event per
  // opportunity wins. Drop opportunities whose latest event is terminal.
  const latestByOpportunity = new Map<string, ActivityEvent>();
  for (const evt of txEvents) {
    if (!latestByOpportunity.has(evt.object_id)) {
      latestByOpportunity.set(evt.object_id, evt);
    }
  }

  const openTransactions: OpenTransaction[] = [];
  latestByOpportunity.forEach((evt, opportunityId) => {
    const stage = evt.verb.replace(/^transaction\./, "");
    if (TERMINAL_STAGES.has(stage)) return;
    openTransactions.push({
      opportunity_id: opportunityId,
      stage,
      last_event_at: evt.occurred_at,
      context: evt.context ?? {},
    });
  });

  return {
    contact: contact as AgentPortalContact,
    deliverables,
    openTransactions,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
