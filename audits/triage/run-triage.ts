import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { findLatestReport, parseReds, FailureCard } from "./lib/parse-reds";
import { createWorktree, removeWorktree, originMainSha, pushBranch, hasCommits, Worktree } from "./lib/worktree";
import { spawnSubagent, classifyResult, SubagentResult } from "./lib/spawn-subagent";
import { runSingleCheck } from "./lib/single-check";
import { writeTriageMd, TriageReason } from "./lib/triage-md";
import { commitChanges, openPr, PrResult } from "./lib/open-pr";
import { getFailureCount, recordFailure, clearStreak } from "./lib/streaks";

const REPO_ROOT = resolve(__dirname, "..", "..");
const MAX_REDS = 10;
const MAX_FAILURE_STREAK = 3;
const DEFAULT_CONCURRENCY = 4;

type Outcome =
  | { kind: "pr"; card: FailureCard; pr: PrResult; before: { severity: string; smell: string }; after: { severity: string; smell: string } }
  | { kind: "triage"; card: FailureCard; reason: TriageReason; triagePath: string; branchPushed: boolean }
  | { kind: "skipped-streak"; card: FailureCard; failures: number }
  | { kind: "stale"; card: FailureCard };

function parseArgs(): { dryRun: boolean; draft: boolean; concurrency: number; reportPath?: string } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    draft: !args.includes("--no-draft"),
    concurrency: Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? DEFAULT_CONCURRENCY),
    reportPath: args.find((a) => a.startsWith("--report="))?.split("=")[1],
  };
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function triageOne(card: FailureCard, baseSha: string, opts: { dryRun: boolean; draft: boolean; reportDate: string }): Promise<Outcome> {
  if (getFailureCount(card.check_id) >= MAX_FAILURE_STREAK) {
    return { kind: "skipped-streak", card, failures: getFailureCount(card.check_id) };
  }

  if (opts.dryRun) {
    return { kind: "triage", card, reason: "fix-incomplete", triagePath: "(dry-run; no worktree created)", branchPushed: false };
  }

  let wt: Worktree | null = null;
  try {
    wt = createWorktree(card.check_id, baseSha);
  } catch (err) {
    return {
      kind: "triage",
      card,
      reason: "crash",
      triagePath: `(failed to create worktree: ${(err as Error).message})`,
      branchPushed: false,
    };
  }

  const sub: SubagentResult = await spawnSubagent(card, wt.path);
  const verdict = classifyResult(sub);

  if (verdict === "stale") {
    clearStreak(card.check_id);
    removeWorktree(wt);
    return { kind: "stale", card };
  }

  if (verdict !== "green") {
    recordFailure(card.check_id);
    const triagePath = writeTriageMd({ worktree: wt, card, result: sub, reason: verdict });
    let branchPushed = false;
    if (hasCommits(wt)) {
      try {
        commitChanges(wt, card.check_id);
        pushBranch(wt);
        branchPushed = true;
      } catch {
        // non-fatal
      }
    }
    return { kind: "triage", card, reason: verdict, triagePath, branchPushed };
  }

  const after = await runSingleCheck(card.check_id);
  if (!after.result.pass || after.result.severity !== "green") {
    recordFailure(card.check_id);
    const triagePath = writeTriageMd({ worktree: wt, card, result: sub, reason: "fix-incomplete" });
    return { kind: "triage", card, reason: "fix-incomplete", triagePath, branchPushed: false };
  }

  const filesChanged = commitChanges(wt, card.check_id);
  if (filesChanged === 0) {
    clearStreak(card.check_id);
    removeWorktree(wt);
    return { kind: "stale", card };
  }
  pushBranch(wt);
  const pr = openPr({
    worktree: wt,
    card,
    before: { severity: "red", smell: card.smell },
    after,
    filesChanged,
    reportDate: opts.reportDate,
    draft: opts.draft,
  });
  clearStreak(card.check_id);
  return {
    kind: "pr",
    card,
    pr,
    before: { severity: "red", smell: card.smell },
    after: { severity: after.result.severity, smell: after.result.smell ?? "" },
  };
}

function writeRunLog(stamp: string, outcomes: Outcome[]): string {
  const runsDir = join(REPO_ROOT, "audits/triage/runs");
  mkdirSync(runsDir, { recursive: true });
  const path = join(runsDir, `${stamp}.json`);
  writeFileSync(path, JSON.stringify(outcomes, null, 2), "utf8");
  return path;
}

async function main() {
  const args = parseArgs();
  const { path: reportPath, date: reportDate } = args.reportPath
    ? { path: args.reportPath, date: args.reportPath.match(/audit-([\d-]+)\.json/)?.[1] ?? "unknown" }
    : findLatestReport();

  const cards = parseReds(reportPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  console.log(`AUDIT-TRIAGE ${stamp}`);
  console.log(`  report:        ${reportPath}`);
  console.log(`  date:          ${reportDate}`);
  console.log(`  reds:          ${cards.length}`);
  console.log(`  dry-run:       ${args.dryRun}`);
  console.log(`  draft PRs:     ${args.draft}`);
  console.log(`  concurrency:   ${args.concurrency}`);

  if (cards.length === 0) {
    console.log("\nNo REDs. Nothing to triage.");
    return;
  }

  if (cards.length > MAX_REDS) {
    console.error(`\n  REDs exceed MAX_REDS=${MAX_REDS}. Audit is on fire; fix manually.`);
    process.exit(2);
  }

  const baseSha = originMainSha();
  console.log(`  base:          ${baseSha.slice(0, 7)} (origin/main)`);
  console.log("");

  if (args.dryRun) {
    console.log("=== DRY RUN ===");
    for (const c of cards) {
      console.log(`\n[${c.layer}] ${c.check_id}`);
      console.log(`  title: ${c.title}`);
      console.log(`  smell: ${c.smell}`);
      console.log(`  related_paths: ${c.related_paths.length}`);
      console.log(`  recent_commits: ${c.recent_commits.length}`);
      console.log(`  would-spawn-in: ../triage-${baseSha.slice(0, 7)}-${c.check_id.replace(/[^a-zA-Z0-9._-]/g, "-")}`);
      console.log(`  streak: ${getFailureCount(c.check_id)} previous failure(s)`);
    }
    console.log("\n(no worktrees created, no claude spawned, no branches pushed, no PRs opened)");
    return;
  }

  const outcomes = await pool(cards, args.concurrency, (c) =>
    triageOne(c, baseSha, { dryRun: args.dryRun, draft: args.draft, reportDate }),
  );

  const logPath = writeRunLog(stamp, outcomes);

  console.log("\n=== Results ===");
  for (const o of outcomes) {
    switch (o.kind) {
      case "pr":
        console.log(`  [GREEN -> PR]   ${o.card.check_id}    ${o.pr.url}`);
        break;
      case "triage":
        console.log(`  [TRIAGE]        ${o.card.check_id}    reason=${o.reason}  branch-pushed=${o.branchPushed}  ${o.triagePath}`);
        break;
      case "skipped-streak":
        console.log(`  [SKIPPED]       ${o.card.check_id}    streak=${o.failures} (>= ${MAX_FAILURE_STREAK}); manual fix required`);
        break;
      case "stale":
        console.log(`  [STALE]         ${o.card.check_id}    check now passes; report was stale`);
        break;
    }
  }
  console.log(`\nrun log: ${logPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("audit-triage crashed:", err);
    process.exit(1);
  });
}
