import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../../src/config/tunables';
import { longestLongTaskMs, startLongTaskObserver, throttleCpu } from '../support/long-tasks';
import { enterOrganization, label } from '../support/score';
import { enterAnnotation, strokeLine, tool } from '../support/saving';
import {
  budget, DEV_URL, installSlideChangeTimer, installStrokeLatencyTimer, openReference, p95, PERF_WAIT_MS, recordedSlideChanges, report,
  summary, takeStrokeLatencies, waitForDetectionComplete, waitForFirstSlideDrawn,
} from './support';

test.use({ viewport: { width: 1280, height: 800 } });

const SLIDE_CHANGES = 50;
const SETTLE_MS = 300; // the neighbors are prefetched before the next command (NFR-001 "with neighbors prefetched")
const CPU_THROTTLE = 4; // estimates a small tablet; reported only
const IMPACT_SLIDE_CHANGES = 20;
const IMPACT_BURST = 5;
const STROKE_ROW = 0.5;
const BYTES_PER_MIB = 1024 * 1024;
const SCROLL_STEP_FRACTION = 0.8;
const SCROLL_WAIT_MS = 60;
const MAX_ZOOM_CLICKS = 12;
const ZOOM_WAIT_MS = 1_500;
const NEXT_KEY = 'PageDown';
const STROKE_POINTS = 200;

/** A stroke of `STROKE_POINTS` pointer moves. */
async function drawStroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: STROKE_POINTS });
  await page.mouse.up();
}

const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const currentSlide = async (page: Page): Promise<number> => Number(/^(\d+)/.exec((await indicator(page).textContent()) ?? '')?.[1]);

