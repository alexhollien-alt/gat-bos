import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { Check, CheckResult } from "../lib/invariants";

const HOME = process.env.HOME ?? "/Users/alex";
const SKILLS_DIR = resolve(HOME, ".claude/skills");
const PROJECTS_DIR = resolve(HOME, ".claude/projects/-Users-alex");
const SKILL_ROUTING_PATH = resolve(HOME, ".claude/rules/skill-routing.md");

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;

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

function listSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  const out: string[] = [];
  for (const e of readdirSync(SKILLS_DIR)) {
    if (e.startsWith(".")) continue;
    const skillMd = join(SKILLS_DIR, e, "SKILL.md");
    if (existsSync(skillMd)) out.push(e);
  }
  return out;
}

function recentJsonlFiles(maxFiles = 60): string[] {
  if (!existsSync(PROJECTS_DIR)) return [];
  const cutoff = Date.now() - WINDOW_MS;
  const entries: Array<{ path: string; mtime: number }> = [];
  for (const e of readdirSync(PROJECTS_DIR)) {
    if (!e.endsWith(".jsonl")) continue;
    const full = join(PROJECTS_DIR, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.mtimeMs < cutoff) continue;
    entries.push({ path: full, mtime: st.mtimeMs });
  }
  entries.sort((a, b) => b.mtime - a.mtime);
  return entries.slice(0, maxFiles).map((x) => x.path);
}

type InvocationIndex = {
  counts: Map<string, number>;
  filesScanned: number;
  bytesScanned: number;
};

function buildInvocationIndex(skills: string[]): InvocationIndex {
  const counts = new Map<string, number>();
  for (const s of skills) counts.set(s, 0);

  const files = recentJsonlFiles();
  let bytesScanned = 0;

  const skillNamesSorted = [...skills].sort((a, b) => b.length - a.length);
  const escaped = skillNamesSorted.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const skillSet = new Set(skills);

  const quotedRe = new RegExp(`"skill"\\s*:\\s*"(${escaped.join("|")})"`, "g");
  const skillCallRe = new RegExp(`Skill\\(\\s*"?(${escaped.join("|")})"?\\s*[,)]`, "g");
  const slashRe = new RegExp(`(^|\\s|\")\\/(${escaped.join("|")})(?=\\b|\\s|\"|\\\\n)`, "g");

  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    bytesScanned += text.length;

    const seenInFile = new Map<string, number>();
    const tally = (name: string) => {
      if (!skillSet.has(name)) return;
      seenInFile.set(name, (seenInFile.get(name) ?? 0) + 1);
    };
    let m: RegExpExecArray | null;
    quotedRe.lastIndex = 0;
    while ((m = quotedRe.exec(text)) !== null) tally(m[1]);
    skillCallRe.lastIndex = 0;
    while ((m = skillCallRe.exec(text)) !== null) tally(m[1]);
    slashRe.lastIndex = 0;
    while ((m = slashRe.exec(text)) !== null) tally(m[2]);

    seenInFile.forEach((n, k) => counts.set(k, (counts.get(k) ?? 0) + n));
  }

  return { counts, filesScanned: files.length, bytesScanned };
}

const skillsZeroInvocation: Check = {
  id: "skills.zero-invocation",
  layer: "skills",
  title: "Skills with zero invocations in last 30d",
  run: async () => {
    const skills = listSkills();
    if (skills.length === 0)
      return red({ skillsDir: SKILLS_DIR }, "no SKILL.md files found");
    const idx = buildInvocationIndex(skills);
    const zeros = skills.filter((s) => (idx.counts.get(s) ?? 0) === 0).sort();
    const total = skills.length;
    const ratio = zeros.length / total;
    const payload = {
      total,
      zeroCount: zeros.length,
      ratio: Number(ratio.toFixed(3)),
      filesScanned: idx.filesScanned,
      sample: zeros.slice(0, 30),
    };
    if (zeros.length === 0) return ok(payload, "every skill saw at least one invocation in window");
    if (ratio >= 0.5)
      return yellow(payload, `${zeros.length}/${total} skills (${(ratio * 100).toFixed(0)}%) had zero invocations in last 30d`);
    return info(payload, `${zeros.length}/${total} skills had zero invocations in last 30d`);
  },
};

