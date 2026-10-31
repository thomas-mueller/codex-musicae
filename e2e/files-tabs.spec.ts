import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;

const SCORE = 'e2e/fixtures/synthetic-score.pdf';
const DAMAGED = 'e2e/fixtures/damaged.pdf';
const scoreBytes = readFileSync(SCORE);
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });

type Upload = string | { name: string; mimeType: string; buffer: Buffer };

test.beforeEach(async ({ page }) => {
  // Force the <input type="file"> path in every engine.
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
});

async function openFiles(page: Page, files: Upload | Upload[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles(files);
}

const tabNames = (page: Page) => page.locator('app-tab-bar .name').allTextContents();

async function previewHasInk(page: Page): Promise<boolean> {
  const canvas = page.locator('app-page-preview canvas[data-rendered="true"]');
  await expect(canvas).toBeVisible();
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    if (!data) {
      return false;
    }
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 128 && (data[i + 3] ?? 0) > 0) {
        return true;
      }
    }
    return false;
  });
}

test.describe('expanded', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('FIL-001 FIL-003 FIL-004 opening a PDF adds a named tab and renders page 1', async ({ page }) => {
    await openFiles(page, SCORE);
    await expect.poll(() => tabNames(page)).toEqual(['synthetic-score.pdf']);
    expect(await previewHasInk(page)).toBe(true);
  });

  test('FIL-002 opening the same file again keeps one tab', async ({ page }) => {
    await openFiles(page, SCORE);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(1);
    await openFiles(page, SCORE);
    await page.waitForTimeout(300);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(1);
  });

  test('FIL-001 FIL-005 two files open in two tabs and switching keeps both', async ({ page }) => {
    await openFiles(page, [named('synthetic-score.pdf'), named('second.pdf')]);
    await expect.poll(() => tabNames(page)).toEqual(['synthetic-score.pdf', 'second.pdf']);
    await page.locator('app-tab-bar .name', { hasText: 'synthetic-score.pdf' }).click();
    expect(await previewHasInk(page)).toBe(true);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(2);
  });

  test('FIL-009 a damaged PDF opens as a tab with an error marker and the app stays usable', async ({ page }) => {
    await openFiles(page, DAMAGED);
    await expect(page.locator('app-tab-bar .name')).toHaveText(['damaged.pdf']);
    await expect(page.locator(`app-tab-bar [aria-label="${label('errorInvalid')}"]`)).toBeVisible();
    await openFiles(page, SCORE);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(2);
    expect(await previewHasInk(page)).toBe(true);
  });

  test('FIL-003 closing tabs removes them and activates a neighbor', async ({ page }) => {
    await openFiles(page, [named('synthetic-score.pdf'), named('second.pdf')]);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(2);
    await page.locator('app-tab-bar app-tab-item').last().getByRole('button', { name: label('closeTab') }).click();
    await expect.poll(() => tabNames(page)).toEqual(['synthetic-score.pdf']);
    await page.getByRole('button', { name: label('closeTab') }).click();
    await expect(page.locator('app-tab-bar .name')).toHaveCount(0);
  });

  test('FIL-007 FIL-009 document controls follow the active tab status', async ({ page }) => {
    const undo = page.getByRole('button', { name: label('undo'), exact: true }).first();
    await expect(undo).toHaveAttribute('aria-disabled', 'true');
    await openFiles(page, SCORE);
    await expect(undo).not.toHaveAttribute('aria-disabled', 'true');
    await openFiles(page, DAMAGED);
    await expect(undo).toHaveAttribute('aria-disabled', 'true');
  });

  test('FIL-008 the recent list shows opened files, and a lost file offers the picker on a second tap', async ({ page }) => {
    await openFiles(page, [SCORE, DAMAGED]);
    await expect(page.locator('app-tab-bar .name')).toHaveCount(2);
    const openButton = page.getByRole('button', { name: label('openFile'), exact: true });
    await openButton.click({ button: 'right' });
    const rows = page.locator('[data-popup] .row');
    await expect(rows).toHaveText(['damaged.pdf', 'synthetic-score.pdf']);
    // The <input> path stores no handle: the first tap cannot reopen, so the entry is marked ...
    await rows.filter({ hasText: 'synthetic-score.pdf' }).click();
    await expect(rows.filter({ hasText: 'synthetic-score.pdf' }).locator('app-icon')).toBeVisible();
    // ... and the second tap offers the picker.
    const chooser = page.waitForEvent('filechooser');
    await rows.filter({ hasText: 'synthetic-score.pdf' }).click();
    await (await chooser).setFiles(named('synthetic-score-v2.pdf'));
    await expect.poll(() => tabNames(page)).toContain('synthetic-score-v2.pdf');
    await openButton.click({ button: 'right' });
    await expect(page.locator('[data-popup] .row')).toHaveText(['synthetic-score-v2.pdf', 'damaged.pdf']);
  });
});

test.describe('compact', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('FIL-004 the tab switcher shows the current tab and lists all tabs', async ({ page }) => {
    await openFiles(page, [named('synthetic-score.pdf'), named('second.pdf')]);
    const current = page.locator('app-tab-switcher button.current');
    await expect(current).toHaveText('second.pdf');
    await current.click();
    await expect(page.locator('[data-popup] app-tab-item .name')).toHaveText(['synthetic-score.pdf', 'second.pdf']);
    await page.locator('[data-popup] app-tab-item .name', { hasText: 'synthetic-score.pdf' }).click();
    await expect(current).toHaveText('synthetic-score.pdf');
  });
});
