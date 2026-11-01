import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

import { DETECTION_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS, RETRY_TIMEOUT_MS } from './timing';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };

/** The accessible name of an icon button (a11y.<key> in the translation file). */
export const label = (key: string): string => en.a11y[key] as string;

export const SCORE_PATH = 'e2e/fixtures/synthetic-score.pdf';
export const scoreBytes = readFileSync(SCORE_PATH);
/** 3 pages x (4 systems + 1) bars; junctions 4 and 8 sit on page changes and have two bars. */
export const SYNTHETIC_BARS = 15;
export const SYNTHETIC_SYSTEMS = 12;

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

export async function waitForBars(page: Page, count = SYNTHETIC_BARS): Promise<void> {
  await expect(page.getByTestId('org-bar')).toHaveCount(count, { timeout: DETECTION_TIMEOUT_MS });
}

/** Opens the app, the synthetic score and organization mode, and waits until detection has produced all bars. */
export async function openScoreInOrganization(page: Page): Promise<void> {
  await forceFileInput(page);
  await page.goto('/');
  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
}

/** Opens the app and the synthetic score in annotation mode (the default) and waits for the final slide count ("x / n", no plus). */
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
