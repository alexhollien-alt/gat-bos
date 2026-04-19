import { adminClient } from "@/lib/supabase/admin";

export type ProjectTouchpointType =
  | "email"
  | "event"
  | "voice_memo"
  | "contact_note";

export type ProjectEntityTable =
  | "emails"
  | "email_drafts"
  | "events"
  | "contacts"
  | "notes";

export interface LinkTouchpointInput {
  projectId: string;
  touchpointType: ProjectTouchpointType;
  entityId: string;
  entityTable: ProjectEntityTable;
  occurredAt?: string;
  note?: string | null;
}

export interface LinkTouchpointResult {
  id: string;
  project_id: string;
  touchpoint_type: ProjectTouchpointType;
  entity_id: string;
  entity_table: ProjectEntityTable;
  occurred_at: string | null;
  note: string | null;
  created_at: string;
}

export async function linkTouchpointToProject(
  input: LinkTouchpointInput
): Promise<LinkTouchpointResult> {
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    throw new Error(`Project ${input.projectId} not found or deleted`);
  }

  const { data, error } = await adminClient
    .from("project_touchpoints")
    .insert({
      project_id: input.projectId,
      touchpoint_type: input.touchpointType,
      entity_id: input.entityId,
      entity_table: input.entityTable,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to link touchpoint: ${error?.message ?? "unknown error"}`
    );
  }

  return data as LinkTouchpointResult;
}

export async function listProjectsForEntity(
  entityTable: ProjectEntityTable,
  entityId: string
) {
  const { data: touchpoints, error: tpError } = await adminClient
    .from("project_touchpoints")
    .select("project_id")
    .eq("entity_table", entityTable)
    .eq("entity_id", entityId);

  if (tpError) {
    throw new Error(`Failed to list touchpoints: ${tpError.message}`);
  }

  const projectIds = Array.from(
    new Set((touchpoints ?? []).map((t) => t.project_id as string))
  );

  if (projectIds.length === 0) {
    return [];
  }

  const { data: projects, error: projectsError } = await adminClient
    .from("projects")
    .select("*")
    .in("id", projectIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (projectsError) {
    throw new Error(`Failed to list projects: ${projectsError.message}`);
  }

  return projects ?? [];
}

export async function listProjectsForContact(contactId: string) {
  const { data: owned, error: ownedError } = await adminClient
    .from("projects")
    .select("*")
    .eq("owner_contact_id", contactId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (ownedError) {
    throw new Error(`Failed to list owned projects: ${ownedError.message}`);
  }

  const touchpointLinked = await listProjectsForEntity("contacts", contactId);

  const seen = new Set<string>();
  const merged: typeof owned = [];
  for (const row of [...(owned ?? []), ...touchpointLinked]) {
    const id = row.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(row);
    }
  }

  return merged;
}
