import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { Check, CheckResult } from "../lib/invariants";

const HOME = process.env.HOME ?? "/Users/alex";
const RULES_DIR = resolve(HOME, ".claude/rules");
const SKILLS_DIR = resolve(HOME, ".claude/skills");
const PLANS_DIR = resolve(HOME, ".claude/plans");
const STATUS_PATH = resolve(HOME, ".claude/state/STATUS.md");
const STATUS_PATH_LEGACY = resolve(HOME, ".claude/rules/STATUS.md");
const CLAUDE_MD = resolve(HOME, "CLAUDE.md");
const BLOCKERS_MD = resolve(HOME, "crm/BLOCKERS.md");

const DAY_MS = 24 * 60 * 60 * 1000;

function ok(payload: unknown, smell?: string): CheckResult {
  return { pass: true, severity: "green", payload, smell };
}
function red(payload: unknown, smell: string): CheckResult {
  return { pass: false, severity: "red", payload, smell };
}
function yellow(payload: unknown, smell: string): CheckResult {
  return { pass: false, severity: "yellow", payload, smell };
}
function info(payload: unknown, smell: string): CheckResult {
  return { pass: true, severity: "info", payload, smell };
}

function readSafe(path: string): string | null {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => join(dir, f));
}

function listAgentRulesets(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  const out: string[] = [];
  for (const skill of readdirSync(SKILLS_DIR)) {
    const agentsDir = join(SKILLS_DIR, skill, "agents");
    if (!existsSync(agentsDir)) continue;
    let entries: string[] = [];
    try { entries = readdirSync(agentsDir); } catch { continue; }
    for (const e of entries) {
      if (e.endsWith(".md")) out.push(join(agentsDir, e));
    }
  }
  return out;
}

const rulesCorpus: Check = {
  id: "rules.corpus-shape",
  layer: "rules",
  title: "Rule corpus reachable (rules dir, CLAUDE.md, agent rulesets)",
  run: async () => {
    const ruleFiles = listFiles(RULES_DIR, ".md");
    const agentRulesets = listAgentRulesets();
    const claudeMd = existsSync(CLAUDE_MD);
    const totalBytes = [
      ...ruleFiles,
      ...agentRulesets,
      ...(claudeMd ? [CLAUDE_MD] : []),
    ].reduce((acc, p) => {
      try { return acc + statSync(p).size; } catch { return acc; }
    }, 0);

    const payload = {
      ruleFileCount: ruleFiles.length,
      ruleFiles: ruleFiles.map((p) => p.replace(HOME, "~")),
      agentRulesetCount: agentRulesets.length,
      claudeMdPresent: claudeMd,
      totalBytes,
    };

    if (!claudeMd) return red(payload, "~/CLAUDE.md missing");
    if (ruleFiles.length === 0) return red(payload, "~/.claude/rules/ has no .md files");
    return info(payload, `${ruleFiles.length} rule files, ${agentRulesets.length} agent rulesets, ${(totalBytes / 1024).toFixed(1)}KB total`);
  },
};

const rulesDuplicateNumbers: Check = {
  id: "rules.duplicate-numbers",
  layer: "rules",
  title: "standing-rules.md has no duplicate or out-of-sequence Rule N headings",
  run: async () => {
    const path = resolve(RULES_DIR, "standing-rules.md");
    const text = readSafe(path);
    if (text === null) return red({ path }, "standing-rules.md missing");
    const headingRe = /^##\s+(\d+)\.\s+/gm;
    const seen = new Map<number, number>();
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    const duplicates = Array.from(seen.entries()).filter(([, c]) => c > 1).map(([n, c]) => ({ rule: n, count: c }));
    const numbers = Array.from(seen.keys()).sort((a, b) => a - b);
    const gaps: number[] = [];
    if (numbers.length > 0) {
      for (let i = numbers[0]; i <= numbers[numbers.length - 1]; i++) {
        if (!seen.has(i)) gaps.push(i);
      }
    }
    const payload = { numbers, duplicates, gaps };
    if (duplicates.length > 0)
      return red(payload, `duplicate Rule numbers: ${duplicates.map((d) => `${d.rule}x${d.count}`).join(", ")}`);
    if (gaps.length > 0)
      return yellow(payload, `gaps in Rule numbering: ${gaps.join(", ")}`);
    return ok(payload, `${numbers.length} sequential rules, no duplicates`);
  },
};

