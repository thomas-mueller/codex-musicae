import { expect, test, type Page } from '@playwright/test';

import { desktopTest } from './support/desktop';

import { label, openScoreInAnnotation, openScoreInOrganization } from './support/score';

const SWIPE_FRACTION = 0.2; // NAV-008: above the 15% minimum
const SWIPE_STEPS = 5;
const TOUCH_STEPS = 5;
const TOUCH_STEP_MS = 20;

test.use({ viewport: { width: 1280, height: 800 } });

const stage = (page: Page) => page.locator('app-canvas-area .content');
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const shell = (page: Page) => page.locator('app-shell');

async function stageBox(page: Page) {
  const box = await stage(page).boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** A click at `fraction` of the stage width, vertically centered. */
async function clickAt(page: Page, fraction: number): Promise<void> {
  const box = await stageBox(page);
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
}

/** A mouse drag by `fraction` of the stage width (negative = leftwards). */
async function swipe(page: Page, fraction: number): Promise<void> {
  const box = await stageBox(page);
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 + box.width * fraction, y, { steps: SWIPE_STEPS });
  await page.mouse.up();
}

const progressWidth = (page: Page): Promise<string> =>
  page.getByTestId('progress-line').evaluate((el) => (el as HTMLElement).style.width);

desktopTest('NAV-006 NAV-007 clicks in the left, right and center tap zones go back, forward and into presentation', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  expect(n).toBeGreaterThan(2);
  await clickAt(page, 0.9);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await clickAt(page, 0.9);
  await expect(indicator(page)).toHaveText(`3 / ${n}`);
  await clickAt(page, 0.1);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await clickAt(page, 0.5);
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
});

desktopTest('NAV-008 a mouse swipe turns a slide in annotation mode without a tool', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await swipe(page, -SWIPE_FRACTION);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await swipe(page, SWIPE_FRACTION);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

desktopTest('NAV-008 a mouse swipe turns a slide in presentation mode', async ({ page }) => {
  await openScoreInAnnotation(page);
  await clickAt(page, 0.5);
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  const first = await progressWidth(page);
  await swipe(page, -SWIPE_FRACTION);
  await expect.poll(() => progressWidth(page)).not.toBe(first);
  await swipe(page, SWIPE_FRACTION);
  await expect.poll(() => progressWidth(page)).toBe(first);
});

desktopTest('ANN-008 NAV-009 with the pen active neither taps nor swipes navigate', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await page.getByRole('button', { name: label('pen'), exact: true }).click();
  await swipe(page, -SWIPE_FRACTION);
  await clickAt(page, 0.9);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
});

desktopTest('NAV-009 in organization mode a click never navigates', async ({ page }) => {
  await openScoreInOrganization(page);
  await clickAt(page, 0.1);
  await clickAt(page, 0.5);
  await expect(shell(page)).toHaveAttribute('data-mode', 'organization');
});

test.describe('touch (Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP touch input');

  async function touch(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    const point = (p: { x: number; y: number }) => [{ x: p.x, y: p.y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
    for (let i = 1; i <= TOUCH_STEPS; i++) {
      await page.waitForTimeout(TOUCH_STEP_MS);
      const f = i / TOUCH_STEPS;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point({ x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f }) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('NAV-007 NAV-008 touch taps and swipes navigate', async ({ page }) => {
    const n = await openScoreInAnnotation(page);
    const box = await stageBox(page);
    const y = box.y + box.height / 2;
    const at = (fraction: number) => ({ x: box.x + box.width * fraction, y });
    await touch(page, at(0.9), at(0.9));
    await expect(indicator(page)).toHaveText(`2 / ${n}`);
    await touch(page, at(0.1), at(0.1));
    await expect(indicator(page)).toHaveText(`1 / ${n}`);
    await touch(page, at(0.7), at(0.3));
    await expect(indicator(page)).toHaveText(`2 / ${n}`);
    await touch(page, at(0.3), at(0.7));
    await expect(indicator(page)).toHaveText(`1 / ${n}`);
  });
});
