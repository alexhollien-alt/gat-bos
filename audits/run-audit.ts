import { runAll } from "./lib/invariants";
import { writeMarkdown, writeJSON, todayDate } from "./lib/report";
import { truthChecks } from "./runners/truth";
import { surfaceChecks } from "./runners/surface";
import { skillsChecks } from "./runners/skills";
import { rulesChecks } from "./runners/rules";
import { runSense } from "./runners/sense";

async function main() {
  const date = todayDate();
  const skipSense = process.argv.includes("--no-sense");
  const truthOnly = process.argv.includes("--truth-only");

  const checks = truthOnly
    ? [...truthChecks]
    : [...truthChecks, ...surfaceChecks, ...skillsChecks, ...rulesChecks];

  const t0 = Date.now();
  console.log(`AUDIT ${date} :: running ${checks.length} checks...`);
  const records = await runAll(checks);
  const checksMs = Date.now() - t0;

  // First pass: write JSON + MD without Sense, so we always have an artifact
  // even if the Sense API call fails.
  writeJSON({ date, checks: records });
  writeMarkdown({ date, checks: records });

  let sense;
  let senseMs = 0;
  let senseUsage;
  if (!skipSense && !truthOnly) {
    const t1 = Date.now();
    try {
      console.log(`AUDIT ${date} :: running Sense layer (claude-opus-4-7)...`);
      const result = await runSense(records);
      sense = result.sense;
      senseUsage = result.usage;
      senseMs = Date.now() - t1;
    } catch (err) {
      console.error(`Sense layer failed: ${(err as Error).message}`);
      console.error("Reports written without Sense block; truth/surface/skills/rules data intact.");
    }
  }

  const mdPath = writeMarkdown({ date, checks: records, sense });
  const jsonPath = writeJSON({ date, checks: records, sense });

  const red = records.filter((r) => !r.result.pass && r.result.severity === "red").length;
  const yellow = records.filter(
    (r) => r.result.severity === "yellow" || (!r.result.pass && r.result.severity !== "red"),
  ).length;

  console.log("");
  console.log(`AUDIT ${date} complete`);
  console.log(`  markdown:  ${mdPath}`);
  console.log(`  json:      ${jsonPath}`);
  console.log(`  checks:    ${records.length} (${checksMs}ms)`);
  console.log(`  red:       ${red}`);
  console.log(`  yellow:    ${yellow}`);
  if (senseUsage) {
    console.log(`  sense:     ${senseMs}ms, in=${senseUsage.input_tokens}, out=${senseUsage.output_tokens}, cache_read=${senseUsage.cache_read_input_tokens}, cache_write=${senseUsage.cache_creation_input_tokens}`);
  } else if (skipSense) {
    console.log(`  sense:     skipped (--no-sense)`);
  } else if (truthOnly) {
    console.log(`  sense:     skipped (--truth-only)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
