import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../../src/config/tunables';
import { invariantProblems, isDisplayed, pageAtOffset } from '../../scripts/lib/load-checks.mjs';
import { longestLongTaskMs, startLongTaskObserver, throttleCpu } from '../support/long-tasks';
import { enterOrganization, label } from '../support/score';
import { enterAnnotation, strokeLine, tool } from '../support/saving';
import { detectionRunTimeoutMs } from '../support/timing';
import { BYTES_PER_MIB, currentSlide, drawStroke, heapMib, indicator, NEXT_KEY, SETTLE_MS } from './actions';
import {
  budget, DEV_URL, installSlideChangeTimer, installStrokeLatencyTimer, loadPdfs, openLoadPdf, p95, PERF_WAIT_MS, recordedSlideChanges, report, summary,
  takeStrokeLatencies, waitForDetectionComplete, waitForFirstSlideDrawn,
} from './support';
import { displayedShare } from './viewer';

// The load suite (V2-M3b S3, TST-025): every PDF of the `load` suite of expected.json is opened and then worked with while detection of the
// whole file runs: slide stepping, large jumps, scrolling, zooming and one pen stroke. It asserts that the requested page is displayed and drawn
// after each action, the budgets of T:budgets and the resource invariants; it does not look at detection results. It runs on the development
// build (the invariants are read through window.__cm), so its timings are stricter than those of the production-build budget tests.
const PERF_BASE_TEST_TIMEOUT_MS = 300_000;
const DETECTION_RUNS = 3; // opening, the re-run that keeps detection busy, the idle baseline of the stroke
const SLIDE_CHANGES = 50; // at most; fewer when the PDF has fewer slides
const CPU_THROTTLE = 4; // estimates a small tablet; correctness only
const IMPACT_SLIDE_CHANGES = 20;
const DISPLAYED_SHARE = 0.9; // share of the visible page area that shows drawn tiles
const JUMP_FRACTIONS = [0.5, 0.97, 0.1, 0.75, 0.0, 1.0, 0.3];
const BURST_FRACTIONS: [number, number] = [0.6, 0.2]; // two jumps without waiting: only the last one is asserted
const SCROLL_STEPS = 25;
const SCROLL_STEP_FRACTION = 0.8;
const SCROLL_WAIT_MS = 60;
const PIXEL_POLL_MS = 100;
const SAMPLE_INTERVAL_MS = 250;
const STROKE_ROW = 0.5;

test.use({ viewport: { width: 1280, height: 800 } });

const files = loadPdfs();
test.skip(files.length === 0, 'no load PDF in the corpus (put PDFs in e2e/corpus/real/ or URLs in e2e/corpus/urls.txt, then run npm run corpus)');

type Probe = { __cm: { cache: { totalBytes: number; budgetBytes: number }; detectionState?: () => { complete: boolean }; redetect?: (level: string) => void; schedulerPeak?: () => Record<string, number> } };
type Samples = { cacheBytes: number; cacheBudgetBytes: number; canvasPixels: number[]; peakPerClass: Record<string, number>; heapMb: number };
type Outcome = { slideChanges: number[]; longest: number; stroke: { during: number; idle: number } | null; samples: Samples };

/** What the `parallel` scenario measured, for the `resources` scenario of the same file. */
const outcomes = new Map<string, Outcome>();

/** Starts, in the page, the sampler of the bitmap cache and of the canvas sizes (the invariants must hold at every moment, not only at the end). */
async function startSampler(page: Page): Promise<void> {
  await page.evaluate((interval) => {
    const store = globalThis as unknown as { __loadMax?: { cache: number; budget: number; canvas: number } } & Probe;
    store.__loadMax = { cache: 0, budget: 0, canvas: 0 };
    const sample = (): void => {
      const max = store.__loadMax!;
      max.cache = Math.max(max.cache, store.__cm.cache.totalBytes);
      max.budget = store.__cm.cache.budgetBytes;
      for (const canvas of Array.from(globalThis.document.querySelectorAll('canvas'))) max.canvas = Math.max(max.canvas, canvas.width * canvas.height);
    };
    sample();
    globalThis.setInterval(sample, interval);
  }, SAMPLE_INTERVAL_MS);
}

async function readSamples(page: Page): Promise<Samples> {
  const read = await page.evaluate(() => {
    const store = globalThis as unknown as { __loadMax: { cache: number; budget: number; canvas: number } } & Probe;
    return { ...store.__loadMax, peak: store.__cm.schedulerPeak?.() ?? {} };
  });
  return { cacheBytes: read.cache, cacheBudgetBytes: read.budget, canvasPixels: [read.canvas], peakPerClass: read.peak, heapMb: await heapMib(page) };
}

const assertInvariants = (samples: Samples): void =>
  expect(
    invariantProblems({
      ...samples,
      maxCanvasPixels: TUNABLES.resources.maxCanvasPixels,
      maxHeapMb: budget('maxJsHeapMb'),
      maxPerClass: TUNABLES.resources.schedulerMaxPerClass,
    }),
  ).toEqual([]);

