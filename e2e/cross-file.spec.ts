import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { jumpInto } from '../src/testing/cross-file-files';
import { crossFilePdf, onDisk } from './support/cross-file';
import { PAID_URL } from './support/editions';
import { currentName, expectFiles, openFileList, switchTo } from './support/files';
import { forceFileInput, label, waitForFinalSlideCount } from './support/score';
import { DOCUMENT_OPEN_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS, NEGATIVE_SETTLE_MS } from './support/timing';

const en = (JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { crossFile: Record<string, string> }).crossFile;
const FIRST = 'first.pdf';
const SECOND = 'second.pdf';
const JUMP_LINE = 2;
const NO_SUCH_LINE = 9;

const button = (page: Page, key: string) => page.getByRole('button', { name: label(key), exact: true });
const notice = (page: Page) => page.getByTestId('cross-file-notice');
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');

/** first.pdf plays its lines 1 and 2 and then jumps to line `target` of second.pdf. */
async function pair(target = JUMP_LINE) {
  return {
    first: onDisk(FIRST, await crossFilePdf('First', { jumps: [jumpInto(SECOND, JUMP_LINE, 1, target)] })),
    second: onDisk(SECOND, await crossFilePdf('Second')),
  };
}

async function openPath(page: Page, path: string, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await button(page, 'openFile').click();
  await (await chooser).setFiles(path);
  await expect(currentName(page)).toHaveText(name, { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
  await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DOCUMENT_OPEN_TIMEOUT_MS });
}

/** Turns to the last slide of the current file; returns the number of its slides. */
async function toLastSlide(page: Page): Promise<number> {
  const count = await waitForFinalSlideCount(page);
  for (let turn = 1; turn < count; turn++) {
    await button(page, 'next').click();
  }
  await expect(indicator(page)).toHaveText(`${count} / ${count}`);
  return count;
}

