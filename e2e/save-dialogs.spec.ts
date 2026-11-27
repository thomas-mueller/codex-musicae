import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { PAID_URL } from './support/editions';
import { cutTexts, serveLongTexts } from './support/fit';
import { clickMode } from './support/modes';
import { readWritableFile, useWritableFiles } from './support/opfs';
import { drag, forceFilePaths, inspect, openPdf, strokeLine, tool, waitForDrawnSlide } from './support/saving';
import { label, openScore, scoreBytes, waitForFinalSlideCount } from './support/score';
import { DETECTION_TIMEOUT_MS, NEGATIVE_SETTLE_MS } from './support/timing';

// V2-M6 S2: the overwrite question, the close question and the notice about a file that cannot be written.

const NAME = 'score.pdf';
const NEW_NAME = 'score (annotated).pdf';
/** Longer than the autosave delay: whatever was due has happened. */
const AUTOSAVE_SETTLE_MS = TUNABLES.saving.autosaveIdleMs + 1500;
/** Detection of the score, which may pause or slow down while nothing is shown of it. */
const PRESENTATION_SETTLE_MS = 15_000;

const dialog = (page: Page) => page.getByTestId('overwrite-dialog');
const closeDialog = (page: Page) => page.getByTestId('close-dialog');
const notice = (page: Page) => page.getByTestId('save-notice');
const entry = (page: Page) => page.locator('[data-area="top"] app-file-item');
const name = (page: Page) => entry(page).locator('.name .text');
const star = (page: Page) => entry(page).getByLabel(label('unsaved'), { exact: true });
const closeFile = (page: Page) => entry(page).locator('button.close').click();

async function open(page: Page): Promise<void> {
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
}

async function draw(page: Page, row = 0.25): Promise<void> {
  await waitForDrawnSlide(page);
  const pen = tool(page, 'pen');
  if ((await pen.getAttribute('aria-pressed')) !== 'true') {
    await pen.click();
  }
  const line = await strokeLine(page, 0.2, 0.6, row);
  await drag(page, line.from, line.to);
  await expect(star(page)).toBeVisible();
}

const inkCount = async (page: Page, file: string): Promise<number> => (await inspect(await readWritableFile(page, file))).ink?.length ?? -1;
const unchanged = async (page: Page, file: string): Promise<boolean> => (await readWritableFile(page, file)).equals(scoreBytes);

test.describe('paid edition, files that can be written (real writes, Chromium)', () => {
  test.use({ baseURL: PAID_URL, viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'the browser-private file system with in-place writing: Chromium');
    await useWritableFiles(page);
    await page.goto('/');
  });

  /** SAV-012: the save due after detection is the first one, so opening a new file leads to the question. */
  async function openAndAwaitQuestion(page: Page): Promise<void> {
    await open(page);
    await expect(dialog(page)).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
  }

  test('FIL-033 FIL-034 FIL-035 FIL-036 FIL-049 the save after detection asks and writes nothing; after Cancel closing asks to discard', async ({ page }) => {
    await openAndAwaitQuestion(page);
    await expect(dialog(page)).toContainText(NAME);
    await page.waitForTimeout(AUTOSAVE_SETTLE_MS);
    expect(await unchanged(page, NAME)).toBe(true);
    await expect(star(page)).toBeVisible();
    await page.getByTestId('overwrite-cancel').click();
    await draw(page);
    await page.waitForTimeout(AUTOSAVE_SETTLE_MS);
    await expect(dialog(page)).toHaveCount(0); // asked once per session
    expect(await unchanged(page, NAME)).toBe(true);
    await closeFile(page);
    await page.getByTestId('close-cancel').click();
    await expect(name(page)).toHaveText(NAME);
    await closeFile(page);
    await page.getByTestId('close-discard').click();
    await expect(entry(page)).toHaveCount(0);
    expect(await unchanged(page, NAME)).toBe(true);
  });

  test('FIL-020 FIL-033 FIL-036 Overwrite writes the file, later changes are saved without asking, and closing needs no question', async ({ page }) => {
    await openAndAwaitQuestion(page);
    await page.getByTestId('overwrite-yes').click();
    await expect.poll(() => unchanged(page, NAME)).toBe(false);
    await draw(page);
    await expect(star(page)).toHaveCount(0, { timeout: AUTOSAVE_SETTLE_MS * 3 });
    expect(await inkCount(page, NAME)).toBe(1);
    await expect(dialog(page)).toHaveCount(0);
    await draw(page, 0.5);
    await closeFile(page); // saves first
    await expect(entry(page)).toHaveCount(0);
    expect(await inkCount(page, NAME)).toBe(2);
  });

  test('FIL-038 "do not ask again for any file" still holds after a reload', async ({ page }) => {
    await openAndAwaitQuestion(page);
    await page.getByTestId('silence-all').check();
    await page.getByTestId('overwrite-yes').click();
    await expect.poll(() => unchanged(page, NAME)).toBe(false);
    await expect(star(page)).toHaveCount(0);
    await page.reload();
    await expect(name(page)).toHaveText(NAME);
    await waitForFinalSlideCount(page);
    await draw(page);
    await expect(star(page)).toHaveCount(0, { timeout: AUTOSAVE_SETTLE_MS * 3 });
    expect(await inkCount(page, NAME)).toBe(1);
    await expect(dialog(page)).toHaveCount(0);
  });

  test('FIL-036 FIL-037 "save as new file" leaves the original byte for byte and the entry continues in the new file', async ({ page }) => {
    await openAndAwaitQuestion(page);
    await page.getByTestId('overwrite-save-as').click();
    await expect(name(page)).toHaveText(NEW_NAME);
    await expect(star(page)).toHaveCount(0);
    expect(await inkCount(page, NEW_NAME)).toBe(0);
    await draw(page);
    await expect(star(page)).toHaveCount(0, { timeout: AUTOSAVE_SETTLE_MS * 3 });
    expect(await inkCount(page, NEW_NAME)).toBe(1);
    expect(await unchanged(page, NAME)).toBe(true);
    await expect(dialog(page)).toHaveCount(0);
  });

  test('FIL-050 no question appears in presentation mode; it waits until presentation mode is left', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
    await waitForDrawnSlide(page);
    await clickMode(page, 'modePresentation');
    await expect(page.locator('app-shell')).toHaveAttribute('data-mode', 'presentation');
    await page.waitForTimeout(PRESENTATION_SETTLE_MS);
    await expect(dialog(page)).toHaveCount(0);
    expect(await unchanged(page, NAME)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
  });
});

