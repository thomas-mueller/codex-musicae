import { expect, test } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';

test('PLT-001 TST-004 TST-005 placeholder loads without external requests or errors', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const foreignRequests: string[] = [];
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL is not configured');
  }
  const appOrigin = new URL(baseURL).origin;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== appOrigin) {
      foreignRequests.push(request.url());
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page).toHaveTitle(TUNABLES.identity.appName);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(foreignRequests).toEqual([]);
});
