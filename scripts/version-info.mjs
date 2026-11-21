// Prints one version value for the workflows (PIP-018, PIP-019, PIP-020): `name` (X.Y.Z, Android versionName and iOS marketing version),
// `display` (vX.Y.Z), `full` (git describe) or `code` (commit count, the build number). The optional second argument replaces the
// `git describe` output (used by tests).
import { execFileSync } from 'node:child_process';
import { displayVersion, platformVersionName } from './lib/version.mjs';

const what = process.argv[2];
const describe = () => execFileSync('git', ['describe', '--tags', '--always', '--long'], { encoding: 'utf8' }).trim();
const raw = process.argv[3] ?? describe();

const values = {
  name: () => platformVersionName(raw),
  display: () => displayVersion(raw),
  full: () => raw,
  code: () => execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(),
};
const value = values[what];
if (value === undefined) {
  console.error('usage: node scripts/version-info.mjs name|display|full|code [describe-string]');
  process.exit(1);
}
console.log(value());
