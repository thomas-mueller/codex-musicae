import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { forceFileInput, label, openScore, waitForFinalSlideCount } from './support/score';
import { scaled, SCROLL_TIMEOUT_MS } from './support/timing';

// NFR-001 NFR-003: the neighbors of the shown slide are pre-loaded, so Next and Previous draw within the budget right after the slide appeared.
// The development build carries the debug hook with the bitmap cache numbers (proof that something was loaded in advance).
const DEV_URL = 'http://127.0.0.1:4174';
const CI_JITTER = 2; // the milestone allows x2 for CI
const STABLE_FOR_MS = 1_500; // the cache did not grow for this long: the pre-loading of the neighbors is over
const POLL_MS = 100;
const BYTES_PER_PIXEL = 4;
const MIN_SLIDES_CACHED = 1.5; // the shown slide plus at least a good part of one neighbor
const SEQUENCE = ['next', 'next', 'previous', 'previous'] as const;

test.use({ viewport: { width: 1280, height: 800 } });
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'timing of draw calls: desktop Chromium, development build');
});

const cacheBytes = (page: Page): Promise<number> => page.evaluate(() => (globalThis as unknown as { __cm: { cache: { totalBytes: number } } }).__cm.cache.totalBytes);

/** Waits until the bitmap cache stopped growing for `STABLE_FOR_MS`; returns its size. */
async function settledCacheBytes(page: Page): Promise<number> {
  let last = -1;
  let since = Date.now();
  await expect
    .poll(
      async () => {
        const now = await cacheBytes(page);
        if (now !== last) {
          last = now;
          since = Date.now();
        }
        return Date.now() - since;
      },
      { timeout: scaled(SCROLL_TIMEOUT_MS * 4), intervals: [POLL_MS] },
    )
    .toBeGreaterThanOrEqual(STABLE_FOR_MS);
  return last;
}

/** Milliseconds from the click on `key` to the first draw after it plus one animation frame. */
function changeTime(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve) => {
        const w = globalThis as unknown as { __draws: number[] };
        const seen = w.__draws.length;
        const target = Array.from(globalThis.document.querySelectorAll<HTMLButtonElement>('app-bottom-bar button')).find((b) => b.getAttribute('aria-label') === name);
        const start = performance.now();
        target?.click();
        const poll = (): void => {
          if (w.__draws.length > seen) {
            requestAnimationFrame(() => resolve(performance.now() - start));
          } else {
            requestAnimationFrame(poll);
          }
        };
        poll();
      }),
    label(key),
  );
}

test('NFR-001 NFR-003 TST-015 the next slide is pre-loaded: forward and backward changes draw within the budget', async ({ page }, testInfo) => {
  await forceFileInput(page);
  await page.goto(DEV_URL);
  await openScore(page);
  await waitForFinalSlideCount(page);
  await page.evaluate(() => {
    const w = globalThis as unknown as { __draws: number[] };
    w.__draws = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      w.__draws.push(performance.now());
      return (original as (...a: unknown[]) => void).apply(this, args);
    } as typeof original;
  });

  // The cache holds the shown slide and, once the pre-loading is over, at least one more slide of a similar size.
  const shown = await page.getByTestId('slide-canvas').evaluate((canvas: HTMLCanvasElement, bytesPerPixel) => canvas.width * canvas.height * bytesPerPixel, BYTES_PER_PIXEL);
  const afterFirst = await settledCacheBytes(page);
  expect(afterFirst, 'the neighbors of the first slide were loaded in advance').toBeGreaterThanOrEqual(shown * MIN_SLIDES_CACHED);

  const limit = TUNABLES.budgets.slideChangeP95Ms * CI_JITTER;
  const times: string[] = [];
  for (const key of SEQUENCE) {
    await settledCacheBytes(page); // what the app pre-loads around the shown slide
    const elapsed = await changeTime(page, key);
    times.push(`${key}=${elapsed.toFixed(0)}`);
    expect(elapsed, `${key} right after the neighbors were pre-loaded`).toBeLessThan(limit);
  }
  testInfo.annotations.push({ type: 'slide changes (ms)', description: times.join(' ') });
  process.stdout.write(`PERF slide changes after pre-loading (ms): ${times.join(' ')} (limit ${limit})\n`);
});
