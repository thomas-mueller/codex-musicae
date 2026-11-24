// Edition for the native builds (V2-M3 S4, GEN-011, EDN-010): `node scripts/apply-edition.mjs free|paid [outDir]` (default: CAP_EDITION,
// else free) writes the application ID of the edition from src/config/tunables.ts into the generated files that Gradle
// (android/edition.properties) and Xcode (ios/edition.xcconfig) read. Run it before the web build, `cap sync` and the platform build.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { editionFiles, editionOf } from './lib/edition-files.mjs';

const edition = editionOf(process.argv[2] ?? process.env.CAP_EDITION);
const outDir = process.argv[3] ?? '.';
const files = editionFiles(await readFile('src/config/tunables.ts', 'utf8'), edition);
for (const [path, content] of Object.entries(files)) {
  const target = join(outDir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}
console.log(`edition ${edition}: ${Object.keys(files).join(', ')}`);
