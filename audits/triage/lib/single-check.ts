import { truthChecks } from "../../runners/truth";
import { surfaceChecks } from "../../runners/surface";
import { skillsChecks } from "../../runners/skills";
import { rulesChecks } from "../../runners/rules";
import { Check, CheckRecord } from "../../lib/invariants";

const ALL: Check[] = [...truthChecks, ...surfaceChecks, ...skillsChecks, ...rulesChecks];

export async function runSingleCheck(id: string): Promise<CheckRecord> {
  const check = ALL.find((c) => c.id === id);
  if (!check) {
    throw new Error(`check not found: ${id}. known ids: ${ALL.map((c) => c.id).join(", ")}`);
  }
  const start = Date.now();
  try {
    const result = await check.run();
    return {
      id: check.id,
      layer: check.layer,
      title: check.title,
      result,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
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
    };
  }
}

if (require.main === module) {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: tsx audits/triage/lib/single-check.ts <check-id>");
    process.exit(64);
  }
  runSingleCheck(id)
    .then((rec) => {
      console.log(JSON.stringify(rec, null, 2));
      const ok = rec.result.pass && rec.result.severity === "green";
      process.exit(ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(2);
    });
}
