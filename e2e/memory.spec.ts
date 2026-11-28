import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { currentName, switchTo } from './support/files';
import { forceFileInput, label } from './support/score';
import { DETECTION_TIMEOUT_MS, DOCUMENT_OPEN_TIMEOUT_MS, FILE_CHOOSER_TIMEOUT_MS, scaled } from './support/timing';

// V2-M6 S3: many real PDFs in a browser with a small JavaScript heap. NFR-020, FIL-031, R-1n.

const DEV_URL = 'http://127.0.0.1:4174'; // the development build: the only one with the debug hook
const OPEN_FILES = 30;
const SMALLEST_BUCKET_GB = 1;
const HEAP_LIMIT_MB = 512;
const TEST_TIMEOUT_MS = scaled(600_000);
const EXPECTED = 'e2e/corpus/expected.json';

test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: [`--js-flags=--max-old-space-size=${HEAP_LIMIT_MB}`] } });

/** The real PDFs at hand: the committed ones and the downloaded corpus (`npm run corpus`), without the stress files. */
function realPdfs(): Buffer[] {
  const stress = new Set((JSON.parse(readFileSync(EXPECTED, 'utf8')) as { file: string; stress?: boolean }[]).filter((entry) => entry.stress).map((entry) => entry.file));
  return ['e2e/corpus/real', 'e2e/corpus/cache']
    .filter((folder) => existsSync(folder))
    .flatMap((folder) => readdirSync(folder).filter((name) => name.endsWith('.pdf') && !stress.has(name)).map((name) => readFileSync(join(folder, name))));
}

interface Rendered {
  readonly name: string;
  readonly active: boolean;
  readonly cacheBytes: number;
  readonly rasterBytes: number;
}

const rendered = (page: Page): Promise<Rendered[]> =>
  page.evaluate(() => (globalThis as unknown as { __cm: { renderedBytes(): Rendered[] } }).__cm.renderedBytes());

/** The files that are not current and still keep something rendered. */
const holdingInactive = async (page: Page): Promise<string[]> =>
  (await rendered(page)).filter((file) => !file.active && file.cacheBytes + file.rasterBytes > 0).map((file) => file.name);

test('NFR-020 FIL-031 thirty real PDFs stay open in a small heap, and a file that is left keeps nothing rendered', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'heap limit and debug hook: desktop Chromium');
  test.setTimeout(TEST_TIMEOUT_MS);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await forceFileInput(page);
  await page.addInitScript((gb) => Object.defineProperty(globalThis.navigator, 'deviceMemory', { value: gb, configurable: true }), SMALLEST_BUCKET_GB);
  await page.goto(DEV_URL);
  const pdfs = realPdfs();
  expect(pdfs.length).toBeGreaterThan(0);
  const names = Array.from({ length: OPEN_FILES }, (_, i) => `file-${i}.pdf`);
  for (const [i, name] of names.entries()) {
    const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
    await page.getByRole('button', { name: label('openFile'), exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: pdfs[i % pdfs.length]! });
    await expect(currentName(page)).toHaveText(name, { timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    // The first slide needs detection to reach a page with systems (a score may start with pages without any), while the
    // files opened before are still being analysed too.
    await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DETECTION_TIMEOUT_MS });
    // the current file has something rendered; every file left behind gives it all up
    await expect.poll(async () => (await rendered(page)).find((file) => file.active)!.cacheBytes, { timeout: DOCUMENT_OPEN_TIMEOUT_MS }).toBeGreaterThan(0);
    await expect.poll(() => holdingInactive(page), { timeout: DOCUMENT_OPEN_TIMEOUT_MS }).toEqual([]);
  }
  for (const name of [names[0]!, names[15]!, names[29]!]) {
    await switchTo(page, name);
    await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: DOCUMENT_OPEN_TIMEOUT_MS });
    await expect.poll(() => holdingInactive(page), { timeout: DOCUMENT_OPEN_TIMEOUT_MS }).toEqual([]);
  }
  expect((await rendered(page)).map((file) => file.name)).toEqual(names); // FIL-031: nothing was closed or evicted
  expect(errors).toEqual([]);
});
