// src/app/api/tickets/route.ts
// GET  /api/tickets -- list tickets with optional filters
// POST /api/tickets -- create ticket + ticket_projects (sequential with rollback on child failure)

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { tenantFromRequest, TenantResolutionError } from "@/lib/auth/tenantFromRequest";
import { writeEvent } from "@/lib/activity/writeEvent";
import { ticketCreateSchema } from "@/lib/schemas/ticket";

export const dynamic = "force-dynamic";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

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

export async function GET(request: NextRequest) {
  const { tenant, error: authErr } = await resolveTenant(request);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const contactId = url.searchParams.get("contact_id");
  const branch = url.searchParams.get("branch");
  const createdAfter = url.searchParams.get("created_after");
  const createdBefore = url.searchParams.get("created_before");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const supabase = await createServerSupabase();
  let query = supabase
    .from("tickets")
    .select("*, ticket_projects(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (contactId) query = query.eq("contact_id", contactId);
  if (branch) query = query.eq("branch_association", branch);
  if (createdAfter) query = query.gte("created_at", createdAfter);
  if (createdBefore) query = query.lte("created_at", createdBefore);

  const { data, error } = await query;
  if (error) return bad(500, `tickets_load_failed:${error.message}`);

  void tenant; // RLS scopes the query; tenant resolved for auth only
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { tenant, error: authErr } = await resolveTenant(request);
  if (authErr) return authErr;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return bad(400, "invalid_json");
  }

  const parsed = ticketCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { projects, ...ticketFields } = parsed.data;
  const supabase = await createServerSupabase();

  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .insert({ ...ticketFields, account_id: tenant!.accountId })
    .select()
    .single();

  if (ticketErr) return bad(500, `ticket_insert_failed:${ticketErr.message}`);

  const projectRows = projects.map((p) => ({
    ...p,
    ticket_id: ticket.id,
  }));

  const { data: insertedProjects, error: projectsErr } = await supabase
    .from("ticket_projects")
    .insert(projectRows)
    .select();

  if (projectsErr) {
    // Soft-delete the ticket to roll back the partial insert.
    await supabase
      .from("tickets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ticket.id);
    return bad(500, `ticket_projects_insert_failed:${projectsErr.message}`);
  }

  await writeEvent({
    userId: tenant!.userId,
    actorId: tenant!.userId,
    verb: "ticket.created",
    object: { table: "tickets", id: ticket.id },
    context: {
      ticket_title: ticket.ticket_title,
      status: ticket.status,
      project_count: (insertedProjects ?? []).length,
    },
  });

  return NextResponse.json(
    { ticket: { ...ticket, ticket_projects: insertedProjects ?? [] } },
    { status: 201 },
  );
}
