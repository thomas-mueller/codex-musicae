// Coverage per kind of test (V2-M1 S4, PIP-016, PIP-017): prints a table of the number of tests per kind, with the Vitest line and branch
// coverage when `coverage/**/coverage-summary.json` exists. Writes coverage/coverage-summary.md (uploaded as an artifact by lint-test) and
// appends the table to the job summary when GITHUB_STEP_SUMMARY is set. It never fails because of a number. Optional arguments: the
// project root (used by tests).
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { countByKind, renderTable } from './lib/test-kinds.mjs';

const root = process.argv[2] ?? '.';
const { kinds } = JSON.parse(await readFile(new URL('./test-kinds.json', import.meta.url), 'utf8'));
const SKIP = new Set(['node_modules', 'dist', '.angular', 'android', 'ios', 'coverage', '.git']);

async function specs(dir, out = {}) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true }).catch(() => [])) {
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) await specs(path, out);
    } else if (path.endsWith('.spec.ts')) {
      out[path] = await readFile(join(root, path), 'utf8');
    }
  }
  return out;
}

async function coverageTotal() {
  const entries = await readdir(join(root, 'coverage'), { recursive: true }).catch(() => []);
  const file = entries.map(String).find((entry) => entry.endsWith('coverage-summary.json'));
  if (file === undefined) return null;
  return JSON.parse(await readFile(join(root, 'coverage', file), 'utf8')).total ?? null;
}

const files = { ...(await specs('src')), ...(await specs('e2e')) };
const table = renderTable(countByKind(files, kinds), await coverageTotal());
console.log(table);
await mkdir(join(root, 'coverage'), { recursive: true });
await writeFile(join(root, 'coverage/coverage-summary.md'), `## Coverage per kind of test\n\n${table}\n`, 'utf8');
if (process.env['GITHUB_STEP_SUMMARY']) {
  await appendFile(process.env['GITHUB_STEP_SUMMARY'], `## Coverage per kind of test\n\n${table}\n`, 'utf8');
}