const skillsHighInvocation: Check = {
  id: "skills.high-invocation",
  layer: "skills",
  title: "Top 10 most-invoked skills",
  run: async () => {
    const skills = listSkills();
    if (skills.length === 0)
      return red({}, "no SKILL.md files found");
    const idx = buildInvocationIndex(skills);
    const ranked = Array.from(idx.counts.entries())
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));
    const payload = { top: ranked, filesScanned: idx.filesScanned };
    if (ranked.length === 0)
      return yellow(payload, "no skill invocations detected in window -- jsonl scan may be miscalibrated");
    return info(payload, `top skill: ${ranked[0].id} (${ranked[0].count} invocations)`);
  },
};

const skillsMissingFromRouting: Check = {
  id: "skills.missing-from-routing",
  layer: "skills",
  title: "High-invocation skills not present in skill-routing.md",
  run: async () => {
    const skills = listSkills();
    if (skills.length === 0)
      return red({}, "no SKILL.md files found");
    if (!existsSync(SKILL_ROUTING_PATH))
      return red({ path: SKILL_ROUTING_PATH }, "skill-routing.md missing");
    const routing = readFileSync(SKILL_ROUTING_PATH, "utf8");
    const idx = buildInvocationIndex(skills);
    const HIGH = 5;
    const high = Array.from(idx.counts.entries()).filter(([, n]) => n >= HIGH).map(([id, count]) => ({ id, count }));
    const missing = high.filter((h) => !new RegExp(`\\b${h.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(routing));
    const payload = { highThreshold: HIGH, highCount: high.length, missing };
    if (missing.length === 0)
      return ok(payload, `all ${high.length} workhorse skills appear in skill-routing.md`);
    return yellow(payload, `${missing.length} workhorse skills missing from skill-routing.md`);
  },
};

const skillsDescriptionDrift: Check = {
  id: "skills.description-empty",
  layer: "skills",
  title: "SKILL.md files with empty or missing description frontmatter",
  run: async () => {
    const skills = listSkills();
    const offenders: Array<{ skill: string; reason: string }> = [];
    for (const s of skills) {
      const path = join(SKILLS_DIR, s, "SKILL.md");
      let text: string;
      try { text = readFileSync(path, "utf8"); } catch { offenders.push({ skill: s, reason: "unreadable" }); continue; }
      const fm = text.match(/^---\s*([\s\S]*?)\n---/);
      if (!fm) { offenders.push({ skill: s, reason: "no frontmatter" }); continue; }
      const desc = fm[1].match(/^description:\s*(.*)$/m);
      if (!desc || !desc[1].trim() || desc[1].trim() === "''" || desc[1].trim() === '""') {
        offenders.push({ skill: s, reason: "empty description" });
      }
    }
    if (offenders.length === 0)
      return ok({ checked: skills.length }, `${skills.length} skills, all have descriptions`);
    return yellow({ checked: skills.length, offenders: offenders.slice(0, 30), totalOffenders: offenders.length }, `${offenders.length} skills with description drift`);
  },
};

export const skillsChecks: Check[] = [
  skillsZeroInvocation,
  skillsHighInvocation,
  skillsMissingFromRouting,
  skillsDescriptionDrift,
];

if (require.main === module) {
  (async () => {
    const { runAll } = await import("../lib/invariants");
    const { writeMarkdown, writeJSON, todayDate } = await import("../lib/report");
    const date = todayDate();
    const records = await runAll(skillsChecks);
    const md = writeMarkdown({ date, checks: records });
    const json = writeJSON({ date, checks: records });
    console.log(`AUDIT ${date} (skills-only)`);
    console.log(`  markdown: ${md}`);
    console.log(`  json:     ${json}`);
    console.log(`  checks:   ${records.length}`);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
