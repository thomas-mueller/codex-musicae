import { expect, test } from '@playwright/test';

import { enterOrganization, forceFileInput, label, openScore, SCORE_PAGES } from './support/score';
import { DETECTION_TIMEOUT_MS, scaled, SCROLL_TIMEOUT_MS } from './support/timing';

// NFR-025: the source (pdf.js, with the page's images) is rendered once per page for the working raster; fit views, detection and scrolling are cut from it.
// The development build counts the calls that reached the source renderer.
const DEV_URL = 'http://127.0.0.1:4174';
const SCROLL_STEP_FRACTION = 0.8;
const SCROLL_WAIT_MS = 150;
const MAX_ZOOM_CLICKS = 12;
const CLICK_TIMEOUT_MS = 2_000;
const EXTRA_SOURCE_RENDERS = 1; // slack for one repeated page (a cancelled build is started again)

test.use({ viewport: { width: 1280, height: 800 } });
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'the debug hook counts source renders: desktop Chromium, development build');
});

const sourceRenders = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(() => (globalThis as unknown as { __cm: { sourceRenders: () => number } }).__cm.sourceRenders());

test('NFR-025 opening, detecting and scrolling through every page at fit renders the source once per page; zooming in beyond the working scale goes to the source', async ({ page }) => {
  test.setTimeout(scaled(240_000));
  await forceFileInput(page);
  await page.goto(DEV_URL);
  await openScore(page);
  await enterOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  await expect(viewer).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as { __cm: { detectionState: () => { complete: boolean } } }).__cm.detectionState().complete), { timeout: DETECTION_TIMEOUT_MS })
    .toBe(true);

  // Scroll over every page at fit: detection and the tiles of all pages are served from the working rasters.
  const steps = await viewer.evaluate((el, fraction) => Math.ceil(el.scrollHeight / (el.clientHeight * fraction)), SCROLL_STEP_FRACTION);
  for (let i = 0; i <= steps; i++) {
    await viewer.evaluate((el, fraction) => el.scrollBy({ top: el.clientHeight * fraction }), SCROLL_STEP_FRACTION);
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }
  await page.waitForTimeout(scaled(SCROLL_TIMEOUT_MS));
  const atFit = await sourceRenders(page);
  expect(atFit, 'one source render per page and no more').toBeLessThanOrEqual(SCORE_PAGES + EXTRA_SOURCE_RENDERS);

  // Zoom in until the tiles need more than the working resolution: only then the source is rendered again.
  const zoomIn = page.getByRole('button', { name: label('zoomIn'), exact: true });
  for (let i = 0; i < MAX_ZOOM_CLICKS; i++) {
    const clicked = await zoomIn.click({ timeout: CLICK_TIMEOUT_MS }).then(
      () => true,
      () => false, // the button is disabled at the largest zoom
    );
    if (!clicked) {
      break;
    }
  }
  await expect.poll(() => sourceRenders(page), { timeout: scaled(SCROLL_TIMEOUT_MS * 4) }).toBeGreaterThan(atFit);
});
