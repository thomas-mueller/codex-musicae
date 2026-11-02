import { readFileSync } from 'node:fs';
import { expect, type Page, type TestInfo } from '@playwright/test';

import { TUNABLES } from '../../src/config/tunables';
import { FILE_CHOOSER_TIMEOUT_MS } from '../support/timing';
import { forceFileInput, label } from '../support/score';

export const DEV_URL = 'http://127.0.0.1:4174';
const REFERENCE_PATH = 'e2e/perf/reference-120.pdf';
const CI_FACTOR = process.env['CI'] ? TUNABLES.budgets.ciToleranceFactor : 1;
const P95 = 0.95;
const MEDIAN = 0.5;
const DECIMALS = 1;
const DARK_MAX = 128;
const RGBA = 4;
const PIXEL_POLL_MS = 100;
/** Detection of 120 pages (one scanned) on a small CI runner. */
const DETECTION_120_BASE_MS = 180_000;
const CI_TIMEOUT_FACTOR = 2;
export const DETECTION_120_TIMEOUT_MS = DETECTION_120_BASE_MS * (process.env['CI'] ? CI_TIMEOUT_FACTOR : 1);
export const PERF_WAIT_MS = 30_000;

/** A `T:budgets` number, widened by `T:budgets.ciToleranceFactor` on CI (TST-008). */
export function budget(key: 'slideChangeP95Ms' | 'drawingMaxLongTaskMs' | 'drawingMaxAddedLatencyMs' | 'maxJsHeapMb' | 'openToFirstSlideMs'): number {
  return TUNABLES.budgets[key] * CI_FACTOR;
}

export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] ?? 0;
}

export const p95 = (values: readonly number[]): number => percentile(values, P95);

/** Prints the measurement and keeps it as a test annotation (each perf test reports what it measured). */
export function report(info: TestInfo, name: string, values: Record<string, number>, limit?: number): void {
  const text = Object.entries(values)
    .map(([k, v]) => `${k}=${v.toFixed(DECIMALS)}`)
    .join(' ');
  const line = `${name}: ${text}${limit === undefined ? '' : ` (limit ${limit.toFixed(DECIMALS)})`}`;
  process.stdout.write(`PERF ${line}\n`);
  info.annotations.push({ type: 'perf', description: line });
}

export const summary = (values: readonly number[]): Record<string, number> => ({
  min: Math.min(...values),
  median: percentile(values, MEDIAN),
  p95: p95(values),
  max: Math.max(...values),
});

/** Opens the reference PDF through the file chooser; returns the time when the file was handed over. */
export async function openReference(page: Page, url: string): Promise<number> {
  const bytes = (() => {
    try {
      return readFileSync(REFERENCE_PATH);
    } catch {
      throw new Error(`${REFERENCE_PATH} is missing: run "npm run make:large-pdf" first`);
    }
  })();
  await forceFileInput(page);
  await page.goto(url);
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  const chosen = await chooser;
  const started = Date.now();
  await chosen.setFiles({ name: 'reference-120.pdf', mimeType: 'application/pdf', buffer: bytes });
  return started;
}

/** Waits until the first slide shows paper and ink: visible canvas, nothing processing, at least one dark pixel. */
export async function waitForFirstSlideDrawn(page: Page): Promise<void> {
  const canvas = page.getByTestId('slide-canvas');
  await expect(canvas).toBeVisible({ timeout: PERF_WAIT_MS });
  await expect(page.getByTestId('slide-empty-processing')).toHaveCount(0, { timeout: PERF_WAIT_MS });
  // Decided in the page: shipping the pixels of a whole slide to the test process on every poll would dominate the measurement.
  await expect
    .poll(
      () =>
        canvas.evaluate((element: HTMLCanvasElement, { dark, stride }: { dark: number; stride: number }) => {
          const context = element.getContext('2d');
          if (!context || element.width === 0 || element.height === 0) {
            return false;
          }
          const { data } = context.getImageData(0, 0, element.width, element.height);
          for (let i = 0; i < data.length; i += stride) {
            if (data[i]! < dark && data[i + 1]! < dark && data[i + 2]! < dark) {
              return true;
            }
          }
          return false;
        }, { dark: DARK_MAX, stride: RGBA }),
      { timeout: PERF_WAIT_MS, intervals: [PIXEL_POLL_MS] },
    )
    .toBe(true);
}

/** Detection is complete when the indicator no longer shows the trailing "+". */
export async function waitForDetectionComplete(page: Page): Promise<void> {
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/, { timeout: DETECTION_120_TIMEOUT_MS });
}

type Timings = { __frameMs?: number[]; __pending?: number | null };

/**
 * Collects, in the page, the time from every keydown (event time stamp) to the second animation frame after the indicator
 * "x / n" changed: the slide has been switched and a frame has been produced (NFR-001). Install once before the presses.
 */
export async function installSlideChangeTimer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = globalThis as unknown as Timings;
    store.__frameMs = [];
    store.__pending = null;
    globalThis.addEventListener(
      'keydown',
      (event) => {
        store.__pending = event.timeStamp;
      },
      true,
    );
    const indicator = globalThis.document.querySelector('app-bottom-bar .indicator')!;
    new MutationObserver(() => {
      const started = store.__pending;
      if (started === null || started === undefined) {
        return;
      }
      store.__pending = null;
      requestAnimationFrame(() => requestAnimationFrame(() => store.__frameMs?.push(performance.now() - started)));
    }).observe(indicator, { childList: true, characterData: true, subtree: true });
  });
}

export const recordedSlideChanges = (page: Page): Promise<number[]> => page.evaluate(() => [...((globalThis as unknown as Timings).__frameMs ?? [])]);

type Latencies = { __strokeMs?: number[] };

/** Collects, in the page, the time from every pointermove (event time stamp) to the next animation frame. */
export async function installStrokeLatencyTimer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = globalThis as unknown as Latencies;
    store.__strokeMs = [];
    globalThis.addEventListener(
      'pointermove',
      (event) => {
        const started = event.timeStamp;
        requestAnimationFrame(() => store.__strokeMs?.push(performance.now() - started));
      },
      true,
    );
  });
}

export const takeStrokeLatencies = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    const store = globalThis as unknown as Latencies;
    const values = store.__strokeMs ?? [];
    store.__strokeMs = [];
    return values;
  });
