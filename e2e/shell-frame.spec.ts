import { expect, test } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';

const viewports = [
  { w: 360, h: 800, sizeClass: 'compact' },
  { w: 800, h: 360, sizeClass: 'compact' },
  { w: 599, h: 1000, sizeClass: 'compact' },
  { w: 1280, h: 800, sizeClass: 'expanded' },
  { w: 2560, h: 1440, sizeClass: 'expanded' },
  { w: 320, h: 568, sizeClass: 'compact' },
];

for (const v of viewports) {
  test.describe(`${v.w}x${v.h}`, () => {
    test.use({ viewport: { width: v.w, height: v.h } });
    test(`UIX-003 UIX-016 ${v.w}x${v.h} is ${v.sizeClass} without horizontal scroll`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('app-shell')).toHaveAttribute('data-size-class', v.sizeClass);
      const overflow = await page.locator('html').evaluate((e) => e.scrollWidth <= e.clientWidth);
      expect(overflow).toBe(true);
    });
  });
}

test('GEN-008 UIX-008 canvas is grey and bars are visible', async ({ page }) => {
  await page.goto('/');
  const bg = await page.locator('app-canvas-area').evaluate((e) => getComputedStyle(e).backgroundColor);
  const hex = TUNABLES.colors.canvasGrey.slice(1).match(/../g)!.map((h) => parseInt(h, 16));
  expect(bg).toBe(`rgb(${hex.join(', ')})`);
  const bar = await page.locator('[data-area=top]').boundingBox();
  expect(Math.abs(bar!.height - TUNABLES.layout.barHeightPx)).toBeLessThanOrEqual(1);
});