const rulesSupersedeMarkers: Check = {
  id: "rules.supersede-markers",
  layer: "rules",
  title: "feedback_*.md supersede markers reflected in canonical rules",
  run: async () => {
    const memDir = resolve(HOME, ".claude/projects/-Users-alex/memory");
    if (!existsSync(memDir))
      return info({}, "no auto-memory dir; skipping supersede scan");
    let entries: string[] = [];
    try { entries = readdirSync(memDir); } catch { return info({}, "memory dir unreadable"); }
    const feedback = entries.filter((e) => e.startsWith("feedback_") && e.endsWith(".md"));
    const supersedes: Array<{ file: string; line: number; text: string }> = [];
    const re = /supersedes\s+(rule\s+\d+|brand\.md|standing-rules\.md|task-routing\.md|skill-routing\.md|tool-routing\.md)/i;
    for (const f of feedback) {
      const text = readSafe(join(memDir, f));
      if (!text) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          supersedes.push({ file: f, line: i + 1, text: lines[i].slice(0, 200) });
        }
      }
    }
    const payload = { feedbackCount: feedback.length, supersedeCount: supersedes.length, sample: supersedes.slice(0, 10) };
    if (supersedes.length === 0)
      return ok(payload, `${feedback.length} feedback files scanned, no supersede markers`);
    return info(payload, `${supersedes.length} supersede markers across ${new Set(supersedes.map((s) => s.file)).size} feedback files (Sense layer reviews)`);
  },
};

const stalePlans: Check = {
  id: "hygiene.stale-plans",
  layer: "hygiene",
  title: "Plan files >30d old not under archive/",
  run: async () => {
    if (!existsSync(PLANS_DIR))
      return info({}, "no plans dir; skipping");
    const cutoff = Date.now() - 30 * DAY_MS;
    const stale: Array<{ path: string; ageDays: number }> = [];
    let entries: string[] = [];
    try { entries = readdirSync(PLANS_DIR); } catch { return red({}, "plans dir unreadable"); }
    for (const e of entries) {
      if (!e.endsWith(".md")) continue;
      const full = join(PLANS_DIR, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.mtimeMs < cutoff) {
        stale.push({ path: full.replace(HOME, "~"), ageDays: Math.floor((Date.now() - st.mtimeMs) / DAY_MS) });
      }
    }
    const payload = { staleCount: stale.length, sample: stale.slice(0, 15) };
    if (stale.length === 0)
      return ok(payload, "no stale plan files");
    return yellow(payload, `${stale.length} plan files >30d old (move to archive/ or delete)`);
  },
};

const statusMdSize: Check = {
  id: "hygiene.status-md-size",
  layer: "hygiene",
  title: "STATUS.md under 20KB self-healing guardrail",
  run: async () => {
    const path = existsSync(STATUS_PATH) ? STATUS_PATH : STATUS_PATH_LEGACY;
    if (!existsSync(path))
      return red({ tried: [STATUS_PATH, STATUS_PATH_LEGACY] }, "STATUS.md missing at both expected paths");
    const size = statSync(path).size;
    const payload = { path: path.replace(HOME, "~"), bytes: size, kb: Number((size / 1024).toFixed(1)) };
    if (size > 20 * 1024)
      return yellow(payload, `STATUS.md is ${(size / 1024).toFixed(1)}KB (>20KB threshold; archive older entries)`);
    return ok(payload, `STATUS.md is ${(size / 1024).toFixed(1)}KB`);
  },
};

const blockersStale: Check = {
  id: "hygiene.blockers-stale",
  layer: "hygiene",
  title: "BLOCKERS.md entries >14d old without [updated] marker",
  run: async () => {
    if (!existsSync(BLOCKERS_MD))
      return info({}, "no BLOCKERS.md; skipping");
    const text = readSafe(BLOCKERS_MD);
    if (!text) return red({}, "BLOCKERS.md unreadable");
    const lines = text.split(/\r?\n/);
    const dateRe = /(\d{4}-\d{2}-\d{2})/;
    const cutoff = Date.now() - 14 * DAY_MS;
    const stale: Array<{ line: number; date: string; text: string }> = [];
    let inOpen = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^##\s+Open\b/i.test(line)) { inOpen = true; continue; }
      if (/^##\s+Resolved\b/i.test(line)) { inOpen = false; continue; }
      if (!inOpen) continue;
      const m = line.match(dateRe);
      if (!m) continue;
      const ts = new Date(m[1]).getTime();
      if (isNaN(ts) || ts >= cutoff) continue;
      if (/\[updated\]/i.test(line)) continue;
      stale.push({ line: i + 1, date: m[1], text: line.slice(0, 200) });
    }
    const payload = { staleCount: stale.length, sample: stale.slice(0, 15) };
    if (stale.length === 0)
      return ok(payload, "no stale open blockers");
    return yellow(payload, `${stale.length} open blockers >14d old without [updated] marker`);
  },
};

export const rulesChecks: Check[] = [
  rulesCorpus,
  rulesDuplicateNumbers,
  rulesSupersedeMarkers,
  stalePlans,
  statusMdSize,
  blockersStale,
];

if (require.main === module) {
  (async () => {
    const { runAll } = await import("../lib/invariants");
    const { writeMarkdown, writeJSON, todayDate } = await import("../lib/report");
    const date = todayDate();
    const records = await runAll(rulesChecks);
    const md = writeMarkdown({ date, checks: records });
    const json = writeJSON({ date, checks: records });
    console.log(`AUDIT ${date} (rules-only)`);
    console.log(`  markdown: ${md}`);
    console.log(`  json:     ${json}`);
    console.log(`  checks:   ${records.length}`);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
