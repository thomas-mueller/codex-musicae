import { expect, test } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { inkedPixelsNear } from './support/pixels';
import { DETECTION_TIMEOUT_MS, SCROLL_TIMEOUT_MS } from './support/timing';
import { label, openScore, SYNTHETIC_BARS, SYNTHETIC_SYSTEMS, waitForFinalSlideCount } from './support/score';
import {
  addJumpToStart, annotationFacts, attachmentText, COLOR_TOLERANCE, drag, enterAnnotation, enterOrganization, FOREIGN_ATTACHMENT,
  FOREIGN_ATTACHMENT_TEXT, foreignScoreBytes, forceFilePaths, inkBounds, inspect, KEY, openPdf, qpdfCheck, RED, saveCopyDownload,
  strokeLine, tool, YELLOW,
} from './support/saving';

import type { Page } from '@playwright/test';

const PEN_ROW = 0.25;
const HIGHLIGHTER_ROW = 0.6;
const RIGHT_FROM = 0.75;
const RIGHT_TO = 0.95;
const BREAK_BAR_INDEX = 1;
const STOP_BAR_INDEX = 2;
const SHOW_MORE_CLICKS = 8; // as in slides.spec.ts: clearly taller slides
const SWEEP_HALF = 30;
const MIN_POINTS = 2;

test.use({ viewport: { width: 1600, height: 700 } }); // landscape: the ratio override is stored per orientation

const FOREIGN_BLUE = [0, 0, 255];
const HIGHLIGHTER_TOLERANCE = 16; // 35 % opacity: the canvas keeps premultiplied, rounded channels

const penInk = (page: Page) => page.getByTestId('ink-canvas');
const highlighterInk = (page: Page) => page.getByTestId('ink-highlighter-canvas');

async function draw(page: Page, key: 'pen' | 'highlighter', row: number, from?: number, to?: number): Promise<void> {
  const color = key === 'pen' ? RED : YELLOW;
  const tolerance = key === 'pen' ? COLOR_TOLERANCE : HIGHLIGHTER_TOLERANCE;
  await tool(page, key).click();
  await expect(tool(page, key)).toHaveAttribute('aria-pressed', 'true');
  const line = await strokeLine(page, from, to, row);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(key === 'pen' ? penInk(page) : highlighterInk(page), color, tolerance)).toBeGreaterThan(0);
}

/** The eraser straight across the point (`x`, `y`), a short vertical drag as in the other erase tests. */
async function sweep(page: Page, x: number, y: number): Promise<void> {
  await tool(page, 'eraser').click();
  await drag(page, { x, y: y - SWEEP_HALF }, { x, y: y + SWEEP_HALF });
}

async function openFresh(page: Page, bytes: Uint8Array, name: string): Promise<void> {
  await forceFilePaths(page);
  await page.goto('/');
  await openPdf(page, bytes, name);
}

