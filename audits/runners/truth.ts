import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { Check, CheckResult } from "../lib/invariants";
import { getServiceClient } from "../lib/supabase-client";
import { isKnownIssue } from "../lib/known-issues";

const HOME = process.env.HOME ?? "/Users/alex";
const STATUS_PATH = resolve(HOME, ".claude/rules/STATUS.md");

function ok(payload: unknown, smell?: string): CheckResult {
  return { pass: true, severity: "green", payload, smell };
}
function red(payload: unknown, smell: string): CheckResult {
  return { pass: false, severity: "red", payload, smell };
}
function yellow(payload: unknown, smell: string, knownIssueId?: string): CheckResult {
  return { pass: false, severity: "yellow", payload, smell, knownIssueId };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------- Cypher bridge integrity ----------

const cypherTicketsRecent: Check = {
  id: "cypher.tickets-recent",
  layer: "truth",
  title: "5 most recent tickets have account_id, cypher_id, cypher_url, synced_at",
  run: async () => {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("tickets")
      .select("id, account_id, cypher_id, cypher_url, synced_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return red({ error: error.message }, `query failed: ${error.message}`);
    if (!data || data.length === 0) {
      const burnIn = new Date("2026-05-19T00:00:00Z");
      const postBurnIn = new Date() >= burnIn;
      return yellow(
        { count: 0, postBurnIn },
        postBurnIn
          ? "tickets table empty post-burn-in -- pull worker burn-in window expired but no live rows; confirm worker status"
          : "tickets table empty -- pull worker PARKED, awaiting burn-in",
        "cypher-pull-worker-parked",
      );
    }
    // account_id is local-write integrity (must always be set).
    // cypher_id / cypher_url / synced_at are pull-worker dependent. While the
    // pull worker is PARKED (before 2026-05-19 burn-in), tickets created in
    // that window legitimately lack those fields -- demote to yellow with
    // known-issue pointer instead of failing red.
    const accountMissing = data.filter((t) => !t.account_id);
    if (accountMissing.length > 0)
      return red(
        { rows: data, missingIds: accountMissing.map((m) => m.id) },
        `${accountMissing.length}/${data.length} tickets missing account_id (local-write integrity)`,
      );
    const cypherMissing = data.filter(
      (t) => !t.cypher_id || !t.cypher_url || !t.synced_at,
    );
    if (cypherMissing.length > 0) {
      const burnIn = new Date("2026-05-19T00:00:00Z");
      const inParkedWindow = new Date() < burnIn;
      const payload = { rows: data, missingIds: cypherMissing.map((m) => m.id) };
      const smell = `${cypherMissing.length}/${data.length} tickets missing cypher_id|cypher_url|synced_at`;
      return inParkedWindow
        ? yellow(payload, `${smell} (pull worker PARKED until 2026-05-19)`, "cypher-pull-worker-parked")
        : red(payload, smell);
    }
    return ok({ count: data.length, rows: data }, `${data.length} recent tickets fully populated`);
  },
};

const cypherTicketsActivityTrace: Check = {
  id: "cypher.tickets-activity-trace",
  layer: "truth",
  title: "Recent tickets have downstream activity_events rows",
  run: async () => {
    const sb = getServiceClient();
    const { data: tickets, error: tErr } = await sb
      .from("tickets")
      .select("id, ticket_title, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (tErr) return red({ error: tErr.message }, `tickets query failed: ${tErr.message}`);
    if (!tickets || tickets.length === 0)
      return yellow({}, "no tickets to trace (cascade from cypher.tickets-recent)", "cypher-pull-worker-parked");
    const ids = tickets.map((t) => t.id);
    const { data: events, error: eErr } = await sb
      .from("activity_events")
      .select("object_id")
      .eq("object_table", "tickets")
      .in("object_id", ids);
    if (eErr) return red({ error: eErr.message }, `activity_events query failed: ${eErr.message}`);
    const seen = new Set((events ?? []).map((e: any) => e.object_id));
    const silentInserts = tickets.filter((t) => !seen.has(t.id));
    if (silentInserts.length > 0)
      return yellow(
        {
          ticketsChecked: tickets.length,
          silentInserts: silentInserts.map((t) => ({ id: t.id, title: t.ticket_title })),
        },
        `${silentInserts.length}/${tickets.length} tickets have zero activity_events (silent insert)`,
      );
    return ok({ ticketsChecked: tickets.length }, "every recent ticket has activity_events trace");
  },
};

const cypherParkedStatus: Check = {
  id: "cypher.parked-status",
  layer: "truth",
  title: "STATUS.md still notes Slice B Cypher pull worker PARKED until 2026-05-19",
  run: async () => {
    if (!existsSync(STATUS_PATH))
      return red({ path: STATUS_PATH }, "STATUS.md missing at expected path");
    const text = readFileSync(STATUS_PATH, "utf8");
    const has = /Slice B Cypher Pull Worker.*PARKED/i.test(text);
    const today = new Date();
    const burnIn = new Date("2026-05-19T00:00:00Z");
    if (today < burnIn) {
      return has
        ? yellow({ path: STATUS_PATH }, "Cypher pull worker PARKED, expected pre-2026-05-19", "cypher-pull-worker-parked")
        : red({ path: STATUS_PATH }, "PARKED line missing from STATUS.md before burn-in window");
    }
    // After 2026-05-19, this check should flip; for now return info-only smell.
    return ok({ path: STATUS_PATH, postBurnIn: true }, "burn-in window passed -- flip this check to expect live cron");
  },
};

// ---------- Messages log truth ----------

const messagesLast50Roundtrip: Check = {
  id: "messages.last50-roundtrip",
  layer: "truth",
  title: "Last 50 sent messages_log rows have message_events round-trip",
  run: async () => {
    const sb = getServiceClient();
    const { data: logs, error: lErr } = await sb
      .from("messages_log")
      .select("id, status, provider_message_id, created_at, sent_at")
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (lErr) return red({ error: lErr.message }, `messages_log query failed: ${lErr.message}`);
    if (!logs || logs.length === 0)
      return ok({ count: 0 }, "no sent messages_log rows in window");
    const ids = logs.map((l) => l.id);
    const { data: events, error: eErr } = await sb
      .from("message_events")
      .select("message_log_id, event_type")
      .in("message_log_id", ids);
    if (eErr) return red({ error: eErr.message }, `message_events query failed: ${eErr.message}`);
    const seen = new Set((events ?? []).map((e: any) => e.message_log_id));
    const now = Date.now();
    const orphans = logs.filter((l) => !seen.has(l.id));
    const orphansOld = orphans.filter((l) => now - new Date(l.created_at).getTime() > HOUR_MS);
    const orphansPending = orphans.filter((l) => now - new Date(l.created_at).getTime() <= HOUR_MS);
    const provIdMissing = logs.filter((l) => !l.provider_message_id);

    if (provIdMissing.length > 0)
      return red(
        { provIdMissingCount: provIdMissing.length, sample: provIdMissing.slice(0, 3) },
        `${provIdMissing.length} sent rows missing provider_message_id`,
      );

    if (orphansOld.length > 0) {
      const ki = isKnownIssue("resend-webhook-broken");
      return yellow(
        {
          checked: logs.length,
          orphansOldCount: orphansOld.length,
          orphansPendingCount: orphansPending.length,
          eventCount: events?.length ?? 0,
        },
        `${orphansOld.length}/${logs.length} sent rows >1h old have zero message_events (webhook gap)`,
        ki?.id,
      );
    }
    return ok(
      { checked: logs.length, eventCount: events?.length ?? 0, pending: orphansPending.length },
      `${logs.length} sent rows, all >1h old have downstream events`,
    );
  },
};

const messagesEventInvitesTelemetry: Check = {
  id: "messages.eventinvites-telemetry",
  layer: "truth",
  title: "Last 7 days event_invites have downstream message_events",
  run: async () => {
    const sb = getServiceClient();
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data: invites, error } = await sb
      .from("event_invites")
      .select("id, status, message_log_id, sent_at, created_at")
      .gte("created_at", since)
      .is("deleted_at", null);
    if (error) return red({ error: error.message }, `event_invites query failed: ${error.message}`);
    const sent = (invites ?? []).filter((i: any) => i.status === "sent" && i.message_log_id);
    if (sent.length === 0)
      return ok({ inviteCount: invites?.length ?? 0, sentCount: 0 }, "no sent event_invites in last 7d");
    const ids = sent.map((s: any) => s.message_log_id);
    const { data: events, error: eErr } = await sb
      .from("message_events")
      .select("message_log_id")
      .in("message_log_id", ids);
    if (eErr) return red({ error: eErr.message }, `message_events query failed: ${eErr.message}`);
    const seen = new Set((events ?? []).map((e: any) => e.message_log_id));
    const orphans = sent.filter((s: any) => !seen.has(s.message_log_id));
    if (orphans.length > 0) {
      const ki = isKnownIssue("resend-webhook-broken");
      return yellow(
        { sentCount: sent.length, orphansCount: orphans.length, eventCount: events?.length ?? 0 },
        `${orphans.length}/${sent.length} sent event_invites have no message_events (webhook gap)`,
        ki?.id,
      );
    }
    return ok({ sentCount: sent.length, eventCount: events?.length ?? 0 }, "all sent event_invites have downstream events");
  },
};

const messagesRecipientShape: Check = {
  id: "messages.recipient-shape-check",
  layer: "truth",
  title: "10 recent sent messages_log rows have well-formed recipient + provider_message_id",
  run: async () => {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("messages_log")
      .select("id, recipient_email, provider_message_id, status, created_at")
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return red({ error: error.message }, `query failed: ${error.message}`);
    if (!data || data.length === 0)
      return ok({ count: 0 }, "no sent rows to sample");
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const bad = data.filter((r: any) => !emailRe.test(r.recipient_email ?? "") || !r.provider_message_id);
    if (bad.length > 0)
      return red(
        { sample: bad.slice(0, 5), totalChecked: data.length },
        `${bad.length}/${data.length} rows malformed (recipient_email or provider_message_id)`,
      );
    return ok({ checked: data.length }, "10 recent rows all well-formed");
  },
};

// ---------- Activity ledger health ----------

const activityLast24h: Check = {
  id: "activity.last24h-rows",
  layer: "truth",
  title: "activity_events received writes in the last 24h",
  run: async () => {
    const sb = getServiceClient();
    const since24 = new Date(Date.now() - DAY_MS).toISOString();
    const since72 = new Date(Date.now() - 3 * DAY_MS).toISOString();
    const sb24 = await sb
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since24)
      .is("deleted_at", null);
    if (sb24.error) return red({ error: sb24.error.message }, `query failed: ${sb24.error.message}`);
    const c24 = sb24.count ?? 0;
    if (c24 > 0) return ok({ count24h: c24 }, `${c24} activity_events in last 24h`);
    const sb72 = await sb
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since72)
      .is("deleted_at", null);
    if (sb72.error) return red({ error: sb72.error.message }, `72h query failed: ${sb72.error.message}`);
    const c72 = sb72.count ?? 0;
    if (c72 === 0)
      return red({ count24h: 0, count72h: 0 }, "zero activity_events in last 72h -- ledger silent, writeEvent likely broken");
    return yellow(
      { count24h: 0, count72h: c72 },
      `zero activity_events in last 24h (${c72} in last 72h) -- quiet day plausible, watch trend`,
    );
  },
};

