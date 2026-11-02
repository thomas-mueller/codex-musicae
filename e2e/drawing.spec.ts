import { expect, test, type Locator, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { longestLongTaskMs, startLongTaskObserver, throttleCpu } from './support/long-tasks';
import { label, openScoreInAnnotation } from './support/score';

test.use({ viewport: { width: 1600, height: 700 } });

const CPU_THROTTLE = 4;
const STROKE_POINTS = 200;
const STROKE_STEPS = 20;
const GREY_MIN_PX = 8;
const PEN_RGB = [0xd3, 0x2f, 0x2f]; // T:annotation.defaultPen.color
const COLOR_TOLERANCE = 3;

const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const stage = (page: Page) => page.locator('app-canvas-area .content');
const undoButton = (page: Page) => page.getByRole('button', { name: label('undo'), exact: true });
const penButton = (page: Page) => page.getByRole('button', { name: label('pen'), exact: true });
const liveCanvas = (page: Page) => page.getByTestId('live-canvas');

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** Number of pixels of the live layer that are inked in the pen color (alpha > 0). */
function inkedPixels(live: Locator): Promise<number> {
  return live.evaluate((canvas: HTMLCanvasElement, { rgb, tolerance }: { rgb: number[]; tolerance: number }) => {
    const context = canvas.getContext('2d');
    if (!context) {
      return 0;
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0 && rgb.every((v, k) => Math.abs(data[i + k]! - v) <= tolerance)) {
        count++;
      }
    }
    return count;
  }, { rgb: PEN_RGB, tolerance: COLOR_TOLERANCE });
}

async function startWithPen(page: Page): Promise<number> {
  const n = await openScoreInAnnotation(page);
  await penButton(page).click();
  await expect(penButton(page)).toHaveAttribute('aria-pressed', 'true');
  return n;
}

/** A point inside the slide, a quarter of its height from the top (on music), and a point to its right. */
async function onSlide(page: Page) {
  const slide = await boxOf(page.getByTestId('slide-canvas'));
  return { x: slide.x + slide.width * 0.2, y: slide.y + slide.height * 0.25, width: slide.width, box: slide };
}

desktopTest('ANN-008 ANN-009 drawing with the pen shows the live stroke in the pen color and commits one stroke on release', async ({ page }) => {
  await startWithPen(page);
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
  const start = await onSlide(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width * 0.5, start.y + 20, { steps: STROKE_STEPS });
  await expect.poll(() => inkedPixels(liveCanvas(page))).toBeGreaterThan(0);
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true'); // not while the stroke is in progress
  await page.mouse.up();
  await expect(undoButton(page)).not.toHaveAttribute('aria-disabled', 'true');
  await undoButton(page).click();
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: label('redo'), exact: true }).click();
  await expect(undoButton(page)).not.toHaveAttribute('aria-disabled', 'true');
});

desktopTest('ANN-010 a drag that starts on the grey outside the page draws nothing and navigates nowhere', async ({ page }) => {
  const n = await startWithPen(page);
  const area = await boxOf(stage(page));
  const slide = await onSlide(page);
  expect(slide.box.x - area.x, 'the slide leaves grey on its left').toBeGreaterThan(GREY_MIN_PX);
  await page.mouse.move(area.x + GREY_MIN_PX / 2, slide.y);
  await page.mouse.down();
  await page.mouse.move(slide.x + slide.width * 0.4, slide.y + 20, { steps: STROKE_STEPS });
  await page.mouse.up();
  await expect.poll(() => inkedPixels(liveCanvas(page))).toBe(0);
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

desktopTest('ANN-008 with the pen active tap zones do nothing but PageDown turns the slide', async ({ page }) => {
  const n = await startWithPen(page);
  const area = await boxOf(stage(page));
  await page.mouse.click(area.x + area.width * 0.9, area.y + area.height / 2); // right tap zone: a dot on grey or page, never a turn
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await page.keyboard.press('PageDown');
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
});

desktopTest('ANN-013 PageDown while the mouse button is down is applied after the stroke ends', async ({ page }) => {
  const n = await startWithPen(page);
  const start = await onSlide(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width * 0.3, start.y + 15, { steps: STROKE_STEPS });
  await page.keyboard.press('PageDown');
  await page.mouse.move(start.x + start.width * 0.4, start.y + 25, { steps: STROKE_STEPS });
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await page.mouse.up();
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await undoButton(page).click(); // the stroke belongs to the slide it was drawn on and is in the model
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
});

test('ANN-011 a 200-point stroke with the CPU throttled 4x has no long task above the budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'CDP CPU throttling and long tasks: desktop Chromium only');
  await startWithPen(page);
  const start = await onSlide(page);
  await page.mouse.move(start.x, start.y);
  const restore = await throttleCpu(page, CPU_THROTTLE);
  try {
    await startLongTaskObserver(page);
    await page.mouse.down();
    for (let i = 1; i <= STROKE_POINTS; i++) {
      await page.mouse.move(start.x + (start.width * 0.6 * i) / STROKE_POINTS, start.y + 30 * Math.sin(i / 10));
    }
    await page.mouse.up();
    await expect(undoButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    const longest = await longestLongTaskMs(page);
    expect(longest).toBeLessThanOrEqual(TUNABLES.budgets.drawingMaxLongTaskMs * TUNABLES.budgets.ciToleranceFactor);
  } finally {
    await restore();
  }
});
