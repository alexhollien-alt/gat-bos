import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { CheckRecord } from "./invariants";
import { KNOWN_ISSUES } from "./known-issues";

export type SenseOutput = {
  broken: Array<{ item: string; cite: string; why: string }>;
  drifting: Array<{ item: string; cite: string; why: string }>;
  surprising: Array<{ item: string; cite: string; why: string }>;
  top3: Array<{ item: string; cite: string; why: string }>;
};

export type ReportInput = {
  date: string;
  checks: CheckRecord[];
  sense?: SenseOutput;
};

const REPORTS_DIR = resolve(process.cwd(), "audits/reports");

function ensureDir() {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

function bucket(records: CheckRecord[]) {
  const red = records.filter((r) => !r.result.pass && r.result.severity === "red");
  const yellow = records.filter(
    (r) => r.result.severity === "yellow" || (!r.result.pass && r.result.severity !== "red"),
  );
  const green = records.filter((r) => r.result.pass && r.result.severity !== "yellow");
  return { red, yellow, green };
}

function renderRow(r: CheckRecord): string {
  const status = r.result.pass ? "PASS" : "FAIL";
  const sev = r.result.severity.toUpperCase();
  const smell = r.result.smell ?? "";
  return `| \`${r.id}\` | ${r.layer} | ${sev} | ${status} | ${smell.replace(/\|/g, "\\|")} |`;
}

export function writeMarkdown(input: ReportInput): string {
  ensureDir();
  const { date, checks, sense } = input;
  const { red, yellow, green } = bucket(checks);
  const lines: string[] = [];

  lines.push(`# AUDIT :: ${date}`);
  lines.push("");
  lines.push(`Checks run: ${checks.length}. Red: ${red.length}. Yellow: ${yellow.length}. Green: ${green.length}.`);
  lines.push("");

  if (sense) {
    lines.push("## Top 3 (Sense Layer)");
    lines.push("");
    if (sense.top3.length === 0) lines.push("_None._");
    for (const t of sense.top3) lines.push(`- **${t.item}** -- ${t.why} (${t.cite})`);
    lines.push("");
  }

  lines.push("## What's Broken");
  lines.push("");
  if (red.length === 0) lines.push("_No red findings._");
  for (const r of red) {
    lines.push(`- **${r.id}** (${r.layer}) -- ${r.result.smell ?? r.title}`);
    if (r.error) lines.push(`  - error: \`${r.error.split("\n")[0]}\``);
  }
  lines.push("");

  lines.push("## What's Drifting");
  lines.push("");
  if (yellow.length === 0 && (!sense || sense.drifting.length === 0)) {
    lines.push("_No yellow findings._");
  }
  for (const r of yellow) {
    const ki = r.result.knownIssueId ? ` _[${r.result.knownIssueId}]_` : "";
    lines.push(`- **${r.id}** (${r.layer})${ki} -- ${r.result.smell ?? r.title}`);
  }
  if (sense) {
    for (const d of sense.drifting) lines.push(`- ${d.item} -- ${d.why} (${d.cite})`);
  }
  lines.push("");

  if (sense) {
    lines.push("## What Surprised Me");
    lines.push("");
    if (sense.surprising.length === 0) lines.push("_Nothing surprising._");
    for (const s of sense.surprising) lines.push(`- ${s.item} -- ${s.why} (${s.cite})`);
    lines.push("");
  }

  lines.push("## Known Issues (informational, not findings)");
  lines.push("");
  for (const k of KNOWN_ISSUES) {
    lines.push(`- **${k.id}** (${k.status}, since ${k.since}) -- ${k.description}`);
    lines.push(`  - pointer: ${k.pointer}`);
  }
  lines.push("");

  lines.push("## Raw Check Results");
  lines.push("");
  lines.push("| id | layer | severity | status | smell |");
  lines.push("|---|---|---|---|---|");
  for (const r of checks) lines.push(renderRow(r));
  lines.push("");

  const md = lines.join("\n");
  const path = resolve(REPORTS_DIR, `AUDIT-${date}.md`);
  writeFileSync(path, md, "utf8");
  return path;
}

export function writeJSON(input: ReportInput): string {
  ensureDir();
  const path = resolve(REPORTS_DIR, `audit-${input.date}.json`);
  writeFileSync(
    path,
    JSON.stringify(
      {
        date: input.date,
        checks: input.checks,
        sense: input.sense ?? null,
        knownIssues: KNOWN_ISSUES,
      },
      null,
      2,
    ),
    "utf8",
  );
  return path;
}

export function todayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
