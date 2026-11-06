import { expect, test, type Locator, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { label, openScoreInAnnotation } from './support/score';

test.use({ viewport: { width: 1600, height: 700 } });

const LONG_PRESS_MARGIN_MS = 200;
const GRACE_MARGIN_MS = 50;
const SWIPE_FRACTION = 0.4;
const SWIPE_STEPS = 4;
const PINCH_START = 60;
const PINCH_END = 240;
const PEN_ID = 11;
const TOUCH_A = 21;
const TOUCH_B = 22;

type Kind = 'pen' | 'touch';
interface Step {
  readonly type: string;
  readonly kind: Kind;
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly buttons?: number;
  /** Real time to wait before the event. */
  readonly waitMs?: number;
}

const stage = (page: Page) => page.locator('app-canvas-area .content');
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const undoButton = (page: Page) => page.getByRole('button', { name: label('undo'), exact: true });
const penButton = (page: Page) => page.getByRole('button', { name: label('pen'), exact: true });

/** Synthetic pointer events on the stage, in order, inside one page call (their timestamps are real time). */
async function fire(page: Page, steps: readonly Step[]): Promise<void> {
  await stage(page).evaluate(async (element, list) => {
    for (const s of list) {
      if (s.waitMs) {
        await new Promise((resolve) => setTimeout(resolve, s.waitMs));
      }
      element.dispatchEvent(
        new PointerEvent(s.type, {
          pointerType: s.kind,
          pointerId: s.id,
          clientX: s.x,
          clientY: s.y,
          buttons: s.buttons ?? 0,
          button: 0,
          isPrimary: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }, steps);
}

async function geometry(page: Page) {
  const area = (await stage(page).boundingBox())!;
  const slide = (await page.getByTestId('slide-canvas').boundingBox())!;
  return { area, slide, y: slide.y + slide.height * 0.25, left: slide.x + slide.width * 0.2 };
}

/** A pen that came and went: sets stylusSeen; the pen is not near any more once the grace period has passed. */
async function seePen(page: Page): Promise<void> {
  const g = await geometry(page);
  await fire(page, [
    { type: 'pointermove', kind: 'pen', id: PEN_ID, x: g.left, y: g.y },
    { type: 'pointerleave', kind: 'pen', id: PEN_ID, x: g.left, y: g.y },
  ]);
  await page.waitForTimeout(TUNABLES.stylus.palmRejectionGraceMs + GRACE_MARGIN_MS);
}

function dragSteps(kind: Kind, id: number, from: { x: number; y: number }, dx: number, waitMs = 0): Step[] {
  const steps: Step[] = [{ type: 'pointerdown', kind, id, x: from.x, y: from.y, buttons: 1, waitMs }];
  for (let i = 1; i <= SWIPE_STEPS; i++) {
    steps.push({ type: 'pointermove', kind, id, x: from.x + (dx * i) / SWIPE_STEPS, y: from.y, buttons: 1 });
  }
  steps.push({ type: 'pointerup', kind, id, x: from.x + dx, y: from.y });
  return steps;
}

async function expectDrawn(page: Page, drawn: boolean): Promise<void> {
  if (drawn) {
    await expect(undoButton(page)).not.toHaveAttribute('aria-disabled', 'true');
  } else {
    await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
  }
}

async function startWithPen(page: Page): Promise<number> {
  const n = await openScoreInAnnotation(page);
  await penButton(page).click();
  await expect(penButton(page)).toHaveAttribute('aria-pressed', 'true');
  return n;
}

const zoomOf = async (page: Page): Promise<number> =>
  Number(/scale\(([\d.]+)\)/.exec(await page.getByTestId('slide').evaluate((el) => (el as HTMLElement).style.transform))?.[1] ?? 1);

async function openPenPopup(page: Page): Promise<void> {
  await penButton(page).hover();
  await page.mouse.down();
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await page.mouse.up();
  await expect(page.locator('app-tool-popup')).toHaveCount(1);
}

const finger = (page: Page): Locator => page.locator('app-tool-popup .finger');

desktopTest('STY-001 STY-002 before any pen event a touch drag with the pen tool draws', async ({ page }) => {
  await startWithPen(page);
  const g = await geometry(page);
  await fire(page, dragSteps('touch', TOUCH_A, { x: g.left, y: g.y }, g.slide.width * 0.3));
  await expectDrawn(page, true);
});

desktopTest('STY-002 after a pen event the pen draws, a touch drag does not', async ({ page }) => {
  await startWithPen(page);
  await seePen(page);
  const g = await geometry(page);
  await fire(page, dragSteps('touch', TOUCH_A, { x: g.left, y: g.y }, g.slide.width * 0.1));
  await expectDrawn(page, false);
  await fire(page, dragSteps('pen', PEN_ID, { x: g.left, y: g.y }, g.slide.width * 0.3));
  await expectDrawn(page, true);
});

desktopTest('STY-002 with a stylus seen, touch taps and swipes turn slides and a pinch zooms; the pen tool stays active', async ({ page }) => {
  const n = await startWithPen(page);
  await seePen(page);
  const g = await geometry(page);
  const right = g.area.x + g.area.width * 0.9;
  await fire(page, [
    { type: 'pointerdown', kind: 'touch', id: TOUCH_A, x: right, y: g.y, buttons: 1 },
    { type: 'pointerup', kind: 'touch', id: TOUCH_A, x: right, y: g.y },
  ]);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await fire(page, dragSteps('touch', TOUCH_A, { x: g.area.x + g.area.width * 0.7, y: g.y }, -g.area.width * SWIPE_FRACTION));
  await expect(indicator(page)).toHaveText(`3 / ${n}`);
  await expectDrawn(page, false);
  const cx = g.area.x + g.area.width / 2;
  await fire(page, [
    { type: 'pointerdown', kind: 'touch', id: TOUCH_A, x: cx - PINCH_START / 2, y: g.y, buttons: 1 },
    { type: 'pointerdown', kind: 'touch', id: TOUCH_B, x: cx + PINCH_START / 2, y: g.y, buttons: 1 },
    { type: 'pointermove', kind: 'touch', id: TOUCH_B, x: cx + PINCH_END / 2, y: g.y, buttons: 1 },
    { type: 'pointerup', kind: 'touch', id: TOUCH_B, x: cx + PINCH_END / 2, y: g.y },
    { type: 'pointerup', kind: 'touch', id: TOUCH_A, x: cx - PINCH_START / 2, y: g.y },
  ]);
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1);
  await expect(penButton(page)).toHaveAttribute('aria-pressed', 'true');
});

desktopTest('STY-004 a touch within the grace period after pen-up is ignored, a later one is accepted', async ({ page }) => {
  const n = await startWithPen(page);
  await seePen(page);
  const g = await geometry(page);
  const right = g.area.x + g.area.width * 0.9;
  const grace = TUNABLES.stylus.palmRejectionGraceMs;
  await fire(page, [
    { type: 'pointerdown', kind: 'pen', id: PEN_ID, x: g.left, y: g.y, buttons: 1 },
    { type: 'pointerup', kind: 'pen', id: PEN_ID, x: g.left, y: g.y },
    { type: 'pointerdown', kind: 'touch', id: TOUCH_A, x: right, y: g.y, buttons: 1 },
    { type: 'pointerup', kind: 'touch', id: TOUCH_A, x: right, y: g.y },
  ]);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await fire(page, [
    { type: 'pointerdown', kind: 'touch', id: TOUCH_A, x: right, y: g.y, buttons: 1, waitMs: grace + GRACE_MARGIN_MS },
    { type: 'pointerup', kind: 'touch', id: TOUCH_A, x: right, y: g.y },
  ]);
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
});

desktopTest('STY-003 the finger-drawing toggle lets a touch draw again and, like stylusSeen, survives a reload', async ({ page }) => {
  await startWithPen(page);
  await seePen(page);
  await openPenPopup(page);
  await expect(finger(page)).toHaveAttribute('aria-label', label('fingerDrawing'));
  await expect(finger(page)).not.toHaveAttribute('aria-pressed', 'true');
  await finger(page).click();
  await expect(finger(page)).toHaveAttribute('aria-pressed', 'true');
  const area = (await stage(page).boundingBox())!;
  await page.mouse.click(area.x + 3, area.y + area.height / 2); // closes the popup
  await expect(page.locator('app-tool-popup')).toHaveCount(0);
  const g = await geometry(page);
  await fire(page, dragSteps('touch', TOUCH_A, { x: g.left, y: g.y }, g.slide.width * 0.3));
  await expectDrawn(page, true);

  await page.reload();
  await startWithPen(page);
  await openPenPopup(page);
  await expect(finger(page)).toHaveAttribute('aria-pressed', 'true');
  // allowed fingers draw again; the flag still holds (a pen was seen before the reload): turn it off and a touch must not draw
  await finger(page).click();
  await expect(finger(page)).not.toHaveAttribute('aria-pressed', 'true');
  const area2 = (await stage(page).boundingBox())!;
  await page.mouse.click(area2.x + 3, area2.y + area2.height / 2);
  const g2 = await geometry(page);
  await fire(page, dragSteps('touch', TOUCH_A, { x: g2.left, y: g2.y }, g2.slide.width * 0.1));
  await expectDrawn(page, false);
});
