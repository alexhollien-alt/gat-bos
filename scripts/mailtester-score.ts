// scripts/mailtester-score.ts <test-id> -- read the mail-tester result score.
import { chromium } from "playwright";
const id = process.argv[2]; // e.g. test-ur6lcenob
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`https://www.mail-tester.com/${id}&format=json`, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => null);
  // The JSON endpoint returns the score; fall back to the HTML page if needed.
  const txt = await page.evaluate(() => document.body.innerText).catch(() => "");
  let score: string | null = null;
  const j = txt.match(/"note"\s*:\s*"?([0-9.]+)/i) || txt.match(/([0-9](?:\.[0-9]+)?)\s*\/\s*10/);
  if (j) score = j[1];
  console.log("RAW_SNIPPET:", txt.slice(0, 300).replace(/\s+/g, " "));
  if (!score) {
    await page.goto(`https://www.mail-tester.com/${id}`, { waitUntil: "networkidle", timeout: 40000 }).catch(() => null);
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText).catch(() => "");
    const m = body.match(/([0-9](?:\.[0-9]+)?)\s*\/\s*10/);
    if (m) score = m[1];
    console.log("HTML_SNIPPET:", body.slice(0, 400).replace(/\s+/g, " "));
  }
  console.log("MAILTESTER_SCORE:", score ?? "PENDING");
  await browser.close();
})();
