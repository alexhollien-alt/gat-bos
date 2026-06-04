// scripts/preview-open-house.ts
// Local visual check for the open house email. Builds a sample, writes HTML,
// and screenshots both the normal render and an images-blocked variant.
// Run: pnpm exec tsx scripts/preview-open-house.ts
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { buildOpenHouseEmail } from "../src/lib/open-house/email";

const sample = buildOpenHouseEmail({
  recipientFirstName: "Maria",
  agent: {
    name: "Denise van den Bossche",
    firstName: "Denise",
    brokerage: "Coldwell Banker",
    email: "denise@example.com",
    phone: "(480) 555-0142",
  },
  blast: {
    address: "7012 E Berneil Lane",
    city: "Scottsdale",
    state: "AZ",
    price: "$2,395,000",
    openHouseDate: "2026-06-14",
    openHouseStart: "13:00:00",
    openHouseEnd: "16:00:00",
    details:
      "Single-level Paradise Valley contemporary with a resort backyard, chef's kitchen, and a primary wing that opens to the pool. Easy to show, broker lunch provided.",
    beds: 4,
    baths: 4.5,
    sqft: 4180,
    heroImageUrl: "https://gat-bos.vercel.app/email-assets/berneil/hero-photo.jpg",
  },
  landingUrl: "https://opens.alexhollienco.com/open-house/scottsdale-7012-e-berneil-ab12cd",
  unsubscribeUrl: "https://opens.alexhollienco.com/u/sample-token-1234",
  footerAddress: "Great American Title Agency, 2425 E Camelback Rd, Phoenix, AZ 85016",
});

const desktop = join(homedir(), "Desktop");
const fullPath = join(desktop, "open-house-email-sample.html");
const noImgPath = join(desktop, "open-house-email-noimg.html");

writeFileSync(fullPath, sample.html, "utf8");
// Images-blocked simulation: blank every src so the browser shows alt text.
writeFileSync(noImgPath, sample.html.replace(/src="[^"]*"/g, 'src=""'), "utf8");

console.log("SUBJECT:", sample.subject);
console.log("TEXT VERSION:\n" + sample.text);
console.log("\nHTML:", fullPath);
console.log("NO-IMG:", noImgPath);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 1200 } });
  await page.goto("file://" + fullPath);
  await page.screenshot({ path: join(desktop, "open-house-email-sample.png"), fullPage: true });
  await page.goto("file://" + noImgPath);
  await page.screenshot({ path: join(desktop, "open-house-email-noimg.png"), fullPage: true });
  await browser.close();
  console.log("PNG:", join(desktop, "open-house-email-sample.png"));
  console.log("PNG:", join(desktop, "open-house-email-noimg.png"));
})();
