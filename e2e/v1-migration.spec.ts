import { expect, test, type Page } from '@playwright/test';

import { systemNumbers, generatePlayingOrder } from '../src/app/core/playing-order';
import { TUNABLES } from '../src/config/tunables';
import { schema1Text } from '../src/testing/schema1-text';
import { desktopTest } from './support/desktop';
import { PAID_URL } from './support/editions';
import {
  enterOrganization, label, openScore, SCORE_BARS, SCORE_PAGES, SCORE_SYSTEMS, waitForBars,
} from './support/score';
import { forceFilePaths, inspect, openPdf, saveCopyDownload, shorterPdfWithMetadata } from './support/saving';
import { DETECTION_TIMEOUT_MS } from './support/timing';

// V2-M4 S3: opening a file the V1 app saved. The file is the standard score of the corpus with V1 data embedded.
test.use({ baseURL: PAID_URL, viewport: { width: 1600, height: 700 } });

/** Waiting past the autosave delay shows that opening alone changed nothing. */
const AFTER_AUTOSAVE_MS = TUNABLES.saving.autosaveIdleMs * 2;

/** Skip the title system (a jump from gap 0), D.C. back to system 2 after the last one, Fine after system 7, one slide break. */
const V1_MARKS = {
  jumps: [{ id: 1, origin: 0, target: 1, pass: 1 }, { id: 2, origin: SCORE_SYSTEMS, target: 1, pass: 1 }],
  breaks: [4],
  stops: [7],
  nextJumpId: 3,
};
const VISIBLE_JUMP_MARKERS = 2; // the D.C.; the skipped title is a start mark, which has no marker until V2-M10

/** What V1 wrote under every system: its playing-order numbers. */
const V1_NUMBERS = systemNumbers(
  generatePlayingOrder({ systemCount: SCORE_SYSTEMS, jumps: V1_MARKS.jumps, stops: V1_MARKS.stops, maxLength: TUNABLES.playingOrder.maxLength }),
  SCORE_SYSTEMS,
).map((numbers) => numbers.join(TUNABLES.layout.numberSeparator));

async function expectTheV1Order(page: Page): Promise<void> {
  await enterOrganization(page);
  await expect(page.getByTestId('org-bar')).toHaveCount(SCORE_BARS);
  await expect(page.getByTestId('jump-marker')).toHaveCount(VISIBLE_JUMP_MARKERS);
  // a system that is never played (the title) has no label
  const expected = V1_NUMBERS.filter((text) => text !== '');
  await expect(page.getByTestId('system-label')).toHaveText(expected);
  await expect(page.locator('[data-testid="system-label"][data-system="1"]')).toHaveCount(0);
}

async function expectNoDetection(page: Page): Promise<void> {
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/);
  await expect(page.getByTestId('detection-progress')).toHaveCount(0);
}

desktopTest('SAV-003 SAV-016 SAV-017 a V1 file opens with its playing order, is left alone, and is saved in schema 2', async ({ page }) => {
  await forceFilePaths(page);
  await page.goto('/');
  // The detection of the score, as any save holds it, to build the V1 file from.
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
  const plain = await inspect((await saveCopyDownload(page)).bytes);
  if (plain.metadata?.kind !== 'ok' || plain.metadata.value.detection === null) {
    throw new Error('the saved score has no detection');
  }
  const v1 = schema1Text({ pageCount: SCORE_PAGES, detection: plain.metadata.value.detection, marks: V1_MARKS });
  const v1File = await shorterPdfWithMetadata(v1, SCORE_PAGES);

  await page.goto('/');
  await openPdf(page, v1File, 'v1.pdf');
  await expectNoDetection(page);
  await expectTheV1Order(page);
  await page.waitForTimeout(AFTER_AUTOSAVE_MS);
  await expect(page.getByLabel(label('unsaved'))).toHaveCount(0);

  const copy = await saveCopyDownload(page);
  expect(JSON.parse((await inspect(copy.bytes)).json ?? '{}')).toMatchObject({
    schemaVersion: TUNABLES.saving.schemaVersion,
    marks: {
      start: { at: { pageIndex: 2, system: 1 } },
      jumps: [{ id: 2, to: { pageIndex: 2, system: 1 }, pass: 1 }],
      nextJumpId: 3,
    },
  });

  await page.goto('/');
  await openPdf(page, copy.bytes, copy.name);
  await expect(page.locator('app-bottom-bar .indicator')).toHaveText(/^\d+ \/ \d+$/, { timeout: DETECTION_TIMEOUT_MS });
  await expectNoDetection(page);
  await expectTheV1Order(page);
});
