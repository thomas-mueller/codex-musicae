import { expect, test, type Locator, type Page } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { PAID_URL } from './support/editions';
import { readTranslations } from './support/fit';
import { label, openScore, openScoreInAnnotation, waitForFinalSlideCount } from './support/score';

const shell = (page: Page): Locator => page.locator('app-shell');
const button = (page: Page, key: string): Locator => page.getByRole('button', { name: label(key), exact: true });
const GROUPS = ['general', 'display', 'slideMode', 'files'];
const LONG_PRESS_MARGIN_MS = 200;
/** Far below the seconds a request took while a first visit's service worker was installing. */
const SWITCH_TIMEOUT_MS = 2_000;
const PICKED_COLOR = 3;
const DEFAULT_COLOR = (TUNABLES.colors.penPresets as readonly string[]).indexOf(TUNABLES.annotation.defaultPen.color);

const swatch = (page: Page, index: number): Locator => page.locator('app-tool-popup .swatch').nth(index);

/** The V1 pen popup, by long press on the pen button of the tool strip (desktop layout). */
async function openPenPopup(page: Page): Promise<void> {
  await button(page, 'pen').hover();
  await page.mouse.down();
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await page.mouse.up();
  await expect(page.locator('app-tool-popup')).toBeVisible();
}

async function expectPenColor(page: Page, index: number): Promise<void> {
  await openPenPopup(page);
  await expect(swatch(page, index)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('app-tool-popup')).toHaveCount(0);
}

async function choosePenColor(page: Page, index: number): Promise<void> {
  await openPenPopup(page);
  await swatch(page, index).click();
  await expect(swatch(page, index)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
}

/** Settings button, "Reset all settings", then the dialog's answer, and back to the score. */
async function resetAllSettings(page: Page, answer: 'cancel' | 'confirm'): Promise<void> {
  await button(page, 'settings').click();
  await button(page, 'resetSettings').click();
  await page.getByTestId(`reset-${answer}`).click();
  await expect(page.getByTestId('reset-dialog')).toHaveCount(0);
  await button(page, 'settings').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
}

desktopTest('UIX-023 free web: reset asks first and puts the pen color back for the session', async ({ page }) => {
  await openScoreInAnnotation(page);
  await choosePenColor(page, PICKED_COLOR);
  await resetAllSettings(page, 'cancel');
  await expectPenColor(page, PICKED_COLOR);
  await resetAllSettings(page, 'confirm');
  await expectPenColor(page, DEFAULT_COLOR);
});

test.describe('paid build', () => {
  test.use({ baseURL: PAID_URL });

  desktopTest('UIX-023 EDN-008 paid: a confirmed reset is still in effect after a reload', async ({ page }) => {
    await openScoreInAnnotation(page);
    await choosePenColor(page, PICKED_COLOR);
    await page.reload();
    await openScore(page);
    await waitForFinalSlideCount(page);
    await expectPenColor(page, PICKED_COLOR); // stored, so there is something to reset
    await resetAllSettings(page, 'confirm');
    await expectPenColor(page, DEFAULT_COLOR);
    await page.reload();
    await openScore(page);
    await waitForFinalSlideCount(page);
    await expectPenColor(page, DEFAULT_COLOR);
  });
});

test.describe('reset dialog at the minimum supported width', () => {
  test.use({ viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  test('UIX-016 UIX-023 the reset dialog fits the screen and cancel closes it', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await button(page, 'settings').click();
    await expect(button(page, 'resetSettings')).toBeInViewport({ ratio: 1 });
    await button(page, 'resetSettings').click();
    for (const id of ['reset-dialog', 'reset-cancel', 'reset-confirm']) {
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    }
    expect(await page.getByTestId('reset-dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByTestId('reset-cancel').click();
    await expect(page.getByTestId('reset-dialog')).toHaveCount(0);
    await expect(shell(page)).toHaveAttribute('data-mode', 'settings');
  });
});

test('UIX-025 UIX-026 the settings button opens the four groups and returns to the previous mode', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await button(page, 'modeOrganization').click();
  await button(page, 'settings').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'settings');
  await expect(page.locator('app-settings-view section h2')).toHaveCount(GROUPS.length);
  expect(await page.locator('app-settings-view section').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))).toEqual(GROUPS);
  await expect(page.locator('app-tool-area')).toHaveCount(0);
  await expect(page.locator('[data-area="bottom"]')).toBeHidden();
  await button(page, 'settings').click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'organization');
  await expect(page.locator('[data-area="bottom"]')).toBeVisible();
});

desktopTest('UIX-025 NAV-018 PageDown changes no slide in the settings and Escape returns to the score', async ({ page }) => {
  await openScoreInAnnotation(page);
  const indicator = page.locator('[data-area="bottom"] .indicator');
  await expect(indicator).toHaveText(/^1\D/);
  const before = await indicator.textContent();
  await button(page, 'settings').click();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
  await expect(page.locator('app-slide-view')).toBeVisible();
  await expect(indicator).toHaveText(before ?? '');
});

