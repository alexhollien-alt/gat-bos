import { test, expect } from '@playwright/test';

test('/login renders the form', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/login');

  await expect(page.locator('input#email')).toBeVisible();
  await expect(page.locator('input#password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('/today-v2 redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/today-v2');
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
});
