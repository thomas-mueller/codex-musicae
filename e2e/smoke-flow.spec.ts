import { expect, test, type Page } from '@playwright/test';

import { inkedPixelsNear } from './support/pixels';
import { COLOR_TOLERANCE, forceFilePaths, inspect, openPdf, qpdfCheck, RED, saveCopyDownload, strokeLine, tool } from './support/saving';
import { label, scoreBytes, waitForFinalSlideCount } from './support/score';

const bottomButton = (page: Page, key: 'next' | 'previous') =>
  page.locator('app-bottom-bar').getByRole('button', { name: label(key), exact: true });
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');

const STROKE_STEPS = 20;
const POINTER_ID = 1;
const TOUCH_PRESSURE = 0.5;

/** Compact layouts keep the tools behind the tools button. */
async function selectPen(page: Page): Promise<void> {
  const pen = tool(page, 'pen');
  const compact = !(await pen.isVisible());
  if (compact) {
    await page.getByRole('button', { name: label('toolFab'), exact: true }).click();
  }
  await pen.click();
  await expect(pen).toHaveAttribute('aria-pressed', 'true');
  if (compact) {
    await page.keyboard.press('Escape'); // the tool strip stays open and would take the first touch on the slide
    await expect(pen).toBeHidden();
  }
}

/**
 * One finger stroke as pointer events on the element under the start point. Real mouse input cannot be relied on in the
 * touch emulation of every engine (Firefox delivers none), and the desktop projects drive the real mouse in the full suite.
 */
async function touchStroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.evaluate(
    ({ a, b, steps, id, pressure }) => {
      const target = globalThis.document.elementFromPoint(a.x, a.y);
      if (!target) {
        throw new Error('nothing under the stroke start');
      }
      const fire = (type: string, x: number, y: number, buttons: number): void => {
        target.dispatchEvent(
          new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, buttons, pressure }),
        );
      };
      fire('pointerdown', a.x, a.y, 1);
      for (let i = 1; i <= steps; i++) {
        fire('pointermove', a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, 1);
      }
      fire('pointerup', b.x, b.y, 0);
    },
    { a: from, b: to, steps: STROKE_STEPS, id: POINTER_ID, pressure: TOUCH_PRESSURE },
  );
}

// The smoke subset of the cross-browser matrix (PLT-011): open a PDF, navigate, draw, save a copy. It is the only
// drawing and saving flow the phone and tablet profiles run; the desktop engines run the whole suite.
test('PLT-011 TST-003 TST-004 open a PDF, navigate, draw and save a copy', { tag: '@smoke' }, async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  await openPdf(page, scoreBytes, 'score.pdf');
  const slides = await waitForFinalSlideCount(page);
  expect(slides).toBeGreaterThan(1);

  await bottomButton(page, 'next').click();
  await expect(indicator(page)).toHaveText(`2 / ${slides}`);
  await bottomButton(page, 'previous').click();
  await expect(indicator(page)).toHaveText(`1 / ${slides}`);

  await selectPen(page);
  const line = await strokeLine(page);
  await touchStroke(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(page.getByTestId('ink-canvas'), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);

  const copy = await saveCopyDownload(page);
  qpdfCheck(copy.bytes);
  const saved = await inspect(copy.bytes);
  expect(saved.ink).toHaveLength(1);
  expect(saved.metadata?.kind).toBe('ok');
});
