import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

import { resolveCorpusEntry, smokeEntries, STRESS_MIN_PAGES } from '../scripts/lib/corpus-files.mjs';

import { CORPUS_LEVELS, openPdfBytes, systemCountsAt, type CorpusLevel } from './support/corpus';
import { detectionRunTimeoutMs } from './support/timing';
import { forceFileInput } from './support/score';

const DEV_URL = 'http://127.0.0.1:4174';
const CORPUS_DIR = 'e2e/corpus';
const TEST_BASE_TIMEOUT_MS = 240_000; // plus one scaled detection run per level, see below

interface Entry {
  file: string;
  source?: 'folder' | 'url';
  reviewed?: boolean;
  stress?: boolean;
  level: CorpusLevel;
  systemsPerPage: number[];
  note: string;
  knownLimitation: string | null;
}

const entries = JSON.parse(readFileSync(`${CORPUS_DIR}/expected.json`, 'utf8')) as Entry[];
// Desktop Chromium runs every entry, desktop Firefox and WebKit the first three (TST-015). The debug hook is in the development build.
const SMOKE = new Set(smokeEntries(entries).map((entry) => entry.file));
const SMOKE_PROJECTS = ['firefox', 'webkit'];


for (const entry of entries) {
  test(`TST-002 TST-015 DET-013 corpus ${entry.file}${entry.knownLimitation ? ` (${entry.knownLimitation})` : ''}`, async ({
    page,
  }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(
      project !== 'chromium' && !(SMOKE_PROJECTS.includes(project) && SMOKE.has(entry.file)),
      'the corpus runs on desktop Chromium (all entries) and on desktop Firefox and WebKit (the first three)',
    );
    test.skip(entry.stress === true, `${entry.file} is a stress file (more than ${STRESS_MIN_PAGES} pages): the performance tests check scrolling, zooming and responsiveness`);
    test.skip(entry.reviewed === false, `${entry.file} is not reviewed yet: check its entry in expected.json and set "reviewed": true`);
    const found = resolveCorpusEntry({ entry, exists: existsSync });
    test.skip(found.path === null, `file missing: ${found.reason}`);
    // Every level is one full run: a real score with hundreds of pages needs the time per page, not a fixed minute.
    const wait = detectionRunTimeoutMs(entry.systemsPerPage.length);
    test.setTimeout(TEST_BASE_TIMEOUT_MS + CORPUS_LEVELS.length * wait);
    await forceFileInput(page);
    await page.goto(DEV_URL);
    await openPdfBytes(page, entry.file, readFileSync(found.path as string));

    // A new document starts at the default level (fast); the other levels are reached by a re-run.
    const table: Record<string, (number | null)[]> = {};
    table['fast'] = await systemCountsAt(page, 'fast', false, wait);
    for (const level of CORPUS_LEVELS.filter((l) => l !== 'fast')) {
      table[level] = await systemCountsAt(page, level, true, wait);
    }
    console.log(
      `corpus ${entry.file} ${JSON.stringify(table)} expected(${entry.level})=${JSON.stringify(entry.systemsPerPage)}`,
    );
    test.info().annotations.push({ type: 'systems per page', description: JSON.stringify(table) });

    expect(table[entry.level], entry.note).toEqual(entry.systemsPerPage);
  });
}
