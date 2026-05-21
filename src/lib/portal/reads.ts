// src/lib/portal/reads.ts
//
// Server-only wrappers around the Slice 7C.5 portal read RPCs:
//   - get_portal_touchpoints(p_slug)
//   - get_portal_messages(p_slug)
//   - get_portal_upcoming_events(p_slug)
//
// Each RPC is SECURITY DEFINER and verifies that the caller's JWT email
// matches the agent contact resolved by p_slug before returning rows. The
// wrappers do nothing extra: they pass the slug, return [] on any error or
// null result, and let the dashboard page render its empty state when the
// list is empty.
//
// Migration: supabase/migrations/20260521220710_portal_read_rpcs.sql.

import { createClient } from "@/lib/supabase/server";

export interface PortalTouchpoint {
  id: string;
  project_id: string;
  project_title: string | null;
  touchpoint_type: string;
  occurred_at: string | null;
  due_at: string | null;
  note: string | null;
  created_at: string;
}

export interface PortalMessage {
  id: string;
  template_id: string | null;
  template_name: string | null;
  recipient_email: string;
  send_mode: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface PortalUpcomingEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  rsvp_status: string | null;
}

export async function getPortalTouchpoints(
  slug: string,
): Promise<PortalTouchpoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_touchpoints", {
    p_slug: slug,
  });
  if (error || !data) return [];
  return data as PortalTouchpoint[];
}

export async function getPortalMessages(
  slug: string,
): Promise<PortalMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_messages", {
    p_slug: slug,
  });
  if (error || !data) return [];
  return data as PortalMessage[];
}

export async function getPortalUpcomingEvents(
  slug: string,
): Promise<PortalUpcomingEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_upcoming_events", {
    p_slug: slug,
  });
  if (error || !data) return [];
  return data as PortalUpcomingEvent[];
}