test.describe('cross-file jumps', () => {
  test.beforeEach(async ({ page }) => {
    await forceFileInput(page);
    await page.goto('/');
  });

  test('FIL-043 MRK-016 a missing file is warned about and the presentation ends at the jump', async ({ page }) => {
    const files = await pair();
    await openPath(page, files.first, FIRST);
    await expect(notice(page)).toContainText(SECOND);
    await expect(page.getByTestId('cross-file-open')).toHaveText(en.openFile);
    await toLastSlide(page);
    await expect(button(page, 'next')).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(NEGATIVE_SETTLE_MS);
    await expect(currentName(page)).toHaveText(FIRST);
    await page.getByTestId('cross-file-dismiss').click();
    await expect(notice(page)).toHaveCount(0);
  });

  test(
    'FIL-043 FIL-045 FIL-051 FIL-052 a file opened by hand is played into at the jump, and previous leads back',
    { tag: '@smoke' },
    async ({ page }) => {
      const files = await pair();
      await openPath(page, files.first, FIRST);
      const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
      await page.getByTestId('cross-file-open').click();
      await (await chooser).setFiles(files.second);
      await expect(notice(page)).toHaveCount(0, { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
      await expect(currentName(page)).toHaveText(FIRST);
      const count = await toLastSlide(page);

      await button(page, 'next').click();
      await expect(currentName(page)).toHaveText(SECOND);
      await expect(indicator(page)).toHaveText(/^1 \/ \d+$/);
      await expect(page.getByTestId('slide-canvas')).toBeVisible();

      await button(page, 'previous').click();
      await expect(currentName(page)).toHaveText(FIRST);
      await expect(indicator(page)).toHaveText(`${count} / ${count}`);
    },
  );

  test('MRK-015 MRK-016 a target line that does not exist ends the presentation there', async ({ page }) => {
    const files = await pair(NO_SUCH_LINE);
    await openPath(page, files.second, SECOND);
    await openPath(page, files.first, FIRST);
    await expect(notice(page)).toContainText(en.missingSystem);
    await expect(page.getByTestId('cross-file-open')).toHaveCount(0);
    await toLastSlide(page);
    await expect(button(page, 'next')).toBeDisabled();
  });

  test('FIL-044 closing a referenced file warns until "don\'t show again"', async ({ page }) => {
    const files = await pair();
    const closeSecond = async (): Promise<void> => {
      await switchTo(page, SECOND);
      await openFileList(page);
      await page.locator('app-popup-host app-file-item', { hasText: SECOND }).getByRole('button', { name: label('closeTab'), exact: true }).click();
      await expect(currentName(page)).toHaveText(FIRST);
      // the list stays open after closing a file and lies over the notice, like over every notice
      await page.keyboard.press('Escape');
      await expect(page.locator('app-popup-host app-file-item')).toHaveCount(0);
    };
    await openPath(page, files.second, SECOND);
    await openPath(page, files.first, FIRST);
    await expect(notice(page)).toHaveCount(0);
    await closeSecond();
    await expect(notice(page)).toHaveAttribute('data-kind', 'closed');
    await expect(notice(page)).toContainText(FIRST);
    await page.getByTestId('cross-file-silence').click();
    await expect(notice(page)).toHaveCount(0);
    await openPath(page, files.second, SECOND);
    await closeSecond();
    await page.waitForTimeout(NEGATIVE_SETTLE_MS);
    await expect(notice(page)).toHaveCount(0);
  });
});

/** The browser-side objects used below (the lint rules keep bare platform globals out of e2e code). */
interface PickerGlobals {
  navigator: {
    storage: {
      getDirectory(): Promise<{
        getFileHandle(name: string, options?: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }> }>;
      }>;
    };
  };
  showOpenFilePicker?: unknown;
  nextPick?: string;
}

/** Puts `bytes` into the browser-private file system and makes the next open picker answer with that file. */
async function chooseStored(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page.evaluate(
    async ({ fileName, data }) => {
      const globals = globalThis as unknown as PickerGlobals;
      const root = await globals.navigator.storage.getDirectory();
      const writable = await (await root.getFileHandle(fileName, { create: true })).createWritable();
      await writable.write(new Uint8Array(data));
      await writable.close();
      globals.nextPick = fileName;
    },
    { fileName: name, data: Array.from(bytes) },
  );
}

test.describe('cross-file jumps with stored file access', () => {
  test.use({ baseURL: PAID_URL });

  test('FIL-042 FIL-045 a referenced file of the recent list opens in the background', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs file handles that can be stored and re-opened');
    await page.addInitScript(() => {
      const globals = globalThis as unknown as PickerGlobals;
      globals.showOpenFilePicker = async () => {
        const root = await globals.navigator.storage.getDirectory();
        return [await root.getFileHandle(globals.nextPick!)];
      };
    });
    await page.goto('/');
    const open = async (name: string, bytes: Uint8Array): Promise<void> => {
      await chooseStored(page, name, bytes);
      await button(page, 'openFile').click();
      await expect(currentName(page)).toHaveText(name, { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
      await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    };
    await open(SECOND, await crossFilePdf('Second'));
    await openFileList(page);
    await page.locator('app-popup-host app-file-item').getByRole('button', { name: label('closeTab'), exact: true }).click();
    await expect(currentName(page)).toHaveCount(0);

    await open(FIRST, await crossFilePdf('First', { jumps: [jumpInto(SECOND, JUMP_LINE)] }));
    await openFileList(page);
    await expect(page.locator('app-popup-host app-file-item .text')).toHaveText([FIRST, SECOND]);
    await page.keyboard.press('Escape');
    await expect(currentName(page)).toHaveText(FIRST);
    await expect(notice(page)).toHaveCount(0);
    await toLastSlide(page);
    await button(page, 'next').click();
    await expect(currentName(page)).toHaveText(SECOND);
    await expectFiles(page, [FIRST, SECOND]);
  });
});
