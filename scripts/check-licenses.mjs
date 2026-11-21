// License check (V2-M1 S2, PIP-015, #49): every production dependency in package-lock.json has a license from the allow-list in
// scripts/license-allow-list.json; GPL, AGPL and LGPL never pass. Prints the table to the log. Optional arguments: lock file, allow-list
// (used by the lint self-test); exits non-zero with one line per violation.
import { readFile } from 'node:fs/promises';
import { checkLicenses, formatTable } from './lib/license-check.mjs';

const lock = JSON.parse(await readFile(process.argv[2] ?? 'package-lock.json', 'utf8'));
const { allowed } = JSON.parse(await readFile(process.argv[3] ?? 'scripts/license-allow-list.json', 'utf8'));

const packages = Object.entries(lock.packages ?? {})
  .filter(([key, value]) => key.includes('node_modules/') && !value.dev && !value.devOptional && !value.link)
  .map(([key, value]) => ({ name: key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length), version: value.version, license: value.license }))
  .sort((a, b) => a.name.localeCompare(b.name));

const { rows, violations } = checkLicenses(packages, allowed);
console.log(formatTable(rows));
if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`licenses ok: ${rows.length} production packages`);
