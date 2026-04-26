import type { Capture, InteractionType, PromotedTarget, SuggestedTarget } from "@/lib/types";
import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";
import type { ActivityVerb } from "@/lib/activity/types";

export interface PromoteInput {
  capture: Capture;
  userId: string;
  promoteTarget?: 'task' | 'ticket' | 'contact' | 'touchpoint' | 'event';
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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

class ProjectHintRequiredError extends Error {
  constructor() {
    super('project_hint is required for this promotion target');
  }
}

async function ensureProject(
  hint: SuggestedTarget['project_hint'] | undefined
): Promise<string> {
  if (!hint) throw new ProjectHintRequiredError();
  const { data, error } = await adminClient
    .from('projects')
    .insert({
      title: hint.name,
      owner_contact_id: hint.contact_id ?? null,
      type: 'other',
      status: 'active',
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`ensureProject failed: ${error?.message ?? 'no data'}`);
  }
  return data.id as string;
}

// Fire-and-forget status update -- does not gate the return on success.
function markCapturePromoted(captureId: string): void {
  void adminClient
    .from('captures')
    .update({ status: 'promoted' })
    .eq('id', captureId);
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function promoteCapture(
  input: PromoteInput
): Promise<PromoteResult> {
  const { capture, userId, promoteTarget } = input;
  const intent = capture.parsed_intent;
  const contactId = capture.parsed_contact_id;
  const rawText = capture.raw_text;
  const keyword =
    typeof capture.parsed_payload?.intent_keyword === "string"
      ? (capture.parsed_payload.intent_keyword as string)
      : undefined;
  const suggestedTarget = capture.suggested_target;

  // -------------------------------------------------------------------------
  // EXPLICIT TARGET ROUTING -- when promoteTarget is provided
  // -------------------------------------------------------------------------
  if (promoteTarget) {
    switch (promoteTarget) {
      case 'task': {
        const { data, error } = await adminClient
          .from('tasks')
          .insert({
            user_id: userId,
            contact_id: capture.parsed_contact_id ?? null,
            title: buildTicketTitle(rawText),
            description: rawText,
            due_date: defaultFollowUpDueDate(capture.created_at),
            priority: 'medium',
          })
          .select('id')
          .single();

        if (error || !data) {
          return { ok: false, status: 500, error: error?.message ?? 'Failed to insert task' };
        }

        markCapturePromoted(capture.id);
        void writeEvent({
          actorId: process.env.OWNER_USER_ID!,
          verb: 'capture.promoted.task',
          object: { table: 'captures', id: capture.id },
          context: {
            promoted_to: 'task',
            promoted_id: data.id as string,
            ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
          },
        });
        return {
          ok: true,
          promotedTo: 'task',
          promotedId: data.id as string,
          targetUrl: '/tasks',
        };
      }

      case 'ticket': {
        const { data, error } = await adminClient
          .from('tickets')
          .insert({
            user_id: userId,
            contact_id: contactId,
            title: buildTicketTitle(rawText),
            request_type: 'design_help',
            status: 'draft',
            source: 'internal',
            notes: rawText,
          })
          .select('id')
          .single();

        if (error || !data) {
          return { ok: false, status: 500, error: error?.message ?? 'Failed to insert ticket' };
        }

        markCapturePromoted(capture.id);
        void writeEvent({
          actorId: process.env.OWNER_USER_ID!,
          verb: 'capture.promoted.ticket',
          object: { table: 'captures', id: capture.id },
          context: {
            promoted_to: 'ticket',
            promoted_id: data.id as string,
            ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
          },
        });
        return {
          ok: true,
          promotedTo: 'ticket',
          promotedId: data.id as string,
          targetUrl: '/tickets',
        };
      }

      case 'contact': {
        // If a resolved contact_id exists on suggestedTarget, link to that contact directly.
        if (suggestedTarget?.contact_id) {
          const contactRowId = suggestedTarget.contact_id;
          markCapturePromoted(capture.id);
          void writeEvent({
            actorId: process.env.OWNER_USER_ID!,
            verb: 'capture.promoted.contact',
            object: { table: 'captures', id: capture.id },
            context: {
              promoted_to: 'contact',
              promoted_id: contactRowId,
              contact_id: contactRowId,
            },
          });
          return {
            ok: true,
            promotedTo: 'contact',
            promotedId: contactRowId,
            targetUrl: `/contacts/${contactRowId}`,
          };
        }

        // Otherwise, create a new contact from rawText.
        const parts = rawText.trim().split(/\s+/);
        const firstName = parts[0] ?? 'Unknown';
        const lastName = parts.slice(1).join(' ') || '';

        const { data, error } = await adminClient
          .from('contacts')
          .insert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            type: 'sphere',
            source: 'manual',
            stage: 'new',
          })
          .select('id')
          .single();

        if (error || !data) {
          return { ok: false, status: 500, error: error?.message ?? 'Failed to insert contact' };
        }

        const contactRowId = data.id as string;
        markCapturePromoted(capture.id);
        void writeEvent({
          actorId: process.env.OWNER_USER_ID!,
          verb: 'capture.promoted.contact',
          object: { table: 'captures', id: capture.id },
          context: {
            promoted_to: 'contact',
            promoted_id: contactRowId,
            contact_id: contactRowId,
          },
        });
        return {
          ok: true,
          promotedTo: 'contact',
          promotedId: contactRowId,
          targetUrl: `/contacts/${contactRowId}`,
        };
      }

      case 'touchpoint': {
        let projectId: string;
        try {
          projectId = await ensureProject(suggestedTarget?.project_hint);
        } catch (err) {
          if (err instanceof ProjectHintRequiredError) {
            return { ok: false, status: 400, error: 'project_hint required for touchpoint promotion' };
          }
          return { ok: false, status: 500, error: (err as Error).message };
        }

        const { data, error } = await adminClient
          .from('project_touchpoints')
          .insert({
            project_id: projectId,
            touchpoint_type: 'contact_note',
            entity_id: capture.id,
            entity_table: 'captures',
            occurred_at: new Date().toISOString(),
            note: rawText,
          })
          .select('id')
          .single();

        if (error || !data) {
          return { ok: false, status: 500, error: error?.message ?? 'Failed to insert touchpoint' };
        }

        markCapturePromoted(capture.id);
        void writeEvent({
          actorId: process.env.OWNER_USER_ID!,
          verb: 'capture.promoted.touchpoint',
          object: { table: 'captures', id: capture.id },
          context: {
            promoted_to: 'touchpoint',
            promoted_id: data.id as string,
            project_id: projectId,
            ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
          },
        });
        return {
          ok: true,
          promotedTo: 'touchpoint',
          promotedId: data.id as string,
          targetUrl: `/projects/${projectId}`,
        };
      }

      case 'event': {
        let projectId: string;
        try {
          projectId = await ensureProject(suggestedTarget?.project_hint);
        } catch (err) {
          if (err instanceof ProjectHintRequiredError) {
            return { ok: false, status: 400, error: 'project_hint required for event promotion' };
          }
          return { ok: false, status: 500, error: (err as Error).message };
        }

        const startAt = new Date().toISOString();
        const endAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        const { data, error } = await adminClient
          .from('events')
          .insert({
            title: rawText.slice(0, 80),
            start_at: startAt,
            end_at: endAt,
            attendees: [],
            source: 'dashboard_create',
            occurrence_status: 'scheduled',
            project_id: projectId,
            contact_id: capture.parsed_contact_id ?? null,
          })
          .select('id')
          .single();

        if (error || !data) {
          return { ok: false, status: 500, error: error?.message ?? 'Failed to insert event' };
        }

        markCapturePromoted(capture.id);
        void writeEvent({
          actorId: process.env.OWNER_USER_ID!,
          verb: 'capture.promoted.event',
          object: { table: 'captures', id: capture.id },
          context: {
            promoted_to: 'event',
            promoted_id: data.id as string,
            project_id: projectId,
            ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
          },
        });
        return {
          ok: true,
          promotedTo: 'event',
          promotedId: data.id as string,
          targetUrl: `/projects/${projectId}`,
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // LEGACY PARSED_INTENT ROUTING -- backward compat for callers without promoteTarget
  // -------------------------------------------------------------------------

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

    const { data, error } = await adminClient
      .from("activity_events")
      .insert({
        user_id: userId,
        actor_id: userId,
        verb: `interaction.${interactionType}` as ActivityVerb,
        object_table: "contacts",
        object_id: contactId,
        context: {
          contact_id: contactId,
          type: interactionType,
          summary: rawText,
          source: "capture",
        },
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

    markCapturePromoted(capture.id);
    void writeEvent({
      actorId: process.env.OWNER_USER_ID!,
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'interaction',
        promoted_id: data.id as string,
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });
    return {
      ok: true,
      promotedTo: "interaction",
      promotedId: data.id as string,
      targetUrl: `/contacts/${contactId}`,
    };
  }

  if (intent === "follow_up") {
    // follow_ups merged into tasks (Slice 2C). Write a task with type='follow_up'.
    // due_reason holds the reason; title duplicates it; source records provenance.
    // The created_via='capture' field has no tasks-table equivalent; use source instead.
    const { data, error } = await adminClient
      .from("tasks")
      .insert({
        user_id: userId,
        contact_id: contactId,
        type: "follow_up",
        source: "capture",
        title: rawText,
        due_reason: rawText,
        due_date: defaultFollowUpDueDate(capture.created_at),
        status: "pending",
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

    markCapturePromoted(capture.id);
    void writeEvent({
      actorId: process.env.OWNER_USER_ID!,
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'follow_up',
        promoted_id: data.id as string,
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });
    return {
      ok: true,
      promotedTo: "follow_up",
      promotedId: data.id as string,
      targetUrl: `/contacts/${contactId}`,
    };
  }

  if (intent === "ticket") {
    const { data, error } = await adminClient
      .from("tickets")
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

    markCapturePromoted(capture.id);
    void writeEvent({
      actorId: process.env.OWNER_USER_ID!,
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'ticket',
        promoted_id: data.id as string,
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });
    return {
      ok: true,
      promotedTo: "ticket",
      promotedId: data.id as string,
      targetUrl: "/tickets",
    };
  }

  return {
    ok: false,
    status: 400,
    error: `Unsupported intent: ${intent}`,
  };
}