test.describe('at the minimum supported width', () => {
  test.use({ viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  test('UIX-016 UIX-025 UIX-034 every top-bar button is fully visible and touch-sized in every mode', async ({ page }) => {
    await page.goto('/');
    for (const mode of ['modeAnnotation', 'modeOrganization', 'settings']) {
      await button(page, mode).click();
      const boxes = await page.locator('[data-area="top"] button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      expect(boxes.length, mode).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.left, mode).toBeGreaterThanOrEqual(0);
        expect(box.right, mode).toBeLessThanOrEqual(TUNABLES.layout.minSupportedWidthPx);
        expect(box.width, mode).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
      }
      await expect(page.locator('[data-area="top"]').getByLabel(label('undo'), { exact: true })).toHaveCount(0);
    }
  });
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 800, height: 360 },
]) {
  test.describe(`compact ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`UIX-033 UIX-034 the tool popup holds undo and redo and fits the screen at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openScoreInAnnotation(page);
      await expect(button(page, 'undo')).toHaveCount(0);
      const fab = button(page, 'toolFab');
      const closed = await fab.boundingBox();
      await fab.click();
      const popup = page.locator('app-tool-area [data-popup]');
      for (const key of ['pen', 'highlighter', 'eraser', 'undo', 'redo']) {
        await expect(popup.getByRole('button', { name: label(key), exact: true })).toBeInViewport({ ratio: 1 });
      }
      await expect(button(page, 'undo')).toHaveAttribute('aria-disabled', 'true');
      await expect(button(page, 'redo')).toHaveAttribute('aria-disabled', 'true');
      const opened = await fab.boundingBox();
      expect(opened?.x).toBeCloseTo(closed?.x ?? Number.NaN, 0); // the wider popup does not move the button
    });

    desktopTest(`UIX-033 undo and redo in the tool popup act on a drawn stroke at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openScoreInAnnotation(page);
      await button(page, 'toolFab').click();
      await button(page, 'pen').click();
      await expect(button(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
      await button(page, 'toolFab').click(); // a pointer on the stage while a popup is open only closes the popup (V1)
      await expect(page.locator('app-tool-area [data-popup]')).toHaveCount(0);
      const slide = await page.getByTestId('slide-canvas').boundingBox();
      const start = { x: (slide?.x ?? 0) + (slide?.width ?? 0) * 0.5, y: (slide?.y ?? 0) + (slide?.height ?? 0) * 0.25 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + (slide?.width ?? 0) * 0.2, start.y + 10, { steps: 10 });
      await page.mouse.up();
      await button(page, 'toolFab').click();
      await expect(button(page, 'undo')).not.toHaveAttribute('aria-disabled', 'true');
      await button(page, 'undo').click();
      await expect(button(page, 'undo')).toHaveAttribute('aria-disabled', 'true');
      await button(page, 'redo').click();
      await expect(button(page, 'undo')).not.toHaveAttribute('aria-disabled', 'true');
      await expect(button(page, 'redo')).toHaveAttribute('aria-disabled', 'true');
    });
  });
}

const translations = (language: string) => readTranslations(language) as unknown as {
  a11y: Record<string, string>;
  settings: { groups: Record<string, string> };
};
const en = translations('en');
const de = translations('de');
const headings = (page: Page) => page.locator('app-settings-view h2');
const languageSelect = (page: Page) => page.locator('[data-setting="language"] select');
const german = (page: Page, key: string) => page.getByRole('button', { name: de.a11y[key], exact: true });

async function expectLanguage(page: Page, texts: typeof en, language: string): Promise<void> {
  await expect(headings(page)).toHaveText(Object.values(texts.settings.groups));
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

for (const [locale, texts, language] of [
  ['de-AT', de, 'de'],
  ['sv-SE', en, 'en'],
] as const) {
  test.describe(`system language ${locale}`, () => {
    test.use({ locale });

    test(`I18-004 a ${locale} system starts in ${language}`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: texts.a11y['settings'], exact: true }).click();
      await expectLanguage(page, texts, language);
      await expect(languageSelect(page)).toHaveValue('system');
    });
  });
}

test('I18-004 EDN-005 free web: a chosen language applies at once and is gone after a reload', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await button(page, 'settings').click();
  await expectLanguage(page, en, 'en');
  await languageSelect(page).selectOption('de');
  await expectLanguage(page, de, 'de');
  await expect(german(page, 'openFile')).toBeVisible();
  await page.reload();
  await button(page, 'settings').click();
  await expectLanguage(page, en, 'en');
});

// the service worker is on and nothing waits for it: on a first visit it is still installing
test('I18-004 on a first visit a chosen language applies at once, without a request', { tag: '@smoke' }, async ({ page, context }) => {
  await page.goto('/');
  await button(page, 'settings').click();
  await expectLanguage(page, en, 'en');
  const requests: string[] = [];
  // requests of the page only: Chromium also reports the service worker filling its cache
  context.on('request', (request) => {
    if (request.url().includes('/assets/i18n/') && request.serviceWorker() === null) {
      requests.push(request.url());
    }
  });
  await languageSelect(page).selectOption('de');
  await expect(headings(page).first()).toHaveText(de.settings.groups['general']!, { timeout: SWITCH_TIMEOUT_MS });
  expect(requests).toEqual([]);
});

test.describe('paid build, language', () => {
  test.use({ baseURL: PAID_URL });

  test('I18-004 UIX-023 EDN-008 paid: German survives a reload until "Reset all settings"', async ({ page }) => {
    await page.goto('/');
    await button(page, 'settings').click();
    await languageSelect(page).selectOption('de');
    await expectLanguage(page, de, 'de');
    await page.reload();
    await german(page, 'settings').click();
    await expectLanguage(page, de, 'de');
    await expect(languageSelect(page)).toHaveValue('de');
    await german(page, 'resetSettings').click();
    await page.getByTestId('reset-confirm').click();
    await expectLanguage(page, en, 'en');
    await expect(languageSelect(page)).toHaveValue('system');
    await page.reload();
    await button(page, 'settings').click();
    await expectLanguage(page, en, 'en');
  });
});

