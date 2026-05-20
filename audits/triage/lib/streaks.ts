import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const STREAKS_PATH = resolve(REPO_ROOT, "audits/triage/state/streaks.json");

type StreakMap = Record<string, { failures: number; lastFailureAt: string }>;

function load(): StreakMap {
  if (!existsSync(STREAKS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STREAKS_PATH, "utf8")) as StreakMap;
  } catch {
    return {};
  }
}

function save(map: StreakMap): void {
  mkdirSync(dirname(STREAKS_PATH), { recursive: true });
  writeFileSync(STREAKS_PATH, JSON.stringify(map, null, 2), "utf8");
}

export function getFailureCount(checkId: string): number {
  return load()[checkId]?.failures ?? 0;
}

export function recordFailure(checkId: string): number {
  const map = load();
  const cur = map[checkId] ?? { failures: 0, lastFailureAt: "" };
  cur.failures += 1;
  cur.lastFailureAt = new Date().toISOString();
  map[checkId] = cur;
  save(map);
  return cur.failures;
}

export function clearStreak(checkId: string): void {
  const map = load();
  delete map[checkId];
  save(map);
}
