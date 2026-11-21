// Tunables comments (V2-M1 S4, ARC-008): every numeric value in src/config/tunables.ts has a comment (unit and meaning) on its line or on
// the line above. Obvious values are in scripts/tunables-comment-allow-list.json. Optional arguments: the tunables file and the allow-list
// (used by the lint self-test); exits non-zero with one line per violation.
import { readFile } from 'node:fs/promises';
import { findUncommentedNumbers } from './lib/tunables-comments.mjs';

const { obviousNumbers } = JSON.parse(await readFile(process.argv[3] ?? 'scripts/tunables-comment-allow-list.json', 'utf8'));
const findings = findUncommentedNumbers(await readFile(process.argv[2] ?? 'src/config/tunables.ts', 'utf8'), obviousNumbers);
if (findings.length > 0) {
  console.error(findings.map((finding) => `tunables.ts:${finding} has no comment (ARC-008)`).join('\n'));
  process.exit(1);
}
console.log('tunables comments ok');
