import { expect, test } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { inkedPixelsNear } from './support/pixels';
import { label, openScore, slideCount, waitForBars, waitForFinalSlideCount } from './support/score';
import { addJumpToStart, COLOR_TOLERANCE, drag, enterAnnotation, enterOrganization, forceFilePaths, RED, strokeLine, tool } from './support/saving';

test.use({ viewport: { width: 1600, height: 700 } });

const MIN_SLIDES_WITH_INK = 2;

desktopTest('ANN-012 a stroke on a repeated system appears on every slide that shows that system', async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
  await addJumpToStart(page); // 4 -> 0: the first page is played twice
  await enterAnnotation(page);
  await waitForFinalSlideCount(page);

  await tool(page, 'pen').click();
  const line = await strokeLine(page);
  await drag(page, line.from, line.to);
  const ink = page.getByTestId('ink-canvas');
  await expect.poll(() => inkedPixelsNear(ink, RED, COLOR_TOLERANCE)).toBeGreaterThan(0);

  // Walk through all slides: the repeated system shows the stroke again where it is played again.
  const next = page.getByRole('button', { name: label('next'), exact: true });
  const total = await slideCount(page);
  let withInk = 1;
  for (let slide = 1; slide < total; slide++) {
    await next.click();
    await expect(page.locator('app-bottom-bar .indicator')).toHaveText(`${slide + 1} / ${total}`);
    await page.waitForTimeout(300);
    if ((await inkedPixelsNear(ink, RED, COLOR_TOLERANCE)) > 0) {
      withInk++;
    }
  }
  expect(withInk).toBeGreaterThanOrEqual(MIN_SLIDES_WITH_INK);
});
