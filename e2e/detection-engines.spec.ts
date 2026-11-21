import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

import { resolveCorpusEntry } from '../scripts/lib/corpus-files.mjs';
import { openPdfBytes, pageCountOf, systemCountsAt, type CorpusLevel } from './support/corpus';
import { forceFileInput } from './support/score';
import { detectionRunTimeoutMs } from './support/timing';

// NFR-025, DET-013: detection must not depend on the browser. Every corpus PDF that is not a stress file is detected in Chromium, Firefox and
// WebKit (the development build carries the hook) and must give the systems per page of its entry in expected.json, whether that entry is
// reviewed yet or not: the same numbers in every engine.
const DEV_URL = 'http://127.0.0.1:4174';
const BASE_TIMEOUT_MS = 120_000;
const DESKTOP_PROJECTS = ['chromium', 'firefox', 'webkit'];

interface Entry {
  file: string;
  level: CorpusLevel;
  systemsPerPage: number[];
  stress?: boolean;
}

const entries = (JSON.parse(readFileSync('e2e/corpus/expected.json', 'utf8')) as Entry[]).filter((entry) => entry.stress !== true);

for (const entry of entries) {
  test(`DET-013 NFR-025 TST-015 ${entry.file} gives the same systems per page in every browser`, async ({ page }, testInfo) => {
    test.skip(!DESKTOP_PROJECTS.includes(testInfo.project.name), 'the three desktop engines');
    const found = resolveCorpusEntry({ entry, exists: existsSync });
    test.skip(found.path === null, `file missing: ${found.reason}`);
    test.setTimeout(BASE_TIMEOUT_MS + 2 * detectionRunTimeoutMs(entry.systemsPerPage.length));
    await forceFileInput(page);
    await page.goto(DEV_URL);
    await openPdfBytes(page, entry.file, readFileSync(found.path as string));
    const wait = detectionRunTimeoutMs(await pageCountOf(page));
    await systemCountsAt(page, 'fast', false, wait);
    const counts = await systemCountsAt(page, entry.level, true, wait);
    expect(counts).toEqual(entry.systemsPerPage);
  });
}
