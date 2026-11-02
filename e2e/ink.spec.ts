import { expect, test, type Locator, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { findWhiteRun, inkedPixelsNear, pixelAt, readPixels } from './support/pixels';
import { label, openScore, openScoreInAnnotation } from './support/score';


test.use({ viewport: { width: 1600, height: 700 } });

const COLOR_TOLERANCE = 3;
const STROKE_STEPS = 20;
const LONG_PRESS_MARGIN_MS = 200;
const RED: readonly number[] = [0xd3, 0x2f, 0x2f]; // T:annotation.defaultPen.color
const DARK_MAX = 70; // black ink multiplied with yellow stays black
const BLEND_TOLERANCE = 10;
const POSITION_TOLERANCE_PX = 2;
const WHITE_RUN = 60;
const WHITE_MARGIN = 10;
const WHITE_INSET = 10;
const HIGHLIGHTER_YELLOW = [0xfd, 0xd8, 0x35]; // T:annotation.defaultHighlighter.color

const stage = (page: Page) => page.locator('app-canvas-area .content');
const undoButton = (page: Page) => page.getByRole('button', { name: label('undo'), exact: true });
const redoButton = (page: Page) => page.getByRole('button', { name: label('redo'), exact: true });
const tool = (page: Page, key: 'pen' | 'highlighter' | 'eraser') => page.getByRole('button', { name: label(key), exact: true });
const penInk = (page: Page) => page.getByTestId('ink-canvas');
const liveInk = (page: Page) => page.getByTestId('live-canvas');

async function slideBox(page: Page) {
  const box = await page.getByTestId('slide-canvas').boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: STROKE_STEPS });
  await page.mouse.up();
}

/** A horizontal line on music, at a quarter of the slide height. */
async function horizontal(page: Page, from = 0.2, to = 0.6) {
  const slide = await slideBox(page);
  const y = slide.y + slide.height * 0.25;
  return { from: { x: slide.x + slide.width * from, y }, to: { x: slide.x + slide.width * to, y } };
}

async function longPress(page: Page, button: Locator): Promise<void> {
  await button.hover();
  await page.mouse.down();
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await page.mouse.up();
}

/** A click on the grey beside the slide closes a popup (the first press only closes it, see PointerStage). */
async function closePopup(page: Page): Promise<void> {
  const area = (await stage(page).boundingBox())!;
  await page.mouse.click(area.x + 3, area.y + area.height / 2);
  await expect(page.locator('app-tool-popup')).toHaveCount(0);
}

async function pickInPopup(page: Page, color: number, width: number): Promise<void> {
  await page.locator('app-tool-popup .swatch').nth(color).click();
  await page.locator('app-tool-popup .sample').nth(width).click();
  await closePopup(page);
}

async function startWith(page: Page, toolKey: 'pen' | 'highlighter' | 'eraser'): Promise<void> {
  await openScoreInAnnotation(page);
  await tool(page, toolKey).click();
  await expect(tool(page, toolKey)).toHaveAttribute('aria-pressed', 'true');
}

desktopTest('ANN-001 ANN-006 a finished pen stroke stays on the ink layer in the pen color; undo removes it and redo brings it back', async ({ page }) => {
  await startWith(page, 'pen');
  const line = await horizontal(page);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await expect.poll(() => inkedPixelsNear(liveInk(page), RED, COLOR_TOLERANCE)).toBe(0); // the live layer is empty again
  await undoButton(page).click();
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBe(0);
  await redoButton(page).click();
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
});

