import { expect, test } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';

test('PLT-009 Chromium loads the production PWA offline after first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'PLT-009 offline service-worker coverage is Chromium-only in M2');

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => globalThis.navigator.serviceWorker.controller !== null)).toBe(true);

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json() as { icons?: Array<{ src: string }> };
  expect(manifest.icons?.map((icon) => icon.src)).toEqual(['icons/icon-192.png', 'icons/icon-512.png']);

  for (const iconPath of manifest.icons?.map((icon) => icon.src) ?? []) {
    expect((await page.request.get(`/${iconPath}`)).ok()).toBe(true);
  }

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(TUNABLES.identity.appName);
  await expect.poll(() => page.evaluate(() => globalThis.document.readyState)).toBe('complete');
});
