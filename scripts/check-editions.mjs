// Editions (V2-M3 S4, EDN-010, EDN-013, GEN-011): the build configurations, the generated application-ID files, Gradle, Xcode and the
// native workflows agree on free and paid, and a build starts from the right feature file.
//   node scripts/check-editions.mjs                          static check of the repository
//   node scripts/check-editions.mjs --built <dir> web|native  checks a built bundle (dist/...)
// Optional further arguments of the static check (used by the lint self-test): angular.json, tunables.ts, build.gradle, debug.xcconfig,
// android.yml, ios.yml. Exits non-zero with one line per violation.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkAngularConfigurations, checkBuiltBundle, checkEditionFiles, checkEditionWorkflow } from './lib/editions-check.mjs';

async function bundleTexts(dir) {
  const names = (await readdir(dir)).filter((name) => /\.js$/.test(name));
  return Promise.all(names.map((name) => readFile(join(dir, name), 'utf8')));
}

const args = process.argv.slice(2);
let findings;
if (args[0] === '--built') {
  const [, dir, kind] = args;
  findings = checkBuiltBundle(kind, await bundleTexts(dir));
} else {
  const [angular = 'angular.json', tunablesPath = 'src/config/tunables.ts', gradle = 'android/app/build.gradle', xcconfig = 'ios/debug.xcconfig', android = '.github/workflows/android.yml', ios = '.github/workflows/ios.yml'] = args;
  const tunables = await readFile(tunablesPath, 'utf8');
  findings = [
    ...checkAngularConfigurations(JSON.parse(await readFile(angular, 'utf8'))),
    ...checkEditionFiles(tunables, await readFile(gradle, 'utf8'), await readFile(xcconfig, 'utf8')),
    ...checkEditionWorkflow('android.yml', await readFile(android, 'utf8'), tunables),
    ...checkEditionWorkflow('ios.yml', await readFile(ios, 'utf8'), tunables),
  ];
}
if (findings.length > 0) {
  console.error(findings.map((finding) => `${finding} (EDN-010)`).join('\n'));
  process.exit(1);
}
console.log('editions ok');
