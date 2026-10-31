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

const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const ZOOM_STEP = 1.25; // T:zoom.buttonStep
const WIDTH_TOLERANCE_PX = 3; // rounding of the page width
const CENTER_TOLERANCE_PX = 1.5;
const GAP_TOLERANCE_PX = 3; // native slider track/thumb rounding

const pageWidth = (page: Page) => page.getByTestId('org-page-0').evaluate((el) => (el as HTMLElement).offsetWidth);

async function openAndEnter(page: Page): Promise<void> {
  await openFile(page, 'a.pdf');
  await enterOrganization(page);
  await expect(indicator(page)).toHaveText('1 / 3');
}

async function pageSlider(page: Page) {
  const inBar = page.locator('app-bottom-bar input.slider');
  if (await inBar.count()) {
    return inBar;
  }
  await indicator(page).click(); // compact: the slider is in the popup
  return page.locator('[data-popup] input.slider');
}

test('ORG-004 the indicator follows scrolling', async ({ page }) => {
  await openAndEnter(page);
  await page.getByTestId('org-viewer').evaluate((el) => {
    el.scrollTop = (el.querySelector('[data-testid="org-page-1"]') as HTMLElement).offsetTop;
  });
  await expect(indicator(page)).toHaveText('2 / 3');
});

test('ORG-005 next and previous move one page and are disabled at the ends', async ({ page }) => {
  await openAndEnter(page);
  const previous = page.getByRole('button', { name: label('previous'), exact: true });
  const next = page.getByRole('button', { name: label('next'), exact: true });
  await expect(previous).toHaveAttribute('aria-disabled', 'true');
  await next.click();
  await expect(indicator(page)).toHaveText('2 / 3');
  await next.click();
  await expect(indicator(page)).toHaveText('3 / 3');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await previous.click();
  await expect(indicator(page)).toHaveText('2 / 3');
});

test('ORG-005 the page slider scrolls to the chosen page', async ({ page }) => {
  await openAndEnter(page);
  const slider = await pageSlider(page);
  await slider.evaluate((el) => {
    (el as HTMLInputElement).value = '3';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(indicator(page)).toHaveText('3 / 3');
});

test('ORG-003 ORG-006 zoom buttons step and reset to fit-page; zoom stays when the page changes', async ({ page }) => {
  await openAndEnter(page);
  const fitPage = await pageWidth(page);
  await page.getByRole('button', { name: label('zoomIn'), exact: true }).click();
  await expect.poll(() => pageWidth(page)).toBeGreaterThan(fitPage * ZOOM_STEP - WIDTH_TOLERANCE_PX);
  expect(await pageWidth(page)).toBeLessThan(fitPage * ZOOM_STEP + WIDTH_TOLERANCE_PX);
  const zoomed = await pageWidth(page);
  await page.getByRole('button', { name: label('next'), exact: true }).click();
  await expect(indicator(page)).toHaveText('2 / 3');
  expect(await pageWidth(page)).toBe(zoomed);
  await page.getByRole('button', { name: label('zoomReset'), exact: true }).click();
  await expect.poll(() => pageWidth(page)).toBe(fitPage);
});

test('ORG-003 the document opens at fit-page: the whole first page is visible', async ({ page }) => {
  await openAndEnter(page);
  const fits = await page.getByTestId('org-viewer').evaluate((viewer) => {
    const box = (viewer.querySelector('[data-testid="org-page-0"]') as HTMLElement).getBoundingClientRect();
    const view = viewer.getBoundingClientRect();
    return box.top >= view.top - 1 && box.bottom <= view.bottom + 1 && box.left >= view.left - 1 && box.right <= view.right + 1;
  });
  expect(fits).toBe(true);
});

test('ORG-001 a page narrower than the viewport is centered horizontally', async ({ page }) => {
  await openAndEnter(page);
  const offset = await page.getByTestId('org-viewer').evaluate((viewer) => {
    const box = (viewer.querySelector('[data-testid="org-page-0"]') as HTMLElement).getBoundingClientRect();
    const view = viewer.getBoundingClientRect();
    return box.left + box.width / 2 - (view.left + viewer.clientWidth / 2);
  });
  expect(Math.abs(offset)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
});

test('ORG-004 the indicator is vertically centered in the bar, after the slider and before next', async ({ page }) => {
  await openAndEnter(page);
  const geometry = await page.locator('app-bottom-bar').evaluate((bar) => {
    const rect = (el: Element | null) => (el as HTMLElement).getBoundingClientRect();
    const barBox = rect(bar);
    const indicatorBox = rect(bar.querySelector('.indicator'));
    const text = bar.ownerDocument.createRange(); // the digits themselves, not the (full height) box
    text.selectNodeContents(bar.querySelector('.indicator') as Node);
    const textBox = text.getBoundingClientRect();
    const next = rect(bar.querySelector('button[aria-label="Next"]'));
    const slider = bar.querySelector('input.slider');
    const before = slider ? rect(slider) : rect(bar.querySelector('button[aria-label="Previous"]'));
    return {
      centerOffset: textBox.top + textBox.height / 2 - (barBox.top + barBox.height / 2),
      afterPrevious: indicatorBox.left >= before.right - 1,
      beforeNext: indicatorBox.right <= next.left + 1,
    };
  });
  expect(Math.abs(geometry.centerOffset)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(geometry.afterPrevious).toBe(true);
  expect(geometry.beforeNext).toBe(true);
});

test('ORG-004 the gaps between previous, slider, "x / n" and next are equal (expanded)', async ({ page }) => {
  await openAndEnter(page);
  const gaps = await page.locator('app-bottom-bar').evaluate((bar) => {
    const slider = bar.querySelector('input.slider');
    if (!slider) {
      return null; // compact layout: no slider
    }
    const rect = (el: Element | null) => (el as HTMLElement).getBoundingClientRect();
    const text = bar.ownerDocument.createRange();
    text.selectNodeContents(bar.querySelector('.indicator') as Node);
    const textBox = text.getBoundingClientRect();
    const previousIcon = rect(bar.querySelector('button[aria-label="Previous"] app-icon'));
    const nextIcon = rect(bar.querySelector('button[aria-label="Next"] app-icon'));
    const sliderBox = rect(slider);
    return [sliderBox.left - previousIcon.right, textBox.left - sliderBox.right, nextIcon.left - textBox.right];
  });
  test.skip(gaps === null, 'compact layout has no slider');
  const [first, second, third] = gaps ?? [];
  expect(Math.abs((first ?? 0) - (second ?? 0))).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
  expect(Math.abs((second ?? 0) - (third ?? 0))).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
});

test('NFR-008 coming back from another mode and going to the previous page shows its content', async ({ page }) => {
  await openAndEnter(page);
  const next = page.getByRole('button', { name: label('next'), exact: true });
  await next.click();
  await expect(indicator(page)).toHaveText('2 / 3');
  await next.click();
  await expect(indicator(page)).toHaveText('3 / 3');
  await page.getByLabel(label('modeAnnotation'), { exact: true }).click();
  await expect(page.getByTestId('org-viewer')).toHaveCount(0);
  await enterOrganization(page);
  await expect(indicator(page)).toHaveText('3 / 3');
  await page.getByRole('button', { name: label('previous'), exact: true }).click();
  await expect(indicator(page)).toHaveText('2 / 3');
  await expect.poll(() => page.locator('app-page-tiles canvas[style*="visibility: hidden"]').count()).toBe(0);
  await expect.poll(() => page.locator('app-page-tiles canvas[style*="visibility: visible"]').count()).toBeGreaterThan(0);
});
