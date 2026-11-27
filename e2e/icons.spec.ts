import { expect, test } from '@playwright/test';

import { label } from './support/score';

/** Far below the seconds an icon stayed blank while a first visit's service worker held its request. */
const GLYPH_TIMEOUT_MS = 1_500;

test.use({ viewport: { width: 360, height: 640 } });

// The service worker is on (the default) and nothing waits for it: this is the first visit, while it installs.
test('UIX-010 icons of a popup opened right after the first load are drawn at once, without a request', { tag: '@smoke' }, async ({ page, context }) => {
  await page.goto('/');
  const overflow = page.locator('[data-area="bottom"]').getByLabel(label('overflow'), { exact: true });
  await expect(overflow).toBeVisible();
  const requests: string[] = [];
  // Requests of the page only: Chromium also reports the service worker filling its cache with the sprite.
  context.on('request', (request) => {
    if (request.url().includes('sprite.svg') && request.serviceWorker() === null) {
      requests.push(request.url());
    }
  });
  await overflow.click();
  const glyphs = page.locator('app-popup-host app-icon use');
  await expect(glyphs.first()).toBeAttached();
  await expect
    .poll(() => glyphs.evaluateAll((uses) => uses.filter((use) => (use as SVGGraphicsElement).getBBox().width === 0).length), {
      timeout: GLYPH_TIMEOUT_MS,
    })
    .toBe(0);
  expect(requests).toEqual([]);
});
