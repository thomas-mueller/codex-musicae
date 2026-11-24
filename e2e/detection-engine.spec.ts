import { expect, test } from '@playwright/test';

import { SCORE_SYSTEMS_PER_PAGE, scoreBytes as scoreFile } from './support/score';

const scoreBytes = [...scoreFile];
const DEV_URL = 'http://127.0.0.1:4174';
const SCALE = 1;
const TOLERANCE_PX = 3 * SCALE;
const PAGE_INDEX = 2; // the first page of the standard score with a full set of systems
const PAGE_WIDTH = 685; // pt, the page size of the standard score (685.008 x 897.912)
const PAGE_HEIGHT = 898;
const WIDE_RATIO = 0.6;
const OPENCV_ASSET = '/assets/opencv/opencv.js';
const TEST_TIMEOUT_MS = 60_000;

test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'worker engine checked on desktop Chromium');
});

test.describe('development build with the debug hook', () => {
  test('DET-002 DET-004 NFR-012 the engine finds the systems of a page of the standard score, loading OpenCV lazily from our own origin', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto(DEV_URL);
    await expect(page.locator('app-root')).toBeAttached();
    expect(requested.some((u) => u.endsWith(OPENCV_ASSET))).toBe(false);

    const rects = await page.evaluate(
      ([bytes, scale, PAGE_INDEX_IN_PAGE]) => {
        const hook = (globalThis as unknown as { __cm: { detect: (p: Uint8Array, i: number, s: number) => Promise<{ x: number; y: number; width: number; height: number }[]> } }).__cm;
        return hook.detect(new Uint8Array(bytes as number[]), PAGE_INDEX_IN_PAGE as number, scale as number);
      },
      [scoreBytes, SCALE, PAGE_INDEX] as const,
    );

    expect(requested.some((u) => u.endsWith(OPENCV_ASSET))).toBe(true);
    expect(requested.filter((u) => !u.startsWith(DEV_URL) && !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([]);

    // The background component is not reported: no rectangle spans the whole page.
    expect(rects.some((r) => r.width >= PAGE_WIDTH * SCALE - TOLERANCE_PX && r.height >= PAGE_HEIGHT * SCALE - TOLERANCE_PX)).toBe(false);

    const wide = rects.filter((r) => r.width >= WIDE_RATIO * PAGE_WIDTH * SCALE);
    expect(wide.length).toBe(SCORE_SYSTEMS_PER_PAGE[PAGE_INDEX]);
    // The systems lie one below the other without overlapping.
    const ordered = [...wide].sort((first, second) => first.y - second.y);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]!.y, `system ${i + 1} starts below system ${i}`).toBeGreaterThanOrEqual(ordered[i - 1]!.y + ordered[i - 1]!.height - TOLERANCE_PX);
    }
  });
});
