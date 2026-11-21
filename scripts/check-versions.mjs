// Version consistency (V2-M1 S4, PIP-018, PIP-019, PIP-020, NFR-019). Without arguments (part of `npm run lint`): the generated version
// file is consistent, the Android and iOS workflows take the version from scripts/version-info.mjs instead of deriving it inline, and for
// a list of describe strings the web, Android and iOS versions agree. With `--built` (after `npm run build`): the production bundle
// contains the display version, there are no source maps and the bundles are minified. Optional second/third arguments: the generated
// file and the workflow folder (used by the lint self-test).
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { displayVersion, platformVersionName } from './lib/version.mjs';

const built = process.argv[2] === '--built';
const generatedPath = (built ? undefined : process.argv[2]) ?? 'src/config/version.generated.ts';
const workflowDir = (built ? undefined : process.argv[3]) ?? '.github/workflows';
const BUILD_DIR = 'dist/codexmusicae/browser';
const MINIFIED_MIN_LINE_LENGTH = 200; // characters per line on average: a minified bundle has few, very long lines
const BUNDLE_NAME = /^(main|chunk|worker)-[A-Za-z0-9]+\.js$/; // the hashed bundles of the build; ngsw-worker.js and copied vendor files are not ours to minify
const SMALL_BUNDLE_BYTES = 5000; // tiny chunks are not worth judging
const violations = [];

const SAMPLES = ['v1.5.0-3-gabc1234-dirty', 'v1.1.0-0-g8b69cff', 'v2.0.0', 'v0.20.0-14-g8b69cff-dirty', '8b69cff', 'unknown'];

if (!built) {
  const generated = await readFile(generatedPath, 'utf8').catch(() => null);
  if (generated !== null) {
    const display = generated.match(/APP_VERSION_DISPLAY = "([^"]*)"/)?.[1];
    const full = generated.match(/APP_VERSION_FULL = "([^"]*)"/)?.[1];
    if (display === undefined || full === undefined) violations.push('version.generated.ts: APP_VERSION_DISPLAY or APP_VERSION_FULL is missing (PIP-018)');
    else if (display !== displayVersion(full)) violations.push(`version.generated.ts: display ${display} does not match ${displayVersion(full)} derived from ${full} (PIP-018)`);
  }
  for (const name of ['android', 'ios']) {
    const text = (await readFile(join(workflowDir, `${name}.yml`), 'utf8').catch(() => '')).replace(/^\s*#.*$/gm, '');
    if (!text.includes('node scripts/version-info.mjs name')) violations.push(`${name}.yml: the version name must come from scripts/version-info.mjs (PIP-020)`);
    if (/git describe/.test(text)) violations.push(`${name}.yml: do not derive the version inline with git describe, use scripts/version-info.mjs (PIP-020)`);
  }
  for (const sample of SAMPLES) {
    const info = execFileSync(process.execPath, ['scripts/version-info.mjs', 'name', sample], { encoding: 'utf8' }).trim();
    const web = displayVersion(sample).slice(1);
    if (info !== web || platformVersionName(sample) !== web) violations.push(`${sample}: web ${web}, Android/iOS ${info} differ (PIP-020)`);
    if (!/^\d+\.\d+\.\d+$/.test(info)) violations.push(`${sample}: version name ${info} is not X.Y.Z (PIP-019)`);
  }
} else {
  const display = (await readFile('src/config/version.generated.ts', 'utf8')).match(/APP_VERSION_DISPLAY = "([^"]*)"/)?.[1];
  const files = (await readdir(BUILD_DIR, { recursive: true })).map(String);
  if (files.some((file) => file.endsWith('.map'))) violations.push('the production build contains source maps (NFR-019)');
  const bundles = files.filter((file) => BUNDLE_NAME.test(file));
  let found = false;
  for (const file of bundles) {
    const text = await readFile(join(BUILD_DIR, file), 'utf8');
    if (display !== undefined && text.includes(`"${display}"`)) found = true;
    if (text.length > SMALL_BUNDLE_BYTES && text.length / text.split('\n').length < MINIFIED_MIN_LINE_LENGTH) violations.push(`${file}: not minified (NFR-019)`);
  }
  if (display === undefined || !found) violations.push(`the production bundle does not contain the display version ${display} (PIP-018)`);
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(built ? 'built version check ok' : 'version check ok');
