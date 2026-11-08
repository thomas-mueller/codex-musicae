import { expect, test, type Page } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { isFullscreen, leavePresentationWithEscape, modeButton, recordWakeLock, rejectFullscreenRequests, removeFullscreenAndWakeLock, wakeLog } from './support/fullscreen';
import { openScoreInAnnotation } from './support/score';

test.use({ viewport: { width: 1280, height: 800 } });

const shell = (page: Page) => page.locator('app-shell');

test('PLT-004 PLT-005 chromium: a click enters fullscreen; Esc leaves it and returns to annotation mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Fullscreen API with a synthetic click: Chromium');
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect.poll(() => isFullscreen(page)).toBe(true);
  await leavePresentationWithEscape(page);
  await expect.poll(() => isFullscreen(page)).toBe(false);
});

test('PLT-004 chromium: the center tap leaves fullscreen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Fullscreen API with a synthetic click: Chromium');
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect.poll(() => isFullscreen(page)).toBe(true);
  const box = (await page.locator('app-canvas-area .content').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
  await expect.poll(() => isFullscreen(page)).toBe(false);
});

desktopTest('PLT-005 the wake lock is acquired on entering presentation and released on leaving', async ({ page }) => {
  await recordWakeLock(page);
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect.poll(() => wakeLog(page)).toEqual(['acquire']);
  await leavePresentationWithEscape(page);
  await expect.poll(() => wakeLog(page)).toEqual(['acquire', 'release']);
});

desktopTest('PLT-004 PLT-005 without Fullscreen and Wake Lock APIs presentation mode still opens', async ({ page }) => {
  await removeFullscreenAndWakeLock(page);
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await leavePresentationWithEscape(page);
});

test('PLT-004 chromium: the center tap enters fullscreen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Fullscreen API with a synthetic click: Chromium');
  await openScoreInAnnotation(page);
  const box = (await page.locator('app-canvas-area .content').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect.poll(() => isFullscreen(page)).toBe(true);
});

test('PLT-016 chromium: a refused options request falls back to the plain request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Fullscreen API with a synthetic click: Chromium');
  await rejectFullscreenRequests(page, { onlyWithOptions: true });
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect.poll(() => isFullscreen(page)).toBe(true);
  await leavePresentationWithEscape(page);
  await expect.poll(() => isFullscreen(page)).toBe(false);
});

test('PLT-016 chromium: a fully refused entry is retried on the next gesture and leaving still works', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Fullscreen API with a synthetic click: Chromium');
  await rejectFullscreenRequests(page, { rejectCalls: 3 });
  await openScoreInAnnotation(page);
  await modeButton(page, 'modePresentation').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => isFullscreen(page)).toBe(true);
  await leavePresentationWithEscape(page);
  await expect.poll(() => isFullscreen(page)).toBe(false);
});