/** Presses Next `count` times, waiting for each change and for the neighbors to be prefetched; returns the page's timings. */
async function pressNext(page: Page, count: number): Promise<number[]> {
  await installSlideChangeTimer(page);
  for (let i = 0; i < count; i++) {
    const before = await currentSlide(page);
    await page.keyboard.press(NEXT_KEY);
    await expect.poll(() => currentSlide(page), { timeout: PERF_WAIT_MS }).toBe(before + 1);
    await page.waitForTimeout(SETTLE_MS);
  }
  await expect.poll(async () => (await recordedSlideChanges(page)).length, { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(count);
  return recordedSlideChanges(page);
}

async function openAndSettle(page: Page): Promise<void> {
  await openReference(page, '/');
  await waitForFirstSlideDrawn(page);
  await waitForDetectionComplete(page);
}

test('NFR-016 TST-008 the reference PDF shows its first slide within the budget', async ({ page }, testInfo) => {
  const started = await openReference(page, '/');
  await waitForFirstSlideDrawn(page);
  const elapsed = Date.now() - started;
  report(testInfo, 'open to first slide (ms)', { elapsed }, budget('openToFirstSlideMs'));
  expect(elapsed).toBeLessThanOrEqual(budget('openToFirstSlideMs'));
});

test('NFR-001 TST-008 a slide change takes at most the budget at the 95th percentile (50 consecutive Next, prefetch warm)', async ({ page }, testInfo) => {
  await openAndSettle(page);
  await enterAnnotation(page);
  const times = await pressNext(page, SLIDE_CHANGES);
  report(testInfo, 'slide change (ms)', summary(times), budget('slideChangeP95Ms'));
  expect(p95(times)).toBeLessThanOrEqual(budget('slideChangeP95Ms'));
});

test('NFR-001 TST-008 slide change under 4x CPU throttling (report only)', async ({ page }, testInfo) => {
  await openAndSettle(page);
  await enterAnnotation(page);
  const restore = await throttleCpu(page, CPU_THROTTLE);
  const times = await pressNext(page, SLIDE_CHANGES);
  await restore();
  report(testInfo, `slide change at ${CPU_THROTTLE}x CPU throttling (ms)`, summary(times));
  expect(times.length).toBeGreaterThanOrEqual(SLIDE_CHANGES);
});

test('NFR-002 DET-017 TST-008 detection in the background adds no long task and no drawing latency', async ({ page }, testInfo) => {
  await openAndSettle(page);
  // Detection of the reference takes seconds at the default level; a re-run at the finest level (DET-015) keeps it busy
  // in the background while the user works.
  await enterOrganization(page);
  const fab = page.getByLabel(label('orgFab'), { exact: true });
  if (await fab.isVisible()) {
    await fab.click();
  }
  await page.getByLabel(label('levelFine'), { exact: true }).click();
  await page.getByTestId('level-confirm').click();
  const progress = page.getByTestId('detection-progress'); // shown in organization mode only
  await expect(progress).toBeVisible(); // the re-run is going on
  await enterAnnotation(page);
  await installStrokeLatencyTimer(page);
  await startLongTaskObserver(page);
  await tool(page, 'pen').click();

  // Bursts of work separated by more than the idle time, so that detection resumes between them.
  let changes = 0;
  while (changes < IMPACT_SLIDE_CHANGES) {
    for (let i = 0; i < IMPACT_BURST && changes < IMPACT_SLIDE_CHANGES; i++, changes++) {
      await page.keyboard.press(NEXT_KEY);
      await page.waitForTimeout(SETTLE_MS);
    }
    await page.waitForTimeout(TUNABLES.detection.idleBeforeResumeMs + SETTLE_MS);
  }
  const line = await strokeLine(page, undefined, undefined, STROKE_ROW);
  await takeStrokeLatencies(page);
  await drawStroke(page, line.from, line.to);
  const during = await takeStrokeLatencies(page);
  const longest = await longestLongTaskMs(page);
  await enterOrganization(page);
  const stillRunning = await progress.isVisible(); // it only counts up: running now means running all along
  await enterAnnotation(page);

  // The same stroke with detection finished is the baseline: what detection adds is the difference.
  await waitForDetectionComplete(page);
  await page.waitForTimeout(TUNABLES.detection.idleBeforeResumeMs);
  const second = await strokeLine(page, undefined, undefined, STROKE_ROW);
  await takeStrokeLatencies(page);
  await drawStroke(page, second.from, second.to);
  const idle = await takeStrokeLatencies(page);

  expect(during.length, 'the stroke produced pointer events').toBeGreaterThan(0);
  const added = Math.max(0, p95(during) - p95(idle));
  report(testInfo, 'longest long task during detection (ms)', { longest }, budget('drawingMaxLongTaskMs'));
  report(testInfo, 'stroke added latency (ms)', { during: p95(during), idle: p95(idle), added }, budget('drawingMaxAddedLatencyMs'));
  expect(stillRunning, 'detection was still running while the stroke was drawn').toBe(true);
  expect(longest).toBeLessThanOrEqual(budget('drawingMaxLongTaskMs'));
  expect(added).toBeLessThanOrEqual(budget('drawingMaxAddedLatencyMs'));
});

test('NFR-016 NFR-004 TST-008 scrolling every page and zooming to the maximum stays within the heap and cache budgets (development build)', async ({ page }, testInfo) => {
  await openReference(page, DEV_URL);
  await waitForFirstSlideDrawn(page);
  await enterOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  await expect(viewer).toBeVisible();

  const steps = await viewer.evaluate((el) => Math.ceil(el.scrollHeight / (el.clientHeight * 0.8)));
  for (let i = 0; i <= steps; i++) {
    await viewer.evaluate((el, fraction) => el.scrollTo({ top: el.scrollTop + el.clientHeight * fraction }), SCROLL_STEP_FRACTION);
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }
  const zoomIn = page.getByRole('button', { name: label('zoomIn'), exact: true });
  for (let i = 0; i < MAX_ZOOM_CLICKS && (await zoomIn.isEnabled()); i++) {
    await zoomIn.click();
    await page.waitForTimeout(ZOOM_WAIT_MS / MAX_ZOOM_CLICKS);
  }
  await page.waitForTimeout(ZOOM_WAIT_MS);

  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.collectGarbage');
  await session.send('Performance.enable');
  const { metrics } = (await session.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
  const heapMb = (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? Number.NaN) / BYTES_PER_MIB;
  const cache = await page.evaluate(() => (globalThis as unknown as { __cm: { cache: { totalBytes: number; budgetBytes: number } } }).__cm.cache);
  report(testInfo, 'JS heap (MiB)', { heapMb }, budget('maxJsHeapMb'));
  report(testInfo, 'bitmap cache (MiB)', { total: cache.totalBytes / BYTES_PER_MIB, budget: cache.budgetBytes / BYTES_PER_MIB });
  expect(heapMb).toBeLessThanOrEqual(budget('maxJsHeapMb'));
  expect(cache.totalBytes).toBeLessThanOrEqual(cache.budgetBytes);
});
