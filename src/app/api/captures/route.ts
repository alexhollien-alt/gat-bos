import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { parseCapture, type ContactIndexEntry } from "@/lib/captures/rules";
import { parseCaptureWithAI } from "@/lib/ai/capture-parse";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { extractIp } from "@/lib/rate-limit/extract-ip";
import { timingSafeEqual } from "node:crypto";
import { writeEvent } from "@/lib/activity/writeEvent";
import type { ActivityVerb } from "@/lib/activity/types";
import { inferType } from "@/lib/task-system/infer-type";
import { resolveParent } from "@/lib/task-system/resolve-parent";
import { createCadence, touchCadenceForInteraction } from "@/lib/task-system/cadence";
import {
  type CaptureHints,
  type CaptureInferred,
  type CaptureRequestBody,
  type CaptureSource,
  type CaptureTarget,
  type CaptureWarning,
  type ContactTier,
  type NodeType,
  type TaskSystemCaptureResponse,
} from "@/lib/types/task-system";

// Rate limit: 30 captures per 60s sliding window per IP. Burst-prone
// (Alex pastes a sequence of meeting notes); shared across both targets.
const CAPTURES_RATE_LIMIT = 30;
const CAPTURES_RATE_WINDOW_SEC = 60;

const ALLOWED_SOURCES: readonly CaptureSource[] = [
  "claude",
  "todoist",
  "email",
  "sms",
  "manual",
];
const ALLOWED_NODE_TYPES: readonly NodeType[] = [
  "task",
  "project",
  "area",
  "contact",
  "interaction",
  "event",
];
const ALLOWED_TIERS: readonly ContactTier[] = [1, 2, 3];

// Map inferred NodeType -> ActivityVerb for the writeEvent emission.
// project and area do not have a dedicated capture.promoted.* verb yet, so
// they ride on capture.created (still whitelisted for projection).
function verbForType(type: NodeType): ActivityVerb {
  switch (type) {
    case "task":
      return "capture.promoted.task";
    case "contact":
      return "capture.promoted.contact";
    case "interaction":
      return "capture.promoted.touchpoint";
    case "event":
      return "capture.promoted.event";
    case "project":
    case "area":
    default:
      return "capture.created";
  }
}

function statusForType(type: NodeType): string | null {
  // Sensible defaults so the new row lands in a usable state.
  // Captures inferred as 'task' from Claude default to 'inbox' for triage.
  switch (type) {
    case "task":
      return "inbox";
    case "project":
      return "active";
    case "area":
      return "live";
    case "contact":
      return "prospect";
    case "interaction":
    case "event":
      return null;
  }
  return null;
}