async function cadenceCheckByDays(thresholdDays: number, tier: "A" | "B" | "C") {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - thresholdDays * DAY_MS).toISOString();
  const { data, error } = await sb
    .from("contacts")
    .select("id, full_name, tier, last_touchpoint")
    .eq("tier", tier)
    .is("deleted_at", null)
    .or(`last_touchpoint.is.null,last_touchpoint.lt.${cutoff}`);
  if (error) return red({ error: error.message }, `contacts query failed: ${error.message}`);
  const violators = data ?? [];
  if (violators.length === 0)
    return ok({ tier, threshold: thresholdDays, violators: 0 }, `tier ${tier} on cadence`);
  return yellow(
    {
      tier,
      threshold: thresholdDays,
      violatorCount: violators.length,
      sample: violators.slice(0, 10).map((v: any) => ({ id: v.id, name: v.full_name, last: v.last_touchpoint })),
    },
    `${violators.length} tier-${tier} contacts past ${thresholdDays}d cadence`,
  );
}

const activityCadenceA: Check = {
  id: "activity.cadence-tier-A",
  layer: "truth",
  title: "Tier A contacts touched in last 5 days",
  run: () => cadenceCheckByDays(5, "A"),
};
const activityCadenceB: Check = {
  id: "activity.cadence-tier-B",
  layer: "truth",
  title: "Tier B contacts touched in last 10 days",
  run: () => cadenceCheckByDays(10, "B"),
};
const activityCadenceC: Check = {
  id: "activity.cadence-tier-C",
  layer: "truth",
  title: "Tier C contacts touched in last 14 days",
  run: () => cadenceCheckByDays(14, "C"),
};

