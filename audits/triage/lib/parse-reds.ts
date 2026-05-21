import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

export type FailureCard = {
  check_id: string;
  layer: string;
  title: string;
  smell: string;
  payload: unknown;
  related_paths: string[];
  recent_commits: string[];
  runner_source: string;
  rerun_command: string;
};

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const REPORTS_DIR = resolve(REPO_ROOT, "audits/reports");

const RUNNER_BY_LAYER: Record<string, string> = {
  truth: "audits/runners/truth.ts",
  surface: "audits/runners/surface.ts",
  skills: "audits/runners/skills.ts",
  rules: "audits/runners/rules.ts",
};

export function findLatestReport(): { path: string; date: string } {
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("audit-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("no audit reports found");
  const latest = files[files.length - 1];
  const date = latest.replace(/^audit-/, "").replace(/\.json$/, "");
  return { path: join(REPORTS_DIR, latest), date };
}

function extractPathsFromPayload(payload: unknown): string[] {
  const paths = new Set<string>();
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") {
      if (v.startsWith("/") && (v.includes(".html") || v.includes(".ts") || v.includes(".md") || v.includes(".tsx") || v.includes(".css"))) {
        paths.add(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v === "object") {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    }
  };
  walk(payload);
  return Array.from(paths).slice(0, 30);
}

function recentCommitsForPaths(paths: string[]): string[] {
  if (paths.length === 0) {
    try {
      const out = execSync(`git -C "${REPO_ROOT}" log --oneline -n 5`, { encoding: "utf8" });
      return out.trim().split("\n");
    } catch {
      return [];
    }
  }
  const insideRepo = paths.filter((p) => p.startsWith(REPO_ROOT));
  if (insideRepo.length === 0) {
    try {
      const out = execSync(`git -C "${REPO_ROOT}" log --oneline -n 5`, { encoding: "utf8" });
      return out.trim().split("\n");
    } catch {
      return [];
    }
  }
  const args = insideRepo.map((p) => `"${p}"`).join(" ");
  try {
    const out = execSync(`git -C "${REPO_ROOT}" log --oneline -n 5 -- ${args}`, { encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function parseReds(reportPath: string): FailureCard[] {
  const data = JSON.parse(readFileSync(reportPath, "utf8")) as {
    checks: Array<{
      id: string;
      layer: string;
      title: string;
      result: { pass: boolean; severity: string; payload: unknown; smell?: string };
    }>;
  };
  const reds = data.checks.filter((c) => c.result.severity === "red" && !c.result.pass);
  const cards: FailureCard[] = reds.map((r) => {
    const related = extractPathsFromPayload(r.result.payload);
    return {
      check_id: r.id,
      layer: r.layer,
      title: r.title,
      smell: r.result.smell ?? "",
      payload: r.result.payload,
      related_paths: related,
      recent_commits: recentCommitsForPaths(related),
      runner_source: RUNNER_BY_LAYER[r.layer] ?? `audits/runners/${r.layer}.ts`,
      rerun_command: `pnpm exec tsx audits/triage/lib/single-check.ts ${r.id}`,
    };
  });
  return cards;
}

if (require.main === module) {
  const { path, date } = findLatestReport();
  const cards = parseReds(path);
  console.log(`report: ${path}`);
  console.log(`date:   ${date}`);
  console.log(`reds:   ${cards.length}`);
  for (const c of cards) {
    console.log(`\n--- ${c.check_id} [${c.layer}] ---`);
    console.log(`  title: ${c.title}`);
    console.log(`  smell: ${c.smell}`);
    console.log(`  related_paths: ${c.related_paths.length}`);
    console.log(`  runner_source: ${c.runner_source}`);
  }
}
