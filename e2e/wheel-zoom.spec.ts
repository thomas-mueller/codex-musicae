import { expect, test, type Page } from '@playwright/test';

import { desktopTest } from './support/desktop';

import { openScoreInAnnotation, openScoreInOrganization } from './support/score';

const NOTCH = 100;
const QUICK_MS = 100; // NAV-011: faster than idleResetMs
const SETTLE_MS = 600; // longer than the wheel cooldown
const ZOOM_NOTCHES = 5;
const SWIPE_FRACTION = 0.2;
const TOUCH_STEPS = 5;
const TOUCH_STEP_MS = 20;
const GUTTER_PX = 5;
const PINCH_START = 60;
const PINCH_END = 240;

test.use({ viewport: { width: 1280, height: 800 } });

const stage = (page: Page) => page.locator('app-canvas-area .content');
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const shell = (page: Page) => page.locator('app-shell');

async function center(page: Page) {
  const box = (await stage(page).boundingBox())!;
  return { box, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const transform = (page: Page): Promise<string> => page.getByTestId('slide').evaluate((el) => (el as HTMLElement).style.transform);
const zoomOf = async (page: Page): Promise<number> => Number(/scale\(([\d.]+)\)/.exec(await transform(page))?.[1] ?? 1);

async function wheel(page: Page, deltaY: number, ctrl = false): Promise<void> {
  if (ctrl) {
    await page.keyboard.down('Control');
  }
  await page.mouse.wheel(0, deltaY);
  if (ctrl) {
    await page.keyboard.up('Control');
  }
}

async function zoomIn(page: Page): Promise<void> {
  const { x, y } = await center(page);
  await page.mouse.move(x, y);
  for (let i = 0; i < ZOOM_NOTCHES; i++) {
    await wheel(page, -NOTCH, true);
  }
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1);
}

async function swipe(page: Page, fraction: number): Promise<void> {
  const { box, x, y } = await center(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width * fraction, y, { steps: 5 });
  await page.mouse.up();
}

desktopTest('NAV-011 one wheel notch turns one slide; a second notch 100 ms later is ignored', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  const { x, y } = await center(page);
  await page.mouse.move(x, y);
  // The handler measures the gap with the events' own time stamps (creation time). Both notches are therefore made in one task
  // of the page and the gap is waited out by spinning, not by a timer: a timer on a stalled CI browser (WebKit) can fire after
  // the cooldown and the second notch would count. The spin cannot be stretched by event-loop delays.
  await stage(page).evaluate(
    (el, { delta, gap }) => {
      const notch = () => el.dispatchEvent(new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true }));
      notch();
      const start = performance.now();
      while (performance.now() - start < gap) {
        // wait
      }
      notch();
    },
    { delta: NOTCH, gap: QUICK_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await wheel(page, -NOTCH);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

desktopTest('NAV-012 NAV-013 Ctrl+wheel zooms; a zoomed wheel pans and never turns the slide', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await zoomIn(page);
  const zoomed = await transform(page);
  await wheel(page, NOTCH);
  await expect.poll(() => transform(page)).not.toBe(zoomed);
  await page.waitForTimeout(SETTLE_MS);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  expect(await zoomOf(page)).toBeGreaterThan(1);
});

desktopTest('NAV-009 a swipe does not turn the slide while zoomed', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await zoomIn(page);
  await swipe(page, -SWIPE_FRACTION);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

desktopTest('NAV-017 Ctrl+wheel is ignored in presentation mode', async ({ page }) => {
  await openScoreInAnnotation(page);
  const { box, x, y } = await center(page);
  await page.mouse.click(box.x + box.width / 2, y);
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await page.mouse.move(x, y);
  await wheel(page, -NOTCH, true);
  await page.waitForTimeout(SETTLE_MS);
  expect(await zoomOf(page)).toBe(1);
});

desktopTest('NAV-005 NAV-009 organization: PageDown scrolls one page and a click never navigates', async ({ page }) => {
  await openScoreInOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  const { box, y } = await center(page);
  await page.mouse.click(box.x + GUTTER_PX, y);
  await page.keyboard.press('PageDown');
  await expect.poll(() => viewer.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(shell(page)).toHaveAttribute('data-mode', 'organization');
});

/** A point of the organization viewer that is not on a bar, marker or chip (found by scanning). */
async function emptyPoint(page: Page): Promise<{ x: number; y: number }> {
  return page.getByTestId('org-viewer').evaluate((viewer, own) => {
    const rect = viewer.getBoundingClientRect();
    const step = 20;
    for (let y = rect.top + step; y < rect.bottom; y += step) {
      for (let x = rect.left + step; x < rect.right; x += step) {
        const hit = viewer.ownerDocument.elementFromPoint(x, y);
        if (hit && viewer.contains(hit) && hit.closest(own) === null) {
          return { x, y };
        }
      }
    }
    throw new Error('no empty point');
  }, '[data-bar],[data-marker],[data-chip],[data-popup]');
}

desktopTest('NAV-016 a double click on empty space in organization mode toggles the zoom', async ({ page }) => {
  await openScoreInOrganization(page);
  const width = async (): Promise<number> => (await page.getByTestId('org-page-0').boundingBox())!.width;
  const fitPage = await width();
  const first = await emptyPoint(page);
  await page.mouse.dblclick(first.x, first.y);
  await expect.poll(width).toBeGreaterThan(fitPage * 1.5);
  const zoomed = await width();
  const second = await emptyPoint(page);
  await page.mouse.dblclick(second.x, second.y);
  await expect.poll(width).toBeLessThan(zoomed);
});

test.describe('touch (Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP touch input');

  test('NAV-014 a pinch zooms the slide and a one-finger swipe then pans instead of turning', async ({ page }) => {
    const n = await openScoreInAnnotation(page);
    const { x, y } = await center(page);
    const cdp = await page.context().newCDPSession(page);
    const points = (half: number) => [{ x: x - half, y, id: 1 }, { x: x + half, y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(PINCH_START) });
    for (let i = 1; i <= TOUCH_STEPS; i++) {
      await page.waitForTimeout(TOUCH_STEP_MS);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(PINCH_START + ((PINCH_END - PINCH_START) * i) / TOUCH_STEPS) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 200, y }] });
    for (let i = 1; i <= TOUCH_STEPS; i++) {
      await page.waitForTimeout(TOUCH_STEP_MS);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 200 - (400 * i) / TOUCH_STEPS, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(indicator(page)).toHaveText(`1 / ${n}`);
  });
});
