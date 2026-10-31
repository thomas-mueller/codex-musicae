import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Names in tunables.icons that the package ships under a different file name.
const aliases = { file_download: 'download' };

const packageDir = 'node_modules/@material-symbols/svg-400/outlined';
const output = 'src/assets/icons/sprite.svg';

const tunables = await readFile('src/config/tunables.ts', 'utf8');
const block = tunables.match(/icons:\s*\{([\s\S]*?)\n {2}\},/)?.[1] ?? '';
const names = [...block.matchAll(/^\s*\w+:\s*'([a-z0-9_]+)'/gm)].map((m) => m[1]);
if (names.length === 0) {
  console.error('no icons found in tunables.ts');
  process.exit(1);
}

const symbols = [];
const missing = [];
for (const name of [...new Set(names)]) {
  const source = await readFile(`${packageDir}/${aliases[name] ?? name}.svg`, 'utf8').catch(() => null);
  const parts = source?.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!parts) {
    missing.push(name);
    continue;
  }
  symbols.push(`<symbol id="${name}" viewBox="${parts[1]}">${parts[2]}</symbol>`);
}
if (missing.length > 0) {
  console.error(`icons missing in the package: ${missing.join(', ')}`);
  process.exit(1);
}

await mkdir('src/assets/icons', { recursive: true });
await writeFile(output, `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>\n`);
console.log(`${symbols.length} icons -> ${output}`);
