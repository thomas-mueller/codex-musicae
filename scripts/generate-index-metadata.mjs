import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunablesPath = join(repositoryRoot, 'src/config/tunables.ts');
const templatePath = join(repositoryRoot, 'src/index.template.html');
const outputPath = join(repositoryRoot, '.angular/generated/index.html');

const tunables = await readFile(tunablesPath, 'utf8');
const match = tunables.match(/appName:\s*'([^']+)'/);
if (!match?.[1]) {
  throw new Error('Unable to read TUNABLES.identity.appName');
}

const appName = match[1].replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const template = await readFile(templatePath, 'utf8');
if (!template.includes('__APP_NAME__')) {
  throw new Error('Index template is missing the __APP_NAME__ identity token');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, template.replaceAll('__APP_NAME__', appName), 'utf8');
