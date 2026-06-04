// scripts/get-mailtester.ts -- fetch a fresh mail-tester.com test address.
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.mail-tester.com/", { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);
  const found = await page.evaluate(() => {
    const re = /[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)?mail-tester\.com/i;
    const hits = new Set<string>();
    document.querySelectorAll("input,textarea").forEach((el) => {
      const v = (el as HTMLInputElement).value || "";
      const m = v.match(re);
      if (m) hits.add(m[0]);
    });
    const bodyText = document.body.innerText || "";
    let m: RegExpExecArray | null;
    const g = new RegExp(re.source, "ig");
    while ((m = g.exec(bodyText)) !== null) hits.add(m[0]);
    return Array.from(hits);
  });
  console.log("MAILTESTER_HITS:", JSON.stringify(found));
  await browser.close();
})();
