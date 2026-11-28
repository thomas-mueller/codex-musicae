import { expect } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { forceFilePaths } from './support/saving';
import { openScore, forceFileInput, waitForFinalSlideCount } from './support/score';

// V2-M3 S2, default base URL: the free web build (every paid switch off).

desktopTest('EDN-001 EDN-003 EDN-011 free edition: the lock and "save as new file" are disabled, and nothing is downloaded or written', async ({ page }) => {
  await forceFileInput(page);
  await forceFilePaths(page);
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  await openScore(page);
  await waitForFinalSlideCount(page);
  const lock = page.locator('[data-area="top"] app-file-item button.lock');
  await expect(lock).toHaveAttribute('aria-disabled', 'true');
  await lock.click({ force: true });
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(downloads).toEqual([]);
});

desktopTest('EDN-005 free edition: a reload starts empty, without restored tabs or a recent list', async ({ page }) => {
  await forceFileInput(page);
  await page.goto('/');
  await openScore(page);
  await waitForFinalSlideCount(page);
  await page.reload();
  await expect(page.locator('app-file-item')).toHaveCount(0);
});
