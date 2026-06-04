// scripts/shot-authed.ts -- log in, then screenshot authed blast pages.
// Run: pnpm exec tsx scripts/shot-authed.ts <blastId>
import { join } from "node:path";
import { homedir } from "node:os";
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EMAIL = "alex+local@example.com";
const PASSWORD = "Testpass123!";
const blastId = process.argv[2];
const desktop = homedir() + "/Desktop";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

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
    ["/blasts/new", "oh-intake"],
    [`/blasts/${blastId}/preview`, "oh-preview"],
    [`/blasts/${blastId}`, "oh-dashboard"],
  ];
  for (const [path, name] of shots) {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    console.log(`${path} -> ${resp?.status()}`);
    await page.screenshot({ path: join(desktop, `${name}.png`), fullPage: true });
  }
  await browser.close();
  console.log("done");
})();
