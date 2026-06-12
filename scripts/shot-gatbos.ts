// scripts/shot-gatbos.ts -- log in, screenshot the /new/* redesign screens.
// Run: pnpm exec tsx scripts/shot-gatbos.ts [baseUrl]
import { join } from "node:path";
import { homedir } from "node:os";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = "alex+local@example.com";
const PASSWORD = "Testpass123!";
const desktop = homedir() + "/Desktop";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  console.log("after login url:", page.url());

  const shots: Array<[string, string]> = [
    ["/new/today", "gatbos-today"],
    ["/new/tasks", "gatbos-tasks"],
    ["/new/people", "gatbos-people"],
    ["/new/marketing", "gatbos-marketing"],
  ];
  for (const [path, name] of shots) {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    console.log(`${path} -> ${resp?.status()}`);
    await page.screenshot({ path: join(desktop, `${name}.png`), fullPage: false });
  }
  await browser.close();
  console.log("done");
})();
