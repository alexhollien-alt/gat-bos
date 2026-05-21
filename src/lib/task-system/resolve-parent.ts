// Parent resolution for /api/captures target=task_system.
//
// Best-effort lookup against existing nodes. Fill-and-flag on miss: returns
// parent_id=null and a structured warning so the caller can surface it.
// Name match is case-insensitive substring.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CaptureHints,
  CaptureWarning,
  NodeType,
} from "@/lib/types/task-system";

export interface ResolveParentInput {
  type: NodeType;
  hints: CaptureHints | undefined;
  userId: string;
  client: SupabaseClient;
}

export interface ResolveParentResult {
  parent_id: string | null;
  warnings: CaptureWarning[];
}

export async function resolveParent(
  input: ResolveParentInput,
): Promise<ResolveParentResult> {
  const { type, hints, userId, client } = input;
  const warnings: CaptureWarning[] = [];

  if (!hints) {
    return { parent_id: null, warnings };
  }

  // Per-type parent resolution order. Mirrors the decision tree in
  // /Users/alex/.claude/plans/read-claude-code-brief-md-and-gatbos-tas-lovely-pretzel.md
  // Proposal B routing tree.
  let resolved: string | null = null;

  if (type === "task") {
    resolved = await findNode({ client, userId, nodeType: "project", title: hints.project });
    if (!resolved && hints.project) {
      warnings.push({
        code: "unresolved_project",
        message: `No project matched hint "${hints.project}"; node inserted with parent_id=null.`,
        hint: hints.project,
      });
    }
    if (!resolved) {
      resolved = await findNode({ client, userId, nodeType: "area", title: hints.area });
      if (!resolved && hints.area) {
        warnings.push({
          code: "unresolved_area",
          message: `No area matched hint "${hints.area}"; node inserted with parent_id=null.`,
          hint: hints.area,
        });
      }
    }
  } else if (type === "project") {
    resolved = await findNode({ client, userId, nodeType: "area", title: hints.area });
    if (!resolved && hints.area) {
      warnings.push({
        code: "unresolved_area",
        message: `No area matched hint "${hints.area}"; project inserted with parent_id=null.`,
        hint: hints.area,
      });
    }
  } else if (type === "interaction") {
    resolved = await findNode({ client, userId, nodeType: "contact", title: hints.contact });
    if (!resolved) {
      warnings.push({
        code: "unresolved_contact",
        message: hints.contact
          ? `No contact matched hint "${hints.contact}"; interaction inserted with parent_id=null. Cadence side-effect skipped.`
          : `No contact hint provided for interaction; parent_id=null. Cadence side-effect skipped.`,
        hint: hints.contact,
      });
    }
  } else if (type === "event") {
    resolved = await findNode({ client, userId, nodeType: "project", title: hints.project });
    if (!resolved) {
      resolved = await findNode({ client, userId, nodeType: "contact", title: hints.contact });
    }
  }
  // type='area' and type='contact' have no parent.

  return { parent_id: resolved, warnings };
}

interface FindNodeInput {
  client: SupabaseClient;
  userId: string;
  nodeType: NodeType;
  title: string | undefined;
}

async function findNode(input: FindNodeInput): Promise<string | null> {
  const { client, userId, nodeType, title } = input;
  if (!title || !title.trim()) return null;

  const { data } = await client
    .from("nodes")
    .select("id")
    .eq("user_id", userId)
    .eq("type", nodeType)
    .ilike("title", `%${title.trim()}%`)
    .is("deleted_at", null)
    .order("last_touched_at", { ascending: false, nullsFirst: false })
    .limit(1);

  return data && data.length > 0 ? (data[0].id as string) : null;
}
