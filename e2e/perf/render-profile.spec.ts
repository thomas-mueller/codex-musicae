import { expect, test, type Page } from '@playwright/test';

import { label } from '../support/score';
import { MIN_PERF_SLIDE_CHANGES } from '../../scripts/lib/corpus-files.mjs';
import {
  DEV_URL, detectionTimeoutMs, installSlideChangeTimer, openReference, PERF_WAIT_MS, realPdfs, recordedSlideChanges, report, summary, waitForDetectionComplete,
  waitForFirstSlideDrawn,
} from './support';

/**
 * Report-only measurements that show where loading time and memory go (NFR-001, NFR-004, NFR-016, NFR-025).
 * They assert nothing about speed or size; they print `PERF` lines for the decision on optimizations.
 * They run against the development build (the only one with the `window.__cm` debug hook).
 */
const PERF_BASE_TEST_TIMEOUT_MS = 300_000;
const MAX_SLIDES = 50;
const SETTLE_MS = 300;
const GC_SETTLE_MS = 200;
const BYTES_PER_MIB = 1024 * 1024;
const NEXT_KEY = 'PageDown';
const PREVIOUS_KEY = 'PageUp';

test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(PERF_BASE_TEST_TIMEOUT_MS + 2 * detectionTimeoutMs());

type Probe = { __cm: { cache: { totalBytes: number; budgetBytes: number }; sourceRenders?: () => number } };

const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const currentSlide = async (page: Page): Promise<number> => Number(/^(\d+)/.exec((await indicator(page).textContent()) ?? '')?.[1]);
const directRenders = (page: Page): Promise<number> => page.evaluate(() => (globalThis as unknown as Probe).__cm.directRenders?.() ?? -1);
const sourceRenders = (page: Page): Promise<number> => page.evaluate(() => (globalThis as unknown as Probe).__cm.sourceRenders?.() ?? -1);
const cacheMib = (page: Page): Promise<number> => page.evaluate((mib) => (globalThis as unknown as Probe).__cm.cache.totalBytes / mib, BYTES_PER_MIB);

/** JS heap in MiB after a garbage collection (decoded bitmaps live outside the JS heap and are not included). */
async function heapMib(page: Page): Promise<number> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('HeapProfiler.collectGarbage');
    await session.send('Performance.enable');
    await page.waitForTimeout(GC_SETTLE_MS);
    const { metrics } = (await session.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
    return (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? Number.NaN) / BYTES_PER_MIB;
  } finally {
    await session.detach();
  }
}

/** Presses `key` `count` times, waiting for each change; returns the key-to-frame time of every change. */
async function press(page: Page, key: string, step: 1 | -1, count: number): Promise<number[]> {
  await installSlideChangeTimer(page);
  for (let i = 0; i < count; i++) {
    const before = await currentSlide(page);
    await page.keyboard.press(key);
    await expect.poll(() => currentSlide(page), { timeout: PERF_WAIT_MS }).toBe(before + step);
    await page.waitForTimeout(SETTLE_MS);
  }
  await expect.poll(async () => (await recordedSlideChanges(page)).length, { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(count);
  return recordedSlideChanges(page);
}

test('NFR-001 NFR-025 TST-008 profile: source renders and slide-change times going forward and back through the regular PDF (report only)', async ({ page }, testInfo) => {
  test.skip(realPdfs().regular === null, 'no regular real PDF in the corpus');
  await openReference(page, DEV_URL, 'regular');
  await waitForFirstSlideDrawn(page);
  await waitForDetectionComplete(page);
  await page.waitForTimeout(SETTLE_MS);

  const slides = Number(/\/ (\d+)$/.exec((await indicator(page).textContent()) ?? '')?.[1]);
  const changes = Math.min(MAX_SLIDES, slides - 1);
  test.skip(!(changes >= MIN_PERF_SLIDE_CHANGES), `the regular PDF has ${slides} slides: too few to profile`);

  const rendersAfterDetection = await sourceRenders(page);
  const forward = await press(page, NEXT_KEY, 1, changes);
  const rendersAfterForward = await sourceRenders(page);
  // Back to the start: the working rasters (workingPagesKept) of the first pages were evicted by the pass, so they are decoded again.
  const back = await press(page, PREVIOUS_KEY, -1, changes);
  const rendersAfterBack = await sourceRenders(page);

  report(testInfo, 'slides and pages decoded by the source renderer', {
    slides,
    afterDetection: rendersAfterDetection,
    forwardPass: rendersAfterForward - rendersAfterDetection,
    backPass: rendersAfterBack - rendersAfterForward,
  });
  report(testInfo, 'slide change forward (ms)', summary(forward));
  report(testInfo, 'slide change back (ms)', summary(back));
  report(testInfo, 'bitmap cache after both passes (MiB)', { total: await cacheMib(page) });
  expect(forward.length).toBeGreaterThanOrEqual(changes);
});

test('NFR-004 NFR-016 TST-008 profile: JS heap before and after opening the largest PDF, and time to first slide (report only)', async ({ page }, testInfo) => {
  test.skip(realPdfs().largest === null, 'no real PDF in the corpus');
  const pdf = realPdfs().largest!;
  await page.goto(DEV_URL);
  const before = await heapMib(page);
  const started = await openReference(page, DEV_URL, 'largest');
  await waitForFirstSlideDrawn(page);
  const firstSlideMs = Date.now() - started;
  const after = await heapMib(page);
  report(testInfo, 'open of the largest PDF', {
    fileMib: pdf.bytes / BYTES_PER_MIB,
    heapBeforeMib: before,
    heapAfterMib: after,
    heapAddedMib: after - before,
    firstSlideMs,
    cacheMib: await cacheMib(page),
  });
  expect(firstSlideMs).toBeGreaterThan(0);
});

/** Time from each Next key to the frame after the slide canvas was repainted (`paint()` resizes the canvas, so a width assignment marks a repaint). */
async function installCanvasChangeTimer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = globalThis as unknown as { __paintMs?: number[]; __keyAt?: number | null };
    store.__paintMs = [];
    store.__keyAt = null;
    globalThis.addEventListener('keydown', (e) => { store.__keyAt = e.timeStamp; }, true);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
      ...descriptor,
      set(this: HTMLCanvasElement, value: number) {
        descriptor.set!.call(this, value);
        if (this.dataset['testid'] === 'slide-canvas' && store.__keyAt !== null && store.__keyAt !== undefined) {
          const started = store.__keyAt;
          store.__keyAt = null;
          requestAnimationFrame(() => store.__paintMs?.push(performance.now() - started));
        }
      },
    });
  });
}

