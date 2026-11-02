import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { forceFileInput, label, scoreBytes, slideCount, waitForFinalSlideCount } from './support/score';
import { DOCUMENT_OPEN_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS } from './support/timing';

test.use({ viewport: { width: 1280, height: 800 } });

const FIRST = 'first.pdf';
const SECOND = 'second.pdf';
const tabNames = (page: Page) => page.locator('app-tab-bar .name').allTextContents();
const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const shell = (page: Page) => page.locator('app-shell');
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });
/** The stored session is written after the debounce (and at once on pagehide); give it the debounce plus a margin. */
const SESSION_WRITE_MS = TUNABLES.persistence.sessionDebounceMs * 3;

async function openBoth(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles([named(FIRST), named(SECOND)]);
  await expect.poll(() => tabNames(page)).toEqual([FIRST, SECOND]);
}

desktopTest('FIL-011 FIL-012 FIL-013 FIL-014 reloading restores both tabs as needs-reopen; one tap and the file restores the position', async ({ page }) => {
  await forceFileInput(page);
  await page.goto('/');
  await openBoth(page);
  await page.locator('app-tab-bar .name', { hasText: FIRST }).click();
  const count = await waitForFinalSlideCount(page);
  expect(count).toBeGreaterThan(3);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText(`3 / ${count}`);
  await page.waitForTimeout(SESSION_WRITE_MS);

  await page.reload();

  // FIL-011: both tabs are back, the previously active one is selected; FIL-013: the input path keeps no handle.
  await expect.poll(() => tabNames(page)).toEqual([FIRST, SECOND]);
  await expect(page.locator(`app-tab-bar [aria-label="${label('needsReopen')}"]`)).toHaveCount(2);
  await expect(page.locator('app-tab-bar .name[aria-selected="true"]')).toHaveText(FIRST);
  // FIL-012: annotation mode, whatever the previous session was doing.
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');

  // FIL-013: one tap on the marked tab asks for the file; FIL-014: the position is back once detection is final.
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.locator('app-tab-bar .name', { hasText: FIRST }).click();
  await (await chooser).setFiles(named(FIRST));
  await expect(page.locator(`app-tab-bar app-tab-item:has-text("${FIRST}") [aria-label="${label('needsReopen')}"]`)).toHaveCount(0);
  await expect(indicator(page)).toHaveText(new RegExp(`^3 / ${count}$`), { timeout: DOCUMENT_OPEN_TIMEOUT_MS * 4 });
  expect(await slideCount(page)).toBe(count);
  await expect(page.locator(`app-tab-bar [aria-label="${label('needsReopen')}"]`)).toHaveCount(1);
});
