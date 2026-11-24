// Real-PDF corpus (V2-M2 S1, TST-010, TST-011): `npm run corpus [-- --offline] [--root <dir>]`.
// Reads e2e/corpus/urls.txt (one URL per line), downloads each PDF into e2e/corpus/cache/ (git-ignored), records the checksum of the first
// download in e2e/corpus/urls.lock.json and verifies it afterwards. Problems with a download are warnings, never a failed run.
// Then the expectation helper (scripts/make-expected.mjs) proposes entries for new PDFs; `--no-expected` skips it, `--force` is passed on.
// Tests and CI only; the shipped app makes no such request (R-8d).
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchCorpus, httpDownload, parseUrlList, serializeLock } from './lib/corpus.mjs';

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const rootIndex = args.indexOf('--root');
const root = rootIndex >= 0 ? args[rootIndex + 1] : 'e2e/corpus';
const cacheDir = join(root, 'cache');
const lockPath = join(root, 'urls.lock.json');

const readOr = async (path, fallback) => readFile(path, 'utf8').catch((error) => (error.code === 'ENOENT' ? fallback : Promise.reject(error)));
const countPdfs = async (dir) => (await readdir(dir).catch(() => [])).filter((name) => name.toLowerCase().endsWith('.pdf')).length;

try {
  const { urls, invalid } = parseUrlList(await readOr(join(root, 'urls.txt'), ''));
  for (const line of invalid) console.warn(`warning: ignored line in urls.txt (not an http(s) URL): ${line}`);
  const lockText = await readOr(lockPath, '[]');
  const lock = JSON.parse(lockText);
  await mkdir(cacheDir, { recursive: true });
  const cache = {
    read: async (file) => readFile(join(cacheDir, file)).catch(() => null),
    write: async (file, bytes) => writeFile(join(cacheDir, file), bytes),
  };
  const result = await fetchCorpus({ urls, lock, cache, download: httpDownload, offline, warn: (message) => console.warn(`warning: ${message}`) });
  const text = serializeLock(result.lock);
  if (text !== serializeLock(lock)) await writeFile(lockPath, text);
  const inFolder = await countPdfs(join(root, 'real'));
  const { downloaded, cached, skipped } = result.summary;
  console.log(`corpus: ${inFolder} in folder, ${downloaded} downloaded, ${cached} cached, ${skipped} skipped (${urls.length} URLs)`);
  if (!args.includes('--no-expected')) {
    const helper = spawnSync(process.execPath, ['scripts/make-expected.mjs', '--root', root, ...(args.includes('--force') ? ['--force'] : [])], { stdio: 'inherit' });
    if (helper.status !== 0) process.exit(helper.status ?? 1);
  }
} catch (error) {
  console.error(`corpus: cannot read the local input: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
