import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { PAID_URL } from './support/editions';
import { closeFileList, currentName, entryButton, expectFiles, fileRows, openFileList, switchTo } from './support/files';
import { clickMode, revealMode } from './support/modes';
import { drag, strokeLine, tool, waitForDrawnSlide } from './support/saving';
import { SCORE_NAME, SCORE_PATH as SCORE, scoreBytes, waitForFinalSlideCount } from './support/score';
import { DOCUMENT_OPEN_TIMEOUT_MS, NEGATIVE_SETTLE_MS } from './support/timing';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;

const RETRY_TIMEOUT_MS = 1000; // one attempt of the repeated mode click
const DAMAGED = 'e2e/fixtures/damaged.pdf';
const SCORE_V2_NAME = `v2-${SCORE_NAME}`;
const named = (name: string) => ({ name, mimeType: 'application/pdf', buffer: scoreBytes });

type Upload = string | { name: string; mimeType: string; buffer: Buffer };

const FILE_CHOOSER_TIMEOUT_MS = 15_000; // fail fast with a clear error instead of hanging until the test timeout

test.beforeEach(async ({ page }) => {
  // Force the <input type="file"> path in every engine.
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
});

async function openFiles(page: Page, files: Upload | Upload[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles(files);
}

const button = (page: Page, key: string) => page.getByRole('button', { name: label(key), exact: true });
const entry = (page: Page) => page.locator('[data-area="top"] app-file-item');
const popup = (page: Page) => page.locator('app-popup-host .popup');
const LONG_PRESS_MARGIN_MS = 200;

/** Holds the mouse button on the open-file button past the long-press time: the desktop equivalent of a long press (UIX-022). */
async function holdOpen(page: Page): Promise<void> {
  await button(page, 'openFile').hover();
  await page.mouse.down();
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await page.mouse.up();
}

async function previewHasInk(page: Page): Promise<boolean> {
  await expect(async () => {
    await clickMode(page, 'modeOrganization');
    await expect(page.getByTestId('org-viewer')).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
  const canvas = page.locator('app-organization-viewer canvas[style*="visibility: visible"]').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    if (!data) {
      return false;
    }
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 128 && (data[i + 3] ?? 0) > 0) {
        return true;
      }
    }
    return false;
  });
}

