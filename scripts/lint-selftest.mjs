import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

const repositoryRoot = new URL('..', import.meta.url).pathname;
const fixtureRoot = await mkdtemp(join(repositoryRoot, 'src/app/lint-selftest-'));

const fixtures = [
  ['ARC-001 boundary', 'core/violates-boundary.ts', "import '../features/shell/violates-boundary.ts';\n"],
  ['ARC-002 core-angular', 'core/violates-core-import.ts', "import { Component } from '@angular/core';\n"],
  ['PLT-003 platform-global', 'state/violates-platform.ts', 'export const width = window.innerWidth;\n'],
  ['PLT-003 capacitor-import', 'state/violates-capacitor.ts', "import { Preferences } from '@capacitor/preferences';\n"],
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

const runNode = (script, ...args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], {
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
    if (name.endsWith('boundary')) {
      await mkdir(join(fixtureRoot, 'features/shell'), { recursive: true });
      await writeFile(join(fixtureRoot, 'features/shell/violates-boundary.ts'), 'export const fixture = true;\n', 'utf8');
    }
    const result = await runEslint(relative(repositoryRoot, file));
    if (result.code === 0) {
      throw new Error(`lint self-test fixture passed unexpectedly: ${name}\n${result.output}`);
    }
    console.log(`  ok  ${name} is rejected`);
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
  const iosBroken = [
    ['PLT-012 ios-deployment-target', 'App/App.xcodeproj/project.pbxproj', (text) => text.replace('= 16.4;', '= 15.0;')],
    ['PLT-012 ios-document-type', 'App/App/Info.plist', (text) => text.replaceAll('com.adobe.pdf', 'public.data')],
    ['PLT-012 ios-open-in-place', 'App/App/Info.plist', (text) => text.replace('LSSupportsOpeningDocumentsInPlace', 'LSSomethingElse')],
    ['PLT-013 ios-marker', 'App/App/DocumentAccessPlugin.swift', (text) => text.replaceAll('UNVERIFIED(ios)', 'checked')],
    ['PLT-013 ios-unregistered-source', 'App/App.xcodeproj/project.pbxproj', (text) => text.replaceAll('ImmersivePlugin.swift in Sources', 'ImmersivePlugin.swift in Elsewhere')],
    ['GEN-003 ios-bundle-id', 'App/App.xcodeproj/project.pbxproj', (text) => text.replace('= app.web.codexmusicae;', '= com.getcapacitor.App;')],
  ];
  const swiftSources = (await readdir(join(repositoryRoot, 'ios/App/App'))).filter((name) => name.endsWith('.swift'));
  const iosFiles = ['App/App/Info.plist', 'App/App.xcodeproj/project.pbxproj', ...swiftSources.map((name) => `App/App/${name}`)];
  for (const [name, broken, change] of iosBroken) {
    const copy = join(fixtureRoot, 'ios-copy');
    for (const file of iosFiles) {
      await mkdir(join(copy, file, '..'), { recursive: true });
      const text = await readFile(join(repositoryRoot, 'ios', file), 'utf8');
      await writeFile(join(copy, file), file === broken ? change(text) : text, 'utf8');
    }
    const result = await runNode('scripts/check-ios-config.mjs', relative(repositoryRoot, copy));
    if (result.code === 0) {
      throw new Error(`iOS config self-test passed unexpectedly: ${name}`);
    }
    console.log(`  ok  ${name} is rejected`);
  }
  const workflow = await readFile(join(repositoryRoot, '.github/workflows/ios.yml'), 'utf8');
  const workflowBroken = [
    ['PIP-010 ios-workflow-unknown-secret', workflow.replace('permissions:', 'env:\n  KEY: ${{ secrets.APPLE_KEY }}\npermissions:')],
    ['PIP-010 ios-workflow-ungated-step', workflow.replace(/(- name: Build signed ad hoc IPA\n)\s+if: [^\n]*\n/, '$1')],
    ['PIP-010 ios-workflow-printed-secret', workflow.replace('security import', 'echo "$IOS_CERTIFICATE_PASSWORD"; security import')],
    ['PIP-010 ios-workflow-groups-unconditional', workflow.replace('--groups "$groups"', '--groups "$FIREBASE_IOS_TESTER_GROUPS"')],
    ['PIP-004 ios-workflow-runner', workflow.replace('macos-latest', 'ubuntu-latest')],
    ['PIP-004 ios-workflow-no-unsigned-build', workflow.replace('CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_ALLOWED=YES')],
  ];
  for (const [name, text] of workflowBroken) {
    const file = join(fixtureRoot, 'ios.yml');
    await writeFile(file, text, 'utf8');
    const result = await runNode('scripts/check-ios-config.mjs', 'ios', relative(repositoryRoot, file));
    if (result.code === 0) {
      throw new Error(`iOS workflow self-test passed unexpectedly: ${name}`);
    }
    console.log(`  ok  ${name} is rejected`);
  }
  const handoverFile = join(fixtureRoot, 'ios-unverified.md');
  const handover = await readFile(join(repositoryRoot, 'docs/ios-unverified.md'), 'utf8');
  await writeFile(handoverFile, handover.replaceAll('ImmersivePlugin.swift', 'Missing.swift'), 'utf8');
  const handoverResult = await runNode('scripts/check-ios-config.mjs', 'ios', '.github/workflows/ios.yml', relative(repositoryRoot, handoverFile));
  if (handoverResult.code === 0) {
    throw new Error('iOS hand-over self-test passed unexpectedly: PLT-014 ios-handover-missing-file');
  }
  console.log('  ok  PLT-014 ios-handover-missing-file is rejected');
  const iosOk = await runNode('scripts/check-ios-config.mjs', 'ios');
  if (iosOk.code !== 0) {
    throw new Error(`iOS config check fails on the real project\n${iosOk.output}`);
  }
  console.log(`lint self-test passed (${fixtures.length} deliberate violations plus template and iOS config checks)`);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
