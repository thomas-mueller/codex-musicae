// Unused dependencies (V2-M1 S2, PIP-014, R-14c): every package in package.json must be named by an import or require in the sources,
// scripts and configuration, or by a configuration file that names tools by string. Packages that tools use implicitly are listed with a
// reason in docs/unused-exceptions.md. Optional arguments: package.json, exceptions file (lint self-test).
import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { findUnusedDependencies } from './lib/unused-dependencies.mjs';
import { parseExceptions } from './lib/unused-code.mjs';

const packagePath = process.argv[2] ?? 'package.json';
const exceptionsPath = process.argv[3] ?? 'docs/unused-exceptions.md';
const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];

const CODE = new Set(['.ts', '.mjs', '.js', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', 'android', 'ios', 'coverage', 'out-tsc', '.git', 'playwright-report', 'test-results']);
async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !path.startsWith('docs/contracts') && !path.startsWith('docs/reference')) await walk(path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

const files = await walk('.');
const specifiers = [];
for (const path of files.filter((file) => CODE.has(extname(file)))) {
  const text = await readFile(path, 'utf8');
  for (const match of text.matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'".][^'"]*)['"]/g)) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
}
const configFiles = files.filter((file) => /^(angular\.json|tsconfig[^/]*\.json|\.prettierrc.*|capacitor\.config\.ts|[^/]*\.config\.(ts|mjs))$/.test(file)
  || file.startsWith('.github/') || (file.startsWith('scripts/') && !/check-unused-dependencies|lint-selftest/.test(file)));
const configText = [
  ...(await Promise.all(configFiles.map((file) => readFile(file, 'utf8')))),
  Object.values(manifest.scripts ?? {}).join('\n'),
].join('\n');

const exceptions = new Set([...parseExceptions(await readFile(exceptionsPath, 'utf8').catch(() => '')).keys()].filter((key) => !key.startsWith('src/')));
const lines = findUnusedDependencies({ declared, specifiers, configText, exceptions });
if (lines.length > 0) {
  console.error(lines.join('\n'));
  process.exit(1);
}
console.log(`unused dependency check ok: ${declared.length} packages`);
