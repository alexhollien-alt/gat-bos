// scripts/shot-url.ts -- screenshot a URL at desktop + mobile widths.
// Run: pnpm exec tsx scripts/shot-url.ts <url> <outBaseName>
import { join } from "node:path";
import { homedir } from "node:os";
import { chromium } from "playwright";

const url = process.argv[2];
const base = process.argv[3] ?? "shot";
const desktop = homedir() + "/Desktop";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  console.log("STATUS:", resp?.status());
  const title = await page.title();
  console.log("TITLE:", title);
  const h1 = await page.locator("h1").first().textContent().catch(() => null);
  console.log("H1:", h1);
  await page.screenshot({ path: join(desktop, `${base}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(desktop, `${base}-mobile.png`), fullPage: true });
  await browser.close();
  console.log("PNG:", join(desktop, `${base}-desktop.png`));
  console.log("PNG:", join(desktop, `${base}-mobile.png`));
})();
