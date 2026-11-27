import { expect } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { forceFilePaths, openMoreIfCompact } from './support/saving';
import { label, openScore, forceFileInput, waitForFinalSlideCount } from './support/score';

// V2-M3 S2, default base URL: the free web build (every paid switch off).

desktopTest('EDN-001 EDN-003 EDN-011 free edition: save a copy is visible but disabled and nothing is downloaded or written', async ({ page }) => {
  await forceFileInput(page);
  await forceFilePaths(page);
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  await openScore(page);
  await waitForFinalSlideCount(page);
  await openMoreIfCompact(page);
  const copy = page.getByRole('button', { name: label('saveCopy'), exact: true });
  await expect(copy).toBeVisible();
  await expect(copy).toHaveAttribute('aria-disabled', 'true');
  await copy.click({ force: true });
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
