// Expectation helper (V2-M2 S2, TST-013, TST-014): `npm run corpus:expected [-- --force] [--root <dir>]` (also run by `npm run corpus`).
// Measures the corpus PDFs that have no reviewed entry in e2e/corpus/expected.json (headless, through the detection debug hook, driven by
// e2e/tools/propose-expected.spec.ts) and writes proposed entries in the V2 format with "reviewed": false (suite from the page count, default
// profile). A reviewed entry is never overwritten without --force, and keeps its suites, tags, engines, profiles and deviations when it is.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCorpusPdfs, mergeProposals, selectToMeasure, serializeExpected } from './lib/make-expected.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const rootIndex = args.indexOf('--root');
const root = rootIndex >= 0 ? args[rootIndex + 1] : 'e2e/corpus';
const expectedPath = join(root, 'expected.json');
const names = async (dir) => readdir(dir).catch(() => []);

const expectedText = await readFile(expectedPath, 'utf8').catch((error) => (error.code === 'ENOENT' ? '[]' : Promise.reject(error)));
const entries = JSON.parse(expectedText);
const { pdfs, warnings } = listCorpusPdfs({ realFiles: await names(join(root, 'real')), cacheFiles: await names(join(root, 'cache')) });
for (const warning of warnings) console.warn(`warning: ${warning}`);
const todo = selectToMeasure({ pdfs, entries, force });
if (todo.length === 0) {
  console.log(`expectations: nothing to do (${pdfs.length} PDFs, all with a reviewed entry)`);
  process.exit(0);
}

const profiles = JSON.parse(await readFile(join(root, 'profiles.json'), 'utf8'));
const work = await mkdtemp(join(tmpdir(), 'corpus-expected-'));
try {
  const input = join(work, 'in.json');
  const output = join(work, 'out.json');
  await writeFile(input, JSON.stringify(todo.map(({ file, source }) => ({ path: join(root, source === 'folder' ? 'real' : 'cache', file), file }))));
  console.log(`expectations: measuring ${todo.length} PDFs (the first run builds the development app) …`);
  const run = spawnSync(
    'npx',
    ['playwright', 'test', 'e2e/tools/propose-expected.spec.ts', '--project=chromium', '--workers=1', '--reporter=line'],
    { stdio: 'inherit', env: { ...process.env, CORPUS_PROPOSE_IN: input, CORPUS_PROPOSE_OUT: output } },
  );
  const measured = JSON.parse(await readFile(output, 'utf8').catch(() => '{}'));
  if (run.status !== 0 && Object.keys(measured).length === 0) {
    console.error('expectations: the measurement failed (see the output above)');
    process.exit(1);
  }
  const merged = mergeProposals({ entries, pdfs: todo, measured, force, profiles });
  if (merged.problems.length > 0) {
    for (const problem of merged.problems) console.error(`expectations: ${problem}`);
    console.error('expectations: nothing written');
    process.exit(1);
  }
  for (const warning of merged.warnings) console.warn(`warning: ${warning}`);
  for (const { file } of todo.filter(({ file }) => measured[file] === undefined)) console.warn(`warning: ${file} could not be measured and has no entry`);
  const text = serializeExpected(merged.entries);
  if (text !== serializeExpected(entries)) await writeFile(expectedPath, text);
  console.log(`expectations: ${merged.added.length} added, ${merged.refreshed.length} refreshed, ${merged.kept.length} kept (reviewed)`);
  if (merged.added.length + merged.refreshed.length > 0) console.log('Review the entries with "reviewed": false in expected.json, correct them, then set "reviewed": true.');
} finally {
  await rm(work, { recursive: true, force: true });
}
