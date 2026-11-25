import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../../src/config/tunables';
import { longestLongTaskMs, startLongTaskObserver, throttleCpu } from '../support/long-tasks';
import { enterOrganization, label } from '../support/score';
import { enterAnnotation, strokeLine, tool } from '../support/saving';
import { MIN_PERF_SLIDE_CHANGES } from '../../scripts/lib/corpus-files.mjs';
import { BYTES_PER_MIB, drawStroke, indicator, NEXT_KEY, pressNext, SETTLE_MS } from './actions';
import { displayedShare } from './viewer';
import {
  budget, DEV_URL, installStrokeLatencyTimer, detectionTimeoutMs, openReference, p95, PERF_WAIT_MS, realPdfs, report,
  summary, takeStrokeLatencies, waitForDetectionComplete, waitForFirstSlideDrawn,
} from './support';

const PERF_BASE_TEST_TIMEOUT_MS = 300_000; // the perf project's own test timeout, extended by the detection runs

test.use({ viewport: { width: 1280, height: 800 } });
// Detection of a long score takes minutes: two runs (opening, then the re-run of the background test) on top of the usual test time.
test.setTimeout(PERF_BASE_TEST_TIMEOUT_MS + 2 * detectionTimeoutMs());
test.skip(realPdfs().regular === null && realPdfs().heavy === null, 'no real PDF in the corpus (put PDFs in e2e/corpus/real/ or URLs in e2e/corpus/urls.txt, then run npm run corpus)');

const SLIDE_CHANGES = 50; // at most; fewer when the PDF has fewer slides (skipped below MIN_PERF_SLIDE_CHANGES)
const CPU_THROTTLE = 4; // estimates a small tablet; reported only
const IMPACT_SLIDE_CHANGES = 20;
const IMPACT_BURST = 5;
const STROKE_ROW = 0.5;
const SCROLL_STEP_FRACTION = 0.8;
const SCROLL_WAIT_MS = 60;
const MAX_ZOOM_CLICKS = 12;
const ZOOM_WAIT_MS = 1_500;
const DISPLAYED_SHARE = 0.9; // share of the visible page area that shows drawn tiles
const JUMP_FRACTIONS = [0.5, 0.97, 0.1, 0.75, 0.0, 1.0, 0.3];
const SCROLL_STEPS = 25;
const PIXEL_POLL_MS = 100;

async function openAndSettle(page: Page): Promise<void> {
  test.skip(realPdfs().regular === null, 'no regular real PDF (not a stress file) in the corpus');
  await openReference(page, '/', 'regular');
  await waitForFirstSlideDrawn(page);
  await waitForDetectionComplete(page);
}

/** The number of Next presses the open PDF allows, at most SLIDE_CHANGES; skips the test when it is too few to measure (never a silent pass). */
async function availableSlideChanges(page: Page): Promise<number> {
  const slides = Number(/\/ (\d+)$/.exec((await indicator(page).textContent()) ?? '')?.[1]);
  const changes = Math.min(SLIDE_CHANGES, slides - 1);
  test.skip(!(changes >= MIN_PERF_SLIDE_CHANGES), `the regular PDF with the most pages has ${slides} slides: fewer than ${MIN_PERF_SLIDE_CHANGES + 1} cannot give a slide-change measurement`);
  return changes;
}

test('NFR-016 TST-008 TST-015 the largest real PDF shows its first slide within the budget', async ({ page }, testInfo) => {
  test.skip(realPdfs().largest === null, 'no real PDF in the corpus (put PDFs in e2e/corpus/real/ or URLs in e2e/corpus/urls.txt, then run npm run corpus)');
  const started = await openReference(page, '/', 'largest');
  await waitForFirstSlideDrawn(page);
  const elapsed = Date.now() - started;
  report(testInfo, 'open to first slide (ms)', { elapsed }, budget('openToFirstSlideMs'));
  expect(elapsed).toBeLessThanOrEqual(budget('openToFirstSlideMs'));
});