const takePaintTimes = (page: Page): Promise<number[]> => page.evaluate(() => [...((globalThis as unknown as { __paintMs?: number[] }).__paintMs ?? [])]);

const FULL_HD = { width: 1920, height: 1080 };
const HIDPI = 2;
const COMPARED_SLIDES = 15;
const PAINT_WAIT_MS = 1_500;
const DEFAULT_CANVAS_WIDTH = 300; // width of a canvas that was never painted

for (const mode of ['annotation', 'presentation'] as const) {
  test.describe(`${mode} mode at 1920x1080, devicePixelRatio 2`, () => {
    test.use({ viewport: FULL_HD, deviceScaleFactor: HIDPI });

    test(`NFR-001 NFR-025 TST-008 profile: ${mode} mode slide changes and source renders (report only)`, async ({ page }, testInfo) => {
      test.skip(realPdfs().regular === null, 'no regular real PDF in the corpus');
      await openReference(page, DEV_URL, 'regular');
      await waitForFirstSlideDrawn(page);
      await waitForDetectionComplete(page);
      if (mode === 'presentation') {
        await page.getByLabel(label('modePresentation'), { exact: true }).click();
        await expect(page.locator('app-shell')).toHaveAttribute('data-mode', 'presentation');
      }
      // The slide view of the new mode paints once its first render is done (seconds on a large scan); the canvas keeps the 300x150 default until then.
      await expect.poll(() => page.getByTestId('slide-canvas').evaluate((c: HTMLCanvasElement) => c.width), { timeout: PERF_WAIT_MS }).toBeGreaterThan(DEFAULT_CANVAS_WIDTH);
      await page.waitForTimeout(PAINT_WAIT_MS);
      const stage = await page.getByTestId('slide-canvas').evaluate((c: HTMLCanvasElement) => ({ cssWidth: c.clientWidth, cssHeight: c.clientHeight, pxWidth: c.width, pxHeight: c.height }));
      await installCanvasChangeTimer(page);
      const rendersBefore = await sourceRenders(page);
      const directBefore = await directRenders(page);
      for (let i = 0; i < COMPARED_SLIDES; i++) {
        await page.keyboard.press(NEXT_KEY);
        await page.waitForTimeout(PAINT_WAIT_MS);
      }
      const times = await takePaintTimes(page);
      report(testInfo, `${mode}: slide canvas`, stage);
      report(testInfo, `${mode}: source renders during ${COMPARED_SLIDES} Next presses`, { renders: (await sourceRenders(page)) - rendersBefore, directRegions: (await directRenders(page)) - directBefore, painted: times.length });
      if (times.length > 0) {
        report(testInfo, `${mode}: key to changed slide pixels (ms)`, summary(times));
      }
      expect(times.length).toBeGreaterThan(0);
    });
  });
}
