import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const CYCLES = 25;

test.use({ viewport: { width: 1280, height: 800 } });

// NFR-004, NFR-009: the cache budget itself is asserted in the unit stress test (state/cache-stress.spec.ts);
// production builds carry no debug hook, so this checks that repeated opening stays healthy.
test('NFR-004 NFR-009 opening and closing a PDF repeatedly keeps the app responsive and rendering', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'resource check runs on Chromium only');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
  for (let i = 0; i < CYCLES; i++) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: en.a11y['openFile'] as string, exact: true }).click();
    await (await chooser).setFiles({ name: `score-${i}.pdf`, mimeType: 'application/pdf', buffer: scoreBytes });
    await expect(page.locator('app-page-preview canvas[data-rendered="true"]')).toBeVisible();
    await page.getByRole('button', { name: en.a11y['closeTab'] as string }).click();
    await expect(page.locator('app-tab-bar .name')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