/** Detection of the whole file must be running while the app is used: it starts with the document; a finished run is restarted at the finest level. */
async function keepDetectionBusy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (globalThis as unknown as Probe).__cm;
    if (hook.detectionState?.().complete === true) hook.redetect?.('fine');
  });
}

const totalSlides = async (page: Page): Promise<number> => Number(/\/ (\d+)/.exec((await indicator(page).textContent()) ?? '')?.[1]);

/**
 * Steps through the slides with Next, at most `max` times; after every step the next slide is the one shown (indicator) and it is drawn.
 * While detection runs new slides keep arriving, so a missing next slide is waited for; when none comes the stepping ends. Returns the key-to-frame times.
 */
async function stepSlides(page: Page, max: number): Promise<number[]> {
  await installSlideChangeTimer(page);
  let done = 0;
  while (done < max) {
    const before = await currentSlide(page);
    try {
      await expect.poll(() => totalSlides(page), { timeout: PERF_WAIT_MS }).toBeGreaterThan(before);
    } catch {
      break; // no further slide arrived: the document ends here
    }
    await page.keyboard.press(NEXT_KEY);
    await expect.poll(() => currentSlide(page), { timeout: PERF_WAIT_MS }).toBe(before + 1);
    await waitForFirstSlideDrawn(page);
    await page.waitForTimeout(SETTLE_MS);
    done++;
  }
  expect(done, 'there was at least one slide to step to').toBeGreaterThan(0);
  await expect.poll(async () => (await recordedSlideChanges(page)).length, { timeout: PERF_WAIT_MS }).toBeGreaterThanOrEqual(done);
  return recordedSlideChanges(page);
}

/** The page the viewer shows at its middle after a jump to `fraction` is the requested one, and its visible area is drawn. */
async function expectJumpDisplayed(page: Page): Promise<void> {
  const geometry = await page.getByTestId('org-viewer').evaluate((viewer) => {
    const area = viewer.getBoundingClientRect();
    return {
      centre: viewer.scrollTop + viewer.clientHeight / 2,
      pages: Array.from(viewer.querySelectorAll('[data-testid^="org-page-"]')).map((el) => {
        const rect = el.getBoundingClientRect();
        return { id: el.getAttribute('data-testid') ?? '', top: rect.top - area.top + viewer.scrollTop, height: rect.height };
      }),
    };
  });
  expect(geometry.pages.length, 'pages are present after the jump').toBeGreaterThan(0);
  const requested = pageAtOffset(geometry.pages, geometry.centre);
  if (requested >= 0) await expect(page.getByTestId(geometry.pages[requested]!.id), 'the requested page is in the viewer').toBeVisible();
  await expect.poll(async () => isDisplayed(await displayedShare(page), DISPLAYED_SHARE), { timeout: PERF_WAIT_MS, intervals: [PIXEL_POLL_MS] }).toBe(true);
}

const jumpTo = (page: Page, fraction: number) =>
  page.getByTestId('org-viewer').evaluate((el, f) => el.scrollTo({ top: f * (el.scrollHeight - el.clientHeight) }), fraction);

/** Jumps, scrolling and zooming in the organization viewer; the requested page is displayed after each action. */
async function useViewer(page: Page): Promise<void> {
  await enterOrganization(page);
  await expect(page.getByTestId('org-viewer')).toBeVisible();
  await expect.poll(async () => isDisplayed(await displayedShare(page), DISPLAYED_SHARE), { timeout: PERF_WAIT_MS }).toBe(true);
  for (const fraction of JUMP_FRACTIONS) {
    await jumpTo(page, fraction);
    await expectJumpDisplayed(page);
  }
  // Two jumps without waiting: the first is overtaken and not asserted.
  for (const fraction of BURST_FRACTIONS) await jumpTo(page, fraction);
  await expectJumpDisplayed(page);
  for (let i = 0; i < SCROLL_STEPS; i++) {
    await page.getByTestId('org-viewer').evaluate((el, f) => el.scrollBy({ top: el.clientHeight * f }), SCROLL_STEP_FRACTION);
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }
  await expectJumpDisplayed(page);
  const zoomIn = page.getByRole('button', { name: label('zoomIn'), exact: true });
  const zoomOut = page.getByRole('button', { name: label('zoomOut'), exact: true });
  for (const button of [zoomIn, zoomIn, zoomOut, zoomOut, zoomOut]) {
    if (await button.isEnabled()) await button.click();
    await page.waitForTimeout(TUNABLES.rendering.zoomSettleMs);
    await expectJumpDisplayed(page);
  }
}

