import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FailureCard } from "./parse-reds";
import { SubagentResult } from "./spawn-subagent";
import { Worktree } from "./worktree";

export type TriageReason = "fix-incomplete" | "structural" | "crash" | "stale";

export function writeTriageMd(opts: {
  worktree: Worktree;
  card: FailureCard;
  result: SubagentResult;
  reason: TriageReason;
}): string {
  const { worktree, card, result, reason } = opts;
  const path = join(worktree.path, `TRIAGE-${card.check_id}.md`);

  const lines: string[] = [];
  lines.push(`# TRIAGE :: ${card.check_id}`);
  lines.push("");
  lines.push(`Reason: **${reason}**`);
  lines.push(`Layer: ${card.layer}`);
  lines.push(`Title: ${card.title}`);
  lines.push(`Smell: ${card.smell}`);
  lines.push(`Branch: ${worktree.branch}`);
  lines.push(`Base SHA: ${worktree.baseSha}`);
  lines.push("");

  lines.push("## Sub-agent exit");
  lines.push("");
  lines.push(`- exit code: ${result.exitCode}`);
  lines.push(`- duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push(`- timed out: ${result.timedOut}`);
  lines.push("");

  lines.push("## Hypotheses");
  lines.push("");
  switch (reason) {
    case "fix-incomplete":
      lines.push("The sub-agent applied changes but the rerun did not return GREEN. Likely causes:");
      lines.push("- Partial fix; some hits remain ambiguous.");
      lines.push("- The check measures something the fix did not address.");
      lines.push("- Side effect: fix introduced a different violation.");
      break;
    case "structural":
      lines.push("The check cannot be made GREEN without editing the runner or system config. The sub-agent refused to alter the runner. Inspect the runner source listed below.");
      break;
    case "crash":
      lines.push("The sub-agent crashed or timed out (10 min cap). Inspect stderr below.");
      break;
    case "stale":
      lines.push("The report was stale; the check passed without any change. No action needed; the next audit run will confirm.");
      break;
  }
  lines.push("");

  lines.push("## What ran");
  lines.push("");
  lines.push(`Runner: \`${card.runner_source}\``);
  lines.push(`Rerun: \`${card.rerun_command}\``);
  lines.push("");

  lines.push("## Related paths");
  lines.push("");
  if (card.related_paths.length === 0) {
    lines.push("(none extracted)");
  } else {
    for (const p of card.related_paths) lines.push(`- \`${p}\``);
  }
  lines.push("");

  lines.push("## Recent commits touching those paths");
  lines.push("");
  if (card.recent_commits.length === 0) {
    lines.push("(none)");
  } else {
    for (const c of card.recent_commits) lines.push(`- ${c}`);
  }
  lines.push("");

  lines.push("## Sub-agent stdout (tail)");
  lines.push("");
  lines.push("```");
  lines.push(result.stdout.slice(-3000));
  lines.push("```");
  lines.push("");

  lines.push("## Sub-agent stderr (tail)");
  lines.push("");
  lines.push("```");
  lines.push(result.stderr.slice(-1500));
  lines.push("```");
  lines.push("");

  lines.push("## Next step");
  lines.push("");
  lines.push("To inspect manually:");
  lines.push("```bash");
  lines.push(`cd ${worktree.path}`);
  lines.push(`${card.rerun_command}`);
  lines.push("```");
  lines.push("");
  lines.push("To open a PR after fixing manually:");
  lines.push("```bash");
  lines.push(`cd ${worktree.path}`);
  lines.push(`git add -A && git commit -m "triage: ${card.check_id}"`);
  lines.push(`git push -u origin ${worktree.branch}`);
  lines.push(`gh pr create --title "triage: ${card.check_id}" --body "See TRIAGE-${card.check_id}.md"`);
  lines.push("```");

  writeFileSync(path, lines.join("\n"), "utf8");
  return path;
}