function verifyInternalToken(request: NextRequest): boolean {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return false;
  const provided = match[1];
  if (provided.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(token));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Rate limit (shared across both targets).
  const ip = extractIp(request.headers);
  const rl = await checkRateLimit(
    `ratelimit:captures:${ip}`,
    CAPTURES_RATE_LIMIT,
    CAPTURES_RATE_WINDOW_SEC,
  );
  if (!rl.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: CaptureRequestBody;
  try {
    body = (await request.json()) as CaptureRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body.raw_text === "string" ? body.raw_text.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  const target: CaptureTarget = body.target === "task_system" ? "task_system" : "captures";

  if (target === "captures") {
    return handleCapturesTarget(raw);
  }

  return handleTaskSystemTarget({ request, raw, body });
}

// ===========================================================================
// target = "captures" (existing behavior, unchanged)
// ===========================================================================
async function handleCapturesTarget(raw: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: contacts, error: contactsErr } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .is("deleted_at", null);

  if (contactsErr) {
    return NextResponse.json(
      { error: `Contacts lookup failed: ${contactsErr.message}` },
      { status: 500 },
    );
  }

  const index: ContactIndexEntry[] = (contacts ?? []).map((c) => ({
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
  }));

  // Slice 6: opt-in AI intent parser. Default off; rule parser stays primary.
  const aiEnabled = process.env.CAPTURES_AI_PARSE === "true";
  const parsed = aiEnabled
    ? await parseCaptureWithAI({ rawText: raw, contactsIndex: index }, user.id)
    : parseCapture({ rawText: raw, contactsIndex: index });

  const { data, error } = await supabase
    .from("captures")
    .insert({
      user_id: user.id,
      raw_text: raw,
      parsed_intent: parsed.intent,
      parsed_contact_id: parsed.contactId,
      parsed_payload: parsed.payload,
      processed: false,
    })
    .select("id, raw_text, parsed_intent, parsed_contact_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// ===========================================================================
// target = "task_system" (new -- writes to nodes, emits to activity_events)
// ===========================================================================
async function handleTaskSystemTarget(args: {
  request: NextRequest;
  raw: string;
  body: CaptureRequestBody;
}) {
  const { request, raw, body } = args;

  // Auth: session OR Bearer INTERNAL_API_TOKEN.
  // verifyCronSecret matches CRON_SECRET -- not what we want here.
  // INTERNAL_API_TOKEN matches the existing api-auth.requireApiToken pattern.
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const hasBearer = verifyInternalToken(request);

  if (!sessionUser && !hasBearer) {
    return NextResponse.json(
      { error: "Not authenticated. Provide a session cookie or Bearer INTERNAL_API_TOKEN." },
      { status: 401 },
    );
  }

  let userId: string | null = sessionUser?.id ?? null;
  if (!userId) {
    // Bearer-auth path resolves to the single-operator user via OWNER_USER_ID.
    // OWNER_USER_ID is the existing env name used by /api/intake; reusing it.
    userId = process.env.OWNER_USER_ID ?? null;
    if (!userId) {
      return NextResponse.json(
        { error: "OWNER_USER_ID env var not set; bearer-auth path cannot resolve operator user_id." },
        { status: 500 },
      );
    }
  }

  // Validate source enum if provided.
  if (body.source !== undefined && !ALLOWED_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: `source must be one of: ${ALLOWED_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  // Validate hints.type enum if provided.
  const hints: CaptureHints | undefined = body.hints;
  if (hints?.type !== undefined && !ALLOWED_NODE_TYPES.includes(hints.type)) {
    return NextResponse.json(
      { error: `hints.type must be one of: ${ALLOWED_NODE_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (hints?.tier !== undefined && !ALLOWED_TIERS.includes(hints.tier as ContactTier)) {
    return NextResponse.json(
      { error: `hints.tier must be 1, 2, or 3` },
      { status: 400 },
    );
  }

  const warnings: CaptureWarning[] = [];

  // Type inference: use hints.type if provided, else call Claude.
  let inferredType: NodeType;
  let inferredFallback = false;
  let summary: string | null = null;

  if (hints?.type) {
    inferredType = hints.type;
    const trimmed = raw.length <= 120 ? raw : raw.slice(0, 117) + "...";
    summary = trimmed || null;
  } else {
    try {
      const result = await inferType({ rawText: raw, userId });
      inferredType = result.type;
      inferredFallback = result.fallback;
      summary = result.summary;
      if (inferredFallback) {
        warnings.push({
          code: "inference_fallback",
          message: "Claude inference unavailable; defaulted to type='task' status='inbox'.",
        });
      }
    } catch (err) {
      // Defense in depth -- inferType already swallows errors but log if it
      // throws for any reason (e.g. unrelated runtime error).
      inferredType = "task";
      inferredFallback = true;
      summary = raw.length <= 120 ? raw : raw.slice(0, 117) + "...";
      warnings.push({
        code: "inference_fallback",
        message: `Inference threw: ${err instanceof Error ? err.message : String(err)}. Defaulted to type='task'.`,
      });
    }
  }

  // Parent resolution (best effort, fill-and-flag on miss).
  // Use adminClient under bearer auth; supabase server client under session
  // auth (RLS still satisfied because user_id = auth.uid()). resolveParent
  // takes a client and filters by user_id manually either way.
  const dbClient = hasBearer ? adminClient : supabase;
  const parentResolution = await resolveParent({
    type: inferredType,
    hints,
    userId,
    client: dbClient,
  });
  warnings.push(...parentResolution.warnings);

  // Tier-required check for contact type.
  let tier: ContactTier | null = null;
  if (inferredType === "contact") {
    if (hints?.tier && ALLOWED_TIERS.includes(hints.tier as ContactTier)) {
      tier = hints.tier as ContactTier;
    } else {
      warnings.push({
        code: "missing_tier",
        message: "Contact created without a tier hint; defaulted to tier 3 (target_days=30).",
      });
      tier = 3;
    }
  }

  // Title derivation. Use raw_text (trimmed/summarized for headline-style types)
  // unless hints offer something more structured. Body always carries raw_text.
  const titleSource = hints?.contact && inferredType === "contact"
    ? hints.contact
    : (summary ?? raw.slice(0, 120));
  const title = titleSource.trim() || raw.slice(0, 120);

  const nodeMetadata: Record<string, unknown> = {
    source: body.source ?? "manual",
    raw_text: raw,
    inferred: {
      type: inferredType,
      fallback: inferredFallback,
    },
  };
  if (hints?.contact) nodeMetadata.contact_hint = hints.contact;
  if (hints?.project) nodeMetadata.project_hint = hints.project;
  if (hints?.area) nodeMetadata.area_hint = hints.area;
  if (tier !== null) nodeMetadata.tier = tier;

  // Insert node row (use admin client under bearer; user-scoped under session).
  const { data: nodeRow, error: nodeErr } = await dbClient
    .from("nodes")
    .insert({
      type: inferredType,
      title,
      body: raw,
      status: statusForType(inferredType),
      user_id: userId,
      parent_id: parentResolution.parent_id,
      metadata: nodeMetadata,
      last_touched_at: new Date().toISOString(),
    })
    .select("id, type, parent_id")
    .single();

  if (nodeErr || !nodeRow) {
    return NextResponse.json(
      { error: `node insert failed: ${nodeErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Side-effects.
  if (inferredType === "contact" && tier !== null) {
    await createCadence({
      client: dbClient,
      contactId: nodeRow.id as string,
      tier,
    });
  }

  if (inferredType === "interaction" && parentResolution.parent_id) {
    // Confirm the resolved parent is actually a contact node before touching
    // its cadence. resolveParent for type='interaction' only matches
    // contacts, so this is belt-and-suspenders.
    const { data: parentNode } = await dbClient
      .from("nodes")
      .select("type")
      .eq("id", parentResolution.parent_id)
      .maybeSingle();
    if (parentNode?.type === "contact") {
      const touched = await touchCadenceForInteraction({
        client: dbClient,
        contactId: parentResolution.parent_id,
      });
      if (!touched.touched) {
        warnings.push({
          code: "unresolved_contact",
          message: "Cadence row missing for the matched contact; interaction logged but cadence not touched.",
        });
      }
    }
  }

  // Emit to activity_events. The DB trigger projects to node_events.
  await writeEvent({
    userId,
    actorId: userId,
    verb: verbForType(inferredType),
    object: { table: "nodes", id: nodeRow.id as string },
    context: {
      source: body.source ?? "manual",
      raw_text: raw,
      summary,
      hint_type: hints?.type,
      hint_contact: hints?.contact,
      hint_project: hints?.project,
      hint_area: hints?.area,
      hint_tier: hints?.tier,
      parent_id: parentResolution.parent_id,
      inferred: {
        type: inferredType,
        fallback: inferredFallback,
      },
    },
  });

  const inferred: CaptureInferred = {
    type: inferredType,
    parent_id: parentResolution.parent_id,
    tier,
    summary,
    fallback: inferredFallback,
  };

  const response: TaskSystemCaptureResponse = {
    id: nodeRow.id as string,
    type: inferredType,
    inferred,
    warnings,
  };

  return NextResponse.json(response, { status: 201 });
}

// ===========================================================================
// GET (unchanged) -- lists existing captures table rows.
// ===========================================================================
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("captures")
    .select(
      "id, raw_text, parsed_intent, parsed_contact_id, parsed_payload, processed, created_at, contacts:parsed_contact_id(id, first_name, last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
