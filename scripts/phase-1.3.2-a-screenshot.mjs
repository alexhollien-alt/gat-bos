// Phase 1.3.2-A: Playwright screenshot of /drafts showing both escalation
// badges (amber Marlene, sky BD) for the acceptance gate visual artifact.
import { chromium } from "playwright";
import { ensureAuthState, loadEnv } from "./phase-9-auth-helper.mjs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const AUTH = resolve(homedir(), "crm", "scripts", ".phase-1.3.2-a-auth.json");
const OUT = resolve(homedir(), "Desktop", "phase-1.3.2-a-drafts-badges.png");

const { SITE: envSite } = loadEnv();
const SITE = process.env.SITE ?? envSite;

await ensureAuthState(AUTH);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${SITE}/drafts`, { waitUntil: "networkidle" });
// Give TanStack query a beat to hydrate + realtime subscribe
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT, fullPage: true });
console.log("screenshot:", OUT);
await browser.close();
