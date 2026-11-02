import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunablesPath = join(repositoryRoot, 'src/config/tunables.ts');
const templatePath = join(repositoryRoot, 'src/index.template.html');
const outputPath = join(repositoryRoot, '.angular/generated/index.html');
const manifestPath = join(repositoryRoot, '.angular/generated/manifest.webmanifest');

const tunables = await readFile(tunablesPath, 'utf8');
const match = tunables.match(/appName:\s*'([^']+)'/);
if (!match?.[1]) {
  throw new Error('Unable to read TUNABLES.identity.appName');
}

const appName = match[1].replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const colorMatch = tunables.match(/canvasGrey:\s*'([^']+)'/);
if (!colorMatch?.[1]) {
  throw new Error('Unable to read TUNABLES.colors.canvasGrey');
}
const template = await readFile(templatePath, 'utf8');
if (!template.includes('__APP_NAME__')) {
  throw new Error('Index template is missing the __APP_NAME__ identity token');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, template.replaceAll('__APP_NAME__', appName), 'utf8');
await writeFile(manifestPath, `${JSON.stringify({
  name: match[1],
  short_name: match[1],
  display: 'standalone',
  background_color: colorMatch[1],
  theme_color: colorMatch[1],
  start_url: './',
  // FIL-019: "Open with" in desktop Chromium; later files go to the running window.
  file_handlers: [{ action: './', accept: { 'application/pdf': ['.pdf'] } }],
  launch_handler: { client_mode: 'focus-existing' },
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2)}\n`, 'utf8');
