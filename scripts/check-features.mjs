// Feature configuration (V2-M3 S1, EDN-013, R-22k): every shared switch exists in both src/config/features.*.ts files, web-only switches
// only in the web file, each switch is a boolean literal with a comment. Optional arguments: the web file and the native file
// (used by the lint self-test); exits non-zero with one line per violation.
import { readFile } from 'node:fs/promises';
import { checkFeatureFiles } from './lib/features-check.mjs';

const web = await readFile(process.argv[2] ?? 'src/config/features.web.ts', 'utf8');
const native = await readFile(process.argv[3] ?? 'src/config/features.native.ts', 'utf8');
const findings = checkFeatureFiles(web, native);
if (findings.length > 0) {
  console.error(findings.map((finding) => `${finding} (EDN-013)`).join('\n'));
  process.exit(1);
}
console.log('feature files ok');
