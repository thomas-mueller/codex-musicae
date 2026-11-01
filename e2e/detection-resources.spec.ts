import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const scoreBytes = readFileSync('e2e/fixtures/synthetic-score.pdf');
const OPENCV_ASSET = '/assets/opencv/opencv.js';
const FILE_CHOOSER_TIMEOUT_MS = 15_000;
const DETECTION_WAIT_MS = 30_000;
const SETTLE_MS = 3_000; // lets the three pages of the synthetic score finish; no detection UI exists before M10 S4
const TEST_TIMEOUT_MS = 90_000;

test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'detection run checked on desktop Chromium');
});

test('M10-S3 DET-002 the production build detects in the background and logs nothing', async ({ page }) => {
  const messages: string[] = [];
  const errors: string[] = [];
  page.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: en.a11y['openFile'] as string, exact: true }).click();
  const opencv = page.waitForResponse((r) => r.url().endsWith(OPENCV_ASSET), { timeout: DETECTION_WAIT_MS });
  await (await chooser).setFiles({ name: 'score.pdf', mimeType: 'application/pdf', buffer: scoreBytes });
  expect((await opencv).ok()).toBe(true); // detection started by itself after opening
  await page.waitForTimeout(SETTLE_MS);
  expect(errors).toEqual([]);
  expect(messages).toEqual([]);
});
