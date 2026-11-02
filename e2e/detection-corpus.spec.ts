import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

import { CORPUS_LEVELS, openPdfBytes, systemCountsAt, type CorpusLevel } from './support/corpus';
import { forceFileInput } from './support/score';

const DEV_URL = 'http://127.0.0.1:4174';
const CORPUS_DIR = 'e2e/corpus';
const REAL_DIR = `${CORPUS_DIR}/real`;
const TEST_TIMEOUT_MS = 240_000;

interface Entry {
  file: string;
  level: CorpusLevel;
  systemsPerPage: number[];
  note: string;
  knownLimitation: string | null;
}

const entries = JSON.parse(readFileSync(`${CORPUS_DIR}/expected.json`, 'utf8')) as Entry[];
const pathOf = (file: string): string =>
  existsSync(`${CORPUS_DIR}/${file}`) ? `${CORPUS_DIR}/${file}` : `${REAL_DIR}/${file}`;

test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'chromium',
    'the debug hook and the corpus run on desktop Chromium with the development build',
  );
});

for (const entry of entries) {
  test(`TST-002 DET-013 corpus ${entry.file}${entry.knownLimitation ? ` (${entry.knownLimitation})` : ''}`, async ({
    page,
  }) => {
    test.skip(
      !existsSync(pathOf(entry.file)),
      `${entry.file} is not present (real scores are kept out of git)`,
    );
    await forceFileInput(page);
    await page.goto(DEV_URL);
    await openPdfBytes(page, entry.file, readFileSync(pathOf(entry.file)));

    // A new document starts at the default level (fast); the other levels are reached by a re-run.
    const table: Record<string, (number | null)[]> = {};
    table['fast'] = await systemCountsAt(page, 'fast', false);
    for (const level of CORPUS_LEVELS.filter((l) => l !== 'fast')) {
      table[level] = await systemCountsAt(page, level, true);
    }
    console.log(
      `corpus ${entry.file} ${JSON.stringify(table)} expected(${entry.level})=${JSON.stringify(entry.systemsPerPage)}`,
    );
    test.info().annotations.push({ type: 'systems per page', description: JSON.stringify(table) });

    expect(table[entry.level], entry.note).toEqual(entry.systemsPerPage);
  });
}
