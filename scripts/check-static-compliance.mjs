import { readFile } from 'node:fs/promises';

const template = await readFile('src/index.template.html', 'utf8');
const tunables = await readFile('src/config/tunables.ts', 'utf8');
const appName = tunables.match(/appName:\s*'([^']+)'/)?.[1];
const forbidden = /google[-_ ]analytics|gtag|sentry|segment|amplitude|mixpanel|hotjar|clarity/i;
const externalResource = /(?:src|href)=\s*["']https?:\/\//i;
const violations = [];

if (!appName || !template.includes('__APP_NAME__')) {
  violations.push('identity template is not connected to TUNABLES.identity.appName');
}

if (forbidden.test(template)) {
  violations.push('index template contains an analytics or crash-reporting reference');
}
if (externalResource.test(template)) {
  violations.push('index template contains a foreign resource URL');
}
if (/<script\b/i.test(template)) {
  violations.push('index template contains a startup script');
}

const generatedIndex = await readFile('.angular/generated/index.html', 'utf8').catch(() => null);
if (generatedIndex && appName) {
  for (const marker of [
    `<title>${appName}</title>`,
    `<meta name="application-name" content="${appName}">`,
    `<meta name="apple-mobile-web-app-title" content="${appName}">`,
  ]) {
    if (!generatedIndex.includes(marker)) {
      violations.push(`generated index is missing identity metadata: ${marker}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
