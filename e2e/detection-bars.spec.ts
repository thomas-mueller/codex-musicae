import { expect, test } from '@playwright/test';

import { enterOrganization, label, openScore, SYNTHETIC_BARS } from './support/score';
import { DETECTION_TIMEOUT_MS, scaled } from './support/timing';

const DEV_URL = 'http://127.0.0.1:4174';
const LONG_TASK_LIMIT_MS = scaled(50); // acceptance criterion of M10 (50 ms); a shared CI runner stalls the main thread more often
const KEEP_ACTIVE_MS = 100; // pointer events at this interval keep detection paused (DET-017)
const SCROLL_SETTLE_MS = scaled(600);
const LAST_PAGE_INDEX = 2;

test.use({ viewport: { width: 1280, height: 800 } });
test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'detection run checked on desktop Chromium');
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
});

test('ORG-008 DET-016 DET-019 the synthetic score gets 15 bars, progress disappears, no long task during detection', async ({ page }) => {
  await page.addInitScript(() => {
    const store = ((globalThis as unknown as { __longTasks: number[] }).__longTasks = []);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/');
  await page.getByLabel(label('modeOrganization'), { exact: true }).click();
  await page.evaluate(() => ((globalThis as unknown as { __longTasks: number[] }).__longTasks.length = 0));
  await openScore(page);
  await enterOrganization(page);
  await expect(page.getByTestId('org-bar')).toHaveCount(SYNTHETIC_BARS, { timeout: DETECTION_TIMEOUT_MS });
  await expect(page.getByTestId('detection-progress')).toHaveCount(0);
  await expect(page.getByTestId('org-bar-provisional')).toHaveCount(0);
  const longTasks = await page.evaluate(() => (globalThis as unknown as { __longTasks: number[] }).__longTasks);
  expect(longTasks.filter((duration) => duration > LONG_TASK_LIMIT_MS)).toEqual([]);
});

test.describe('development build with the debug hook', () => {
  test('DET-021 scrolling to the last page right after opening makes it the first page processed', async ({ page }) => {
    await page.addInitScript((everyMs) => {
      // Keeps the user "active" so detection stays paused until the test releases it.
      (globalThis as unknown as { __keepActive: unknown }).__keepActive = globalThis.setInterval(
        () => globalThis.dispatchEvent(new Event('pointermove')),
        everyMs,
      );
    }, KEEP_ACTIVE_MS);
    await page.goto(DEV_URL);
    await openScore(page);
    await enterOrganization(page);
    const viewer = page.getByTestId('org-viewer');
    await expect(page.getByTestId(`org-page-${LAST_PAGE_INDEX}`)).toBeAttached();
    await viewer.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    await page.evaluate(() => clearInterval((globalThis as unknown as { __keepActive: number }).__keepActive));
    await expect
      .poll(() => page.evaluate(() => (globalThis as unknown as { __cm: { startedOrder: () => number[] } }).__cm.startedOrder().length), {
        timeout: DETECTION_TIMEOUT_MS,
      })
      .toBeGreaterThan(0);
    const order = await page.evaluate(() => (globalThis as unknown as { __cm: { startedOrder: () => number[] } }).__cm.startedOrder());
    expect(order[0]).toBe(LAST_PAGE_INDEX);
  });
});
