import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

import { DETECTION_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS, RETRY_TIMEOUT_MS } from './timing';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };

/** The accessible name of an icon button (a11y.<key> in the translation file). */
export const label = (key: string): string => en.a11y[key] as string;

/** The standard test score (V2-M2 S4): a real scan from the corpus; its expected counts are those of its entry in e2e/corpus/expected.json. */
export const SCORE_NAME = 'IMSLP799145-PMLP14377-tiff2pdf_-2.pdf';
export const SCORE_PATH = `e2e/corpus/real/${SCORE_NAME}`;
export const scoreBytes = readFileSync(SCORE_PATH);
/** Systems per page: from the entry of the score in expected.json (page 1 has one system, page 2 none, pages 3 to 5 six each). */
export const SCORE_SYSTEMS_PER_PAGE: number[] = (
  JSON.parse(readFileSync('e2e/corpus/expected.json', 'utf8')) as { file: string; systemsPerPage: number[] }[]
).find((entry) => entry.file === SCORE_NAME)?.systemsPerPage ?? [];
export const SCORE_PAGES = SCORE_SYSTEMS_PER_PAGE.length;
export const SCORE_SYSTEMS = SCORE_SYSTEMS_PER_PAGE.reduce((sum, count) => sum + count, 0);
/**
 * Bars after detection, measured in the app (the detection-bars spec checks it): the 20 junctions of 19 systems, and the three junctions at a page change
 * (1 -> 3, 3 -> 4, 4 -> 5) have two bars. Page 1 has bars 0 and 1, page 3 bars 2 to 8, page 4 bars 9 to 15, page 5 bars 16 to 22.
 */
export const SCORE_BARS = 23;

/** Forces the <input type="file"> path in every engine. Call before `page.goto`. */
export async function forceFileInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
}

export async function openScore(page: Page, name = 'score.pdf'): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: scoreBytes });
}

// The click can land before the app reacts (WebKit); repeat it until the viewer shows. Selecting the mode is idempotent.
export async function enterOrganization(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByLabel(label('modeOrganization'), { exact: true }).click();
    await expect(page.getByTestId('org-viewer')).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
}

export async function waitForBars(page: Page, count = SCORE_BARS): Promise<void> {
  await expect(page.getByTestId('org-bar')).toHaveCount(count, { timeout: DETECTION_TIMEOUT_MS });
}

/** Opens the app, the standard score and organization mode, and waits until detection has produced all bars. */
export async function openScoreInOrganization(page: Page): Promise<void> {
  await forceFileInput(page);
  await page.goto('/');
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
}

/** Opens the app and the standard score in annotation mode (the default) and waits for the final slide count ("x / n", no plus). */
export async function openScoreInAnnotation(page: Page): Promise<number> {
  await forceFileInput(page);
  await page.goto('/');
  await openScore(page);
  return waitForFinalSlideCount(page);
}

/** Waits until detection is complete (the indicator has no "+") and returns n. */
export async function waitForFinalSlideCount(page: Page): Promise<number> {
  const indicator = page.locator('app-bottom-bar .indicator');
  await expect(indicator).toHaveText(/^\d+ \/ \d+$/, { timeout: DETECTION_TIMEOUT_MS });
  return slideCount(page);
}

/** n of the indicator "x / n(+)". */
export async function slideCount(page: Page): Promise<number> {
  const text = (await page.locator('app-bottom-bar .indicator').textContent()) ?? '';
  return Number(/\/\s*(\d+)/.exec(text)?.[1]);
}