const activityMorningBriefCron: Check = {
  id: "activity.morning-brief-cron",
  layer: "truth",
  title: "morning_briefs has a row generated within last 36h",
  run: async () => {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("morning_briefs")
      .select("generated_at, brief_date")
      .is("deleted_at", null)
      .order("generated_at", { ascending: false })
      .limit(1);
    if (error) return red({ error: error.message }, `query failed: ${error.message}`);
    if (!data || data.length === 0)
      return yellow(
        {},
        "morning_briefs table empty -- verify cron wired in this Supabase env (vercel.json schedule + CRON_SECRET)",
      );
    const last = new Date(data[0].generated_at).getTime();
    const ageH = Math.round((Date.now() - last) / HOUR_MS);
    if (ageH > 36)
      return red(
        { lastGeneratedAt: data[0].generated_at, ageHours: ageH },
        `last morning brief is ${ageH}h old (>36h) -- cron likely silent`,
      );
    return ok({ lastGeneratedAt: data[0].generated_at, ageHours: ageH }, `morning brief ${ageH}h old`);
  },
};

// ---------- Soft-delete discipline ----------

const softDeleteDuplicates: Check = {
  id: "soft-delete.duplicate-actives",
  layer: "truth",
  title: "No duplicate active rows for unique business keys",
  run: async () => {
    const sb = getServiceClient();
    const findings: Array<{ table: string; key: string; value: string; count: number }> = [];

    const checkContacts = async () => {
      const { data, error } = await sb
        .from("contacts")
        .select("email")
        .is("deleted_at", null)
        .not("email", "is", null);
      if (error) return error.message;
      const seen = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).email?.toLowerCase();
        if (!k) continue;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      seen.forEach((n, k) => { if (n > 1) findings.push({ table: "contacts", key: "email", value: k, count: n }); });
      return null;
    };
    const checkMessages = async () => {
      const { data, error } = await sb
        .from("messages_log")
        .select("provider_message_id")
        .is("deleted_at", null)
        .not("provider_message_id", "is", null);
      if (error) return error.message;
      const seen = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).provider_message_id;
        if (!k) continue;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      seen.forEach((n, k) => { if (n > 1) findings.push({ table: "messages_log", key: "provider_message_id", value: k, count: n }); });
      return null;
    };
    const checkInvites = async () => {
      const { data, error } = await sb
        .from("event_invites")
        .select("event_id, contact_id")
        .is("deleted_at", null);
      if (error) return error.message;
      const seen = new Map<string, number>();
      for (const r of data ?? []) {
        const k = `${(r as any).event_id}|${(r as any).contact_id}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      seen.forEach((n, k) => { if (n > 1) findings.push({ table: "event_invites", key: "event_id+contact_id", value: k, count: n }); });
      return null;
    };

    const errs = (await Promise.all([checkContacts(), checkMessages(), checkInvites()])).filter(Boolean) as string[];
    if (errs.length > 0)
      return red({ errors: errs, findings }, `query errors: ${errs.join("; ")}`);
    if (findings.length > 0)
      return red({ findings }, `${findings.length} duplicate-active business keys`);
    return ok({ tablesChecked: 3 }, "no duplicate actives across contacts, messages_log, event_invites");
  },
};

const softDeleteOrphan: Check = {
  id: "soft-delete.orphan-deleted_at",
  layer: "truth",
  title: "Soft-deleted contacts not being mutated post-delete",
  run: async () => {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, deleted_at, updated_at, health_score")
      .not("deleted_at", "is", null)
      .limit(500);
    if (error) return red({ error: error.message }, `query failed: ${error.message}`);
    const dirty = (data ?? []).filter((r: any) => {
      if (!r.deleted_at || !r.updated_at) return false;
      return new Date(r.updated_at).getTime() > new Date(r.deleted_at).getTime() + 60 * 1000;
    });
    if (dirty.length > 0)
      return yellow(
        { dirtyCount: dirty.length, sample: dirty.slice(0, 5) },
        `${dirty.length} soft-deleted contacts have updated_at > deleted_at (post-delete mutation)`,
      );
    return ok({ checked: data?.length ?? 0 }, "no post-delete mutations on soft-deleted contacts");
  },
};

// ---------- Brand and scope rules ----------

// Files that LOOK like rendered output but are actually meta (prompts,
// rubrics, audit reports, drafts, practice runs, archived files). Brand
// checks scan rendered/shipped output; meta files describe the rules
// themselves and routinely contain the very strings the rules forbid
// (em dashes in prompt headers, "Christine McConnell" in scoping rubrics,
// deprecated hex listed for ban-detection).
const META_PATH_PATTERNS: RegExp[] = [
  /\/_archive\//i,
  /\/claude-project-files\//i,
  /\/PRACTICE-[^\/]+\//i,
  /\/design-package\//i,
  /-rubric(-v\d+)?\.(md|txt|html)$/i,
  /-PROMPT\.(md|txt)$/i,
  /_PROMPT\.(md|txt)$/i,
  /\/PARKED-[^\/]+$/i,
  /\/PROCEED-[^\/]+$/i,
  /\.audit\.md$/i,
  /draft-\d+-layout\.html$/i,
  // Desktop top-level archive + system buckets
  /\/\d{2}_ARCHIVE\//i,
  /\/\d{2}_SYSTEM\//i,
  /\/\d{2}_REFERENCE\//i,
  /\/cleanup-\d{4}-\d{2}-\d{2}\//i,
  /\/audit-reports?\//i,
  // Planning, brief, audit, punchlist docs (meta, not rendered output)
  /-(PLAN|BRIEF|AUDIT|PUNCHLIST|DEFECTS|OVERHAUL)\.(md|txt)$/i,
  /_(Plan|Brief|Details|Plan_v\d+)\.(md|txt)$/i,
  /CLAUDE-CODE-BRIEF\.(md|txt)$/i,
  /CONSISTENCY-AUDIT-\d{4}-\d{2}-\d{2}\.md$/i,
  /AUDIT-\d{4}-\d{2}-\d{2}\.md$/i,
  /-handoff\.(md|txt)$/i,
  /-HANDOFF\.(md|txt)$/i,
];

function isMetaPath(p: string): boolean {
  return META_PATH_PATTERNS.some((re) => re.test(p));
}

function gatherFiles(root: string, exts: string[], maxFiles = 200, sinceMs?: number): string[] {
  const out: string[] = [];
  const cutoff = sinceMs ? Date.now() - sinceMs : 0;
  function walk(dir: string, depth = 0) {
    if (out.length >= maxFiles || depth > 4) return;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) break;
      if (e.startsWith(".") || e === "node_modules") continue;
      const full = join(dir, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full, depth + 1);
      else if (st.isFile()) {
        if (cutoff && st.mtimeMs < cutoff) continue;
        if (isMetaPath(full)) continue;
        if (exts.some((x) => full.toLowerCase().endsWith(x))) out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

const brandDashes: Check = {
  id: "brand.dashes-in-recent-output",
  layer: "truth",
  title: "Em/en dashes absent from recent rendered outputs",
  run: async () => {
    const exts = [".html", ".md", ".txt"];
    const since = 30 * DAY_MS;
    const roots = [
      resolve(HOME, "Desktop"),
      resolve(HOME, "crm/audits/reports"),
    ];
    const files: string[] = [];
    for (const r of roots) if (existsSync(r)) files.push(...gatherFiles(r, exts, 200, since));
    const hits: Array<{ file: string; line: number; text: string }> = [];
    const dashRe = new RegExp("[\\u2014\\u2013]");
    for (const f of files.slice(0, 200)) {
      try {
        const text = readFileSync(f, "utf8");
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (dashRe.test(lines[i])) {
            hits.push({ file: f, line: i + 1, text: lines[i].slice(0, 160) });
            if (hits.length >= 30) break;
          }
        }
      } catch { /* skip unreadable */ }
      if (hits.length >= 30) break;
    }

    // also sample DB-rendered template strings
    const sb = getServiceClient();
    const { data: briefs } = await sb
      .from("morning_briefs")
      .select("id, brief_date, brief_text")
      .order("generated_at", { ascending: false })
      .limit(5);
    const dbHits: Array<{ source: string; id: string; text: string }> = [];
    for (const b of briefs ?? []) {
      if (b.brief_text && dashRe.test(b.brief_text)) {
        dbHits.push({ source: "morning_briefs", id: (b as any).id, text: (b as any).brief_text.slice(0, 200) });
      }
    }

    if (hits.length === 0 && dbHits.length === 0)
      return ok({ filesScanned: files.length, briefsScanned: briefs?.length ?? 0 }, "no em/en dashes found");
    return red(
      { fileHits: hits, dbHits },
      `dash hits: ${hits.length} file refs, ${dbHits.length} db rows`,
    );
  },
};

const DEPRECATED_HEX = [
  "#b31a35", "#003087", "#e63550", "#2563eb", "#C8102E",
  "#c80a0a", "#a71e27", "#0a0a0a", "#000000", "#C6B79B", "#f7f7f5",
];

const brandDeprecatedHex: Check = {
  id: "brand.deprecated-hex",
  layer: "truth",
  title: "Deprecated hex codes absent from recent rendered HTML",
  run: async () => {
    const since = 30 * DAY_MS;
    const roots = [
      resolve(HOME, "Desktop"),
      resolve(HOME, "crm/audits/reports"),
    ];
    const files: string[] = [];
    for (const r of roots) if (existsSync(r)) files.push(...gatherFiles(r, [".html"], 100, since));
    const re = new RegExp(DEPRECATED_HEX.map((h) => h.replace("#", "\\#")).join("|"), "i");
    const hits: Array<{ file: string; line: number; match: string }> = [];
    for (const f of files) {
      try {
        const text = readFileSync(f, "utf8");
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const m = lines[i].match(re);
          if (m) {
            hits.push({ file: f, line: i + 1, match: m[0] });
            if (hits.length >= 30) break;
          }
        }
      } catch { /* skip */ }
      if (hits.length >= 30) break;
    }
    if (hits.length === 0)
      return ok({ filesScanned: files.length }, "no deprecated hex in recent HTML");
    return red({ hits }, `${hits.length} deprecated-hex hits across ${new Set(hits.map((h) => h.file)).size} files`);
  },
};

const brandLenderScope: Check = {
  id: "brand.lender-scope-violation",
  layer: "truth",
  title: "Christine McConnell / Nations Lending only co-appears with Julie Jarmiolowski / Optima Camelview",
  run: async () => {
    const since = 30 * DAY_MS;
    const roots = [
      resolve(HOME, "Desktop"),
      resolve(HOME, "crm/audits/reports"),
    ];
    const files: string[] = [];
    for (const r of roots) if (existsSync(r)) files.push(...gatherFiles(r, [".html", ".md", ".txt"], 200, since));
    const lenderRe = /(Christine McConnell|Nations Lending)/i;
    const scopeRe = /(Julie Jarmiolowski|Optima Camelview)/i;
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const f of files) {
      try {
        const text = readFileSync(f, "utf8");
        if (!lenderRe.test(text)) continue;
        if (scopeRe.test(text)) continue; // co-occurrence allowed
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lenderRe.test(lines[i])) {
            violations.push({ file: f, line: i + 1, text: lines[i].slice(0, 160) });
            if (violations.length >= 20) break;
          }
        }
      } catch { /* skip */ }
      if (violations.length >= 20) break;
    }
    if (violations.length === 0)
      return ok({ filesScanned: files.length }, "no lender-scope violations in recent outputs");
    return red({ violations }, `${violations.length} lender-scope violations`);
  },
};

// ---------- Schema sanity (surfaced from probe) ----------

const schemaArhMv: Check = {
  id: "schema.agent-relationship-health-mv",
  layer: "truth",
  title: "agent_relationship_health materialized view exists",
  run: async () => {
    const sb = getServiceClient();
    const { error } = await sb.from("agent_relationship_health").select("*", { head: true, count: "exact" });
    if (error) {
      if (/Could not find the table|relation .* does not exist|schema cache/i.test(error.message))
        return red({ error: error.message }, "agent_relationship_health MV missing -- dashboard architecture rule references it");
      return red({ error: error.message }, `query failed: ${error.message}`);
    }
    return ok({}, "MV resolves");
  },
};

const schemaDealsTable: Check = {
  id: "schema.deals-table",
  layer: "truth",
  title: "deals table exists per dashboard-architecture.md",
  run: async () => {
    const sb = getServiceClient();
    const { error } = await sb.from("deals").select("*", { head: true, count: "exact" });
    if (error) {
      if (/Could not find the table|relation .* does not exist|schema cache/i.test(error.message))
        return red({ error: error.message }, "deals table missing -- dashboard-architecture.md treats it as load-bearing");
      return red({ error: error.message }, `query failed: ${error.message}`);
    }
    return ok({}, "deals table resolves");
  },
};

// ---------- Export ----------

export const truthChecks: Check[] = [
  cypherTicketsRecent,
  cypherTicketsActivityTrace,
  cypherParkedStatus,
  messagesLast50Roundtrip,
  messagesEventInvitesTelemetry,
  messagesRecipientShape,
  activityLast24h,
  activityCadenceA,
  activityCadenceB,
  activityCadenceC,
  activityMorningBriefCron,
  softDeleteDuplicates,
  softDeleteOrphan,
  brandDashes,
  brandDeprecatedHex,
  brandLenderScope,
  schemaArhMv,
  schemaDealsTable,
];

// Allow standalone invocation: `pnpm gat-audit:truth`
if (require.main === module) {
  (async () => {
    const { runAll } = await import("../lib/invariants");
    const { writeMarkdown, writeJSON, todayDate } = await import("../lib/report");
    const date = todayDate();
    const records = await runAll(truthChecks);
    const md = writeMarkdown({ date, checks: records });
    const json = writeJSON({ date, checks: records });
    console.log(`AUDIT ${date} (truth-only)`);
    console.log(`  markdown: ${md}`);
    console.log(`  json:     ${json}`);
    console.log(`  checks:   ${records.length}`);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
