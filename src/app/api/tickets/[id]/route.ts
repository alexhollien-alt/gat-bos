// src/app/api/tickets/[id]/route.ts
// GET    /api/tickets/[id] -- fetch ticket + projects
// PATCH  /api/tickets/[id] -- update ticket fields and/or replace projects
// DELETE /api/tickets/[id] -- soft-delete (Standing Rule 3: no hard deletes)

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { tenantFromRequest, TenantResolutionError } from "@/lib/auth/tenantFromRequest";
import { writeEvent } from "@/lib/activity/writeEvent";
import { ticketUpdateSchema } from "@/lib/schemas/ticket";

export const dynamic = "force-dynamic";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

type RouteCtx = { params: Promise<{ id: string }> };

async function resolveTenant(request: NextRequest) {
  try {
    const tenant = await tenantFromRequest(request);
    if (tenant.kind !== "user") {
      return { tenant: null, error: bad(403, "user_session_required") };
    }
    return { tenant, error: null };
  } catch (err) {
    if (err instanceof TenantResolutionError) {
      const status = err.code === "no_session" ? 401 : 403;
      return { tenant: null, error: bad(status, err.code) };
    }
    throw err;
  }
}

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { tenant, error: authErr } = await resolveTenant(request);
  if (authErr) return authErr;

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*, ticket_projects(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return bad(500, `ticket_load_failed:${error.message}`);
  if (!ticket) return bad(404, "ticket_not_found");

  void tenant; // RLS scopes the query; tenant resolved for auth only
  return NextResponse.json({ ticket });
}

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { tenant, error: authErr } = await resolveTenant(request);
  if (authErr) return authErr;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return bad(400, "invalid_json");
  }

  const parsed = ticketUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { id } = await params;
  const supabase = await createServerSupabase();

  // Read existing to detect status changes and verify the row is accessible.
  const { data: existing, error: readErr } = await supabase
    .from("tickets")
    .select("id, status, ticket_title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readErr) return bad(500, `ticket_read_failed:${readErr.message}`);
  if (!existing) return bad(404, "ticket_not_found");

  const { projects, ...ticketFields } = parsed.data;

  if (Object.keys(ticketFields).length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from("tickets")
      .update(ticketFields)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");

    if (updateErr) return bad(500, `ticket_update_failed:${updateErr.message}`);
    if (!updated || updated.length === 0) return bad(409, "ticket_update_matched_0_rows");
  }

  // Replace projects atomically: delete existing rows then re-insert.
  if (projects !== undefined && projects.length > 0) {
    const { error: deleteErr } = await supabase
      .from("ticket_projects")
      .delete()
      .eq("ticket_id", id);

    if (deleteErr) return bad(500, `ticket_projects_delete_failed:${deleteErr.message}`);

    const { error: insertErr } = await supabase
      .from("ticket_projects")
      .insert(projects.map((p) => ({ ...p, ticket_id: id })));

    if (insertErr) return bad(500, `ticket_projects_insert_failed:${insertErr.message}`);
  }

  const statusChanged =
    ticketFields.status !== undefined && ticketFields.status !== existing.status;

  await writeEvent({
    userId: tenant!.userId,
    actorId: tenant!.userId,
    verb: statusChanged ? "ticket.status_changed" : "ticket.field_updated",
    object: { table: "tickets", id },
    context: statusChanged
      ? { old_status: existing.status, new_status: ticketFields.status }
      : { fields_updated: Object.keys(ticketFields) },
  });

  const { data: refreshed, error: refreshErr } = await supabase
    .from("tickets")
    .select("*, ticket_projects(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (refreshErr || !refreshed) return NextResponse.json({ ok: true, id });
  return NextResponse.json({ ticket: refreshed });
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { tenant, error: authErr } = await resolveTenant(request);
  if (authErr) return authErr;

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: existing, error: readErr } = await supabase
    .from("tickets")
    .select("id, ticket_title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readErr) return bad(500, `ticket_read_failed:${readErr.message}`);
  if (!existing) return bad(404, "ticket_not_found");

  const { data: deleted, error: deleteErr } = await supabase
    .from("tickets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (deleteErr) return bad(500, `ticket_soft_delete_failed:${deleteErr.message}`);
  if (!deleted || deleted.length === 0) return bad(409, "ticket_delete_matched_0_rows");

  await writeEvent({
    userId: tenant!.userId,
    actorId: tenant!.userId,
    verb: "ticket.deleted",
    object: { table: "tickets", id },
    context: { ticket_title: existing.ticket_title },
  });

  return NextResponse.json({ ok: true, id });
}
