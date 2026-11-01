import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const scoreBytes = [...readFileSync('e2e/fixtures/synthetic-score.pdf')];
const DEV_URL = 'http://127.0.0.1:4174';
const SCALE = 1;
const TOLERANCE_PX = 3 * SCALE;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const SYSTEM_TOPS = [100, 280, 460, 640]; // make-test-pdfs.mjs
const SYSTEM_X0 = 50;
const SYSTEM_X1 = 545;
const SYSTEM_HEIGHT = 60; // second staff starts 40 below the top and has 4 line gaps of 5
const WIDE_RATIO = 0.6;
const OPENCV_ASSET = '/assets/opencv/opencv.js';
const TEST_TIMEOUT_MS = 60_000;

test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'worker engine checked on desktop Chromium');
});

test.describe('development build with the debug hook', () => {
  test('DET-002 DET-004 NFR-012 the engine finds the four systems of page 1, loading OpenCV lazily from our own origin', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto(DEV_URL);
    await expect(page.locator('app-root')).toBeAttached();
    expect(requested.some((u) => u.endsWith(OPENCV_ASSET))).toBe(false);

    const rects = await page.evaluate(
      ([bytes, scale]) => {
        const hook = (globalThis as unknown as { __cm: { detect: (p: Uint8Array, i: number, s: number) => Promise<{ x: number; y: number; width: number; height: number }[]> } }).__cm;
        return hook.detect(new Uint8Array(bytes as number[]), 0, scale as number);
      },
      [scoreBytes, SCALE] as const,
    );

    expect(requested.some((u) => u.endsWith(OPENCV_ASSET))).toBe(true);
    expect(requested.filter((u) => !u.startsWith(DEV_URL) && !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([]);

    // The background component is not reported: no rectangle spans the whole page.
    expect(rects.some((r) => r.width >= PAGE_WIDTH * SCALE - TOLERANCE_PX && r.height >= PAGE_HEIGHT * SCALE - TOLERANCE_PX)).toBe(false);

    const wide = rects.filter((r) => r.width >= WIDE_RATIO * PAGE_WIDTH * SCALE);
    expect(wide.length).toBe(SYSTEM_TOPS.length);
    for (const top of SYSTEM_TOPS) {
      const match = wide.find(
        (r) =>
          Math.abs(r.x - SYSTEM_X0 * SCALE) <= TOLERANCE_PX &&
          Math.abs(r.y - top * SCALE) <= TOLERANCE_PX &&
          Math.abs(r.width - (SYSTEM_X1 - SYSTEM_X0) * SCALE) <= TOLERANCE_PX &&
          Math.abs(r.height - SYSTEM_HEIGHT * SCALE) <= TOLERANCE_PX,
      );
      expect(match, `system at top ${top}`).toBeDefined();
    }
  });
});
