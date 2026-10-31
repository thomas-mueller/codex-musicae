import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;
const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const FILE_CHOOSER_TIMEOUT_MS = 15_000;
const DETECTION_TIMEOUT_MS = 45_000;
const RETRY_TIMEOUT_MS = 1000;
const TEST_TIMEOUT_MS = 120_000;
const SYNTHETIC_BARS = 15; // 3 pages x (4 systems + 1) bars
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