test.describe('expanded', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('FIL-001 FIL-021 FIL-025 opening a PDF with the open button shows its entry and renders page 1', async ({ page }) => {
    await openFiles(page, SCORE);
    await expect(currentName(page)).toHaveText(SCORE_NAME);
    await expect(entry(page).getByRole('button', { name: label('closeTab'), exact: true })).toBeVisible();
    await expect(page.locator('app-tab-bar, [role="tablist"]')).toHaveCount(0); // FIL-023: no tab bar
    const first = page.locator('[data-area="top"] button').first(); // FIL-025: open file is leftmost
    await expect(first).toHaveAccessibleName(label('openFile'));
    expect(await previewHasInk(page)).toBe(true);
  });

  test('FIL-002 opening the same file again keeps one file', async ({ page }) => {
    await openFiles(page, SCORE);
    await expect(currentName(page)).toHaveText(SCORE_NAME);
    await openFiles(page, SCORE);
    await page.waitForTimeout(NEGATIVE_SETTLE_MS); // absence of a second file: nothing to wait for but a grace period
    await expectFiles(page, [SCORE_NAME]);
  });

  test('FIL-001 FIL-005 FIL-023 FIL-024 FIL-028 three files: previous, next and the list switch between them', async ({ page }) => {
    const names = ['c.pdf', 'a.pdf', 'b.pdf'];
    await openFiles(page, names.map(named));
    await expect(currentName(page)).toHaveText('b.pdf');
    await expect(button(page, 'nextFile')).toHaveAttribute('aria-disabled', 'true');
    await button(page, 'previousFile').click();
    await expect(currentName(page)).toHaveText('a.pdf');
    await button(page, 'previousFile').click();
    await expect(currentName(page)).toHaveText('c.pdf');
    await expect(button(page, 'previousFile')).toHaveAttribute('aria-disabled', 'true');
    await button(page, 'nextFile').click();
    await expect(currentName(page)).toHaveText('a.pdf');
    await expectFiles(page, names);
    await switchTo(page, 'c.pdf');
    expect(await previewHasInk(page)).toBe(true);
    await expectFiles(page, names);
  });

  test('FIL-009 a damaged PDF opens with an error marker and the app stays usable', async ({ page }) => {
    await openFiles(page, DAMAGED);
    await expect(currentName(page)).toHaveText('damaged.pdf');
    await expect(entry(page).getByLabel(label('errorInvalid'), { exact: true })).toBeVisible({ timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    await openFiles(page, SCORE);
    await expectFiles(page, ['damaged.pdf', SCORE_NAME]);
    expect(await previewHasInk(page)).toBe(true);
  });

  for (const fixture of ['zero-pages.pdf', 'blank-page.pdf', 'encrypted.pdf']) {
    test(`FIL-009 TST-016 the failure-case fixture ${fixture} opens and the app stays usable`, async ({ page }) => {
      await openFiles(page, `e2e/fixtures/${fixture}`);
      await expect(currentName(page)).toHaveText(fixture);
      await openFiles(page, SCORE);
      await expectFiles(page, [fixture, SCORE_NAME]);
      expect(await previewHasInk(page)).toBe(true);
    });
  }

  test('FIL-021 FIL-023 closing from the entry and from the list removes files and makes a neighbor current', async ({ page }) => {
    await openFiles(page, ['a.pdf', 'b.pdf', 'c.pdf'].map(named));
    await expect(currentName(page)).toHaveText('c.pdf');
    await entry(page).getByRole('button', { name: label('closeTab'), exact: true }).click();
    await expect(currentName(page)).toHaveText('b.pdf');
    await openFileList(page);
    await fileRows(page).filter({ hasText: 'a.pdf' }).getByRole('button', { name: label('closeTab'), exact: true }).click();
    await expect(fileRows(page)).toHaveCount(1);
    await fileRows(page).getByRole('button', { name: label('closeTab'), exact: true }).click();
    await expect(popup(page)).toHaveCount(0);
    await expect(entry(page)).toHaveCount(0);
    await expect(button(page, 'previousFile')).toHaveAttribute('aria-disabled', 'true');
  });

  test('FIL-007 FIL-009 document controls follow the current file status', async ({ page }) => {
    // The pen button depends on the document only; undo is also disabled while there is nothing to undo (ANN-006, M14).
    const control = page.getByRole('button', { name: label('pen'), exact: true }).first();
    await expect(control).toHaveAttribute('aria-disabled', 'true');
    await openFiles(page, SCORE);
    await expect(control).not.toHaveAttribute('aria-disabled', 'true', { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    await openFiles(page, DAMAGED);
    await expect(control).toHaveAttribute('aria-disabled', 'true', { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
  });

  test('FIL-027 FIL-028 the list of 30 files spans the full width, keeps the opening order and scrolls', async ({ page }) => {
    const names = Array.from({ length: 30 }, (_, i) => `score-${i}.pdf`);
    await openFiles(page, names.map(named));
    await expect(currentName(page)).toHaveText('score-29.pdf', { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    await openFileList(page);
    await expect(fileRows(page).locator('.text')).toHaveText(names);
    const box = (await popup(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(1280 - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(800 + 1);
    const list = page.locator('app-popup-host .list');
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await fileRows(page).first().locator('.name').click(); // scrolls to the first row
    await expect(currentName(page)).toHaveText('score-0.pdf');
  });

  test('FIL-027 the entry takes the remaining width and shortens a name only when it does not fit', async ({ page }) => {
    const long = `${'a very long score name '.repeat(8)}.pdf`;
    await openFiles(page, named('short.pdf'));
    await expect(currentName(page)).toHaveText('short.pdf');
    const shortened = () => currentName(page).evaluate((el) => el.scrollWidth > el.clientWidth);
    const width = async () => (await entry(page).boundingBox())!.width;
    expect(await shortened()).toBe(false);
    await currentName(page).hover();
    await expect(page.locator('[data-area="top"] [title]')).toHaveCount(0); // no hover text while the whole name shows
    const free = await width();
    const used = (await page.locator('[data-area="top"] button').evaluateAll((els) =>
      els.filter((el) => !el.closest('app-file-item')).reduce((sum, el) => sum + el.getBoundingClientRect().width, 0),
    ));
    expect(free).toBeGreaterThanOrEqual(1280 - used - 2);
    await openFiles(page, named(long));
    await expect(currentName(page)).toHaveText(long);
    expect(await shortened()).toBe(true);
    await page.mouse.move(0, 400);
    await currentName(page).hover();
    await expect(currentName(page)).toHaveAttribute('title', long);
    expect(Math.abs((await width()) - free)).toBeLessThan(2);
  });

  test('FIL-021 FIL-022 UIX-027 the "*" ends the name; the tooltips of the entry lie above the page and are not bold', async ({ page }, testInfo) => {
    test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name), 'mouse input: desktop projects');
    await openFiles(page, SCORE);
    await waitForFinalSlideCount(page);
    await waitForDrawnSlide(page);
    await tool(page, 'pen').click();
    const line = await strokeLine(page);
    await drag(page, line.from, line.to);
    const star = entry(page).getByLabel(label('unsaved'), { exact: true });
    await expect(star).toHaveText(TUNABLES.layout.unsavedMarkText);
    const gap = (await star.boundingBox())!.x - ((await currentName(page).boundingBox())!.x + (await currentName(page).boundingBox())!.width);
    expect(Math.abs(gap)).toBeLessThan(1);
    // the "*", the lock (read-only through the file input) and the close icon
    const controls = entry(page).locator('.marker, button.close');
    for (let i = 0; i < (await controls.count()); i++) {
      await controls.nth(i).hover();
      const tooltip = controls.nth(i).locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      const state = await tooltip.evaluate((element: HTMLElement) => {
        element.style.pointerEvents = 'auto'; // to be found by hit testing
        const rect = element.getBoundingClientRect();
        const top = element.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        element.style.pointerEvents = '';
        return { onTop: top === element, weight: element.ownerDocument.defaultView!.getComputedStyle(element).fontWeight };
      });
      expect(state).toEqual({ onTop: true, weight: '400' });
      await page.mouse.move(0, 700);
      await expect(tooltip).toHaveCount(0);
    }
  });

  test('EDN-017 FIL-026 UIX-022 free edition: holding the open button shows the files of this run; a right click does nothing', async ({ page }, testInfo) => {
    test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name), 'mouse input: desktop projects');
    await openFiles(page, SCORE);
    await expect(currentName(page)).toHaveText(SCORE_NAME);
    await button(page, 'openFile').click({ button: 'right' });
    await expect(popup(page)).toHaveCount(0);
    await holdOpen(page);
    await expect(page.locator('[data-popup] .row')).toHaveText([SCORE_NAME]);
  });
});

test.describe('paid edition: recent files', () => {
  test.use({ viewport: { width: 1280, height: 800 }, baseURL: PAID_URL });

  test('FIL-008 FIL-026 UIX-022 holding the open button shows opened files, and a lost file offers the picker on a second tap', async ({ page }, testInfo) => {
    test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name), 'mouse input: desktop projects');
    await openFiles(page, [SCORE, DAMAGED]);
    await expectFiles(page, [SCORE_NAME, 'damaged.pdf']);
    await button(page, 'openFile').click({ button: 'right' });
    await expect(popup(page)).toHaveCount(0);
    await holdOpen(page);
    const rows = page.locator('[data-popup] .row');
    await expect(rows).toHaveText(['damaged.pdf', SCORE_NAME]);
    // The <input> path stores no handle: the first tap cannot reopen, so the entry is marked ...
    await rows.filter({ hasText: SCORE_NAME }).click();
    await expect(rows.filter({ hasText: SCORE_NAME }).locator('app-icon')).toBeVisible();
    // ... and the second tap offers the picker.
    const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
    await rows.filter({ hasText: SCORE_NAME }).click();
    await (await chooser).setFiles(named(SCORE_V2_NAME));
    await expect(currentName(page)).toHaveText(SCORE_V2_NAME);
    await holdOpen(page);
    await expect(page.locator('[data-popup] .row')).toHaveText([SCORE_V2_NAME, 'damaged.pdf']);
  });
});

for (const width of [TUNABLES.layout.minSupportedWidthPx, 360]) {
  test.describe(`narrow, ${width}px`, () => {
    test.use({ viewport: { width, height: 700 } });

    test(`UIX-016 UIX-037 FIL-021 FIL-023 at ${width}px the entry and every top-bar button fit; list and mode choice work`, async ({ page }) => {
      await openFiles(page, [named(SCORE_NAME), named('second.pdf')]);
      await expect(currentName(page)).toHaveText('second.pdf');
      const boxes = await page
        .locator('[data-area="top"] button:not(.name, .rest, .lock)')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      await expect(button(page, 'previousFile')).toHaveCount(0); // FIL-024: narrow screens switch through the list
      await expect(button(page, 'nextFile')).toHaveCount(0);
      await expect(entry(page).locator('button.close')).toHaveCount(0); // FIL-021: closing is in the list
      expect(boxes).toHaveLength(3); // open, mode, settings
      const widthOf = async (part: string) => (await entry(page).locator(part).boundingBox())?.width ?? 0;
      // the name and the free space after it are one tap target
      expect((await widthOf('.name')) + (await widthOf('.rest'))).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.width).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
        expect(box.height).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
      }
      await switchTo(page, SCORE_NAME);
      await openFileList(page);
      await expect(fileRows(page).locator('button.close')).toHaveCount(2);
      expect((await popup(page).boundingBox())!.width).toBeGreaterThanOrEqual(width - 1);
      await expect(fileRows(page).locator('button.close')).toHaveCount(2); // every width closes from the list
      await closeFileList(page);
      await expect(await revealMode(page, 'modeOrganization')).toBeVisible();
      await clickMode(page, 'modeOrganization');
      await expect(popup(page)).toHaveCount(0);
      await expect(page.locator('app-shell')).toHaveAttribute('data-mode', 'organization');
    });
  });
}

test.describe('the narrow limit', () => {
  test('UIX-037 below 600 px one mode button, from 600 px three', async ({ page }) => {
    const limit = TUNABLES.layout.compactMaxWidthPx;
    await page.setViewportSize({ width: limit - 1, height: 800 });
    await expect(button(page, 'modeSwitch')).toBeVisible();
    await expect(button(page, 'modeAnnotation')).toHaveCount(0);
    await page.setViewportSize({ width: limit, height: 800 });
    await expect(button(page, 'modeAnnotation')).toBeVisible();
    await expect(button(page, 'modeSwitch')).toHaveCount(0);
    await expect(entryButton(page)).toHaveCount(0);
  });
});
