import { expect, test, type Page } from '@playwright/test';

import { clickMode } from './support/modes';
import { label, openScoreInAnnotation, openScoreInOrganization } from './support/score';

/** The sizes of a phone (compact layout) and a tablet (expanded layout). */
const sizes = {
  compact: { width: 360, height: 800 },
  expanded: { width: 1280, height: 800 },
} as const;
type SizeClass = keyof typeof sizes;

// Bar 3 of the standard score is inside page 3, bar 8 at its bottom and bar 0 at the first junction (see e2e/support/score.ts).
const MIDDLE_BAR_INDEX = 3;
const PAGE_BOTTOM_BAR_INDEX = 8;
const FIRST_BAR_INDEX = 0;
const STROKE_STEPS = 10;

const button = (page: Page, key: string) => page.getByRole('button', { name: label(key), exact: true });
const undo = (page: Page) => button(page, 'undo');
const redo = (page: Page) => button(page, 'redo');

async function expectDisabled(page: Page, undoOff: boolean, redoOff: boolean): Promise<void> {
  for (const [control, off] of [[undo(page), undoOff], [redo(page), redoOff]] as const) {
    await (off ? expect(control) : expect(control).not).toHaveAttribute('aria-disabled', 'true');
  }
}

/** Compact layout: the buttons are in the popup of the floating tool button, which has to be open. */
async function showHistory(page: Page, sizeClass: SizeClass, fab: 'toolFab' | 'orgFab'): Promise<void> {
  if (sizeClass === 'compact' && !(await undo(page).isVisible())) {
    await button(page, fab).click();
  }
  await expect(undo(page)).toBeVisible();
}

async function drawStroke(page: Page): Promise<void> {
  const slide = (await page.getByTestId('slide-canvas').boundingBox())!;
  await page.mouse.move(slide.x + slide.width * 0.2, slide.y + slide.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(slide.x + slide.width * 0.6, slide.y + slide.height * 0.3, { steps: STROKE_STEPS });
  await page.mouse.up();
}

for (const [sizeClass, viewport] of Object.entries(sizes) as [SizeClass, { width: number; height: number }][]) {
  test.describe(`${sizeClass} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`UIX-033 UIX-034 ${sizeClass}: undo and redo are with the tools in both modes, not in the top bar`, { tag: '@smoke' }, async ({ page }) => {
      await page.goto('/');
      for (const [mode, fab] of [['modeAnnotation', 'toolFab'], ['modeOrganization', 'orgFab']] as const) {
        await clickMode(page, mode);
        await showHistory(page, sizeClass, fab);
        const group = sizeClass === 'compact' && fab === 'orgFab' ? 'app-popup-host' : 'app-tool-area';
        for (const key of ['undo', 'redo']) {
          await expect(page.locator(group).getByRole('button', { name: label(key), exact: true })).toBeVisible();
          await expect(page.locator('[data-area="top"]').getByRole('button', { name: label(key), exact: true })).toHaveCount(0);
        }
        await expectDisabled(page, true, true);
      }
    });
  });
}

test.describe('histories', () => {
  test.use({ viewport: sizes.expanded });

  test('ANN-015 ANN-016 draw a stroke, undo and redo it with the buttons', { tag: '@smoke' }, async ({ page }) => {
    await openScoreInAnnotation(page);
    await button(page, 'pen').click();
    await expectDisabled(page, true, true);
    await drawStroke(page);
    await expectDisabled(page, false, true);
    await undo(page).click();
    await expectDisabled(page, true, false);
    await redo(page).click();
    await expectDisabled(page, false, true);
  });

  test('ANN-015 ANN-016 add a jump, undo and redo it with the buttons', async ({ page }) => {
    await openScoreInOrganization(page);
    const bars = page.getByTestId('org-bar');
    const markers = page.getByTestId('jump-marker');
    await expectDisabled(page, true, true);
    await bars.nth(PAGE_BOTTOM_BAR_INDEX).click();
    await page.getByTestId('selection-chip').getByTestId('chip-jump').click();
    await bars.nth(FIRST_BAR_INDEX).click();
    await expect(markers).toHaveCount(2);
    await undo(page).click();
    await expect(markers).toHaveCount(0);
    // the chip of the jump that is gone goes with it
    await expect(page.getByTestId('stepper-value')).toHaveCount(0);
    await expectDisabled(page, true, false);
    await redo(page).click();
    await expect(markers).toHaveCount(2);
    await expectDisabled(page, false, true);
  });

  test('ANN-015 the history of each mode is its own', async ({ page }) => {
    await openScoreInOrganization(page);
    const stopIcons = page.getByTestId('org-bar-stop-icon');
    await page.getByTestId('org-bar').nth(MIDDLE_BAR_INDEX).click();
    await page.getByTestId('selection-chip').getByTestId('chip-stop').click();
    await expect(stopIcons).toHaveCount(1);

    await clickMode(page, 'modeAnnotation');
    await expectDisabled(page, true, true);
    await button(page, 'pen').click();
    await drawStroke(page);
    await undo(page).click();
    await expectDisabled(page, true, false);

    await clickMode(page, 'modeOrganization');
    await expectDisabled(page, false, true);
    await undo(page).click();
    await expect(stopIcons).toHaveCount(0);

    await clickMode(page, 'modeAnnotation');
    await expectDisabled(page, true, false);
  });
});
