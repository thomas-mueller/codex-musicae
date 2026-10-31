import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;

const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });
const PAGES = 3;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
});

async function openFile(page: Page, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles(named(name));
}

// Expanded layouts show the tab bar; compact ones the tab switcher popup (FIL-004).
async function switchTo(page: Page, name: string): Promise<void> {
  const bar = page.locator('app-tab-bar .name', { hasText: name });
  if (await bar.isVisible()) {
    await bar.click();
    return;
  }
  await page.locator('app-tab-switcher button.current').click();
  await page.locator('[data-popup] app-tab-item .name', { hasText: name }).click();
}

test('ORG-001 organization mode shows all pages stacked in a scroll container', async ({ page }) => {
  await openFile(page, 'a.pdf');
  await page.getByLabel(label('modeOrganization'), { exact: true }).click();
  await expect(page.getByTestId('org-viewer')).toBeVisible();
  await expect(page.locator('[data-testid^="org-page-"]')).toHaveCount(PAGES);
  const sizer = await page.getByTestId('org-sizer').evaluate((el) => (el as HTMLElement).offsetHeight);
  const viewer = await page.getByTestId('org-viewer').evaluate((el) => el.clientHeight);
  expect(sizer).toBeGreaterThan(viewer);
});

test('ORG-006 switching tabs restores the scroll position', async ({ page }) => {
  await openFile(page, 'a.pdf');
  await page.getByLabel(label('modeOrganization'), { exact: true }).click();
  const viewer = page.getByTestId('org-viewer');
  await expect(viewer).toBeVisible();
  await viewer.evaluate((el) => {
    el.scrollTop = 300;
  });
  await expect.poll(() => viewer.evaluate((el) => el.scrollTop)).toBe(300);
  await openFile(page, 'b.pdf');
  await expect.poll(() => page.getByTestId('org-viewer').evaluate((el) => el.scrollTop)).toBe(0);
  await switchTo(page, 'a.pdf');
  await expect.poll(() => page.getByTestId('org-viewer').evaluate((el) => el.scrollTop)).toBe(300);
});
