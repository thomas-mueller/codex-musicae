import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { generatePlayingOrder, systemNumbers } from '../src/app/core/playing-order';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;
const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const FILE_CHOOSER_TIMEOUT_MS = 15_000;
const DETECTION_TIMEOUT_MS = 45_000;
const RETRY_TIMEOUT_MS = 1000;
const TEST_TIMEOUT_MS = 120_000;
const SYNTHETIC_BARS = 15; // 3 pages x (4 systems + 1) bars
const SYSTEMS = 12; // 3 pages x 4 systems
const FIRST_BAR_INDEX = 0; // junction 0, label 1·1
const PAGE1_BOTTOM_BAR_INDEX = 4; // junction 4, label 1·5
const LAST_BAR_INDEX = SYNTHETIC_BARS - 1; // junction 12
const LONG_PRESS_MARGIN_MS = 200;
const SCROLL_TIMEOUT_MS = 5000;
const MIDDLE_BAR_INDEX = 1; // the second bar of page 1: junction 1
const EMPTY_SPACE = { x: 5, y: 300 }; // the grey canvas left of the centered page

test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
});

async function openScoreInOrganization(page: Page): Promise<void> {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles({ name: 'score.pdf', mimeType: 'application/pdf', buffer: scoreBytes });
  await expect(async () => {
    await page.getByLabel(label('modeOrganization'), { exact: true }).click();
    await expect(page.getByTestId('org-viewer')).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
  await expect(page.getByTestId('org-bar')).toHaveCount(SYNTHETIC_BARS, { timeout: DETECTION_TIMEOUT_MS });
}

test('ORG-010 the bars layer stacks above every tile canvas', async ({ page }) => {
  await openScoreInOrganization(page);
  const { overlay, canvases } = await page.evaluate(() => {
    const z = (element: Element): number => Number(getComputedStyle(element).zIndex) || 0;
    const layer = globalThis.document.querySelector('.overlay');
    return { overlay: layer ? z(layer) : -1, canvases: Array.from(globalThis.document.querySelectorAll('app-page-tiles canvas')).map(z) };
  });
  expect(canvases.length).toBeGreaterThan(0);
  expect(overlay).toBeGreaterThan(Math.max(...canvases));
});

test('ORG-013 ORG-014 ORG-022 ORG-023 ORG-024 select a bar, set a break and a stop, delete, deselect', async ({ page }) => {
  await openScoreInOrganization(page);
  const bar = page.getByTestId('org-bar').nth(MIDDLE_BAR_INDEX);
  await bar.click();
  const chip = page.getByTestId('selection-chip');
  await expect(chip).toBeVisible();
  await expect(chip.getByTestId('chip-delete')).toHaveCount(0);

  await chip.getByTestId('chip-break').click();
  await chip.getByTestId('chip-stop').click();
  await expect(bar.getByTestId('org-bar-break-line')).toHaveCount(1);
  await expect(bar.getByTestId('org-bar-break-icon')).toHaveCount(1);
  await expect(bar.getByTestId('org-bar-stop-icon')).toHaveCount(1);
  await expect(bar.getByTestId('org-bar-numbers')).toHaveText('1');

  await chip.getByTestId('chip-delete').click();
  await expect(bar.getByTestId('org-bar-break-line')).toHaveCount(0);
  await expect(bar.getByTestId('org-bar-stop-icon')).toHaveCount(0);

  await page.getByTestId('org-viewer').click({ position: EMPTY_SPACE });
  await expect(chip).toHaveCount(0);

  await bar.click();
  await expect(chip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chip).toHaveCount(0);
});

const junctionLabelText = (page: number, bar: number): string => `${page}${TUNABLES.layout.labelSeparator}${bar}`;

test('ORG-015 ORG-016 ORG-018 ORG-020 create a jump, set the pass, see the badges, edit and delete it', async ({ page }) => {
  await openScoreInOrganization(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await expect(page.getByTestId('org-hint-bar')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('org-hint-bar')).toHaveCount(0);
  await expect(page.getByTestId('jump-badge')).toHaveCount(0);

  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await bars.nth(FIRST_BAR_INDEX).click();
  await expect(page.getByTestId('stepper-value')).toHaveText('1');
  await page.getByTestId('stepper-plus').click();
  await expect(page.getByTestId('stepper-value')).toHaveText('2');

  const order = generatePlayingOrder({ systemCount: SYSTEMS, jumps: [{ origin: PAGE1_BOTTOM_BAR_INDEX, target: 0, pass: 2 }], stops: [], maxLength: TUNABLES.playingOrder.maxLength });
  const numbers = systemNumbers(order, SYSTEMS)[PAGE1_BOTTOM_BAR_INDEX - 1]!.join(TUNABLES.layout.numberSeparator);
  const origin = bars.nth(PAGE1_BOTTOM_BAR_INDEX);
  await expect(origin.getByTestId('org-bar-numbers')).toHaveText(numbers);
  await expect(origin.getByTestId('jump-badge')).toContainText(junctionLabelText(1, 1));
  await expect(origin.getByTestId('jump-badge')).toContainText(`${TUNABLES.layout.passPrefix}2`);
  await expect(bars.nth(FIRST_BAR_INDEX).getByTestId('jump-badge')).toContainText(junctionLabelText(1, PAGE1_BOTTOM_BAR_INDEX + 1));

  await origin.getByTestId('jump-badge').click();
  await expect(chip.getByTestId('chip-pass')).toBeVisible();
  await expect(chip.getByTestId('chip-change-target')).toBeVisible();
  await chip.getByTestId('chip-change-target').click();
  await bars.nth(1).click();
  await expect(origin.getByTestId('jump-badge')).toContainText(junctionLabelText(1, 2));

  await origin.getByTestId('jump-badge').click();
  await chip.getByTestId('chip-delete').click();
  await expect(page.getByTestId('jump-badge')).toHaveCount(0);
});

test('ORG-019 a long press on a badge scrolls to the other end of the jump', async ({ page }) => {
  await openScoreInOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  const bars = page.getByTestId('org-bar');
  await bars.nth(FIRST_BAR_INDEX).click();
  await page.getByTestId('selection-chip').getByTestId('chip-jump').click();
  await viewer.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await bars.nth(LAST_BAR_INDEX).click(); // picking works across pages
  await expect(page.getByTestId('stepper-value')).toHaveText('1');
  await page.keyboard.press('Escape');
  await viewer.evaluate((element) => {
    element.scrollTop = 0;
  });
  const badge = bars.nth(FIRST_BAR_INDEX).getByTestId('jump-badge');
  // Dispatched pointer events: Playwright's mouse API sends none on emulated-touch Firefox.
  await badge.dispatchEvent('pointerdown');
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await badge.dispatchEvent('pointerup');
  await expect.poll(() => viewer.evaluate((element) => element.scrollTop), { timeout: SCROLL_TIMEOUT_MS }).toBeGreaterThan(0);
});