test('NFR-001 TST-008 TST-015 a slide change takes at most the budget at the 95th percentile (consecutive Next on the regular real PDF with the most pages, up to 50, prefetch warm)', async ({ page }, testInfo) => {
  await openAndSettle(page);
  const changes = await availableSlideChanges(page);
  await enterAnnotation(page);
  const times = await pressNext(page, changes);
  report(testInfo, 'slide change (ms)', summary(times), budget('slideChangeP95Ms'));
  expect(p95(times)).toBeLessThanOrEqual(budget('slideChangeP95Ms'));
});

test('NFR-001 TST-008 TST-015 slide change under 4x CPU throttling (report only)', async ({ page }, testInfo) => {
  await openAndSettle(page);
  const changes = await availableSlideChanges(page);
  await enterAnnotation(page);
  const restore = await throttleCpu(page, CPU_THROTTLE);
  const times = await pressNext(page, changes);
  await restore();
  report(testInfo, `slide change at ${CPU_THROTTLE}x CPU throttling (ms)`, summary(times));
  expect(times.length).toBeGreaterThanOrEqual(changes);
});

test('NFR-002 DET-017 TST-008 TST-015 detection in the background adds no long task and no drawing latency', async ({ page }, testInfo) => {
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

test('NFR-016 NFR-004 TST-008 TST-015 scrolling every page and zooming to the maximum stays within the heap and cache budgets (development build)', async ({ page }, testInfo) => {
  await openReference(page, DEV_URL, 'heavy');
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

test('NFR-002 NFR-016 TST-015 the heaviest real PDF stays responsive while detection runs: scrolling, zooming and large jumps display the pages', async ({ page }, testInfo) => {
  await openReference(page, '/', 'heavy');
  await waitForFirstSlideDrawn(page);
  await enterOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  await expect(viewer).toBeVisible();
  await expect.poll(() => displayedShare(page), { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(DISPLAYED_SHARE);
  await startLongTaskObserver(page);

  // Jumps of the scroll position over the whole document (start, far, near the end, back to the front, middle, end, start).
  const jumpTimes: number[] = [];
  for (const fraction of JUMP_FRACTIONS) {
    await viewer.evaluate((el, f) => el.scrollTo({ top: f * (el.scrollHeight - el.clientHeight) }), fraction);
    const started = Date.now();
    await expect.poll(() => displayedShare(page), { timeout: PERF_WAIT_MS, intervals: [PIXEL_POLL_MS] }).toBeGreaterThanOrEqual(DISPLAYED_SHARE);
    jumpTimes.push(Date.now() - started);
  }

  // Scrolling in steps over a stretch of pages, the screen must stay drawn after each step.
  for (let i = 0; i < SCROLL_STEPS; i++) {
    await viewer.evaluate((el, fraction) => el.scrollBy({ top: el.clientHeight * fraction }), SCROLL_STEP_FRACTION);
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }
  await expect.poll(() => displayedShare(page), { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(DISPLAYED_SHARE);

  // Zoom in and out; the visible pages are drawn again after each change (sharp at the settled scale).
  const zoomIn = page.getByRole('button', { name: label('zoomIn'), exact: true });
  const zoomOut = page.getByRole('button', { name: label('zoomOut'), exact: true });
  for (const button of [zoomIn, zoomIn, zoomOut, zoomOut, zoomOut]) {
    if (await button.isEnabled()) {
      await button.click();
    }
    await page.waitForTimeout(TUNABLES.rendering.zoomSettleMs);
    await expect.poll(() => displayedShare(page), { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(DISPLAYED_SHARE);
  }

  const longest = await longestLongTaskMs(page);
  const progress = page.getByTestId('detection-progress');
  const stillRunning = await progress.isVisible(); // detection ran at least part of the time; only informational for short documents
  report(testInfo, 'jump until displayed (ms)', summary(jumpTimes));
  report(testInfo, 'longest long task while scrolling, zooming and jumping (ms)', { longest, stillRunning: Number(stillRunning) }, budget('drawingMaxLongTaskMs'));
  expect(longest).toBeLessThanOrEqual(budget('drawingMaxLongTaskMs'));
});