desktopTest('TST-003 SAV-001 SAV-004 SAV-006 SAV-007 ANN-005 a copy with two strokes, a jump, a break, a stop and a ratio is a valid file and reopens identically', async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  await openScore(page);
  await waitForFinalSlideCount(page);
  await draw(page, 'pen', PEN_ROW);
  await draw(page, 'highlighter', HIGHLIGHTER_ROW);

  await enterOrganization(page);
  await expect(page.getByTestId('org-bar')).toHaveCount(SYNTHETIC_BARS, { timeout: DETECTION_TIMEOUT_MS });
  await addJumpToStart(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  await bars.nth(BREAK_BAR_INDEX).click();
  await chip.getByTestId('chip-break').click();
  await bars.nth(STOP_BAR_INDEX).click();
  await chip.getByTestId('chip-stop').click();
  await expect(bars.nth(BREAK_BAR_INDEX).getByTestId('org-bar-break-line')).toHaveCount(1);
  await expect(bars.nth(STOP_BAR_INDEX).getByTestId('org-bar-stop-icon')).toHaveCount(1);

  await enterAnnotation(page);
  const before = await waitForFinalSlideCount(page);
  for (let i = 0; i < SHOW_MORE_CLICKS; i++) {
    await page.locator('app-bottom-bar').getByRole('button', { name: label('showMore'), exact: true }).click();
  }
  await expect.poll(async () => (await waitForFinalSlideCount(page)) < before, { timeout: SCROLL_TIMEOUT_MS }).toBe(true);

  const copy = await saveCopyDownload(page);
  qpdfCheck(copy.bytes);
  const facts = await annotationFacts(copy.bytes);
  expect(facts.inkPoints).toHaveLength(2);
  expect(facts.inkPoints.every((n) => n >= MIN_POINTS)).toBe(true);
  const saved = await inspect(copy.bytes);
  expect(saved.ink?.map((i) => i.points.length).sort()).toEqual([...facts.inkPoints].sort());
  expect(saved.metadata?.kind).toBe('ok');
  if (saved.metadata?.kind !== 'ok') return;
  const meta = saved.metadata.value;
  expect(meta.detection?.pages.reduce((sum, p) => sum + p.systems.length, 0)).toBe(SYNTHETIC_SYSTEMS);
  expect(meta.marks.jumps).toHaveLength(1);
  expect(meta.marks.breaks).toHaveLength(1);
  expect(meta.marks.stops).toHaveLength(1);
  expect(Object.keys(meta.aspectRatio)).toHaveLength(1);

  // DET-023: the copy opens with everything, nothing is detected again.
  await page.goto('/');
  await openPdf(page, copy.bytes, copy.name);
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/);
  await expect(page.getByTestId('detection-progress')).toHaveCount(0);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await enterOrganization(page);
  await expect(page.getByTestId('org-bar')).toHaveCount(SYNTHETIC_BARS);
  await expect(page.getByTestId('jump-marker')).toHaveCount(2);
  await expect(page.getByTestId('org-bar').nth(BREAK_BAR_INDEX).getByTestId('org-bar-break-line')).toHaveCount(1);
  await expect(page.getByTestId('org-bar').nth(STOP_BAR_INDEX).getByTestId('org-bar-stop-icon')).toHaveCount(1);

  // Erasing one stroke and saving again leaves one annotation.
  await enterAnnotation(page);
  await expect.poll(() => inkedPixelsNear(highlighterInk(page), YELLOW, HIGHLIGHTER_TOLERANCE)).toBeGreaterThan(0);
  // The ratio changed the slide's size: aim at where the pen stroke is now.
  const pen = await inkBounds(page, 'ink-canvas', RED, COLOR_TOLERANCE);
  expect(pen).not.toBeNull();
  await sweep(page, pen!.x + pen!.width / 2, pen!.y + pen!.height / 2);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBe(0);
  expect(await inkedPixelsNear(highlighterInk(page), YELLOW, HIGHLIGHTER_TOLERANCE)).toBeGreaterThan(0);
  const second = await saveCopyDownload(page);
  qpdfCheck(second.bytes);
  expect((await annotationFacts(second.bytes)).inkPoints).toHaveLength(1);
  expect((await inspect(second.bytes)).metadata?.kind).toBe('ok');
});

desktopTest('TST-003 SAV-013 ANN-005 foreign ink and a foreign attachment survive a save, and the foreign ink can be erased', async ({ page }) => {
  await openFresh(page, await foreignScoreBytes(), 'foreign.pdf');
  await waitForFinalSlideCount(page);
  await draw(page, 'pen', PEN_ROW, RIGHT_FROM, RIGHT_TO);

  const first = await saveCopyDownload(page);
  qpdfCheck(first.bytes);
  const facts = await annotationFacts(first.bytes);
  expect(facts.inkPoints).toHaveLength(2); // the foreign one and ours
  expect(facts.otherSubtypes).toEqual(['/Text']);
  expect(await attachmentText(first.bytes, FOREIGN_ATTACHMENT)).toBe(FOREIGN_ATTACHMENT_TEXT);
  expect(await attachmentText(first.bytes, KEY)).not.toBeNull();

  await page.goto('/');
  await openPdf(page, first.bytes, first.name);
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/);
  await expect(page.getByTestId('detection-progress')).toHaveCount(0);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await expect.poll(() => inkedPixelsNear(penInk(page), FOREIGN_BLUE, COLOR_TOLERANCE)).toBeGreaterThan(0); // the foreign line is loaded
  const foreign = await inkBounds(page, 'ink-canvas', FOREIGN_BLUE, COLOR_TOLERANCE);
  expect(foreign).not.toBeNull();
  await sweep(page, foreign!.x + foreign!.width / 2, foreign!.y + foreign!.height / 2);
  await expect.poll(() => inkedPixelsNear(penInk(page), FOREIGN_BLUE, COLOR_TOLERANCE)).toBe(0);
  expect(await inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);

  const second = await saveCopyDownload(page);
  qpdfCheck(second.bytes);
  expect((await annotationFacts(second.bytes)).inkPoints).toHaveLength(1);
  expect((await annotationFacts(second.bytes)).otherSubtypes).toEqual(['/Text']);
  expect(await attachmentText(second.bytes, FOREIGN_ATTACHMENT)).toBe(FOREIGN_ATTACHMENT_TEXT);
  expect((await inspect(second.bytes)).ink?.[0]?.color).toBe('#d32f2f'); // ours stays, the blue one is gone
});
