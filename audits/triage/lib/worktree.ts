import { execSync } from "node:child_process";
import { existsSync, symlinkSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export type Worktree = {
  path: string;
  branch: string;
  baseSha: string;
};

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60);
}

export function currentSha(): string {
  return execSync(`git -C "${REPO_ROOT}" rev-parse HEAD`, { encoding: "utf8" }).trim();
}

export function originMainSha(): string {
  try {
    execSync(`git -C "${REPO_ROOT}" fetch origin main --quiet`, { encoding: "utf8" });
  } catch {
    // fetch may fail offline; fall through to local ref
  }
  return execSync(`git -C "${REPO_ROOT}" rev-parse origin/main`, { encoding: "utf8" }).trim();
}

export function createWorktree(checkId: string, baseSha: string): Worktree {
  const short = baseSha.slice(0, 7);
  const safe = safeId(checkId);
  const branch = `auto-triage/${safe}-${short}`;
  const path = resolve(REPO_ROOT, "..", `triage-${short}-${safe}`);

  if (existsSync(path)) {
    throw new Error(`worktree already exists at ${path}; clean up first`);
  }

  execSync(`git -C "${REPO_ROOT}" worktree add "${path}" -b "${branch}" "${baseSha}"`, {
    encoding: "utf8",
    stdio: "pipe",
  });

  const nm = join(path, "node_modules");
  if (!existsSync(nm)) {
    try {
      symlinkSync(join(REPO_ROOT, "node_modules"), nm, "dir");
    } catch {
      // non-fatal; sub-agent will surface if it actually needs deps
    }
  }

  return { path, branch, baseSha };
}

export function removeWorktree(wt: Worktree, opts: { force?: boolean } = {}): void {
  const force = opts.force ? "--force" : "";
  try {
    execSync(`git -C "${REPO_ROOT}" worktree remove ${force} "${wt.path}"`, {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err) {
    const runsDir = join(REPO_ROOT, "audits/triage/runs");
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const log = join(runsDir, `orphan-${stamp}.txt`);
    execSync(`echo "orphan: ${wt.path}\\nbranch: ${wt.branch}\\nerror: ${(err as Error).message}" >> "${log}"`);
  }
}

export function pushBranch(wt: Worktree): void {
  execSync(`git -C "${wt.path}" push -u origin "${wt.branch}"`, {
    encoding: "utf8",
    stdio: "pipe",
  });
}

export function hasCommits(wt: Worktree): boolean {
  const log = execSync(`git -C "${wt.path}" log "${wt.baseSha}..HEAD" --oneline`, {
    encoding: "utf8",
  }).trim();
  return log.length > 0;
}