test.describe('paid edition, a file that cannot be written', () => {
  test.use({ baseURL: PAID_URL, viewport: { width: 1280, height: 800 } });

  desktopTest('FIL-022 FIL-037 FIL-039 FIL-040 a read-only file shows one notice below the top bar; "save as new file" downloads where no file can be chosen', async ({ page }) => {
    await forceFilePaths(page); // the file input gives read-only files, and there is no save picker
    await page.goto('/');
    await openPdf(page, scoreBytes, NAME);
    await waitForFinalSlideCount(page);
    await page.waitForTimeout(NEGATIVE_SETTLE_MS);
    await expect(notice(page)).toHaveCount(0); // detection alone changes nothing that could be saved
    await expect(star(page)).toHaveCount(0);
    await draw(page, 0.5);
    await expect(notice(page)).toBeVisible();
    const bar = (await page.locator('[data-area="top"]').boundingBox())!;
    expect(Math.abs((await notice(page).boundingBox())!.y - (bar.y + bar.height))).toBeLessThanOrEqual(1);
    await draw(page, 0.7); // the notice blocks nothing, not even the tool strip beside it
    await tool(page, 'eraser').click();
    await tool(page, 'pen').click();
    await page.getByTestId('notice-dismiss').click();
    await draw(page, 0.6);
    await page.waitForTimeout(NEGATIVE_SETTLE_MS);
    await expect(notice(page)).toHaveCount(0); // once per session
    await entry(page).locator('button.lock').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('notice-save-as').click()]);
    expect(download.suggestedFilename().replace(/_/g, ' ')).toBe(NEW_NAME);
    await expect(notice(page)).toHaveCount(0);
    await expect(name(page)).toHaveText(NAME);
    await expect(star(page)).toBeVisible();
  });
});

test.describe('free edition: closing', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  desktopTest('FIL-046 FIL-047 EDN-003 an untouched file closes silently; a changed one asks every time', async ({ page }) => {
    await forceFilePaths(page);
    await page.goto('/');
    await openScore(page);
    await waitForFinalSlideCount(page);
    await closeFile(page);
    await expect(entry(page)).toHaveCount(0);
    await expect(closeDialog(page)).toHaveCount(0);
    await openScore(page);
    await waitForFinalSlideCount(page);
    await draw(page);
    await expect(notice(page)).toHaveCount(0);
    for (let i = 0; i < 2; i++) {
      await closeFile(page);
      await expect(page.getByTestId('close-save-as')).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape'); // Cancel: the file stays
      await expect(closeDialog(page)).toHaveCount(0);
      await expect(name(page)).toHaveText(NAME);
    }
    await closeFile(page);
    await page.getByTestId('close-discard').click();
    await expect(entry(page)).toHaveCount(0);
  });
});

test.describe('at the minimum supported width, with long German texts', () => {
  // the language file is replaced by a route, which a service worker would bypass
  test.use({ baseURL: PAID_URL, serviceWorkers: 'block', locale: 'de-DE', viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  async function insideWindow(page: Page, testId: string): Promise<void> {
    for (const element of await page.locator(`[data-testid="${testId}"], [data-testid="${testId}"] button, [data-testid="${testId}"] label`).all()) {
      await expect(element).toBeInViewport({ ratio: 1 });
    }
    expect(await cutTexts(page, `[data-testid="${testId}"]`), testId).toEqual([]);
  }

  test('FIL-036 FIL-039 FIL-049 I18-006 the overwrite question, the close question and the notice fit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'writable files: Chromium');
    const long = (await serveLongTexts(page, 'de')) as unknown as { a11y: Record<string, string> };
    await useWritableFiles(page);
    await page.goto('/');
    await page.getByRole('button', { name: long.a11y['openFile'], exact: true }).click();
    await expect(dialog(page)).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
    await insideWindow(page, 'overwrite-dialog');
    await page.getByTestId('overwrite-cancel').click();
    await entry(page).locator('.name').click();
    await page.locator('app-popup-host app-file-item button.close').click();
    await insideWindow(page, 'close-dialog');
    await page.getByTestId('close-discard').click();

    // a read-only file: the plain file input
    await page.evaluate(() => ((globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = undefined));
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: long.a11y['openFile'], exact: true }).click();
    await (await chooser).setFiles({ name: 'a rather long name of a mail attachment.pdf', mimeType: 'application/pdf', buffer: scoreBytes });
    await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
    await entry(page).locator('.name').click();
    await page.locator('app-popup-host app-file-item button.lock').click();
    await insideWindow(page, 'save-notice');
  });
});
