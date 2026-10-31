import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;

const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });
const PAGES = 3;
const RETRY_TIMEOUT_MS = 1000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
});

// The click can land before the app reacts (WebKit); repeat it until the viewer shows. Selecting the mode is idempotent.
async function enterOrganization(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByLabel(label('modeOrganization'), { exact: true }).click();
    await expect(page.getByTestId('org-viewer')).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
}

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
  await enterOrganization(page);
  await expect(page.getByTestId('org-viewer')).toBeVisible();
  await expect(page.locator('[data-testid^="org-page-"]')).toHaveCount(PAGES);
  const heightOf = (testId: string) => page.getByTestId(testId).evaluate((el) => (el as HTMLElement).offsetHeight);
  // The pages exist before the viewport is measured; wait for the real layout.
  await expect.poll(async () => (await heightOf('org-sizer')) > (await heightOf('org-viewer'))).toBe(true);
});

test('ORG-006 switching tabs restores the scroll position', async ({ page }) => {
  await openFile(page, 'a.pdf');
  await enterOrganization(page);
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

const TILE_SIZE_PX = 1024; // T:resources.tileSizePx
const VISIBLE_PAGES_MAX = 3; // viewport page plus orgRenderPagesAround on each side

test('ORG-002 NFR-007 only canvases of nearby pages exist and no tile exceeds the tile size', async ({ page }) => {
  await openFile(page, 'a.pdf');
  await enterOrganization(page);
  await expect(page.locator('app-page-tiles canvas').first()).toBeAttached();
  const info = await page.locator('app-page-tiles').evaluateAll((hosts) =>
    hosts.map((h) => ({
      canvases: Array.from(h.querySelectorAll('canvas')).map((c) => [parseFloat(c.style.width), parseFloat(c.style.height)]),
    })),
  );
  expect(info.length).toBeLessThanOrEqual(VISIBLE_PAGES_MAX);
  for (const { canvases } of info) {
    for (const [w, h] of canvases) {
      expect(w).toBeLessThanOrEqual(TILE_SIZE_PX);
      expect(h).toBeLessThanOrEqual(TILE_SIZE_PX);
    }
  }
});

test('ORG-002 scrolling to the end releases the first page', async ({ page }) => {
  await openFile(page, 'a.pdf');
  await enterOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  await expect(page.locator('app-page-tiles canvas').first()).toBeAttached();
  await viewer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => page.locator('app-page-tiles').count()).toBeLessThanOrEqual(VISIBLE_PAGES_MAX);
  await expect(page.getByTestId('org-page-2')).toBeVisible();
  await expect.poll(() => page.locator('app-page-tiles canvas[style*="visibility: visible"]').count()).toBeGreaterThan(0);
});
