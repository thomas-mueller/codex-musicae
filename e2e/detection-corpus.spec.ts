import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

import { enginesOf, entriesOf, expectedFor, profilesOf, resolveCorpusEntry } from '../scripts/lib/corpus-files.mjs';
import type { CorpusEntry } from '../scripts/lib/corpus-schema.mjs';

import { openPdfBytes, pageCountOf, runProfile } from './support/corpus';
import { detectionRunTimeoutMs } from './support/timing';
import { forceFileInput } from './support/score';

// The detection suite (V2-M3b S2, TST-024): every reviewed `detection` entry of expected.json is detected once per profile on every engine of
// its `engines` list (desktop Chromium, Firefox and WebKit; the development build carries the debug hook) and must give the owner's counts,
// or the numbers of the deviation that matches the profile and engine. Detection must not depend on the browser (NFR-025, DET-013, DET-035).
const DEV_URL = 'http://127.0.0.1:4174';
const CORPUS_DIR = 'e2e/corpus';
const DESKTOP_PROJECTS = ['chromium', 'firefox', 'webkit'];
const TEST_BASE_TIMEOUT_MS = 120_000; // opening and start-up; the detection runs come on top, scaled by the page count (TST-027)
/** A new document always starts its own `fast` run; the profile run follows it. */
const INITIAL_PROFILE = 'v1-fast';

const entries = entriesOf(JSON.parse(readFileSync(`${CORPUS_DIR}/expected.json`, 'utf8')) as CorpusEntry[], 'detection');
const profiles = JSON.parse(readFileSync(`${CORPUS_DIR}/profiles.json`, 'utf8')) as Record<string, { default?: boolean }>;

for (const entry of entries) {
  for (const profile of profilesOf(entry, profiles)) {
    test(`TST-002 TST-015 DET-013 DET-035 NFR-025 TST-024 corpus ${entry.file} (${profile})`, async ({ page }, testInfo) => {
      const engine = testInfo.project.name;
      test.skip(!DESKTOP_PROJECTS.includes(engine), 'the detection suite runs on the three desktop engines');
      test.skip(!enginesOf(entry).includes(engine), `${entry.file} is not asserted on ${engine}: ${entry.note}`);
      test.skip(entry.reviewed === false, `${entry.file} is not reviewed yet: check its entry in expected.json and set "reviewed": true`);
      const found = resolveCorpusEntry({ entry, exists: existsSync });
      test.skip(found.path === null, `file missing: ${found.reason}`);
      const expected = expectedFor(entry, profile, engine);
      // TST-027: the time of the test is the opening plus the initial run and one run of the profile, each scaled by the page count.
      const wait = detectionRunTimeoutMs(expected.length);
      test.setTimeout(TEST_BASE_TIMEOUT_MS + 2 * wait);
      await forceFileInput(page);
      await page.goto(DEV_URL);
      await openPdfBytes(page, entry.file, readFileSync(found.path as string));

      const started = Date.now();
      let counts: (number | null)[];
      try {
        // A re-run request before the document is open is dropped: wait for the initial run, then ask for the profile.
        await pageCountOf(page);
        await runProfile(page, INITIAL_PROFILE, false, wait);
        counts = profile === INITIAL_PROFILE ? await runProfile(page, profile, false, wait) : await runProfile(page, profile, true, wait);
      } catch (error) {
        throw new Error(`detection did not finish on ${engine} for ${entry.file} (${profile}): ${(error as Error).message}`, { cause: error });
      }
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`corpus ${engine} ${entry.file} ${profile} ${seconds}s ${JSON.stringify(counts)} expected=${JSON.stringify(expected)}`);
      test.info().annotations.push({ type: 'systems per page', description: JSON.stringify(counts) });

      expect(counts, `${engine} ${entry.file} ${profile}: ${entry.note}`).toEqual(expected);
    });
  }
}
