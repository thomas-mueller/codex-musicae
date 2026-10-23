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
  console.log(`lint self-test passed (${fixtures.length} deliberate violations rejected)`);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
