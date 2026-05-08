export type Layer = "truth" | "surface" | "skills" | "rules" | "hygiene";
export type Severity = "red" | "yellow" | "green" | "info";

export type CheckResult = {
  pass: boolean;
  severity: Severity;
  payload: unknown;
  smell?: string;
  knownIssueId?: string;
};

export type Check = {
  id: string;
  layer: Layer;
  title: string;
  run: () => Promise<CheckResult>;
};

export type CheckRecord = {
  id: string;
  layer: Layer;
  title: string;
  result: CheckResult;
  durationMs: number;
  error?: string;
};

export async function runAll(checks: Check[]): Promise<CheckRecord[]> {
  const out: CheckRecord[] = [];
  for (const check of checks) {
    const start = Date.now();
    try {
      const result = await check.run();
      out.push({
        id: check.id,
        layer: check.layer,
        title: check.title,
        result,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      out.push({
        id: check.id,
        layer: check.layer,
        title: check.title,
        result: {
          pass: false,
          severity: "red",
          payload: null,
          smell: `check threw: ${(err as Error).message}`,
        },
        durationMs: Date.now() - start,
        error: (err as Error).stack ?? String(err),
      });
    }
  }
  return out;
}
