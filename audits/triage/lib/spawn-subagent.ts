import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FailureCard } from "./parse-reds";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const PROMPT_PATH = resolve(REPO_ROOT, "audits/triage/prompts/subagent.md");

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Grep",
  "Glob",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git status:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(find:*)",
  "Bash(pnpm exec tsx:*)",
  "Bash(pnpm gat-audit:*)",
  "Bash(node:*)",
].join(",");

const DISALLOWED_TOOLS = [
  "Bash(git push:*)",
  "Bash(git commit:*)",
  "Bash(gh:*)",
  "Bash(vercel:*)",
  "Bash(supabase:*)",
  "Bash(rm:*)",
].join(",");

export type SubagentResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

export async function spawnSubagent(card: FailureCard, worktreePath: string): Promise<SubagentResult> {
  const promptHeader = readFileSync(PROMPT_PATH, "utf8");
  const userMessage = `${promptHeader}\n\n---\n\n# FailureCard\n\n\`\`\`json\n${JSON.stringify(card, null, 2)}\n\`\`\`\n\nBegin.`;

  return new Promise((resolvePromise) => {
    const start = Date.now();
    const child = spawn(
      "claude",
      [
        "-p",
        userMessage,
        "--allowedTools",
        ALLOWED_TOOLS,
        "--disallowedTools",
        DISALLOWED_TOOLS,
        "--permission-mode",
        "acceptEdits",
      ],
      {
        cwd: worktreePath,
        env: { ...process.env, AUDIT_TRIAGE: "1" },
      },
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        timedOut,
      });
    });
  });
}

export function classifyResult(r: SubagentResult): "green" | "stale" | "fix-incomplete" | "structural" | "crash" {
  if (r.timedOut) return "crash";
  switch (r.exitCode) {
    case 0:
      return "green";
    case 2:
      return "fix-incomplete";
    case 3:
      return "stale";
    case 4:
      return "structural";
    default:
      return "crash";
  }
}
