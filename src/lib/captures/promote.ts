import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capture, InteractionType, PromotedTarget } from "@/lib/types";

export interface PromoteInput {
  capture: Capture;
  userId: string;
  supabase: SupabaseClient;
}

export interface PromoteSuccess {
  ok: true;
  promotedTo: PromotedTarget;
  promotedId: string;
  targetUrl: string;
}

export interface PromoteFailure {
  ok: false;
  status: number;
  error: string;
}

export type PromoteResult = PromoteSuccess | PromoteFailure;

const TICKET_TITLE_MAX = 80;

export function mapKeywordToInteractionType(
  keyword: string | undefined
): InteractionType {
  if (!keyword) return "note";
  const k = keyword.toLowerCase();
  if (k === "called" || k === "spoke to") return "call";
  if (k === "texted") return "text";
  if (k === "met with" || k === "coffee") return "meeting";
  if (k === "lunch") return "lunch";
  return "note";
}

export function buildTicketTitle(rawText: string): string {
  const collapsed = rawText.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TICKET_TITLE_MAX) return collapsed;
  return collapsed.slice(0, TICKET_TITLE_MAX - 1).trimEnd() + "…";
}

export function defaultFollowUpDueDate(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 10);
}

export async function promoteCapture(
  input: PromoteInput
): Promise<PromoteResult> {
  const { capture, userId, supabase } = input;
  const intent = capture.parsed_intent;
  const contactId = capture.parsed_contact_id;
  const rawText = capture.raw_text;
  const keyword =
    typeof capture.parsed_payload?.intent_keyword === "string"
      ? (capture.parsed_payload.intent_keyword as string)
      : undefined;

  if (!intent || intent === "unprocessed") {
    return {
      ok: false,
      status: 400,
      error: "No contact or intent to promote",
    };
  }

  if ((intent === "interaction" || intent === "note" || intent === "follow_up") && !contactId) {
    return {
      ok: false,
      status: 400,
      error: "Needs a contact",
    };
  }

  if (intent === "interaction" || intent === "note") {
    const interactionType: InteractionType =
      intent === "note" ? "note" : mapKeywordToInteractionType(keyword);

    const { data, error } = await supabase
      .from("interactions")
      .insert({
        user_id: userId,
        contact_id: contactId,
        type: interactionType,
        summary: rawText,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        status: 500,
        error: error?.message ?? "Failed to insert interaction",
      };
    }
    return {
      ok: true,
      promotedTo: "interaction",
      promotedId: data.id as string,
      targetUrl: `/contacts/${contactId}`,
    };
  }

  if (intent === "follow_up") {
    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        user_id: userId,
        contact_id: contactId,
        reason: rawText,
        due_date: defaultFollowUpDueDate(capture.created_at),
        created_via: "capture",
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        status: 500,
        error: error?.message ?? "Failed to insert follow_up",
      };
    }
    return {
      ok: true,
      promotedTo: "follow_up",
      promotedId: data.id as string,
      targetUrl: `/contacts/${contactId}`,
    };
  }

  if (intent === "ticket") {
    const { data, error } = await supabase
      .from("material_requests")
      .insert({
        user_id: userId,
        contact_id: contactId,
        title: buildTicketTitle(rawText),
        request_type: "design_help",
        status: "draft",
        source: "internal",
        notes: rawText,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        status: 500,
        error: error?.message ?? "Failed to insert ticket",
      };
    }
    return {
      ok: true,
      promotedTo: "ticket",
      promotedId: data.id as string,
      targetUrl: "/materials",
    };
  }

  return {
    ok: false,
    status: 400,
    error: `Unsupported intent: ${intent}`,
  };
}
