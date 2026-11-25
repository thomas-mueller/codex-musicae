import { expect, type Page } from '@playwright/test';

import { installSlideChangeTimer, PERF_WAIT_MS, recordedSlideChanges } from './support';

// Actions the performance specs share (budgets, render profile, load suite): stepping through slides, drawing a stroke, reading the JS heap.

export const SETTLE_MS = 300; // the neighbors are prefetched before the next command (NFR-001 "with neighbors prefetched")
export const GC_SETTLE_MS = 200;
const BYTES_PER_KIB = 1024;
export const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
export const NEXT_KEY = 'PageDown';
export const PREVIOUS_KEY = 'PageUp';
export const STROKE_POINTS = 200;

export const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
export const currentSlide = async (page: Page): Promise<number> => Number(/^(\d+)/.exec((await indicator(page).textContent()) ?? '')?.[1]);

/** A stroke of `STROKE_POINTS` pointer moves. */
export async function drawStroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: STROKE_POINTS });
  await page.mouse.up();
}

/** JS heap in MiB after a garbage collection (decoded bitmaps live outside the JS heap and are not included). */
export async function heapMib(page: Page): Promise<number> {
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
export async function press(page: Page, key: string, step: 1 | -1, count: number): Promise<number[]> {
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

/** Presses Next `count` times, waiting for each change and for the neighbors to be prefetched; returns the page's timings. */
export const pressNext = (page: Page, count: number): Promise<number[]> => press(page, NEXT_KEY, 1, count);
