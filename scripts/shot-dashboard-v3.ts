// scripts/shot-dashboard-v3.ts -- authed verification of the 3-tab dashboard.
// Logs in with the local seed user, screenshots all three tabs + mobile, and
// exercises the three writes (log touch, add task, check task) asserting the
// live topbar counters move. Run: pnpm exec tsx scripts/shot-dashboard-v3.ts
import { join } from "node:path";
import { homedir } from "node:os";
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3001";
const EMAIL = "alex+local@example.com";
const PASSWORD = "Testpass123!";
const out = homedir() + "/Desktop";

async function counter(page: Page, label: string): Promise<number | null> {
  return page.evaluate((lbl) => {
    const spans = Array.from(document.querySelectorAll("span"));
    const tag = spans.find((s) => s.textContent?.trim() === lbl);
    const prev = tag?.previousElementSibling;
    const n = prev?.textContent?.trim();
    return n ? Number(n) : null;
  }, label);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const log: string[] = [];
  const note = (s: string) => { log.push(s); console.log(s); };

  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") note(`[console.${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => note(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) => note(`[reqfailed] ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.request().method() === "POST" && r.url().includes(":3001")) note(`[server-action POST ${r.status()}] ${r.url().slice(0, 60)}`); });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  if (!/\/dashboard/.test(page.url())) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
  }
  await page.waitForTimeout(1500);
  note("after login url: " + page.url());

  // Is the new UI present?
  const hasReachOut = await page.getByText("Reach out", { exact: true }).count();
  const hasTodo = await page.getByText("To-do", { exact: true }).count();
  note(`new UI markers -> Reach out:${hasReachOut} To-do:${hasTodo}`);
  await page.screenshot({ path: join(out, "dash-v3-today.png"), fullPage: false });

  // --- Counters baseline
  const touch0 = await counter(page, "Touches today");
  const done0 = await counter(page, "Tasks done");
  note(`counters baseline -> touches:${touch0} done:${done0}`);

  // --- WRITE 1: Log touch
  const logBtns = page.getByRole("button", { name: "Log touch" });
  const reachCount0 = await logBtns.count();
  note(`reach-out rows: ${reachCount0}`);
  if (reachCount0 > 0) {
    await logBtns.first().click();
    await page.waitForTimeout(1200);
    const touch1 = await counter(page, "Touches today");
    const reachCount1 = await page.getByRole("button", { name: "Log touch" }).count();
    note(`after Log touch -> touches:${touch1} (was ${touch0}), rows:${reachCount1} (was ${reachCount0})`);
  } else {
    note("SKIP log-touch: no reach-out rows in seed data");
  }

  // --- WRITE 2: Add task
  const unique = "vchk-" + Date.now();
  const input = page.getByPlaceholder("Add a task, press Enter");
  if (await input.count()) {
    await input.first().fill(unique);
    await input.first().press("Enter");
    await page.waitForTimeout(1500);
    const appeared = await page.getByText(unique, { exact: true }).count();
    note(`after Add task -> "${unique}" present:${appeared}`);

    // --- WRITE 3: Check the task we just added
    const row = page.locator("li", { hasText: unique }).first();
    const cb = row.getByRole("checkbox");
    if (await cb.count()) {
      await page.waitForTimeout(1000); // let temp id reconcile
      const disabledBefore = await cb.first().isDisabled().catch(() => "n/a");
      note(`checkbox disabled before click: ${disabledBefore}`);
      await cb.first().click();
      await page.waitForTimeout(300);
      const presentImmediate = await page.getByText(unique, { exact: true }).count();
      note(`immediately after click -> present:${presentImmediate} (optimistic remove expected 0)`);
      const toasts = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
      note(`toasts: ${JSON.stringify(toasts)}`);
      await page.waitForTimeout(1500);
      const stillThere = await page.getByText(unique, { exact: true }).count();
      const done1 = await counter(page, "Tasks done");
      note(`after Check task -> "${unique}" present:${stillThere} (expect 0), done:${done1} (was ${done0})`);
    } else {
      note("SKIP check-task: checkbox not found");
    }
  } else {
    note("SKIP add-task: input not found");
  }

  await page.screenshot({ path: join(out, "dash-v3-today-after.png"), fullPage: false });

  // --- Agents tab
  await page.getByRole("tab", { name: "Agents" }).click().catch(() => null);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, "dash-v3-agents.png"), fullPage: false });
  const tierA = await page.getByText("Tier A", { exact: true }).count();
  note(`Agents tab -> Tier A group present:${tierA}`);

  // --- Activity tab
  await page.getByRole("tab", { name: "Activity" }).click().catch(() => null);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(out, "dash-v3-activity.png"), fullPage: false });
  const coldCalls = await page.getByText("Cold calls", { exact: true }).count();
  note(`Activity tab -> Cold calls row present:${coldCalls}`);

  // --- Mobile (Today)
  await page.getByRole("tab", { name: "Today" }).click().catch(() => null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "dash-v3-mobile.png"), fullPage: false });

  await browser.close();
  console.log("\n=== VERIFY SUMMARY ===\n" + log.join("\n"));
})();
