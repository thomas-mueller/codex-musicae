import { readFile } from 'node:fs/promises';

const template = await readFile('src/index.template.html', 'utf8');
const tunables = await readFile('src/config/tunables.ts', 'utf8');
const appName = tunables.match(/appName:\s*'([^']+)'/)?.[1];
const forbidden = /google[-_ ]analytics|gtag|sentry|segment|amplitude|mixpanel|hotjar|clarity/i;
const externalResource = /(?:src|href)=\s*["']https?:\/\//i;
// GEN-012, R-8a, R-8c: no analytics or crash-reporting package may be a dependency. Optional argument: a package.json (used by the lint self-test).
const reporting = /(^|\/)(@?sentry|bugsnag|rollbar|datadog|mixpanel|amplitude|posthog|segment|hotjar|matomo|appcenter|crashlytics|raygun|logrocket|fullstory|heap)|google-analytics|gtag|firebase[-/](analytics|crashlytics|performance)|capacitor-community\/(firebase-analytics|firebase-crashlytics)|clarity/i;
const manifest = JSON.parse(await readFile(process.argv[2] ?? 'package.json', 'utf8'));
const violations = [];
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })) {
  if (reporting.test(name)) violations.push(`package.json: ${name} is an analytics or crash-reporting package (GEN-012)`);
}

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