desktopTest('ANN-004 the highlighter multiplies with the page: black ink stays dark, white paper gets the color at the configured opacity', async ({ page }) => {
  await startWith(page, 'pen');
  // A wide black pen stroke (sixth color, widest line) ...
  await longPress(page, tool(page, 'pen'));
  await pickInPopup(page, TUNABLES.colors.penPresets.length - 1, TUNABLES.annotation.penWidthsPt.length - 1);
  const slide = await slideBox(page);
  const line = await horizontal(page, 0.3, 0.5);
  await drag(page, line.from, line.to);
  const crossX = (line.from.x + line.to.x) / 2;
  // ... and a highlighter stroke across it.
  await tool(page, 'highlighter').click();
  await drag(page, { x: crossX, y: line.from.y - 40 }, { x: crossX, y: line.from.y + 40 });
  const [r, g, b] = await pixelAt(page, crossX, line.from.y);
  expect(Math.max(r, g, b)).toBeLessThan(DARK_MAX);
  // Over blank paper: the stroke color blended with white by the configured opacity.
  const white = await findWhiteRun(page, { x: Math.floor(slide.x), y: Math.floor(slide.y), width: Math.floor(slide.width), height: Math.floor(slide.height) }, WHITE_RUN, WHITE_MARGIN);
  expect(white, 'a blank stretch of paper on the slide').not.toBeNull();
  // inside the run: its top can be the very edge of the page
  await drag(page, { x: white!.x, y: white!.y + WHITE_INSET }, { x: white!.x, y: white!.y + WHITE_RUN - WHITE_INSET });
  const [wr, wg, wb] = await pixelAt(page, white!.x, white!.y + WHITE_RUN / 2);
  const opacity = TUNABLES.annotation.highlighterOpacity;
  const full = 255;
  HIGHLIGHTER_YELLOW.forEach((channel, i) => {
    const expected = (1 - opacity) * full + opacity * channel;
    expect(Math.abs([wr, wg, wb][i]! - expected)).toBeLessThanOrEqual(BLEND_TOLERANCE);
  });
});

desktopTest('ANN-005 the eraser removes a stroke it touches; undo brings it back', async ({ page }) => {
  await startWith(page, 'pen');
  const line = await horizontal(page);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await tool(page, 'eraser').click();
  const slide = await slideBox(page);
  await drag(page, { x: (line.from.x + line.to.x) / 2, y: line.from.y - 30 }, { x: (line.from.x + line.to.x) / 2, y: line.from.y + 30 });
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBe(0);
  expect(slide.width).toBeGreaterThan(0);
  await undoButton(page).click();
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
});

desktopTest('ANN-003 the color and the width of a tool survive a reload', async ({ page }) => {
  await startWith(page, 'pen');
  await longPress(page, tool(page, 'pen'));
  const color = 3;
  const width = 0;
  await pickInPopup(page, color, width);
  await page.reload();
  await openScore(page);
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+/);
  await longPress(page, tool(page, 'pen'));
  await expect(page.locator('app-tool-popup .swatch').nth(color)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('app-tool-popup .sample').nth(width)).toHaveAttribute('aria-pressed', 'true');
});

desktopTest('NFR-002 after a zoom the ink stays where it was drawn and is redrawn sharp', async ({ page }) => {
  await startWith(page, 'pen');
  const line = await horizontal(page, 0.3, 0.7);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(penInk(page), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);
  await tool(page, 'pen').click(); // tool off: no accidental stroke while zooming
  await page.getByRole('button', { name: label('zoomIn'), exact: true }).click();
  await expect(page.getByTestId('ink-sharp').locator('canvas')).toHaveCount(2);
  // zoom in around the stage center: a point moves to center + (point - center) * factor
  const area = (await stage(page).boundingBox())!;
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  const factor = TUNABLES.zoom.buttonStep;
  const expectedY = centerY + (line.from.y - centerY) * factor;
  const expectedX = centerX + ((line.from.x + line.to.x) / 2 - centerX) * factor;
  const column = await readPixels(page, { x: Math.floor(expectedX), y: Math.floor(area.y), width: 1, height: Math.floor(area.height) });
  const rows: number[] = [];
  for (let row = 0; row < column.height; row++) {
    const i = row * 4;
    if (RED.every((v, k) => Math.abs(column.data[i + k]! - v) <= COLOR_TOLERANCE * 4)) {
      rows.push(area.y + row + 0.5);
    }
  }
  expect(rows.length, 'ink pixels in the column').toBeGreaterThan(0);
  const middle = rows.reduce((a, b) => a + b, 0) / rows.length;
  expect(Math.abs(middle - expectedY)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
});

desktopTest('ANN-001 the active pen button is filled with the stroke color', async ({ page }) => {
  await startWith(page, 'pen');
  const [r, g, b] = RED;
  await expect(tool(page, 'pen')).toHaveCSS('background-color', `rgb(${r}, ${g}, ${b})`);
  await tool(page, 'pen').click();
  await expect(tool(page, 'pen')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
