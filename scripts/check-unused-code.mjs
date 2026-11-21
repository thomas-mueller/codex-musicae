// Unused files and exports (V2-M1 S2, PIP-013, R-14c): every application file must be reachable from src/main.ts (imports, dynamic
// imports, `new URL('./x', import.meta.url)` workers) or by a spec or a test helper (specs and src/testing are entries too: exports that
// exist for tests and fixtures are used), and every export must be imported somewhere. Intentional exceptions: docs/unused-exceptions.md. Optional arguments: source folder, exceptions file (lint self-test).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findUnused, parseExceptions } from './lib/unused-code.mjs';

const root = process.argv[2] ?? 'src';
const exceptionsPath = process.argv[3] ?? 'docs/unused-exceptions.md';
const skipped = (path) => path.endsWith('.d.ts');
const isEntry = (path) => path === `${root}/main.ts` || path.endsWith('.spec.ts') || path.startsWith(`${root}/testing/`);

async function walk(dir, out = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path, out);
    else if (path.endsWith('.ts') && !skipped(path)) out[path] = await readFile(join(path), 'utf8');
  }
  return out;
}

const exceptions = parseExceptions(await readFile(exceptionsPath, 'utf8').catch(() => ''));
const codeKeys = new Set([...exceptions.keys()].filter((key) => key.startsWith(`${root}/`)));
const sources = await walk(root);
const lines = findUnused({ sources, entries: Object.keys(sources).filter(isEntry), exceptions: codeKeys });
if (lines.length > 0) {
  console.error(lines.map((line) => `${line} (PIP-013)`).join('\n'));
  process.exit(1);
}
console.log('unused code check ok');
