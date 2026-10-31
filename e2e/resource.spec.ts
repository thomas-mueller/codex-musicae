import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const DEV_URL = 'http://127.0.0.1:4174';
const SMALLEST_BUCKET_GB = 1;
const OPEN_COUNT = 12;
const CYCLES = 25;

test.use({ viewport: { width: 1280, height: 800 } });
test.skip(({ browserName }) => browserName !== 'chromium', 'resource checks run on Chromium only');

interface Probe {
  totalBytes: number;
  budgetBytes: number;
}

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const hook = (globalThis as unknown as { __cm?: { cache: Probe } }).__cm;
    return { totalBytes: hook?.cache.totalBytes ?? -1, budgetBytes: hook?.cache.budgetBytes ?? -1 };
  });

async function prepare(page: Page, url: string): Promise<void> {
  await page.addInitScript((gb) => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    Object.defineProperty(globalThis.navigator, 'deviceMemory', { value: gb, configurable: true });
  }, SMALLEST_BUCKET_GB);
  await page.goto(url);
}

async function openCopy(page: Page, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: en.a11y['openFile'] as string, exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: scoreBytes });
  await expect(page.locator('app-page-preview canvas[data-rendered="true"]')).toBeVisible();
}

test.describe('development build with the debug hook', () => {
  test('NFR-004 NFR-009 the bitmap cache never exceeds its budget while many PDFs are open', async ({ page }) => {
    await prepare(page, DEV_URL);
    const budget = TUNABLES.resources.cacheBudgetByDeviceMemoryGb[SMALLEST_BUCKET_GB];
    for (let i = 0; i < OPEN_COUNT; i++) {
      await openCopy(page, `score-${i}.pdf`);
      const { totalBytes, budgetBytes } = await probe(page);
      expect(budgetBytes).toBe(budget);
      expect(totalBytes).toBeLessThanOrEqual(budgetBytes);
    }
    const { totalBytes, budgetBytes } = await probe(page);
    expect(totalBytes).toBeGreaterThan(0);
    expect(totalBytes).toBeLessThanOrEqual(budgetBytes);
    for (let i = 0; i < OPEN_COUNT; i++) {
      await page.getByRole('button', { name: en.a11y['closeTab'] as string }).last().click();
    }
    await expect(page.locator('app-tab-bar .name')).toHaveCount(0);
    expect((await probe(page)).totalBytes).toBe(0);
  });

  test('NFR-004 NFR-009 opening and closing a PDF repeatedly stays within budget without page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await prepare(page, DEV_URL);
    for (let i = 0; i < CYCLES; i++) {
      await openCopy(page, `cycle-${i}.pdf`);
      const { totalBytes, budgetBytes } = await probe(page);
      expect(totalBytes).toBeLessThanOrEqual(budgetBytes);
      await page.getByRole('button', { name: en.a11y['closeTab'] as string }).click();
      await expect(page.locator('app-tab-bar .name')).toHaveCount(0);
    }
    expect((await probe(page)).totalBytes).toBe(0);
    expect(errors).toEqual([]);
  });
});

test('GEN-005 the production build carries no debug hook', async ({ page }) => {
  await prepare(page, '/');
  expect(await page.evaluate(() => '__cm' in globalThis)).toBe(false);
});
