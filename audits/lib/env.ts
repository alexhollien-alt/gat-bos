import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    throw new Error(`.env.local not found at ${path}. Run from ~/crm/.`);
  }
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
  loaded = true;
}
