import { expect, type Locator, type Page } from '@playwright/test';

/** The name button of the file entry in the top bar (FIL-021). */
export const entryButton = (page: Page): Locator => page.locator('[data-area="top"] app-file-item .name');
export const currentName = (page: Page): Locator => entryButton(page).locator('.text');
/** The rows of the open file list (FIL-023). */
export const fileRows = (page: Page): Locator => page.locator('app-popup-host app-file-item');

export async function openFileList(page: Page): Promise<void> {
  if ((await fileRows(page).count()) === 0) {
    await entryButton(page).click();
  }
  await expect(fileRows(page).first()).toBeVisible();
}

export async function closeFileList(page: Page): Promise<void> {
  await entryButton(page).click();
  await expect(fileRows(page)).toHaveCount(0);
}

/** Expects the open files in opening order, read from the file list, which is closed again. */
export async function expectFiles(page: Page, names: string[]): Promise<void> {
  await openFileList(page);
  await expect(fileRows(page).locator('.text')).toHaveText(names);
  await closeFileList(page);
}

/** Makes a file current through the list; choosing a row closes the list. */
export async function switchTo(page: Page, name: string): Promise<void> {
  await openFileList(page);
  await fileRows(page).locator('.name', { hasText: name }).click();
  await expect(fileRows(page)).toHaveCount(0);
  await expect(currentName(page)).toHaveText(name);
}
