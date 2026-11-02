import { expect, test } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { inkedPixelsNear } from './support/pixels';
import { DETECTION_TIMEOUT_MS } from './support/timing';
import { openScore, scoreBytes, SYNTHETIC_BARS, SYNTHETIC_SYSTEMS, waitForBars, waitForFinalSlideCount } from './support/score';
import {
  addJumpToStart, COLOR_TOLERANCE, drag, enterAnnotation, enterOrganization, forceFilePaths, inspect, openPdf, qpdfCheck, RED,
  redPixelsOnSlide, saveCopyDownload, shorterPdfWithMetadata, strokeLine, tool,
} from './support/saving';

test.use({ viewport: { width: 1600, height: 700 } });

const DEV_URL = 'http://127.0.0.1:4174';
const PAGES_OF_SHORTER_PDF = 2;
const BARS_PER_PAGE = SYNTHETIC_BARS / 3; // 4 systems + 1
const penInk = (page: import('@playwright/test').Page) => page.getByTestId('ink-canvas');

async function drawStroke(page: import('@playwright/test').Page) {
  await tool(page, 'pen').click();
  await expect(tool(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
  const line = await strokeLine(page);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  return line;
}

desktopTest('SAV-001 SAV-004 SAV-006 SAV-011 PLT-010 ANN-005 a saved copy holds the ink and the metadata and reopens without detection', async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
  await addJumpToStart(page);
  await enterAnnotation(page);
  await waitForFinalSlideCount(page);
  const line = await drawStroke(page);

  const copy = await saveCopyDownload(page);
  expect(copy.name.replace(/_/g, ' ')).toBe('score (annotated).pdf'); // WebKit turns spaces of download names into underscores
  qpdfCheck(copy.bytes);
  const saved = await inspect(copy.bytes);
  expect(saved.ink).toHaveLength(1);
  expect(saved.ink?.[0]?.color).toBe('#d32f2f');
  expect(saved.metadata?.kind).toBe('ok');
  if (saved.metadata?.kind !== 'ok') {
    return;
  }
  expect(saved.metadata.value.marks.jumps).toHaveLength(1);
  const systems = saved.metadata.value.detection?.pages.reduce((sum, p) => sum + p.systems.length, 0);
  expect(systems).toBe(SYNTHETIC_SYSTEMS);

  // DET-023: the copy opens with its detection, jump and stroke; nothing is detected again.
  await page.goto('/');
  await openPdf(page, copy.bytes, copy.name);
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/);
  await expect(page.getByTestId('detection-progress')).toHaveCount(0);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await enterOrganization(page);
  await expect(page.getByTestId('org-bar')).toHaveCount(SYNTHETIC_BARS, { timeout: DETECTION_TIMEOUT_MS });
  await expect(page.getByTestId('jump-marker')).toHaveCount(2);

  // ANN-005: the loaded stroke is erasable, and nothing of it stays: pdf.js no longer draws annotations (no doubled ink).
  await enterAnnotation(page);
  await expect.poll(() => redPixelsOnSlide(page)).toBeGreaterThan(0);
  await tool(page, 'eraser').click();
  const middle = (line.from.x + line.to.x) / 2;
  await drag(page, { x: middle, y: line.from.y - 30 }, { x: middle, y: line.from.y + 30 });
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBe(0);
  await expect.poll(() => redPixelsOnSlide(page)).toBe(0);
});

desktopTest('SAV-005 metadata of another page count is ignored: no marks, detection runs', async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
  await addJumpToStart(page);
  const copy = await saveCopyDownload(page);
  const saved = await inspect(copy.bytes);
  expect(saved.json).not.toBeNull();

  const shorter = await shorterPdfWithMetadata(saved.json ?? '', PAGES_OF_SHORTER_PDF);
  expect(scoreBytes.length).toBeGreaterThan(0);
  await page.goto('/');
  await openPdf(page, shorter, 'shorter.pdf');
  await enterOrganization(page);
  await waitForBars(page, BARS_PER_PAGE * PAGES_OF_SHORTER_PDF);
  await expect(page.getByTestId('jump-marker')).toHaveCount(0);
});

test('SAV-006 ANN-005 DET-023 SAV-012 erasing a loaded stroke removes it from the next copy (dev build, hook)', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'dev build with the debug hook: desktop Chromium');
  type Hook = { strokeCount: () => number; detectionState: () => { complete: boolean; startedOrder: number[] } };
  const hook = <T>(read: (cm: Hook) => T) => page.evaluate((fn) => (new Function(`return (${fn})`)() as (cm: Hook) => T)((globalThis as unknown as { __cm: Hook }).__cm), read.toString());

  await forceFilePaths(page);
  await page.goto(DEV_URL);
  await openScore(page);
  await waitForFinalSlideCount(page);
  await drawStroke(page);
  expect(await hook((cm) => cm.strokeCount())).toBe(1);
  const first = await saveCopyDownload(page);
  expect((await inspect(first.bytes)).ink).toHaveLength(1);

  await page.goto(DEV_URL);
  await openPdf(page, first.bytes, first.name);
  await expect.poll(() => hook((cm) => cm.strokeCount())).toBe(1);
  const state = await hook((cm) => cm.detectionState());
  expect(state).toEqual({ complete: true, startedOrder: [] });

  await tool(page, 'eraser').click();
  const line = await strokeLine(page);
  const middle = (line.from.x + line.to.x) / 2;
  await drag(page, { x: middle, y: line.from.y - 30 }, { x: middle, y: line.from.y + 30 });
  await expect.poll(() => hook((cm) => cm.strokeCount())).toBe(0);
  const second = await saveCopyDownload(page);
  qpdfCheck(second.bytes);
  const after = await inspect(second.bytes);
  expect(after.ink).toEqual([]);
  expect(after.metadata?.kind).toBe('ok');
});
