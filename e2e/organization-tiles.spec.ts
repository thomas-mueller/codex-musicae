import { expect, test } from '@playwright/test';

import { openScoreInOrganization } from './support/score';

test.use({ viewport: { width: 1280, height: 800 } });

const DARK_MAX = 200; // 0..255: the staff lines of the scan are thin and grey once the page is shown at fit-page
const RGBA = 4;
/** A staff line spans most of the system width. */
const LINE_SHARE = 0.2;
/** Rows with dark pixels over a good part of the width on the first page of the standard score: far more than this when the tile is really rendered. */
const MIN_LINE_ROWS = 10;

test('ORG-001 ORG-002 a rendered page tile has dark pixels where the staff lines are', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'canvas pixel inspection: desktop Chromium');
  await openScoreInOrganization(page);
  const rows = await page.locator('app-page-tiles canvas').evaluateAll(
    (canvases, { darkMax, stride, share }) =>
      (canvases as HTMLCanvasElement[]).map((canvas) => {
        const context = canvas.getContext('2d');
        if (!context || canvas.width === 0 || canvas.height === 0) {
          return 0;
        }
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let lineRows = 0;
        for (let y = 0; y < canvas.height; y++) {
          let dark = 0;
          for (let x = 0; x < canvas.width; x++) {
            if (data[(y * canvas.width + x) * stride]! < darkMax && data[(y * canvas.width + x) * stride + 3]! > 0) {
              dark++;
            }
          }
          if (dark >= canvas.width * share) {
            lineRows++;
          }
        }
        return lineRows;
      }),
    { darkMax: DARK_MAX, stride: RGBA, share: LINE_SHARE },
  );
  expect(Math.max(...rows)).toBeGreaterThanOrEqual(MIN_LINE_ROWS);
});
