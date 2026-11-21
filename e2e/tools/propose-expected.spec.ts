import { readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';

import { openPdfBytes, systemCountsAt } from '../support/corpus';
import { forceFileInput } from '../support/score';

// Measuring tool of `npm run corpus` (scripts/make-expected.mjs, V2-M2 S2, TST-013), not a test of the app: it only runs when the script
// hands it a list of PDFs, measures the system count per page at the V1 level and writes the numbers. All decisions are made by the script.
const DEV_URL = 'http://127.0.0.1:4174';
const PER_PDF_TIMEOUT_MS = 240_000;
const LEVEL = 'standard';
const inputPath = process.env['CORPUS_PROPOSE_IN'];
const outputPath = process.env['CORPUS_PROPOSE_OUT'];

test.skip(!inputPath || !outputPath, 'only run by npm run corpus');
test.setTimeout(PER_PDF_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'the debug hook is used on desktop Chromium with the development build');
});

const files = inputPath ? (JSON.parse(readFileSync(inputPath, 'utf8')) as { path: string; file: string }[]) : [];
const measured: Record<string, (number | null)[]> = {};

for (const { path, file } of files) {
  test(`TST-013 measure ${file}`, async ({ page }) => {
    await forceFileInput(page);
    await page.goto(DEV_URL);
    await openPdfBytes(page, file, readFileSync(path));
    measured[file] = await systemCountsAt(page, LEVEL, true);
    writeFileSync(outputPath as string, JSON.stringify(measured));
  });
}
