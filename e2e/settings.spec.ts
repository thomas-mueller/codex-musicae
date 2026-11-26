import { expect, test, type Locator, type Page } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { label, openScoreInAnnotation } from './support/score';

const shell = (page: Page): Locator => page.locator('app-shell');
const button = (page: Page, key: string): Locator => page.getByRole('button', { name: label(key), exact: true });
const GROUPS = ['general', 'display', 'slideMode', 'files'];

test('UIX-025 UIX-026 the settings button opens the four groups and returns to the previous mode', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await button(page, 'modeOrganization').click();
  await button(page, 'settings').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'settings');
  await expect(page.locator('app-settings-view section h2')).toHaveCount(GROUPS.length);
  expect(await page.locator('app-settings-view section').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))).toEqual(GROUPS);
  await expect(page.locator('app-tool-area')).toHaveCount(0);
  await expect(page.locator('[data-area="bottom"]')).toBeHidden();
  await button(page, 'settings').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'organization');
  await expect(page.locator('[data-area="bottom"]')).toBeVisible();
});

desktopTest('UIX-025 NAV-018 PageDown changes no slide in the settings and Escape returns to the score', async ({ page }) => {
  await openScoreInAnnotation(page);
  const indicator = page.locator('[data-area="bottom"] .indicator');
  await expect(indicator).toHaveText(/^1\D/);
  const before = await indicator.textContent();
  await button(page, 'settings').click();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
  await expect(page.locator('app-slide-view')).toBeVisible();
  await expect(indicator).toHaveText(before ?? '');
});

test.describe('at the minimum supported width', () => {
  test.use({ viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  test('UIX-016 UIX-025 UIX-034 every top-bar button is fully visible and touch-sized in every mode', async ({ page }) => {
    await page.goto('/');
    for (const mode of ['modeAnnotation', 'modeOrganization', 'settings']) {
      await button(page, mode).click();
      const boxes = await page.locator('[data-area="top"] button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      expect(boxes.length, mode).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.left, mode).toBeGreaterThanOrEqual(0);
        expect(box.right, mode).toBeLessThanOrEqual(TUNABLES.layout.minSupportedWidthPx);
        expect(box.width, mode).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
      }
      await expect(page.locator('[data-area="top"]').getByLabel(label('undo'), { exact: true })).toHaveCount(0);
    }
  });
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 800, height: 360 },
]) {
  test.describe(`compact ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`UIX-033 UIX-034 the tool popup holds undo and redo and fits the screen at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openScoreInAnnotation(page);
      await expect(button(page, 'undo')).toHaveCount(0);
      const fab = button(page, 'toolFab');
      const closed = await fab.boundingBox();
      await fab.click();
      const popup = page.locator('app-tool-area [data-popup]');
      for (const key of ['pen', 'highlighter', 'eraser', 'undo', 'redo']) {
        await expect(popup.getByRole('button', { name: label(key), exact: true })).toBeInViewport({ ratio: 1 });
      }
      await expect(button(page, 'undo')).toHaveAttribute('aria-disabled', 'true');
      await expect(button(page, 'redo')).toHaveAttribute('aria-disabled', 'true');
      const opened = await fab.boundingBox();
      expect(opened?.x).toBeCloseTo(closed?.x ?? Number.NaN, 0); // the wider popup does not move the button
    });

    desktopTest(`UIX-033 undo and redo in the tool popup act on a drawn stroke at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openScoreInAnnotation(page);
      await button(page, 'toolFab').click();
      await button(page, 'pen').click();
      await expect(button(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
      await button(page, 'toolFab').click(); // a pointer on the stage while a popup is open only closes the popup (V1)
      await expect(page.locator('app-tool-area [data-popup]')).toHaveCount(0);
      const slide = await page.getByTestId('slide-canvas').boundingBox();
      const start = { x: (slide?.x ?? 0) + (slide?.width ?? 0) * 0.5, y: (slide?.y ?? 0) + (slide?.height ?? 0) * 0.25 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + (slide?.width ?? 0) * 0.2, start.y + 10, { steps: 10 });
      await page.mouse.up();
      await button(page, 'toolFab').click();
      await expect(button(page, 'undo')).not.toHaveAttribute('aria-disabled', 'true');
      await button(page, 'undo').click();
      await expect(button(page, 'undo')).toHaveAttribute('aria-disabled', 'true');
      await button(page, 'redo').click();
      await expect(button(page, 'undo')).not.toHaveAttribute('aria-disabled', 'true');
      await expect(button(page, 'redo')).toHaveAttribute('aria-disabled', 'true');
    });
  });
}
