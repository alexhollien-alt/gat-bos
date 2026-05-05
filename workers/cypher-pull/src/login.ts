// Playwright login flow for gat.cypher-crm.com.
// Returns an authenticated CypherSession. Throws on login failure.
// Session is NOT persisted between runs -- fresh login adds ~3s per run, acceptable.

import { chromium, type Browser, type Page } from 'playwright';

export interface CypherSession {
  browser: Browser;
  page: Page;
}

const LOGIN_URL = 'https://gat.cypher-crm.com/users/login?redirect=%2F';

export async function cypherLogin(
  username: string,
  password: string
): Promise<CypherSession> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('[login] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Fill credentials using broad selectors -- CakePHP apps use various name schemes
    await page.locator('input[type="email"], input[name="email"], input[id*="email"]').first().fill(username);
    await page.locator('input[type="password"], input[name="password"]').first().fill(password);

    // Submit and wait for the post-login redirect
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
      page.locator('button[type="submit"], input[type="submit"]').first().click(),
    ]);

    const currentUrl = page.url();

    // Still on login page = bad credentials or an error was shown
    if (currentUrl.includes('/users/login')) {
      const errorText = await page
        .locator('.alert, .alert-danger, .error-message, [class*="error"]')
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        `Login failed -- still on login page.${errorText ? ` Server message: ${errorText.trim()}` : ' Check credentials.'}`
      );
    }

    console.log(`[login] Authenticated (landed at: ${currentUrl})`);
    return { browser, page };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
