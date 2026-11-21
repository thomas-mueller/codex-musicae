import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';

import { openPdfBytes, pageCountOf, systemCountsAt } from '../support/corpus';
import { STRESS_MIN_PAGES } from '../../scripts/lib/corpus-files.mjs';
import { forceFileInput } from '../support/score';
import { detectionRunTimeoutMs } from '../support/timing';

// Measuring tool of `npm run corpus` (scripts/make-expected.mjs, V2-M2 S2, TST-013), not a test of the app: it only runs when the script
// hands it a list of PDFs, measures the system count per page at the V1 level and writes the numbers. All decisions are made by the script.
const DEV_URL = 'http://127.0.0.1:4174';
/** Opening, start-up and writing; the detection runs come on top, scaled by the page count (real scores can have hundreds of pages). */
const PER_PDF_BASE_TIMEOUT_MS = 60_000;
const DETECTION_RUNS = 2; // a new document starts at the default level; the proposal is made at LEVEL
const LEVEL = 'standard';
const inputPath = process.env['CORPUS_PROPOSE_IN'];
const outputPath = process.env['CORPUS_PROPOSE_OUT'];

test.skip(!inputPath || !outputPath, 'only run by npm run corpus');
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'the debug hook is used on desktop Chromium with the development build');
});

/** A failed test restarts the worker: merge into the file instead of keeping the results in memory. */
function record(file: string, value: unknown): void {
  const done = existsSync(outputPath as string) ? (JSON.parse(readFileSync(outputPath as string, 'utf8')) as Record<string, unknown>) : {};
  writeFileSync(outputPath as string, JSON.stringify({ ...done, [file]: value }));
}

const files = inputPath ? (JSON.parse(readFileSync(inputPath, 'utf8')) as { path: string; file: string }[]) : [];

for (const { path, file } of files) {
  test(`TST-013 measure ${file}`, async ({ page }) => {
    await forceFileInput(page);
    await page.goto(DEV_URL);
    await openPdfBytes(page, file, readFileSync(path));
    // A new document starts at the default level and a re-run request before it is open is dropped: wait for the first run, then re-run.
    const pages = await pageCountOf(page);
    if (pages > STRESS_MIN_PAGES) {
      // A stress file is not run through detection here: only its page count is needed.
      record(file, { stress: true, pages });
      return;
    }
    const wait = detectionRunTimeoutMs(pages);
    test.setTimeout(PER_PDF_BASE_TIMEOUT_MS + DETECTION_RUNS * wait);
    await systemCountsAt(page, 'fast', false, wait);
    const counts = await systemCountsAt(page, LEVEL, true, wait);
    record(file, counts);
  });
}
