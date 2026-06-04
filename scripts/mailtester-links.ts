// scripts/mailtester-links.ts <test-id> -- open the mail-tester message and
// list the email's links, so we can see if Resend rewrote them for click tracking.
import { chromium } from "playwright";
const id = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`https://www.mail-tester.com/${id}`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);
  // Try to open the raw message view.
  const viewLink = await page.locator('a:has-text("view your message"), a:has-text("View your message"), a:has-text("Click here to view")').first().getAttribute("href").catch(() => null);
  if (viewLink) {
    const url = viewLink.startsWith("http") ? viewLink : `https://www.mail-tester.com${viewLink}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 40000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map((a) => (a as HTMLAnchorElement).href).filter((h) => h && !h.includes("mail-tester.com")));
  console.log("LINKS:", JSON.stringify(Array.from(new Set(hrefs)).slice(0, 20), null, 2));
  await browser.close();
})();
