import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { forceFileInput, label, scoreBytes, slideCount, waitForFinalSlideCount } from './support/score';
import { DOCUMENT_OPEN_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS } from './support/timing';
import { PAID_URL } from './support/editions';
import { closeFileList, currentName, expectFiles, fileRows, openFileList, switchTo } from './support/files';
// V2-M3 S2: these specs need saving, restoring or persisted settings, which the free build switches off.
test.use({ baseURL: PAID_URL });

test.use({ viewport: { width: 1280, height: 800 } });

const FIRST = 'first.pdf';
const SECOND = 'second.pdf';
const rowMarker = (page: Page, name: string) => fileRows(page).filter({ hasText: name }).getByRole('button', { name: label('needsReopen'), exact: true });
const marked = (page: Page) => fileRows(page).getByRole('button', { name: label('needsReopen'), exact: true });
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const shell = (page: Page) => page.locator('app-shell');
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });
/** The stored session is written after the debounce (and at once on pagehide); give it the debounce plus a margin. */
const SESSION_WRITE_MS = TUNABLES.persistence.sessionDebounceMs * 3;

async function openBoth(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles([named(FIRST), named(SECOND)]);
  await expectFiles(page, [FIRST, SECOND]);
}

desktopTest('FIL-011 FIL-012 FIL-013 FIL-014 reloading restores both tabs as needs-reopen; one tap and the file restores the position', async ({ page }) => {
  await forceFileInput(page);
  await page.goto('/');
  await openBoth(page);
  await switchTo(page, FIRST);
  const count = await waitForFinalSlideCount(page);
  expect(count).toBeGreaterThan(3);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText(`3 / ${count}`);
  await page.waitForTimeout(SESSION_WRITE_MS);

  await page.reload();

  // FIL-011: both tabs are back, the previously active one is selected; FIL-013: the input path keeps no handle.
  await expect(currentName(page)).toHaveText(FIRST);
  await openFileList(page);
  await expect(fileRows(page).locator('.text')).toHaveText([FIRST, SECOND]);
  await expect(marked(page)).toHaveCount(2);
  await expect(fileRows(page).locator('.name[aria-current="true"]')).toHaveText(FIRST);
  // FIL-012: annotation mode, whatever the previous session was doing.
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');

  // FIL-013: one tap on the marked tab asks for the file; FIL-014: the position is back once detection is final.
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await fileRows(page).locator('.name', { hasText: FIRST }).click();
  await (await chooser).setFiles(named(FIRST));
  await openFileList(page);
  await expect(rowMarker(page, FIRST)).toHaveCount(0);
  await expect(marked(page)).toHaveCount(1);
  await closeFileList(page);
  await expect(indicator(page)).toHaveText(new RegExp(`^3 / ${count}$`), { timeout: DOCUMENT_OPEN_TIMEOUT_MS * 4 });
  expect(await slideCount(page)).toBe(count);
});