for (const pdf of files) {
  test.describe(`TST-025 load ${pdf.file}`, () => {
    test.setTimeout(PERF_BASE_TEST_TIMEOUT_MS + DETECTION_RUNS * detectionRunTimeoutMs(pdf.pages));

    test(`NFR-016 TST-008 TST-025 open: ${pdf.file} shows its first slide within the budget`, async ({ page }, testInfo) => {
      const started = await openLoadPdf(page, DEV_URL, pdf);
      await waitForFirstSlideDrawn(page);
      const elapsed = Date.now() - started;
      report(testInfo, `open to first slide (ms) ${pdf.file}`, { elapsed }, budget('openToFirstSlideMs'));
      expect(elapsed).toBeLessThanOrEqual(budget('openToFirstSlideMs'));
    });

    test(`NFR-001 NFR-002 TST-008 TST-025 parallel: ${pdf.file} stays correct and responsive while detection runs`, async ({ page }, testInfo) => {
      await openLoadPdf(page, DEV_URL, pdf);
      await waitForFirstSlideDrawn(page);
      await keepDetectionBusy(page);
      await startSampler(page);
      await startLongTaskObserver(page);
      await enterAnnotation(page);
      const slideChanges = await stepSlides(page, SLIDE_CHANGES);
      await useViewer(page);
      await enterAnnotation(page);
      await installStrokeLatencyTimer(page);
      await tool(page, 'pen').click();
      const line = await strokeLine(page, undefined, undefined, STROKE_ROW);
      await takeStrokeLatencies(page);
      await drawStroke(page, line.from, line.to);
      const during = await takeStrokeLatencies(page);
      const longest = await longestLongTaskMs(page);

      // The same stroke with detection finished is the baseline: what detection adds is the difference.
      await waitForDetectionComplete(page, pdf.pages);
      await page.waitForTimeout(TUNABLES.detection.idleBeforeResumeMs);
      const second = await strokeLine(page, undefined, undefined, STROKE_ROW);
      await takeStrokeLatencies(page);
      await drawStroke(page, second.from, second.to);
      const idle = await takeStrokeLatencies(page);
      expect(during.length, 'the stroke produced pointer events').toBeGreaterThan(0);

      const added = Math.max(0, p95(during) - p95(idle));
      outcomes.set(pdf.file, { slideChanges, longest, stroke: { during: p95(during), idle: p95(idle) }, samples: await readSamples(page) });
      report(testInfo, `slide change (ms) ${pdf.file}`, { count: slideChanges.length, ...summary(slideChanges) }, budget('slideChangeP95Ms'));
      report(testInfo, `longest long task (ms) ${pdf.file}`, { longest }, budget('drawingMaxLongTaskMs'));
      report(testInfo, `stroke added latency (ms) ${pdf.file}`, { during: p95(during), idle: p95(idle), added }, budget('drawingMaxAddedLatencyMs'));
      expect(p95(slideChanges)).toBeLessThanOrEqual(budget('slideChangeP95Ms'));
      expect(longest).toBeLessThanOrEqual(budget('drawingMaxLongTaskMs'));
      expect(added).toBeLessThanOrEqual(budget('drawingMaxAddedLatencyMs'));
    });

    test(`NFR-004 NFR-006 NFR-016 TST-025 resources: ${pdf.file} keeps the cache, the canvases, the heap and the tasks within their limits`, () => {
      const outcome = outcomes.get(pdf.file);
      expect(outcome, 'the parallel scenario of this file did not run or did not finish').toBeDefined();
      const samples = (outcome as Outcome).samples;
      report(test.info(), `resources ${pdf.file}`, {
        cacheMib: samples.cacheBytes / BYTES_PER_MIB,
        budgetMib: samples.cacheBudgetBytes / BYTES_PER_MIB,
        canvasPixels: Math.max(...samples.canvasPixels),
        heapMb: samples.heapMb,
        peakTasks: Math.max(0, ...Object.values(samples.peakPerClass)),
      });
      assertInvariants(samples);
    });

    test(`NFR-001 NFR-016 TST-025 throttled: ${pdf.file} stays correct under ${CPU_THROTTLE}x CPU throttling (timing reported only)`, async ({ page }, testInfo) => {
      await openLoadPdf(page, DEV_URL, pdf);
      await waitForFirstSlideDrawn(page);
      await keepDetectionBusy(page);
      await startSampler(page);
      await startLongTaskObserver(page);
      const restore = await throttleCpu(page, CPU_THROTTLE);
      await enterAnnotation(page);
      const slideChanges = await stepSlides(page, IMPACT_SLIDE_CHANGES);
      await useViewer(page);
      const longest = await longestLongTaskMs(page);
      await restore();
      report(testInfo, `slide change at ${CPU_THROTTLE}x CPU throttling (ms) ${pdf.file}`, summary(slideChanges));
      report(testInfo, `longest long task at ${CPU_THROTTLE}x CPU throttling (ms) ${pdf.file}`, { longest });
      assertInvariants(await readSamples(page));
    });
  });
}
