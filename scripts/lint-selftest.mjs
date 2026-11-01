import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

const repositoryRoot = new URL('..', import.meta.url).pathname;
const fixtureRoot = await mkdtemp(join(repositoryRoot, 'src/app/lint-selftest-'));

const fixtures = [
  ['boundary', 'core/violates-boundary.ts', "import '../features/shell/violates-boundary.ts';\n"],
  ['core-angular', 'core/violates-core-import.ts', "import { Component } from '@angular/core';\n"],
  ['platform-global', 'state/violates-platform.ts', 'export const width = window.innerWidth;\n'],
  ['capacitor-import', 'state/violates-capacitor.ts', "import { Preferences } from '@capacitor/preferences';\n"],
  ['magic-number', 'state/violates-magic-number.ts', 'export const value = 3 + 4;\n'],
  ['console-log', 'state/violates-console.ts', "console.log('x');\n"],
  ['color-literal', 'state/violates-color.ts', "export const color = '#FFFFFF';\n"],
];

const runEslint = (file) => new Promise((resolve, reject) => {
  const eslint = spawn('npx', ['eslint', '--no-warn-ignored', '--no-error-on-unmatched-pattern', file], {
    cwd: repositoryRoot,
    env: { ...process.env, DEBUG: 'eslint-plugin-boundaries:*' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  eslint.stdout.on('data', (chunk) => { output += chunk; });
  eslint.stderr.on('data', (chunk) => { output += chunk; });
  eslint.on('error', reject);
  eslint.on('close', (code) => resolve({ code: code ?? 1, output }));
});

const runNode = (script, file) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, file], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code: code ?? 1, output }));
});

try {
  for (const [name, path, source] of fixtures) {
    const file = join(fixtureRoot, path);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, source, 'utf8');
    if (name === 'boundary') {
      await mkdir(join(fixtureRoot, 'features/shell'), { recursive: true });
      await writeFile(join(fixtureRoot, 'features/shell/violates-boundary.ts'), 'export const fixture = true;\n', 'utf8');
    }
    const result = await runEslint(relative(repositoryRoot, file));
    if (result.code === 0) {
      throw new Error(`lint self-test fixture passed unexpectedly: ${name}\n${result.output}`);
    }
  }
  const rawTemplate = join(fixtureRoot, 'raw.html');
  const translatedTemplate = join(fixtureRoot, 'translated.html');
  await writeFile(rawTemplate, '<p>Raw text</p>\n', 'utf8');
  await writeFile(translatedTemplate, "<p>{{ 'app.placeholder' | transloco }}</p>\n", 'utf8');
  const flowTemplate = join(fixtureRoot, 'flow.html');
  const flowRawTemplate = join(fixtureRoot, 'flow-raw.html');
  await writeFile(flowTemplate, "@if (a()) {\n<p>{{ 'app.placeholder' | transloco }}</p>\n} @else {\n<i></i>\n}\n@for (x of xs(); track x) {\n<b></b>\n}\n", 'utf8');
  await writeFile(flowRawTemplate, '@if (a()) {\n<p>Raw text</p>\n}\n', 'utf8');
  const flowResult = await runNode('scripts/check-templates.mjs', relative(repositoryRoot, flowTemplate));
  const flowRawResult = await runNode('scripts/check-templates.mjs', relative(repositoryRoot, flowRawTemplate));
  if (flowResult.code !== 0 || flowRawResult.code === 0) {
    throw new Error('template self-test did not allow control flow or still must reject raw text inside it');
  }
  const rawResult = await runNode('scripts/check-templates.mjs', relative(repositoryRoot, rawTemplate));
  const translatedResult = await runNode('scripts/check-templates.mjs', relative(repositoryRoot, translatedTemplate));
  if (rawResult.code === 0 || translatedResult.code !== 0) {
    throw new Error('template translation self-test did not enforce raw text and allow Transloco text');
  }
  console.log(`lint self-test passed (${fixtures.length} deliberate violations plus template checks)`);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
